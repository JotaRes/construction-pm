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

  for (const draw of draws) {
    cumulative += draw.netWire
    const saldo = Math.max(0, initialHoldback - cumulative)

    // UPB chain — only propagate when downstream values are currently 0/null
    // (the convention used everywhere else in this file for "not yet set").
    let nextUpbPre: number | null = draw.upbPre || null
    let nextUpbPost: number | null = draw.upbPost || null

    if ((nextUpbPre === null || nextUpbPre === 0) && prevPost !== null) {
      nextUpbPre = prevPost
    }
    if (nextUpbPre !== null && nextUpbPre > 0 && (nextUpbPost === null || nextUpbPost === 0)) {
      nextUpbPost = nextUpbPre + draw.netWire
    }

    const data: Record<string, unknown> = { saldoHoldback: saldo }
    if (nextUpbPre !== null && nextUpbPre !== draw.upbPre) data.upbPre = nextUpbPre
    if (nextUpbPost !== null && nextUpbPost !== draw.upbPost) data.upbPost = nextUpbPost

    await prisma.draw.update({ where: { id: draw.id }, data })

    // Advance the chain pointer: prefer the post we have (computed or original),
    // falling back to the previous step if nothing new is known.
    prevPost = nextUpbPost ?? prevPost
  }
}

// ── Trinity draw PDF: line-by-line budget approval extractor ────────────────
// Trinity's draw report lists every budget item with the cumulative dollar
// amount approved as of this draw ("Current Amount Available" column). That
// maps 1:1 to BudgetLine.valorAprobado in the construction budget.
export interface DrawLineApproval {
  itemCode: string
  description: string
  thisInspectionPct: number
  currentAmountAvailable: number
}

// Match a single item row in the Trinity report. The PDF text glues fields
// together (no spaces between columns) so we anchor on the dollar/percent
// pattern. Example row text:
//   "21.1 Survey0.64%$3,000.00$0.000%$0.00100%$3,000.00"
//   ^ line# + item code + description + line% + $req + $prior + prior% + $eligible + thisPct% + $current
const TRINITY_ITEM_RE = /^\d{1,3}(\d+\.\d+[A-Za-z]?)\s+(.+?)(\d+\.?\d*)%\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})(\d+(?:\.\d+)?)%\$([\d,]+\.\d{2})(\d+(?:\.\d+)?)%\$([\d,]+\.\d{2})$/

export function parseTrinityDrawApprovals(text: string): DrawLineApproval[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\x00/g, '')
  const out: DrawLineApproval[] = []
  for (const ln of normalized.split('\n')) {
    const trimmed = ln.trim()
    if (!trimmed) continue
    const m = trimmed.match(TRINITY_ITEM_RE)
    if (!m) continue
    out.push({
      itemCode: m[1],
      description: m[2].trim(),
      thisInspectionPct: parseFloat(m[8]),
      currentAmountAvailable: parseFloat(m[9].replace(/,/g, '')),
    })
  }
  return out
}

