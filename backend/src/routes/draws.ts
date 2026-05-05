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

  // ── Draw number ───────────────────────────────────────────
  // Matches "Draw #1", "Draw#1", "Draw 1"
  const drawNum = t.match(/Draw\s*#\s*(\d+)/i)
  if (drawNum) result.drawNumber = parseInt(drawNum[1])

  // ── Dates (Trinity format: "Date Ordered3/12/2026" or "Date Ordered 3/12/2026") ──
  const dp = '(\\d{1,2}/\\d{1,2}/\\d{4})'

  const ordered = t.match(new RegExp(`Date\\s*Ordered\\s*${dp}`, 'i'))
  if (ordered) result.fechaSolicitud = normalizeDate(ordered[1])

  const inspected = t.match(new RegExp(`Date\\s*Inspected\\s*${dp}`, 'i'))
  if (inspected) result.fechaInspeccion = normalizeDate(inspected[1])

  // "Date Completed3/16/2026" = when Trinity report finished (closest to wire date)
  const completed = t.match(new RegExp(`Date\\s*Completed\\s*${dp}`, 'i'))
  if (completed) result.fechaWire = normalizeDate(completed[1])

  // Fallback date patterns (for non-Trinity PDFs with dashes)
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
  // "TOTAL DIRECT COSTS & PERCENTAGES100.00%$465,750.00$0.000.00%$0.0020.27%$94,400.00"
  // Values are concatenated without spaces — e.g. "$0.0020.27%" means "$0.00" + "20.27%"
  // Strategy: extract just the total row, then find all "XX.XX%$XX,XXX.XX" pairs.
  // The LAST pair is always "ThisInspection%$CurrentAvailable".
  const totalRowStr = t.match(/TOTAL DIRECT COSTS[^©]*/i)?.[0] ?? ''
  if (totalRowStr) {
    const pairs = [...totalRowStr.matchAll(/(\d+\.\d{2})%\$([\d,]+\.\d{2})/g)]
    if (pairs.length > 0) {
      const last = pairs[pairs.length - 1]
      result.elegibleTrinity  = parseMoney(last[2])        // Current Amount Available
      result.montoSolicitado  = parseMoney(last[2])        // what's being requested = certified eligible
      result.porcentajeFunded = parseFloat(last[1]) / 100  // 20.27 → 0.2027
    }
  }

  // ── Fallback: generic patterns for other PDF formats ─────
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
  const moneyPat = '\\$?([\\d,]+\\.?\\d*)'
  const datePat = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})'

  const settleDate = t.match(new RegExp(`settlement\\s*date\\s*:?\\s*${datePat}`, 'i'))
  if (settleDate) result.settlementDate = normalizeDate(settleDate[1])

  const loanAmt = t.match(new RegExp(`loan\\s*amount\\s*:?\\s*${moneyPat}`, 'i'))
  if (loanAmt) result.loanAmount = parseMoney(loanAmt[1])

  const cash = t.match(new RegExp(`cash\\s*(?:at|to|from)?\\s*(?:settlement|borrower)\\s*:?\\s*${moneyPat}`, 'i'))
  if (cash) result.cashAtSettlement = parseMoney(cash[1])

  const closing = t.match(new RegExp(`(?:total\\s*)?closing\\s*costs?\\s*:?\\s*${moneyPat}`, 'i'))
  if (closing) result.closingCosts = parseMoney(closing[1])

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
