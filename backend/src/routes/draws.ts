import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

const router = Router()
const prisma = new PrismaClient()

const drawPdfDir = path.join(__dirname, '../../uploads/draw-pdfs')
if (!fs.existsSync(drawPdfDir)) fs.mkdirSync(drawPdfDir, { recursive: true })

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]

const storage = multer.diskStorage({
  destination: drawPdfDir,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true)
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Use PDF, JPG o PNG.`))
  },
})

function parseMoney(str: string): number {
  return parseFloat(str.replace(/[$,\s]/g, '')) || 0
}

function normalizeDate(str: string): string | null {
  if (!str) return null
  // Strip any trailing time portion (e.g. "3/12/2026 9:53 AM" → "3/12/2026")
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

  // ── Draw number: "Draw #1", "Draw No. 1", "Draw 1", "Draw#1" ──
  const drawNum = t.match(/Draw\s*(?:#|No\.?)?\s*(\d+)/i)
  if (drawNum) result.drawNumber = parseInt(drawNum[1])

  // ── Trinity dates — label immediately followed by date (no space or with space/colon) ──
  const dp = '(\\d{1,2}/\\d{1,2}/\\d{4})'
  const sep = '[:\\s]*'  // optional colon or spaces between label and date

  const ordered = t.match(new RegExp(`Date\\s*Ordered${sep}${dp}`, 'i'))
  if (ordered) result.fechaSolicitud = normalizeDate(ordered[1])

  const inspected = t.match(new RegExp(`Date\\s*Inspected${sep}${dp}`, 'i'))
  if (inspected) result.fechaInspeccion = normalizeDate(inspected[1])

  // "Date Completed" = Trinity report finish date (closest to wire date)
  const completed = t.match(new RegExp(`Date\\s*Completed${sep}${dp}`, 'i'))
  if (completed) result.fechaWire = normalizeDate(completed[1])

  // ── Fallback dates for non-Trinity PDFs ──
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

  // ── Trinity TOTAL row ─────────────────────────────────────
  // The last XX.XX%  $XX,XXX.XX pair in the total row = "This Inspection %" + "Current Available"
  // Values may be space-separated or concatenated. We try several row labels.
  const totalRowCandidates = [
    t.match(/TOTAL\s+DIRECT\s+COSTS[^©\n]*/i)?.[0],
    t.match(/TOTAL\s+ALL\s+COSTS[^©\n]*/i)?.[0],
    t.match(/GRAND\s+TOTAL[^©\n]*/i)?.[0],
    t.match(/TOTALS?[^©\n]{0,30}COSTS?[^©\n]*/i)?.[0],
  ]
  const totalRowStr = totalRowCandidates.find(s => s && s.length > 10) ?? ''

  if (totalRowStr) {
    // Allow optional spaces between % and $ (some PDFs have a space, some don't)
    const pairs = [...totalRowStr.matchAll(/(\d+\.\d{2})\s*%\s*\$\s*([\d,]+\.\d{2})/g)]
    if (pairs.length > 0) {
      const last = pairs[pairs.length - 1]
      result.elegibleTrinity  = parseMoney(last[2])
      result.montoSolicitado  = parseMoney(last[2])
      result.porcentajeFunded = parseFloat(last[1]) / 100
    }
  }

  // ── Fallback: generic patterns for non-Trinity PDFs ──
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
  const t = text.replace(/\n/g, ' ')
  const mp = '\\$?([\\d,]+\\.?\\d*)'
  const dp = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})'

  // Settlement / Closing Date — HUD-1 and Closing Disclosure (CD) both
  const settleDate =
    t.match(new RegExp(`(?:settlement|closing)\\s*date\\s*:?\\s*${dp}`, 'i')) ??
    t.match(new RegExp(`date\\s*of\\s*(?:settlement|closing)\\s*:?\\s*${dp}`, 'i')) ??
    t.match(new RegExp(`date\\s*issued\\s*:?\\s*${dp}`, 'i'))
  if (settleDate) result.settlementDate = normalizeDate(settleDate[1])

  // Loan Amount
  const loanAmt = t.match(new RegExp(`loan\\s*amount\\s*:?\\s*${mp}`, 'i'))
  if (loanAmt) result.loanAmount = parseMoney(loanAmt[1])

  // Cash at Settlement (HUD-1) / Cash to Close (CD) / Cash from/to Borrower
  const cash =
    t.match(new RegExp(`cash\\s*(?:at|to|from)?\\s*(?:close|settlement|borrower)\\s*:?\\s*${mp}`, 'i')) ??
    t.match(new RegExp(`(?:total\\s*)?(?:cash|amount)\\s*(?:due\\s*)?(?:from|to)\\s*borrower\\s*:?\\s*${mp}`, 'i'))
  if (cash) result.cashAtSettlement = parseMoney(cash[1])

  // Total Closing Costs / Total Settlement Charges
  const closing =
    t.match(new RegExp(`(?:total\\s*)?closing\\s*costs?\\s*(?:\\([A-Z]\\)\\s*)?:?\\s*${mp}`, 'i')) ??
    t.match(new RegExp(`(?:total\\s*)?settlement\\s*charges?\\s*:?\\s*${mp}`, 'i'))
  if (closing) result.closingCosts = parseMoney(closing[1])

  // Interest Rate (if present in Closing Disclosure)
  const rate = t.match(/interest\s*rate\s*:?\s*(\d+\.?\d*)\s*%/i)
  if (rate) result.interestRate = parseFloat(rate[1]) / 100

  // Loan Term
  const term = t.match(/loan\s*term\s*:?\s*(\d+)\s*(?:months?|mo\.?|years?|yr\.?)/i)
  if (term) {
    const termText = term[0].toLowerCase()
    const n = parseInt(term[1])
    result.loanTermMonths = termText.includes('year') ? n * 12 : n
  }

  return result
}

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

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const draw = await prisma.draw.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ data: draw, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Handle multer errors cleanly
function handleUpload(req: Request, res: Response, next: () => void) {
  upload.single('pdf')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ data: null, error: `Error de archivo: ${err.message}` })
    }
    if (err) {
      return res.status(400).json({ data: null, error: String(err) })
    }
    next()
  })
}

router.post('/:projectId/draws/parse-pdf', handleUpload, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'No se subió ningún archivo' })

    const fileUrl = `/api/uploads/draw-pdfs/${req.file.filename}`
    const isImage = req.file.mimetype.startsWith('image/')

    if (isImage) {
      // Image uploaded — store and return empty parsed fields for manual entry
      return res.json({
        data: {
          parsed: { pdfUrl: fileUrl },
          preview: null,
          isImage: true,
          imageUrl: fileUrl,
        },
        error: null,
      })
    }

    // PDF — parse text
    const buffer = fs.readFileSync(req.file.path)
    const pdfData = await pdfParse(buffer)
    const parsed = parseDrawText(pdfData.text)
    parsed.pdfUrl = fileUrl

    res.json({
      data: {
        parsed,
        preview: pdfData.text.slice(0, 1500),
        isImage: false,
        imageUrl: null,
      },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/:projectId/docs/parse-pdf', handleUpload, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'No se subió ningún archivo' })

    const fileUrl = `/api/uploads/draw-pdfs/${req.file.filename}`
    const isImage = req.file.mimetype.startsWith('image/')

    if (isImage) {
      return res.json({
        data: { parsed: { pdfUrl: fileUrl }, preview: null, isImage: true, imageUrl: fileUrl },
        error: null,
      })
    }

    const buffer = fs.readFileSync(req.file.path)
    const pdfData = await pdfParse(buffer)
    const docType = (req.query.type as string) || 'HUD'
    const parsed = docType === 'HUD' ? parseHUDText(pdfData.text) : {}
    ;(parsed as Record<string, unknown>).pdfUrl = fileUrl

    res.json({
      data: { parsed, preview: pdfData.text.slice(0, 1500), isImage: false, imageUrl: null },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