// Apply parsed approvals to the project's BudgetLines. Only updates lines
// whose itemCode matches; reports unmatched codes so the caller can surface
// them. Cumulative semantics: we set valorAprobado = the lender's stated
// "currentAmountAvailable" which already represents the cumulative approved
// amount as of this draw.
export async function applyDrawApprovalsToBudget(
  projectId: string,
  approvals: DrawLineApproval[],
): Promise<{ matched: number; updated: number; unmatched: string[] }> {
  if (!approvals.length) return { matched: 0, updated: 0, unmatched: [] }
  const lines = await prisma.budgetLine.findMany({ where: { projectId } })
  const byCode = new Map<string, (typeof lines)[number]>()
  for (const l of lines) byCode.set(l.itemCode, l)

  let matched = 0
  let updated = 0
  const unmatched: string[] = []
  for (const a of approvals) {
    const line = byCode.get(a.itemCode)
    if (!line) { unmatched.push(a.itemCode); continue }
    matched++
    if (Math.abs(line.valorAprobado - a.currentAmountAvailable) > 0.005) {
      await prisma.budgetLine.update({
        where: { id: line.id },
        data: { valorAprobado: a.currentAmountAvailable },
      })
      updated++
    }
  }
  return { matched, updated, unmatched }
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
    const pairs = [...totalRowStr.matchAll(/(\d+\.\d{2})\s*%\s*\$\s*([\d,]+\.\d{2})/g)]
    if (pairs.length > 0) {
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

function parseDrawExcel(buffer: Buffer): { parsed: Record<string, unknown>; preview: string } {
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

// ── PATCH draw ───────────────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const draw = await prisma.draw.update({ where: { id: req.params.id }, data: req.body })
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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.draw.delete({ where: { id: req.params.id } })
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
      let parsedDrawNumber: number | null = null
      let budgetUpdate: { matched: number; updated: number; unmatched: string[] } | null = null

      // EXCEL slot — extract draw-level fields from the lender spreadsheet.
      // Lender Excel is authoritative, so it OVERWRITES existing values for the
      // fields it provides. Anything Trinity doesn't include (e.g. dates) stays
      // as-is for manual fill-in.
      if (kind === 'EXCEL' && isExcelFile(req.file.mimetype, req.file.originalname)) {
        try {
          const { parsed } = parseDrawExcel(req.file.buffer)
          if (typeof parsed.drawNumber === 'number') parsedDrawNumber = parsed.drawNumber
          const allowedFields = [
            'montoSolicitado', 'elegibleTrinity', 'netWire', 'porcentajeFunded',
            'upbPre', 'upbPost', 'saldoHoldback',
            'fechaSolicitud', 'fechaInspeccion', 'fechaWire',
          ]
          for (const k of allowedFields) {
            const v = parsed[k]
            if (v === undefined || v === null || v === '') continue
            extracted[k] = v
          }
        } catch (e) {
          console.warn('Excel parse failed for draw', req.params.id, e)
        }
      }

      // APPROVAL slot — Trinity's draw report PDF carries line-by-line approvals
      // that map directly to BudgetLine.valorAprobado.
      if (kind === 'APPROVAL' && req.file.mimetype === 'application/pdf') {
        try {
          const pdfData = await pdfParse(req.file.buffer)
          const approvals = parseTrinityDrawApprovals(pdfData.text)
          if (approvals.length > 0) {
            const draw = await prisma.draw.findUnique({ where: { id: req.params.id }, select: { projectId: true } })
            if (draw) budgetUpdate = await applyDrawApprovalsToBudget(draw.projectId, approvals)
          }
        } catch (e) {
          console.warn('Approval PDF parse failed for draw', req.params.id, e)
        }
      }

      const data = { ...extracted, ...baseData }
      const draw = await prisma.draw.update({ where: { id: req.params.id }, data })
      // If we touched netWire, recalc the holdback + UPB chain for the project.
      if ('netWire' in extracted || 'upbPre' in extracted || 'upbPost' in extracted) {
        await recalcHoldback(draw.projectId)
      }
      const updated = await prisma.draw.findUnique({ where: { id: draw.id } })
      res.json({ data: updated, extracted, parsedDrawNumber, budgetUpdate, error: null })
    } catch (e) {
      res.status(500).json({ data: null, error: String(e) })
    }
  })
})

// ── DELETE draw document ────────────────────────────────────────────────────
router.delete('/:id/document/:kind', async (req: Request, res: Response) => {
  try {
    const kind = req.params.kind.toUpperCase()
    const data: Record<string, unknown> =
      kind === 'APPROVAL'
        ? { lenderApprovalUrl: null, lenderApprovalName: null }
        : kind === 'EXCEL'
        ? { lenderExcelUrl: null, lenderExcelName: null }
        : { invoiceLenderUrl: null, invoiceLenderName: null }
    const draw = await prisma.draw.update({ where: { id: req.params.id }, data })
    res.json({ data: draw, error: null })
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

// Apply previously-parsed Trinity line approvals to the construction budget.
// The frontend calls this from the "Cargar Draw" modal after the user picks
// which draw to apply to — it's the modal counterpart of the APPROVAL slot.
router.post('/:projectId/draws/apply-approvals', async (req: Request, res: Response) => {
  try {
    const { approvals } = req.body as { approvals?: DrawLineApproval[] }
    if (!Array.isArray(approvals) || approvals.length === 0) {
      return res.json({ data: { matched: 0, updated: 0, unmatched: [] }, error: null })
    }
    const result = await applyDrawApprovalsToBudget(req.params.projectId, approvals)
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
