import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { uploadToCloudinary, resourceTypeFor } from '../lib/cloudinary'
import { parseAmountFlexible } from '../lib/parseAmount'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

const router  = Router()
const prisma  = new PrismaClient()

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

// ── Auto-recalc saldoHoldback for all draws in a project, sorted by drawNumber ──
async function recalcHoldback(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { holdback: true } })
  const initialHoldback = project?.holdback ?? 0
  const draws = await prisma.draw.findMany({
    where: { projectId },
    orderBy: { drawNumber: 'asc' },
    select: { id: true, netWire: true },
  })
  let cumulative = 0
  for (const draw of draws) {
    cumulative += draw.netWire
    const saldo = Math.max(0, initialHoldback - cumulative)
    await prisma.draw.update({ where: { id: draw.id }, data: { saldoHoldback: saldo } })
  }
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

  // Contract sales price — HUD-1 line 101: "Contract sales price$33,000.00" (no space before $)
  const salesPrice =
    t.match(/\b101\.\s*contract\s*sales?\s*price\s*\$?([\d,]+\.?\d*)/i) ??
    t.match(new RegExp(`contract\\s*sales?\\s*price\\s*:?\\s*${mp}`, 'i')) ??
    t.match(new RegExp(`(?:purchase|sale)\\s*price\\s*:?\\s*${mp}`, 'i'))
  if (salesPrice) result.contractSalesPrice = parseMoney(salesPrice[1])

  // Cash at settlement — HUD-1 line 303: "303. Cash   $34,932.25"
  const cash =
    t.match(/\b303\.\s*cash\s*\$?([\d,]+\.?\d*)/i) ??
    t.match(new RegExp(`cash\\s*(?:at|to|from)?\\s*(?:close|settlement|borrower)\\s*:?\\s*${mp}`, 'i')) ??
    t.match(new RegExp(`cash\\s*to\\s*close\\s*:?\\s*${mp}`, 'i'))
  if (cash) result.cashAtSettlement = parseMoney(cash[1])

  // Settlement charges — HUD-1 line 103: "Settlement charges to borrower (line 1400)$2,158.80"
  // Use [^$]* to skip "(line 1400)" which contains digits before the real dollar amount
  const closing =
    t.match(/\b103\.\s*settlement\s+charges?\s+to\s+borrower[^$]*\$([\d,]+\.?\d*)/i) ??
    t.match(/\b1400\.\s*total\s+settlement\s+charges?[^$]*\$([\d,]+\.?\d*)/i) ??
    t.match(new RegExp(`(?:total\\s*)?closing\\s*costs?\\s*(?:\\([A-Z]\\)\\s*)?:?\\s*${mp}`, 'i'))
  if (closing) result.closingCosts = parseMoney(closing[1])

  // Loan amount (construction loan HUD only)
  const loanAmt = t.match(new RegExp(`loan\\s*amount\\s*:?\\s*${mp}`, 'i'))
  if (loanAmt) result.loanAmount = parseMoney(loanAmt[1])

  // Interest rate and loan term (construction loan only)
  const rate = t.match(/interest\s*rate\s*:?\s*(\d+\.?\d*)\s*%/i)
  if (rate) result.interestRate = parseFloat(rate[1]) / 100

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
router.post('/:id/document', (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ data: null, error: String(err) })
    try {
      if (!req.file) return res.status(400).json({ data: null, error: 'No se subió ningún archivo' })
      const kind = String(req.body.kind || 'INVOICE').toUpperCase()
      const fileUrl = await tryCloudinaryUpload(req.file.buffer, 'construction-pm/draw-documents', req.file.mimetype)
      if (!fileUrl) return res.status(500).json({ data: null, error: 'Cloudinary no configurado' })

      const data: Record<string, unknown> =
        kind === 'APPROVAL'
          ? { lenderApprovalUrl: fileUrl, lenderApprovalName: req.file.originalname }
          : kind === 'EXCEL'
          ? { lenderExcelUrl: fileUrl, lenderExcelName: req.file.originalname }
          : { invoiceLenderUrl: fileUrl, invoiceLenderName: req.file.originalname }

      const draw = await prisma.draw.update({ where: { id: req.params.id }, data })
      res.json({ data: draw, error: null })
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
router.post('/:projectId/draws/parse-pdf', handleUpload, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'No se subió ningún archivo' })

    const isImage = req.file.mimetype.startsWith('image/')
    const fileUrl = await tryCloudinaryUpload(req.file.buffer, 'construction-pm/draw-pdfs', req.file.mimetype)

    if (isImage) {
      return res.json({
        data: { parsed: fileUrl ? { pdfUrl: fileUrl } : {}, preview: null, isImage: true, imageUrl: fileUrl },
        error: null,
      })
    }

    const pdfData = await pdfParse(req.file.buffer)
    const parsed  = parseDrawText(pdfData.text)
    if (fileUrl) parsed.pdfUrl = fileUrl

    res.json({
      data: { parsed, preview: pdfData.text.slice(0, 1500), isImage: false, imageUrl: null },
      error: null,
    })
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
