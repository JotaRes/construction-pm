import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { uploadToCloudinary, resourceTypeFor } from '../lib/cloudinary'
import { parseAmountFlexible } from '../lib/parseAmount'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

const router  = Router()
const prisma  = new PrismaClient()

const EXCEL_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
])

const EXCEL_EXT_RE = /\.(xlsx|xlsm|xls|ods|csv)$/i

function isExcelFile(mimetype: string | undefined, filename: string | undefined): boolean {
  if (mimetype && EXCEL_MIMES.has(mimetype)) return true
  if (filename && EXCEL_EXT_RE.test(filename)) return true
  return false
}

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  // Excel / spreadsheet formats
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
]

// ── Use memory storage — files go straight to Cloudinary, never touch disk ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true)
    // Windows sometimes sends generic octet-stream for xlsx — allow it
    if (file.mimetype === 'application/octet-stream') return cb(null, true)
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Use PDF, JPG, PNG o Excel.`))
  },
})

// ── Auto-recalc saldoHoldback and UPB chain for all draws in a project ──
// saldoHoldback: project.holdback − cumulative netWire (always recomputed)
// UPB Pre/Post: for each draw, Pre = previous draw's Post; Post = Pre + netWire.
// We propagate forward starting from the first draw that has a real upbPre value
// (i.e. the user uploaded the lender's Excel with an actual UPB number) — that
// becomes the anchor and downstream draws are projected from it. Anchor itself
// is never overwritten; manually edited downstream values are also preserved if
// the user has explicitly set them away from the propagated value.
async function recalcHoldback(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { holdback: true } })
  const initialHoldback = project?.holdback ?? 0
  const draws = await prisma.draw.findMany({
    where: { projectId },
    orderBy: { drawNumber: 'asc' },
    select: { id: true, netWire: true, upbPre: true, upbPost: true },
  })

  let cumulative = 0
  let prevPost: number | null = null
  let pastAnchor = false // becomes true after we cross the first draw with a real upbPre

  for (const draw of draws) {
    cumulative += draw.netWire
    const saldo = Math.max(0, initialHoldback - cumulative)

    // UPB chain semantics:
    //   - The first draw with a non-zero upbPre is the ANCHOR (loaded from the
    //     lender's Excel). Its upbPre is preserved as-is; upbPost is recomputed
    //     as upbPre + netWire to keep them consistent.
    //   - Every draw AFTER the anchor is strictly chain-propagated: upbPre =
    //     previous draw's upbPost, upbPost = upbPre + netWire.
    //   - Every draw BEFORE the anchor (todavía sin anchor encontrado) se
    //     resetea explícitamente a upbPre=0, upbPost=netWire — esto evita que
    //     valores stale dejados al borrar un upstream draw se queden vivos.
    let nextUpbPre: number
    let nextUpbPost: number

    if (pastAnchor && prevPost !== null) {
      // Force-propagate from the previous post — overrides any stale value.
      nextUpbPre = prevPost
      nextUpbPost = nextUpbPre + draw.netWire
    } else if (!pastAnchor && draw.upbPre > 0) {
      // Anchor found — keep upbPre, recompute upbPost from it.
      pastAnchor = true
      nextUpbPre = draw.upbPre
      nextUpbPost = nextUpbPre + draw.netWire
    } else {
      // Pre-anchor o sin anchor en todo el set: reset explícito a 0.
      // Si el draw tenía netWire, igual su upbPost = netWire (puede ser el
      // primer draw real de un proyecto donde el HUD no se ha cargado).
      nextUpbPre = 0
      nextUpbPost = draw.netWire
    }

    await prisma.draw.update({
      where: { id: draw.id },
      data: { saldoHoldback: saldo, upbPre: nextUpbPre, upbPost: nextUpbPost },
    })

    prevPost = nextUpbPost
  }
}

// ── Trinity draw PDF: line-by-line budget approval extractor ────────────────
// Trinity's draw report lists every budget item with three running totals:
//   - priorAmount             = amount approved in previous draws (cumulative)
//   - thisInspectionPct       = % approved IN THIS DRAW only (the delta)
//   - currentAmountAvailable  = priorAmount + thisDraw approvals (new cumulative)
// We expose all three so the caller can show per-draw deltas and the new
// running total without re-processing already-approved items.
export interface DrawLineApproval {
  itemCode: string
  description: string
  priorAmount: number
  thisInspectionPct: number
  currentAmountAvailable: number
  /** currentAmountAvailable - priorAmount — money approved ONLY in this draw. */
  deltaThisDraw: number
}

// Trinity tiene DOS formatos de Draw Report — el parser soporta ambos.
//
// Formato A (legacy, con itemCode N.N):
//   "21.1 Survey0.64%$3,000.00$0.000%$0.00100%$3,000.00"
//   line# + itemCode + desc + line% + $req + $prior + prior% + $eligible + this% + $current
//
// Formato B (actual 2026, con "Eligible to Fund This Inspection" extra y sin itemCode):
//   "2Survey0.53%$2,432.00$0.005%$121.60100%$2,432.00"
//   line# + desc + line% + $req + $prior + prior% + $eligibleToFund + this% + $current
//
// En B el itemCode no viene en el PDF — se resuelve por match de descripción
// contra el budget en applyDrawApprovalsToBudget(). Devolvemos itemCode vacío
// para que el matcher use la descripción.
const TRINITY_ITEM_RE_A = /^\d{1,3}(\d+\.\d+[A-Za-z]?)\s+(.+?)(\d+\.?\d*)%\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})(\d+(?:\.\d+)?)%\$([\d,]+\.\d{2})(\d+(?:\.\d+)?)%\$([\d,]+\.\d{2})$/
const TRINITY_ITEM_RE_B = /^\d{1,3}([A-Za-z][^%]*?)(\d+\.?\d*)%\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})(\d+(?:\.\d+)?)%\$([\d,]+\.\d{2})(\d+(?:\.\d+)?)%\$([\d,]+\.\d{2})$/

export function parseTrinityDrawApprovals(text: string): DrawLineApproval[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\x00/g, '')
  const out: DrawLineApproval[] = []
  for (const ln of normalized.split('\n')) {
    const trimmed = ln.trim()
    if (!trimmed) continue

    // Probar formato A primero (más estricto: tiene itemCode N.N)
    let m = trimmed.match(TRINITY_ITEM_RE_A)
    if (m) {
      const priorAmount = parseFloat(m[5].replace(/,/g, ''))
      const currentAmountAvailable = parseFloat(m[9].replace(/,/g, ''))
      out.push({
        itemCode: m[1],
        description: m[2].trim(),
        priorAmount,
        thisInspectionPct: parseFloat(m[8]),
        currentAmountAvailable,
        deltaThisDraw: Math.max(0, currentAmountAvailable - priorAmount),
      })
      continue
    }

    // Formato B: sin itemCode, line# pegado a descripción.
    // Columnas: lineNum + desc + lineP% + $req + $prior + priorP% + $eligibleThis + thisP% + $current
    m = trimmed.match(TRINITY_ITEM_RE_B)
    if (m) {
      const description = m[1].trim()
      const priorAmount = parseFloat(m[4].replace(/,/g, ''))
      const eligibleThisInspection = parseFloat(m[6].replace(/,/g, ''))
      const currentAmountAvailable = parseFloat(m[8].replace(/,/g, ''))
      out.push({
        itemCode: '', // resuelto en applyDrawApprovalsToBudget por descripción
        description,
        priorAmount,
        thisInspectionPct: parseFloat(m[7]),
        currentAmountAvailable,
        // Formato B trae el valor directo de "Eligible to Fund This Inspection".
        // Sólo cuenta como delta si Trinity efectivamente aprobó dinero en este draw
        // (eligible > 0 Y current > prior — evita falsos positivos de headers).
        deltaThisDraw: (eligibleThisInspection > 0 && currentAmountAvailable > priorAmount)
          ? eligibleThisInspection
          : 0,
      })
    }
  }
  return out
}

// Normaliza descripción para matching robusto:
//   - lowercase, trim
//   - remueve guiones iniciales ("- Lumber" → "Lumber")
//   - colapsa whitespace
//   - elimina caracteres no alfanuméricos al final ("Survey  " → "survey")
function normalizeItemDescription(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^[-–—\s]+/, '')   // strip leading dashes used as bullets
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '') // strip punctuation that varies between sources
    .trim()
}

// Recalcula valorAprobado de las líneas indicadas sumando todas sus contribuciones
// activas (= contribuciones cuyo Draw aún existe). Es la operación inversa que
// hace coherente el budget cuando se borra un draw o su APPROVAL pdf.
export async function recomputeBudgetLinesFromContributions(budgetLineIds: string[]) {
  if (budgetLineIds.length === 0) return
  const unique = Array.from(new Set(budgetLineIds))
  const groups = await prisma.drawLineContribution.groupBy({
    by: ['budgetLineId'],
    where: { budgetLineId: { in: unique } },
    _sum: { deltaAmount: true },
  })
  const totalsByLine = new Map<string, number>()
  for (const g of groups) totalsByLine.set(g.budgetLineId, g._sum.deltaAmount ?? 0)
  // Líneas sin ninguna contribución viva quedan en 0 — su draw fue borrado.
  await Promise.all(
    unique.map(id =>
      prisma.budgetLine.update({
        where: { id },
        data: { valorAprobado: totalsByLine.get(id) ?? 0 },
      })
    )
  )
}

// Apply parsed approvals to the project's BudgetLines — IDEMPOTENT y TRAZABLE.
// Cada draw guarda sus contribuciones (DrawLineContribution) por línea. Re-aplicar
// el mismo PDF reemplaza las contribuciones previas del draw — nunca duplica.
// Al borrar el draw (o su APPROVAL), las contribuciones desaparecen por cascade
// y recomputeBudgetLinesFromContributions deja el valorAprobado coherente.
//
// Devuelve cuatro contadores para que la UI los muestre al usuario:
//   - matched              = items del PDF con línea de budget existente
//   - newlyApprovedItems   = líneas donde este draw aportó >0
//   - newlyApprovedAmount  = $ aportado por este draw (suma de deltas)
//   - cumulativeApproved   = total valorAprobado del proyecto después de aplicar
export async function applyDrawApprovalsToBudget(
  projectId: string,
  drawId: string,
  approvals: DrawLineApproval[],
): Promise<{
  matched: number
  newlyApprovedItems: number
  newlyApprovedAmount: number
  cumulativeApproved: number
  unmatched: string[]
}> {
  // Borra contribuciones anteriores de este draw — re-aplicar el mismo PDF
  // siempre arranca de cero para este draw (los demás draws se respetan).
  const priorContribs = await prisma.drawLineContribution.findMany({
    where: { drawId }, select: { budgetLineId: true },
  })
  const touchedFromPrior = priorContribs.map(c => c.budgetLineId)
  if (priorContribs.length > 0) {
    await prisma.drawLineContribution.deleteMany({ where: { drawId } })
  }

  if (!approvals.length) {
    await recomputeBudgetLinesFromContributions(touchedFromPrior)
    const lines = await prisma.budgetLine.findMany({ where: { projectId }, select: { valorAprobado: true } })
    return {
      matched: 0,
      newlyApprovedItems: 0,
      newlyApprovedAmount: 0,
      cumulativeApproved: lines.reduce((s, l) => s + l.valorAprobado, 0),
      unmatched: [],
    }
  }

  const lines = await prisma.budgetLine.findMany({ where: { projectId } })
  const byCode = new Map<string, (typeof lines)[number]>()
  const byDesc = new Map<string, (typeof lines)[number]>()
  for (const l of lines) {
    if (l.itemCode) byCode.set(l.itemCode, l)
    const norm = normalizeItemDescription(l.description)
    if (norm) byDesc.set(norm, l)
  }

  let matched = 0
  let newlyApprovedItems = 0
  let newlyApprovedAmount = 0
  const unmatched: string[] = []
  const touched = new Set<string>(touchedFromPrior)
  const usedLineIds = new Set<string>()

  for (const a of approvals) {
    // 1) Match por itemCode si viene en el PDF (formato A legacy)
    let line = a.itemCode ? byCode.get(a.itemCode) : undefined
    // 2) Fallback: match por descripción normalizada (formato B 2026)
    if (!line) {
      const norm = normalizeItemDescription(a.description)
      const candidate = norm ? byDesc.get(norm) : undefined
      if (candidate && !usedLineIds.has(candidate.id)) line = candidate
    }
    if (!line) { unmatched.push(a.itemCode || a.description); continue }
    usedLineIds.add(line.id)
    matched++
    if (a.deltaThisDraw <= 0.005) continue
    await prisma.drawLineContribution.create({
      data: {
        drawId,
        budgetLineId: line.id,
        itemCode: line.itemCode,
        deltaAmount: a.deltaThisDraw,
      },
    })
    touched.add(line.id)
    newlyApprovedItems++
    newlyApprovedAmount += a.deltaThisDraw
  }

  await recomputeBudgetLinesFromContributions(Array.from(touched))
  const final = await prisma.budgetLine.findMany({ where: { projectId }, select: { valorAprobado: true } })
  const cumulativeApproved = final.reduce((s, l) => s + l.valorAprobado, 0)
  return { matched, newlyApprovedItems, newlyApprovedAmount, cumulativeApproved, unmatched }
}

// Recalcula valorAprobado de TODAS las líneas del proyecto desde sus contribuciones.
// Necesario para sanear datos legacy (líneas con valorAprobado heredado de antes
// de que existiera DrawLineContribution) y para garantizar que borrar un draw
// limpie incluso aprobaciones que nunca tuvieron contribución registrada.
export async function recomputeProjectBudgetFromContributions(projectId: string) {
  const lines = await prisma.budgetLine.findMany({
    where: { projectId }, select: { id: true },
  })
  await recomputeBudgetLinesFromContributions(lines.map(l => l.id))
}

// Limpia todas las contribuciones de un draw y recalcula las líneas de budget
// afectadas. Se llama al borrar el draw o su APPROVAL pdf.
export async function clearDrawContributions(drawId: string) {
  const contribs = await prisma.drawLineContribution.findMany({
    where: { drawId }, select: { budgetLineId: true },
  })
  if (contribs.length === 0) return
  const lineIds = contribs.map(c => c.budgetLineId)
  await prisma.drawLineContribution.deleteMany({ where: { drawId } })
  await recomputeBudgetLinesFromContributions(lineIds)
}

// Wrapper que mantiene la firma original pero usa el helper compartido
// que soporta formato US ($45,200.00) y europeo ($45.200,00).
function parseMoney(str: string): number {
  return parseAmountFlexible(str)
}

function normalizeDate(str: string): string | null {
  if (!str) return null
  const clean = str.trim().split(/\s/)[0]
  const parts = clean.split(/[\/\-]/)
  if (parts.length === 3) {
    const [m, d, y] = parts
    const year = y.length === 2 ? `20${y}` : y
    const dt = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    if (!isNaN(dt.getTime())) return dt.toISOString()
  }
  return null
}

function parseDrawText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const t = text.replace(/\n/g, ' ')
  const drawNum = t.match(/Draw\s*(?:#|No\.?)?\s*(\d+)/i)
  if (drawNum) result.drawNumber = parseInt(drawNum[1])
  const dp = '(\\d{1,2}/\\d{1,2}/\\d{4})'
  const sep = '[:\\s]*'
  const ordered = t.match(new RegExp(`Date\\s*Ordered${sep}${dp}`, 'i'))
  if (ordered) result.fechaSolicitud = normalizeDate(ordered[1])
  const inspected = t.match(new RegExp(`Date\\s*Inspected${sep}${dp}`, 'i'))
  if (inspected) result.fechaInspeccion = normalizeDate(inspected[1])
  const completed = t.match(new RegExp(`Date\\s*Completed${sep}${dp}`, 'i'))
  if (completed) result.fechaWire = normalizeDate(completed[1])
  const dp2 = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})'
  if (!result.fechaSolicitud) {
    const r = t.match(new RegExp(`(?:request(?:ed)?|submit(?:ted)?|date\\s*of\\s*request)\\s*(?:date)?\\s*:?\\s*${dp2}`, 'i'))
    if (r) result.fechaSolicitud = normalizeDate(r[1])
  }
  if (!result.fechaInspeccion) {
    const r = t.match(new RegExp(`inspect(?:ion)?\\s*(?:date)?\\s*:?\\s*${dp2}`, 'i'))
    if (r) result.fechaInspeccion = normalizeDate(r[1])
  }
  if (!result.fechaWire) {
    const r = t.match(new RegExp(`wire(?:d)?\\s*(?:date)?\\s*:?\\s*${dp2}`, 'i'))
    if (r) result.fechaWire = normalizeDate(r[1])
  }
  const totalRowCandidates = [
    t.match(/TOTAL\s+DIRECT\s+COSTS[^©\n]*/i)?.[0],
    t.match(/TOTAL\s+ALL\s+COSTS[^©\n]*/i)?.[0],
    t.match(/GRAND\s+TOTAL[^©\n]*/i)?.[0],
    t.match(/TOTALS?[^©\n]{0,30}COSTS?[^©\n]*/i)?.[0],
  ]
  const totalRowStr = totalRowCandidates.find(s => s && s.length > 10) ?? ''
  if (totalRowStr) {
    // Pares en la fila TOTAL del PDF Trinity (siempre 3):
    //   [0] LineP% / $TotalBudget (siempre 100% del construction budget)
    //   [1] PriorP% / $Eligible-to-Fund-This-Inspection (o $0 si primer draw)
    //   [2] ThisP% / $CurrentAmountAvailable (acumulado total del proyecto)
    // El "monto de este draw" es [1] cuando prior > 0, sino [2] (primer draw).
    // No confundir con LotsCumulative — para "monto solicitado del draw" usar
    // la columna "Eligible to Fund THIS Inspection".
    const pairs = [...totalRowStr.matchAll(/(\d+\.\d{2})\s*%\s*\$\s*([\d,]+\.\d{2})/g)]
    if (pairs.length >= 3) {
      const middleAmount = parseMoney(pairs[1][2])
      const lastAmount   = parseMoney(pairs[pairs.length - 1][2])
      // Si middle > 0, es el monto de este draw (formato B con priors).
      // Si middle = 0, primer draw legacy → el último par es el monto.
      const thisDrawAmount = middleAmount > 0 ? middleAmount : lastAmount
      const cumulativePct  = parseFloat(pairs[pairs.length - 1][1]) / 100
      result.elegibleTrinity  = thisDrawAmount
      result.montoSolicitado  = thisDrawAmount
      result.porcentajeFunded = cumulativePct
    } else if (pairs.length > 0) {
      const last = pairs[pairs.length - 1]
      result.elegibleTrinity  = parseMoney(last[2])
      result.montoSolicitado  = parseMoney(last[2])
      result.porcentajeFunded = parseFloat(last[1]) / 100
    }
  }
  const mp = '\\$?([\\d,]+\\.?\\d*)'
  if (!result.montoSolicitado) {
    const r = t.match(new RegExp(`(?:amount\\s*requested|total\\s*requested|requested\\s*amount)\\s*:?\\s*${mp}`, 'i'))
    if (r) result.montoSolicitado = parseMoney(r[1])
  }
  if (!result.elegibleTrinity) {
    const r = t.match(new RegExp(`(?:eligible|trinity\\s*eligible|approved\\s*amount|amount\\s*eligible)\\s*:?\\s*${mp}`, 'i'))
    if (r) result.elegibleTrinity = parseMoney(r[1])
  }
  if (!result.netWire) {
    const r = t.match(new RegExp(`(?:net\\s*wire|wire\\s*amount|amount\\s*wired|net\\s*amount)\\s*:?\\s*${mp}`, 'i'))
    if (r) result.netWire = parseMoney(r[1])
  }
  if (!result.porcentajeFunded) {
    const r = t.match(/(?:percent(?:age)?\s*funded|funded\s*%)\s*:?\s*(\d+\.?\d*)/i)
    if (r) result.porcentajeFunded = parseFloat(r[1]) / 100
  }
  return result
}

// ── Excel parser for lender draw spreadsheets ───────────────────────────────
// Lender exports vary in shape. We try three strategies and merge results,
// with later strategies overriding earlier ones (more specific wins):
//   1. Flatten the whole workbook to text and run the PDF regex parser.
//   2. Label/value scan — "Amount Requested" | $45,200 in adjacent cells.
//   3. Tabular detector — section row (Pre-Draw/Post-Draw merged labels) +
//      header row + data row. Trinity uses this layout.
function flattenSheetToText(sheet: XLSX.WorkSheet): string {
  if (!sheet['!ref']) return ''
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const lines: string[] = []
  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowParts: string[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = sheet[addr]
      if (!cell) continue
      const v = cell.w ?? cell.v
      if (v !== undefined && v !== null && v !== '') rowParts.push(String(v))
    }
    if (rowParts.length) lines.push(rowParts.join(' '))
  }
  return lines.join('\n')
}

function cellToNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v instanceof Date) return null
  const s = String(v).replace(/[\$\s]/g, '').trim()
  if (!s) return null
  // Reject anything that looks like a date (mm/dd/yyyy or mm-dd-yyyy)
  if (/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(s)) return null
  // Must look like a number: digits with optional decimal/thousands separators and optional %/parentheses
  if (!/^-?\(?\d[\d.,]*\)?\s*%?$/.test(s)) return null
  let pct = false
  let cleaned = s
  if (cleaned.endsWith('%')) { pct = true; cleaned = cleaned.slice(0, -1) }
  const n = parseAmountFlexible(cleaned)
  if (!Number.isFinite(n)) return null
  return pct ? n / 100 : n
}

function cellToDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) {
    const t = v.getTime()
    if (Number.isFinite(t)) return new Date(t).toISOString()
    return null
  }
  if (typeof v === 'string') return normalizeDate(v)
  return null
}

// Map a single header label + section qualifier ("pre" | "post" | null) to a
// draw field. Returns null if the label isn't recognized. Centralized so the
// tabular detector and the label/value scanner stay consistent.
function mapHeaderToField(label: string, section: string | null): string | null {
  const l = label.toLowerCase().trim()
  if (/^\s*draw\s*(#|number|no\.?)\s*$/i.test(l)) return 'drawNumber'
  if (/draw\s*amount|amount\s*requested|total\s*requested|requested\s*amount|monto\s*solicit|solicitado/i.test(l)) return 'montoSolicitado'
  if (/eligible|trinity\s*eligible|approved\s*amount|amount\s*eligible|elegible/i.test(l)) return 'elegibleTrinity'
  if (/net\s*wire|wire\s*amount|amount\s*wired|net\s*amount/i.test(l)) return 'netWire'
  if (/percent(age)?\s*(funded|complete)|%\s*(funded|complete)|funded\s*%|complete\s*%|%\s*financiad/i.test(l)) return 'porcentajeFunded'
  // "Refurb Loan Amount" — the project-level holdback (total construction reserve)
  // BEFORE any draw was disbursed. Trinity prints it in the Pre-Draw section.
  if (/refurb\s*loan\s*amount|construction\s*holdback\s*total|holdback\s*total/i.test(l)) return 'projectHoldback'
  // Trinity calls remaining undrawn refurb funds "Refurb Balance" or "Refurb Loan Balance"
  // (Post-Draw column). The "Pre-Draw / Refurb Loan Balance" is the starting balance — we
  // treat both as the holdback balance, with Post winning since it's the after-draw state.
  if (/refurb\s*(loan\s*)?balance|holdback\s*balance|saldo\s*holdback|remaining\s*holdback|holdback\s*remaining/i.test(l)) return 'saldoHoldback'
  if (/^upb$|unpaid\s*principal\s*balance|principal\s*balance/i.test(l)) {
    if (section === 'pre') return 'upbPre'
    if (section === 'post') return 'upbPost'
    return null
  }
  if (/upb\s*pre|principal\s*before|beginning\s*principal|prior\s*balance/i.test(l)) return 'upbPre'
  if (/upb\s*post|principal\s*after|ending\s*principal|new\s*balance|current\s*balance/i.test(l)) return 'upbPost'
  if (/date\s*ordered|date\s*requested|request\s*date|submission\s*date|fecha\s*solicit/i.test(l)) return 'fechaSolicitud'
  if (/date\s*inspected|inspection\s*date|fecha\s*inspecc/i.test(l)) return 'fechaInspeccion'
  if (/date\s*completed|wire\s*date|date\s*wired|fecha\s*wire|funded\s*date|disburs(ed|ement)\s*date/i.test(l)) return 'fechaWire'
  return null
}

function setField(out: Record<string, unknown>, field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return
  if (field === 'porcentajeFunded' && typeof value === 'number') {
    out[field] = value > 1 ? value / 100 : value
    return
  }
  if (field === 'drawNumber' && typeof value === 'number') {
    out[field] = Math.round(value)
    return
  }
  // Don't overwrite an already-set field unless it's saldoHoldback (Post wins over Pre).
  if (out[field] !== undefined && field !== 'saldoHoldback') return
  out[field] = value
}

// Tabular detector for lender Excels like Trinity's:
// Section row (optional, with "Pre-Draw" / "Post Draw" merged labels)
// Header row (column names)
// Data row(s) (one row per draw)
function parseDrawExcelTabular(sheet: XLSX.WorkSheet): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!sheet['!ref']) return out

  const range = XLSX.utils.decode_range(sheet['!ref'])
  // Clamp range — some files (like Trinity's) set !ref to A1:Y1000 but only
  // populate the first ~10 rows. Use !merges and cell presence to find real end.
  const realRows: unknown[][] = []
  const lastRowChecked = Math.min(range.e.r, 50) // safety cap
  for (let r = range.s.r; r <= lastRowChecked; r++) {
    const row: unknown[] = []
    let hasContent = false
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      const v = cell ? (cell.v !== undefined ? cell.v : null) : null
      row.push(v)
      if (v !== null && v !== undefined && v !== '') hasContent = true
    }
    realRows.push(hasContent ? row : [])
  }

  // Find header row: a row with >= 4 string cells, followed by a row with >= 2 numeric cells.
  let headerIdx = -1
  for (let i = 0; i < realRows.length - 1; i++) {
    const headerRow = realRows[i]
    const dataRow   = realRows[i + 1]
    if (!headerRow.length || !dataRow.length) continue
    const textCount = headerRow.filter(v => typeof v === 'string' && v.trim().length > 1).length
    const numCount  = dataRow.filter(v => typeof v === 'number' && Number.isFinite(v)).length
    if (textCount >= 4 && numCount >= 2) { headerIdx = i; break }
  }
  if (headerIdx === -1) return out

  const headerRow = realRows[headerIdx]
  const dataRow   = realRows[headerIdx + 1]
  // Section row is the closest row above the header that contains "Pre"/"Post" markers.
  let sectionRow: unknown[] | null = null
  for (let i = headerIdx - 1; i >= 0 && i >= headerIdx - 3; i--) {
    const candidate = realRows[i]
    const hasSection = candidate.some(v => typeof v === 'string' && /pre[-\s]?draw|post[-\s]?draw|pre\s*draw|post\s*draw/i.test(v))
    if (hasSection) { sectionRow = candidate; break }
  }

  // For each header column, determine section by scanning leftward in sectionRow.
  for (let c = 0; c < headerRow.length; c++) {
    const label = headerRow[c]
    if (typeof label !== 'string' || !label.trim()) continue

    let section: string | null = null
    if (sectionRow) {
      for (let cc = c; cc >= 0; cc--) {
        const sv = sectionRow[cc]
        if (typeof sv === 'string' && sv.trim()) {
          if (/post/i.test(sv)) section = 'post'
          else if (/pre/i.test(sv)) section = 'pre'
          break
        }
      }
    }

    const field = mapHeaderToField(label, section)
    if (!field) continue

    const value = dataRow[c]
    if (field === 'fechaSolicitud' || field === 'fechaInspeccion' || field === 'fechaWire') {
      const d = cellToDate(value)
      if (d) setField(out, field, d)
    } else {
      const n = cellToNumber(value)
      if (n !== null) setField(out, field, n)
    }
  }

  return out
}

export function parseDrawExcel(buffer: Buffer): { parsed: Record<string, unknown>; preview: string } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  // 1) Flatten every sheet → run existing regex parser as a baseline.
  let allText = ''
  for (const sheetName of workbook.SheetNames) {
    allText += `\n=== ${sheetName} ===\n` + flattenSheetToText(workbook.Sheets[sheetName])
  }
  const textResult = parseDrawText(allText)

  // 2) Tabular detection (Trinity-style: section row + header row + data row).
  const tabularResult: Record<string, unknown> = {}
  for (const sheetName of workbook.SheetNames) {
    const partial = parseDrawExcelTabular(workbook.Sheets[sheetName])
    for (const [k, v] of Object.entries(partial)) setField(tabularResult, k, v)
  }

  // 3) Cell-by-cell label/value scan — covers "Label | Value" layouts where the
  //    value sits in the adjacent right or below cell.
  const cellResult: Record<string, unknown> = {}
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet['!ref']) continue
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || []
      for (let c = 0; c < row.length; c++) {
        const raw = row[c]
        const cellText = raw === null || raw === undefined ? '' : String(raw).trim()
        if (!cellText) continue

        const next  = row[c + 1]
        const below = rows[r + 1]?.[c]

        // Inline drawNumber ("Draw #5")
        if (cellResult.drawNumber === undefined) {
          const inline = cellText.match(/draw\s*#?\s*(\d+)/i)
          if (inline) cellResult.drawNumber = parseInt(inline[1])
        }

        const field = mapHeaderToField(cellText, null)
        if (!field || cellResult[field] !== undefined) continue

        if (field === 'fechaSolicitud' || field === 'fechaInspeccion' || field === 'fechaWire') {
          const d = cellToDate(next) ?? cellToDate(below)
          if (d) setField(cellResult, field, d)
        } else {
          const n = cellToNumber(next) ?? cellToNumber(below)
          if (n !== null) setField(cellResult, field, n)
        }
      }
    }
  }

  // Merge priority: tabular > cell-scan > flattened-text regex.
  const parsed: Record<string, unknown> = { ...textResult }
  for (const [k, v] of Object.entries(cellResult))    { if (v !== undefined && v !== null && v !== '') parsed[k] = v }
  for (const [k, v] of Object.entries(tabularResult)) { if (v !== undefined && v !== null && v !== '') parsed[k] = v }

  return { parsed, preview: allText.slice(0, 1500) }
}

function parseHUDText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  // U+0000 null bytes are a PDF font-ligature artifact ("tt" → null byte in this font family).
  // Must replace with space BEFORE other normalization so \s patterns work.
  const t = text
    .replace(/\x00/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/se\s+lement/gi, 'settlement')
    .replace(/transac\s+on/gi, 'transaction')
    .replace(/informa\s+on/gi, 'information')

  const mp = '\\$?([\\d,]+\\.?\\d*)'
  const dp = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})'

  // Settlement date — "I. Settlement Date: 01/26/2026" (HUD-1) or "Closing Date:" (CD)
  const settleDate =
    t.match(new RegExp(`(?:settlement|closing)\\s*date\\s*:?\\s*${dp}`, 'i')) ??
    t.match(new RegExp(`date\\s*of\\s*(?:settlement|closing)\\s*:?\\s*${dp}`, 'i')) ??
    t.match(new RegExp(`date\\s*issued\\s*:?\\s*${dp}`, 'i'))
  if (settleDate) result.settlementDate = normalizeDate(settleDate[1])

  // ── Contract sales price — HUD-1 line 101 ────────────────────────────────
  // The amount MUST appear before the next numbered line (102.) on the same row,
  // otherwise line 101 was left blank (e.g. refinance HUD with no sale) and we
  // were previously capturing "102" from "102. Personal property" as the price.
  // Anchor on the `$` to guarantee we matched a real dollar amount.
  const salesPrice =
    t.match(/\b101\.\s*contract\s*sales?\s*price\s*\$([\d,]+\.\d{2})/i) ??
    t.match(/contract\s*sales?\s*price[^$\n]{0,40}\$([\d,]+\.\d{2})/i) ??
    t.match(/(?:purchase|sale)\s*price[^$\n]{0,40}\$([\d,]+\.\d{2})/i)
  if (salesPrice) result.contractSalesPrice = parseMoney(salesPrice[1])

  // ── Cash at settlement — HUD-1 line 303 ──────────────────────────────────
  const cash =
    t.match(/\b303\.\s*cash[^$\n]{0,40}\$([\d,]+\.\d{2})/i) ??
    t.match(/cash\s*(?:at|to|from)?\s*(?:close|settlement|borrower)[^$\n]{0,30}\$([\d,]+\.\d{2})/i) ??
    t.match(/cash\s*to\s*close[^$\n]{0,30}\$([\d,]+\.\d{2})/i)
  if (cash) result.cashAtSettlement = parseMoney(cash[1])

  // ── Settlement charges — HUD-1 line 103 / 1400 ──────────────────────────
  const closing =
    t.match(/\b103\.\s*settlement\s+charges?\s+to\s+borrower[^$]*\$([\d,]+\.?\d*)/i) ??
    t.match(/\b1400\.\s*total\s+settlement\s+charges?[^$]*\$([\d,]+\.?\d*)/i) ??
    t.match(new RegExp(`(?:total\\s*)?closing\\s*costs?\\s*(?:\\([A-Z]\\)\\s*)?:?\\s*${mp}`, 'i'))
  if (closing) result.closingCosts = parseMoney(closing[1])

  // ── Loan amount — HUD-1 line 202 ("Principal amount of new loan(s)$402,350")
  //    or "Loan amount" / "Principal amount" elsewhere. Anchor on `$` to avoid
  //    capturing line numbers when the field is blank. Reject < $1,000 to skip
  //    fees and line-charge fragments that look syntactically similar.
  const loanAmt =
    t.match(/\b202\.\s*principal\s+amount\s+of\s+new\s+loan[^$]*\$([\d,]+\.?\d*)/i) ??
    t.match(/principal\s+amount\s+of\s+new\s+loan[^$\n]{0,40}\$([\d,]+\.\d{2})/i) ??
    t.match(/\bloan\s*amount[^$\n]{0,30}\$([\d,]+\.\d{2})/i) ??
    t.match(/principal\s+amount[^$\n]{0,30}\$([\d,]+\.\d{2})/i)
  if (loanAmt) {
    const v = parseMoney(loanAmt[1])
    if (v >= 1000) result.loanAmount = v
  }

  // ── Holdback / remaining construction funds — HUD-1 line 109 ────────────
  //    "109. Remaining construction funds$395,350.00" or similar wording.
  const holdback =
    t.match(/\b109\.\s*remaining\s+construc(?:tion|\s*on)\s+funds[^$]*\$([\d,]+\.\d{2})/i) ??
    t.match(/remaining\s+construc(?:tion|\s*on)\s+funds[^$\n]{0,30}\$([\d,]+\.\d{2})/i) ??
    t.match(/(?:construction\s+)?holdback[^$\n]{0,30}\$([\d,]+\.\d{2})/i)
  if (holdback) {
    const v = parseMoney(holdback[1])
    if (v >= 1000) result.holdback = v
  }

  // ── Interest rate (rarely on HUD; usually on Closing Disclosure) ────────
  const rate = t.match(/interest\s*rate\s*:?\s*(\d+\.?\d*)\s*%/i)
  if (rate) result.interestRate = parseFloat(rate[1]) / 100

  // ── Loan term ───────────────────────────────────────────────────────────
  const term = t.match(/loan\s*term\s*:?\s*(\d+)\s*(?:months?|mo\.?|years?|yr\.?)/i)
  if (term) {
    const n = parseInt(term[1])
    result.loanTermMonths = term[0].toLowerCase().includes('year') ? n * 12 : n
  }

  return result
}

function parseLoanText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const t = text.replace(/\n/g, ' ')
  const mp = '\\$?([\\d,]+\\.?\\d*)'
  const dp = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})'
  const lenderMatch = t.match(/(?:lender|mortgagee|bank)\s*(?:name)?\s*:?\s*([A-Za-z][A-Za-z0-9\s,\.&]+?)(?=\s{2,}|\s*\n|,|\.|LLC|Inc|Corp|Holdings)/i)
  if (lenderMatch) result.lender = lenderMatch[1].trim()
  const loanNum = t.match(/(?:loan\s*(?:number|#|no\.?|num)|commitment\s*(?:number|#|no\.?))\s*:?\s*([A-Z0-9\-]+)/i)
  if (loanNum) result.loanNumber = loanNum[1].trim()
  const loanAmt = t.match(new RegExp(`(?:loan|principal|commitment|face|construction)\\s*(?:loan\\s*)?amount\\s*:?\\s*${mp}`, 'i'))
  if (loanAmt) result.loanAmount = parseMoney(loanAmt[1])
  const rate = t.match(/interest\s*rate\s*:?\s*(\d+\.?\d*)\s*%/i)
  if (rate) result.interestRate = parseFloat(rate[1]) / 100
  const term = t.match(/(?:loan\s*)?term\s*:?\s*(\d+)\s*(?:months?|mo\.?)/i)
  if (term) result.loanTermMonths = parseInt(term[1])
  const holdback = t.match(new RegExp(`(?:holdback|retainage|held\\s*back|construction\\s*holdback)\\s*:?\\s*${mp}`, 'i'))
  if (holdback) result.holdback = parseMoney(holdback[1])
  const day1 = t.match(new RegExp(`(?:initial\\s*disbursement|day\\s*1|at\\s*closing|initial\\s*advance|first\\s*draw)\\s*:?\\s*${mp}`, 'i'))
  if (day1) result.day1Disbursement = parseMoney(day1[1])
  const reserve = t.match(new RegExp(`interest\\s*reserve\\s*:?\\s*${mp}`, 'i'))
  if (reserve) result.interestReserve = parseMoney(reserve[1])
  const closingDate = t.match(new RegExp(`(?:commitment|closing|settlement)\\s*date\\s*:?\\s*${dp}`, 'i'))
  if (closingDate) result.settlementDate = normalizeDate(closingDate[1])
  return result
}

function parseSurveyText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const t = text.replace(/\n/g, ' ')
  const parcel = t.match(/(?:parcel\s*(?:id|number|#|no\.?)|tax\s*(?:id|map|parcel|pin))\s*:?\s*([A-Z0-9\-\.]+)/i)
  if (parcel) result.parcelId = parcel[1].trim()
  const acres = t.match(/(\d+\.?\d*)\s*(?:acres?|ac\.?)\b/i)
  if (acres) result.lotAcres = parseFloat(acres[1])
  const addr = t.match(/(?:property\s*(?:address|location|described\s*as)|located\s*at|premises)\s*:?\s*(\d+[^,\n]{5,60})/i)
  if (addr) result.address = addr[1].trim()
  const countyMatch = t.match(/([A-Za-z]+)\s+county/i)
  if (countyMatch) result.county = countyMatch[1]
  return result
}

function parsePlansText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const t = text.replace(/\n/g, ' ')
  const heated = t.match(/(?:heated|conditioned|living|habitable)\s*(?:area|square\s*feet|sf|sqft|sq\.?\s*ft\.?)\s*:?\s*([\d,]+)/i)
  if (heated) result.sfHeated = parseInt(heated[1].replace(/,/g, ''))
  const garage = t.match(/(?:garage|attached\s*garage)\s*(?:area|sf|sqft|sq\.?\s*ft\.?)?\s*:?\s*([\d,]+)/i)
  if (garage) result.sfGarage = parseInt(garage[1].replace(/,/g, ''))
  const porch = t.match(/(?:porch|deck|covered\s*porch|screened)\s*(?:area|sf|sqft|sq\.?\s*ft\.?)?\s*:?\s*([\d,]+)/i)
  if (porch) result.sfPorches = parseInt(porch[1].replace(/,/g, ''))
  const beds = t.match(/(\d+)\s*(?:bedroom|bed\s*room|br)s?\b/i)
  if (beds) result.bedrooms = parseInt(beds[1])
  const baths = t.match(/(\d+(?:\.\d)?)\s*(?:bathroom|bath\s*room|ba)s?\b/i)
  if (baths) result.bathrooms = baths[1]
  const found = t.match(/foundation\s*(?:type|system)?\s*:?\s*(slab|crawl\s*space|basement|pier)/i)
  if (found) result.foundationType = found[1].trim()
  return result
}

function parsePermitText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const t = text.replace(/\n/g, ' ')
  const dp = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})'
  const permitNum = t.match(/permit\s*(?:number|#|no\.?|num)\s*:?\s*([A-Z0-9\-]+)/i)
  if (permitNum) result.permitNumber = permitNum[1].trim()
  const issued = t.match(new RegExp(`(?:issue[d]?\\s*date|date\\s*issued|permit\\s*date|approved)\\s*:?\\s*${dp}`, 'i'))
  if (issued) result.permitIssued = normalizeDate(issued[1])
  const expires = t.match(new RegExp(`(?:expir(?:es?|ation)\\s*date|valid\\s*(?:through|until|to)|expiration)\\s*:?\\s*${dp}`, 'i'))
  if (expires) result.permitExpires = normalizeDate(expires[1])
  const countyMatch = t.match(/([A-Za-z]+)\s+county/i)
  if (countyMatch) result.county = countyMatch[1]
  return result
}

function parseLOIText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const t = text.replace(/\n/g, ' ')
  const mp = '\\$?([\\d,]+\\.?\\d*)'
  const dp = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})'
  // Precio ofertado
  const salePrice =
    t.match(new RegExp(`(?:offer\\s*price|purchase\\s*price|sales?\\s*price|amount\\s*offered)\\s*:?\\s*${mp}`, 'i')) ??
    t.match(new RegExp(`(?:total\\s*consideration|contract\\s*amount)\\s*:?\\s*${mp}`, 'i'))
  if (salePrice) result.loiSalePrice = parseMoney(salePrice[1])
  // Fecha de oferta
  const offerDate =
    t.match(new RegExp(`(?:offer\\s*date|date\\s*of\\s*offer|effective\\s*date|loi\\s*date|letter\\s*date)\\s*:?\\s*${dp}`, 'i'))
  if (offerDate) result.loiOfferDate = normalizeDate(offerDate[1])
  // Fecha esperada de cierre
  const closeDate =
    t.match(new RegExp(`(?:closing\\s*date|expected\\s*closing|target\\s*close|proposed\\s*closing|settlement\\s*date)\\s*:?\\s*${dp}`, 'i'))
  if (closeDate) result.loiExpectedClose = normalizeDate(closeDate[1])
  // Earnest money
  const earnest =
    t.match(new RegExp(`(?:earnest\\s*money|deposit|good\\s*faith)\\s*(?:deposit)?\\s*:?\\s*${mp}`, 'i'))
  if (earnest) result.loiEarnestMoney = parseMoney(earnest[1])
  return result
}

function parseAppraisalText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const t = text.replace(/\n/g, ' ')
  const mp = '\\$?([\\d,]+\\.?\\d*)'
  const arv = t.match(new RegExp(`(?:market\\s*value|appraised\\s*(?:value|amount)|as\\s*completed\\s*value|after\\s*repair\\s*value|arv|indicated\\s*value)\\s*:?\\s*${mp}`, 'i'))
  if (arv) result.arv = parseMoney(arv[1])
  const gla = t.match(/(?:gla|gross\s*living\s*area|gross\s*livable|net\s*livable)\s*:?\s*([\d,]+)/i)
  if (gla) result.sfHeated = parseInt(gla[1].replace(/,/g, ''))
  const target = t.match(new RegExp(`(?:estimated\\s*value|list(?:ing)?\\s*(?:price|value)|as\\s*is\\s*value)\\s*:?\\s*${mp}`, 'i'))
  if (target) result.targetListingPrice = parseMoney(target[1])
  return result
}

// ── GET draws ────────────────────────────────────────────────────────────────
router.get('/:projectId/draws', async (req: Request, res: Response) => {
  try {
    const draws = await prisma.draw.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { drawNumber: 'asc' },
    })
    res.json({ data: draws, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// ── POST create draw ────────────────────────────────────────────────────────
// Adds a new EMPTY draw with the next sequential number. Used when the user
// has deleted draws and needs more capacity, or when a project genuinely has
// more than the default 8 draws. No hard cap — the lender, not the system,
// decides how many draws a project gets.
router.post('/:projectId/draws', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId
    const last = await prisma.draw.findFirst({
      where: { projectId },
      orderBy: { drawNumber: 'desc' },
      select: { drawNumber: true },
    })
    const nextNumber = (last?.drawNumber ?? 0) + 1
    const created = await prisma.draw.create({
      data: {
        projectId,
        drawNumber: nextNumber,
        estado: 'EMPTY',
        montoSolicitado: 0,
        elegibleTrinity: 0,
        porcentajeFunded: 0,
        netWire: 0,
        upbPre: 0,
        upbPost: 0,
        saldoHoldback: 0,
      },
    })
    // recalcHoldback so the new row inherits the running UPB / holdback chain
    await recalcHoldback(projectId)
    const fresh = await prisma.draw.findUnique({ where: { id: created.id } })
    res.json({ data: fresh, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// ── PATCH draw ───────────────────────────────────────────────────────────────
// Auto-promueve el estado cuando el usuario edita netWire/elegibleTrinity y se
// olvida de actualizar el dropdown — así el KPI de holdback queda coherente.
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const body = { ...(req.body as Record<string, unknown>) }
    if (body.estado === undefined) {
      const current = await prisma.draw.findUnique({ where: { id: req.params.id }, select: { estado: true, netWire: true, elegibleTrinity: true } })
      if (current && current.estado !== 'WIRED') {
        const nextNetWire = typeof body.netWire === 'number' ? body.netWire : current.netWire
        const nextElegible = typeof body.elegibleTrinity === 'number' ? body.elegibleTrinity : current.elegibleTrinity
        if (nextNetWire > 0) body.estado = 'WIRED'
        else if (nextElegible > 0 && current.estado === 'EMPTY') body.estado = 'PENDING'
      }
    }
    const draw = await prisma.draw.update({ where: { id: req.params.id }, data: body })
    // Recalculate saldoHoldback for all draws in the project whenever any draw changes
    await recalcHoldback(draw.projectId)
    // Re-fetch to return updated saldoHoldback
    const updated = await prisma.draw.findUnique({ where: { id: draw.id } })
    res.json({ data: updated, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// ── DELETE draw ───────────────────────────────────────────────────────────────
// CRITICAL: must (1) recompute todo el budget del proyecto desde contribuciones
// vivas (incluso datos legacy sin contribución quedan en 0 si nadie los respalda),
// (2) recompute saldoHoldback + UPB chain — para no dejar valores stale.
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.draw.findUnique({
      where: { id: req.params.id },
      select: { projectId: true },
    })
    if (!existing) {
      return res.status(404).json({ data: null, error: 'Draw no encontrado' })
    }
    await prisma.draw.delete({ where: { id: req.params.id } })
    // Cascade ya borró las contribuciones de este draw. Hacemos recompute
    // PROJECT-WIDE: cualquier línea sin contribuciones vivas (incluso heredadas
    // de antes de la trazabilidad) vuelve a $0. Así borrar el draw siempre
    // deja el construction budget coherente.
    await recomputeProjectBudgetFromContributions(existing.projectId)
    await recalcHoldback(existing.projectId)
    res.json({ data: { deleted: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// ── POST upload draw document ────────────────────────────────────────────────
// kind = "INVOICE" | "APPROVAL" | "EXCEL"
// EXCEL  → parse spreadsheet and inject draw-level fields (Trinity layout)
// APPROVAL → parse the Trinity PDF and update the construction budget's
//            valorAprobado per line item (line-level cross-link).
router.post('/:id/document', (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ data: null, error: String(err) })
    try {
      if (!req.file) return res.status(400).json({ data: null, error: 'No se subió ningún archivo' })
      const kind = String(req.body.kind || 'INVOICE').toUpperCase()
      const fileUrl = await tryCloudinaryUpload(req.file.buffer, 'construction-pm/draw-documents', req.file.mimetype)
      if (!fileUrl) return res.status(500).json({ data: null, error: 'Cloudinary no configurado' })

      const baseData: Record<string, unknown> =
        kind === 'APPROVAL'
          ? { lenderApprovalUrl: fileUrl, lenderApprovalName: req.file.originalname }
          : kind === 'EXCEL'
          ? { lenderExcelUrl: fileUrl, lenderExcelName: req.file.originalname }
          : { invoiceLenderUrl: fileUrl, invoiceLenderName: req.file.originalname }

      let extracted: Record<string, unknown> = {}
      let projectExtracted: Record<string, unknown> = {}
      let parsedDrawNumber: number | null = null
      let budgetUpdate: Awaited<ReturnType<typeof applyDrawApprovalsToBudget>> | null = null
      let extractionError: string | null = null

      // EXCEL slot — extract draw-level fields from the lender spreadsheet.
      // Lender Excel is authoritative, so it OVERWRITES existing values for the
      // fields it provides. Anything Trinity doesn't include (e.g. dates) stays
      // as-is for manual fill-in. Parse errors surface to the client so the UI
      // can show a real failure instead of pretending the upload worked.
      if (kind === 'EXCEL') {
        if (!isExcelFile(req.file.mimetype, req.file.originalname)) {
          extractionError = `Archivo no reconocido como Excel (${req.file.mimetype || 'sin mimetype'}).`
        } else {
          try {
            const { parsed } = parseDrawExcel(req.file.buffer)
            if (typeof parsed.drawNumber === 'number') parsedDrawNumber = parsed.drawNumber
            const drawFields = [
              'montoSolicitado', 'elegibleTrinity', 'netWire', 'porcentajeFunded',
              'upbPre', 'upbPost', 'saldoHoldback',
              'fechaSolicitud', 'fechaInspeccion', 'fechaWire',
            ]
            for (const k of drawFields) {
              const v = parsed[k]
              if (v === undefined || v === null || v === '') continue
              extracted[k] = v
            }
            // Trinity's Excel doesn't have a separate "Eligible" column — the
            // Draw Amount IS the eligible/approved amount (else it wouldn't have
            // been wired). Mirror montoSolicitado into elegibleTrinity so the
            // CFO dashboard math stays honest.
            if (extracted.montoSolicitado && !extracted.elegibleTrinity) {
              extracted.elegibleTrinity = extracted.montoSolicitado
            }
            // Project-level holdback ("Refurb Loan Amount") — the original
            // construction reserve before any draw. Hand it up to the route so
            // we can update the Project record if it wasn't set yet (e.g. HUD
            // not uploaded). Without this, recalcHoldback would clamp every
            // saldoHoldback to 0 because initialHoldback=0.
            if (typeof parsed.projectHoldback === 'number' && parsed.projectHoldback > 0) {
              projectExtracted.holdback = parsed.projectHoldback
            }
            if (Object.keys(extracted).length === 0) {
              extractionError = 'No se detectó ningún campo en el Excel. Verifica que sea el formato Trinity.'
            }
          } catch (e) {
            console.warn('Excel parse failed for draw', req.params.id, e)
            extractionError = `Error al parsear Excel: ${e instanceof Error ? e.message : String(e)}`
          }
        }
      }

      // APPROVAL slot — Trinity's draw report PDF carries TWO pieces of info:
      //   (a) line-by-line approvals → drives BudgetLine.valorAprobado
      //   (b) draw header (drawNumber, dates, total elegible) → drives the
      //       draw record itself, so the user doesn't have to also upload the
      //       Excel just to populate fechas/elegibleTrinity.
      // Surface parser failures so the user knows the budget was NOT updated.
      if (kind === 'APPROVAL') {
        if (req.file.mimetype !== 'application/pdf') {
          extractionError = `Archivo no es un PDF (${req.file.mimetype || 'sin mimetype'}).`
        } else {
          try {
            const pdfData = await pdfParse(req.file.buffer)
            const approvals = parseTrinityDrawApprovals(pdfData.text)
            if (approvals.length > 0) {
              const draw = await prisma.draw.findUnique({ where: { id: req.params.id }, select: { projectId: true } })
              if (draw) budgetUpdate = await applyDrawApprovalsToBudget(draw.projectId, req.params.id, approvals)
            } else {
              // PDF subido pero sin items → si había contribuciones previas de
              // este draw (re-upload), límpialas para no dejar aprobaciones
              // que ya no respaldan ningún PDF activo.
              await clearDrawContributions(req.params.id)
              extractionError = 'No se detectaron line items en el PDF. Verifica que sea el reporte de Trinity.'
            }
            // Draw-header extraction — dates, drawNumber, total elegible.
            // parseDrawText already handles the Trinity header format. Only fill
            // fields that are currently empty so we never clobber user edits.
            const headerFields = parseDrawText(pdfData.text)
            if (typeof headerFields.drawNumber === 'number') parsedDrawNumber = headerFields.drawNumber
            const safeFields: Array<keyof typeof headerFields> = [
              'fechaSolicitud', 'fechaInspeccion', 'fechaWire',
              'elegibleTrinity', 'montoSolicitado', 'porcentajeFunded',
            ]
            const existing = await prisma.draw.findUnique({ where: { id: req.params.id } })
            const isBlank = (v: unknown) => v === null || v === undefined || v === '' || v === 0
            for (const k of safeFields) {
              const v = headerFields[k]
              if (v === undefined || v === null || v === '') continue
              if (existing && !isBlank((existing as Record<string, unknown>)[k as string])) continue
              extracted[k as string] = v
            }
            // If the line approvals sum gave us a total ($ this draw), also
            // surface it as elegibleTrinity when the regex missed it.
            if (!extracted.elegibleTrinity && approvals.length > 0) {
              const cumThisDraw = approvals.reduce((s, a) => s + a.deltaThisDraw, 0)
              if (cumThisDraw > 0 && (!existing || isBlank(existing.elegibleTrinity))) {
                extracted.elegibleTrinity = cumThisDraw
              }
            }
          } catch (e) {
            console.warn('Approval PDF parse failed for draw', req.params.id, e)
            extractionError = `Error al parsear PDF: ${e instanceof Error ? e.message : String(e)}`
          }
        }
      }

      // Auto-promover el estado del draw cuando hay desembolso real.
      // - netWire > 0 → WIRED (dinero ya salió del lender)
      // - elegibleTrinity > 0 sin netWire → PENDING (Trinity aprobó, falta wire)
      // Sin esto, el draw se queda en EMPTY/PENDING y el KPI "Saldo holdback"
      // del header se calcula mal (bug reportado por el usuario en LOTE 87).
      // No degradamos: si el draw ya está WIRED, no lo regresamos a PENDING.
      const currentDraw = await prisma.draw.findUnique({ where: { id: req.params.id }, select: { estado: true } })
      const netWireNew = typeof extracted.netWire === 'number' ? extracted.netWire : 0
      const elegibleNew = typeof extracted.elegibleTrinity === 'number' ? extracted.elegibleTrinity : 0
      const promotedEstado =
        netWireNew > 0 ? 'WIRED'
        : (elegibleNew > 0 && currentDraw?.estado === 'EMPTY') ? 'PENDING'
        : null
      if (promotedEstado && currentDraw?.estado !== 'WIRED') {
        (extracted as Record<string, unknown>).estado = promotedEstado
      }

      const data = { ...extracted, ...baseData }
      const draw = await prisma.draw.update({ where: { id: req.params.id }, data })

      // If the Excel gave us a project-level holdback (Refurb Loan Amount) AND
      // the project has none yet, persist it. We never overwrite a holdback
      // that's already configured — the HUD or commitment letter wins for that.
      let projectPatched: Record<string, unknown> | null = null
      if (projectExtracted.holdback) {
        const existing = await prisma.project.findUnique({
          where: { id: draw.projectId },
          select: { holdback: true },
        })
        if (existing && (existing.holdback === 0 || existing.holdback === null)) {
          await prisma.project.update({
            where: { id: draw.projectId },
            data: { holdback: projectExtracted.holdback as number },
          })
          projectPatched = { holdback: projectExtracted.holdback }
        }
      }

      // Always recalc — uploading ANY lender document (Excel, PDF approval) is
      // a signal that the holdback / UPB chain may need to refresh. Cheap to run
      // and removes a whole class of "I uploaded the PDF but the saldo stays
      // at zero" bugs caused by missing the recalc trigger.
      await recalcHoldback(draw.projectId)
      const updated = await prisma.draw.findUnique({ where: { id: draw.id } })
      res.json({ data: updated, extracted, projectPatched, parsedDrawNumber, budgetUpdate, extractionError, error: null })
    } catch (e) {
      res.status(500).json({ data: null, error: String(e) })
    }
  })
})

// ── DELETE draw document ────────────────────────────────────────────────────
// When the lender Excel is removed, the auto-extracted numeric fields it
// populated (montoSolicitado, elegibleTrinity, netWire, %funded, UPB pre/post,
// fechas) must be cleared too — otherwise the draw still looks "loaded" while
// the source document is gone, and recalcHoldback runs on stale netWire values.
router.delete('/:id/document/:kind', async (req: Request, res: Response) => {
  try {
    const kind = req.params.kind.toUpperCase()
    let data: Record<string, unknown>
    if (kind === 'APPROVAL') {
      data = { lenderApprovalUrl: null, lenderApprovalName: null }
    } else if (kind === 'EXCEL') {
      data = {
        lenderExcelUrl: null,
        lenderExcelName: null,
        montoSolicitado: 0,
        elegibleTrinity: 0,
        netWire: 0,
        porcentajeFunded: 0,
        upbPre: 0,
        upbPost: 0,
        fechaSolicitud: null,
        fechaInspeccion: null,
        fechaWire: null,
      }
    } else {
      data = { invoiceLenderUrl: null, invoiceLenderName: null }
    }
    const draw = await prisma.draw.update({ where: { id: req.params.id }, data })
    // El APPROVAL pdf de Trinity es la fuente única de las aprobaciones por
    // línea — al borrarlo, las contribuciones de este draw al budget también
    // deben desaparecer (queja del usuario: "al eliminar un draw, no se borran
    // los datos automaticos en el construction budget"). Hacemos recompute
    // project-wide para sanear también datos legacy sin contribución registrada.
    if (kind === 'APPROVAL') {
      await prisma.drawLineContribution.deleteMany({ where: { drawId: req.params.id } })
      await recomputeProjectBudgetFromContributions(draw.projectId)
    }
    if (kind === 'EXCEL') {
      await recalcHoldback(draw.projectId)
    }
    const updated = await prisma.draw.findUnique({ where: { id: draw.id } })
    res.json({ data: updated, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

function handleUpload(req: Request, res: Response, next: () => void) {
  upload.single('pdf')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ data: null, error: `Error de archivo: ${err.message}` })
    }
    if (err) return res.status(400).json({ data: null, error: String(err) })
    next()
  })
}

// Try Cloudinary upload silently — PDF parsing works even if Cloudinary isn't configured
async function tryCloudinaryUpload(buffer: Buffer, folder: string, mimetype?: string): Promise<string | null> {
  try {
    const { url } = await uploadToCloudinary(buffer, folder, resourceTypeFor(mimetype))
    return url
  } catch {
    return null
  }
}

// ── POST parse-pdf (draw) ────────────────────────────────────────────────────
// Accepts PDF, image (JPG/PNG/etc), Excel (.xlsx/.xls) or CSV. Routes the file
// to the right parser and returns the extracted fields plus the storage URL.
router.post('/:projectId/draws/parse-pdf', handleUpload, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'No se subió ningún archivo' })

    const isImage = req.file.mimetype.startsWith('image/')
    const isExcel = isExcelFile(req.file.mimetype, req.file.originalname)
    // Excel files go to a dedicated folder; PDFs/images go to draw-pdfs.
    const folder = isExcel ? 'construction-pm/draw-documents' : 'construction-pm/draw-pdfs'
    const fileUrl = await tryCloudinaryUpload(req.file.buffer, folder, req.file.mimetype)

    if (isImage) {
      return res.json({
        data: { parsed: fileUrl ? { pdfUrl: fileUrl } : {}, preview: null, isImage: true, imageUrl: fileUrl },
        error: null,
      })
    }

    if (isExcel) {
      const { parsed, preview } = parseDrawExcel(req.file.buffer)
      if (fileUrl) {
        parsed.lenderExcelUrl = fileUrl
        parsed.lenderExcelName = req.file.originalname
      }
      return res.json({
        data: { parsed, preview, isImage: false, imageUrl: null, isExcel: true, fileName: req.file.originalname },
        error: null,
      })
    }

    const pdfData = await pdfParse(req.file.buffer)
    const parsed  = parseDrawText(pdfData.text)
    if (fileUrl) parsed.pdfUrl = fileUrl
    // Line-by-line budget approvals (only present if this is a Trinity report).
    const approvals = parseTrinityDrawApprovals(pdfData.text)

    res.json({
      data: { parsed, preview: pdfData.text.slice(0, 1500), isImage: false, imageUrl: null, approvals },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// ── POST rebuild-budget-from-contributions ──────────────────────────────────
// Botón admin: recompute todo el valorAprobado del proyecto desde las
// contribuciones vivas. Sirve para sanear datos legacy (aprobaciones cargadas
// antes de que existiera DrawLineContribution) o para forzar consistencia.
router.post('/:projectId/budget/rebuild-from-contributions', async (req: Request, res: Response) => {
  try {
    await recomputeProjectBudgetFromContributions(req.params.projectId)
    await recalcHoldback(req.params.projectId)
    const lines = await prisma.budgetLine.findMany({
      where: { projectId: req.params.projectId },
      select: { valorAprobado: true },
    })
    const total = lines.reduce((s, l) => s + l.valorAprobado, 0)
    res.json({ data: { lines: lines.length, totalAprobado: total }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// ── POST rebuild-contributions-from-pdfs ────────────────────────────────────
// Botón admin: para cada draw con APPROVAL PDF cargado en Cloudinary, lo
// descarga, lo re-parsea y reconstruye sus contribuciones. Útil cuando el
// estado se desincronizó o cuando subiste draws antes de que existiera la
// trazabilidad de contribuciones.
router.post('/:projectId/draws/rebuild-contributions', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId
    const draws = await prisma.draw.findMany({
      where: { projectId, lenderApprovalUrl: { not: null } },
      select: { id: true, drawNumber: true, lenderApprovalUrl: true },
      orderBy: { drawNumber: 'asc' },
    })
    // Empezar limpio: borra todas las contribuciones del proyecto.
    await prisma.drawLineContribution.deleteMany({
      where: { draw: { projectId } },
    })
    const report: Array<{ drawNumber: number; matched: number; newlyApprovedItems: number; newlyApprovedAmount: number; error?: string }> = []
    for (const d of draws) {
      if (!d.lenderApprovalUrl) continue
      try {
        const r = await fetch(d.lenderApprovalUrl)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const buf = Buffer.from(await r.arrayBuffer())
        const pdfData = await pdfParse(buf)
        const approvals = parseTrinityDrawApprovals(pdfData.text)
        const result = await applyDrawApprovalsToBudget(projectId, d.id, approvals)
        report.push({
          drawNumber: d.drawNumber,
          matched: result.matched,
          newlyApprovedItems: result.newlyApprovedItems,
          newlyApprovedAmount: result.newlyApprovedAmount,
        })
      } catch (e) {
        report.push({
          drawNumber: d.drawNumber,
          matched: 0, newlyApprovedItems: 0, newlyApprovedAmount: 0,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
    await recomputeProjectBudgetFromContributions(projectId)
    await recalcHoldback(projectId)
    const lines = await prisma.budgetLine.findMany({
      where: { projectId }, select: { valorAprobado: true },
    })
    const totalAprobado = lines.reduce((s, l) => s + l.valorAprobado, 0)
    res.json({ data: { drawsProcessed: draws.length, totalAprobado, report }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Apply previously-parsed Trinity line approvals to the construction budget.
// El frontend pasa el drawId que el usuario eligió en el modal — necesario para
// trazar QUÉ draw aportó cada contribución (clave para limpiarlas si se borra).
router.post('/:projectId/draws/apply-approvals', async (req: Request, res: Response) => {
  try {
    const { approvals, drawId } = req.body as { approvals?: DrawLineApproval[]; drawId?: string }
    if (!drawId || typeof drawId !== 'string') {
      return res.status(400).json({ data: null, error: 'drawId requerido para aplicar approvals' })
    }
    if (!Array.isArray(approvals) || approvals.length === 0) {
      return res.json({ data: { matched: 0, newlyApprovedItems: 0, newlyApprovedAmount: 0, cumulativeApproved: 0, unmatched: [] }, error: null })
    }
    // Verificar que el draw pertenece a este proyecto — sin esto un usuario
    // podría aplicar aprobaciones de un proyecto a draws de otro.
    const draw = await prisma.draw.findUnique({ where: { id: drawId }, select: { projectId: true } })
    if (!draw || draw.projectId !== req.params.projectId) {
      return res.status(404).json({ data: null, error: 'Draw no pertenece a este proyecto' })
    }
    const result = await applyDrawApprovalsToBudget(req.params.projectId, drawId, approvals)
    res.json({ data: result, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// ── POST parse-pdf (project docs: HUD, Loan, Survey, Plans, Permit, Appraisal) ──
router.post('/:projectId/docs/parse-pdf', handleUpload, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'No se subió ningún archivo' })

    const isImage = req.file.mimetype.startsWith('image/')
    const fileUrl = await tryCloudinaryUpload(req.file.buffer, 'construction-pm/project-docs', req.file.mimetype)

    if (isImage) {
      return res.json({
        data: { parsed: fileUrl ? { pdfUrl: fileUrl } : {}, preview: null, isImage: true, imageUrl: fileUrl },
        error: null,
      })
    }

    const pdfData = await pdfParse(req.file.buffer)
    const docType = (req.query.type as string) || 'HUD'
    const parserMap: Record<string, (t: string) => Record<string, unknown>> = {
      HUD: parseHUDText, LOAN: parseLoanText, SURVEY: parseSurveyText,
      PLANS: parsePlansText, PERMIT: parsePermitText, APPRAISAL: parseAppraisalText,
      LOI: parseLOIText,
      OTROS: () => ({}),  // genérico: solo guarda URL, sin extraer datos
    }
    const parser = parserMap[docType.toUpperCase()]
    const parsed: Record<string, unknown> = parser ? parser(pdfData.text) : {}
    if (fileUrl) parsed.pdfUrl = fileUrl

    res.json({
      data: { parsed, preview: pdfData.text.slice(0, 1500), isImage: false, imageUrl: null },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
