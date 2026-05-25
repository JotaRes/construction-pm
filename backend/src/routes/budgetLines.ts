import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { BUDGET_LINES_TEMPLATE } from '../data/budgetLinesTemplate'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

const router = Router()
const prisma = new PrismaClient()


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files allowed'))
  },
})

router.get('/:id/construction-budget', async (req: Request, res: Response) => {
  try {
    const lines = await prisma.budgetLine.findMany({
      where: { projectId: req.params.id },
      orderBy: { order: 'asc' },
    })
    res.json({ data: lines, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:projectId/construction-budget/:id', async (req: Request, res: Response) => {
  try {
    const line = await prisma.budgetLine.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ data: line, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Init budget lines for a new project from template
router.post('/:id/construction-budget/init', async (req: Request, res: Response) => {
  try {
    await prisma.budgetLine.deleteMany({ where: { projectId: req.params.id } })
    let order = 0
    for (const t of BUDGET_LINES_TEMPLATE) {
      await prisma.budgetLine.create({
        data: {
          projectId: req.params.id,
          divCode: t.divCode,
          divName: t.divName,
          itemCode: t.itemCode,
          description: t.description,
          unit: t.unit,
          vendor: t.vendor || null,
          valorInicial: t.valorInicial,
          valorPresentado: 0,
          valorAprobado: 0,
          pagadoSubs: 0,
          order: order++,
        },
      })
    }
    res.json({ data: { count: order }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Parse construction budget PDF and match to template lines
router.post('/:id/construction-budget/parse-pdf', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ data: null, error: 'No file uploaded' }); return }

    const { text } = await pdfParse(req.file.buffer)
    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    // Extract dollar amounts with their context
    const extracted: Array<{ description: string; amount: number }> = []
    const dollarPattern = /\$[\d,]+(?:\.\d{2})?/g

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const amounts = line.match(dollarPattern)
      if (!amounts) continue
      // Use the line itself or the previous line as description
      const desc = line.replace(dollarPattern, '').replace(/\s+/g, ' ').trim()
      for (const amt of amounts) {
        const num = parseFloat(amt.replace(/[$,]/g, ''))
        if (num >= 100 && num <= 5000000) {
          extracted.push({ description: desc || (lines[i - 1] ?? ''), amount: num })
        }
      }
    }

    // Try to fuzzy-match extracted lines to template items
    const matched: Array<{ itemCode: string; description: string; amount: number; confidence: number }> = []
    const usedAmounts = new Set<number>()

    for (const tmpl of BUDGET_LINES_TEMPLATE) {
      const tmplWords = tmpl.description.toLowerCase().split(/\s+/)
      let best: { amount: number; confidence: number } | null = null

      for (const ext of extracted) {
        if (usedAmounts.has(ext.amount)) continue
        const extWords = ext.description.toLowerCase().split(/\s+/)
        const overlap = tmplWords.filter(w => w.length > 3 && extWords.some(ew => ew.includes(w) || w.includes(ew))).length
        const conf = overlap / Math.max(tmplWords.length, 1)
        if (conf > 0.3 && (!best || conf > best.confidence)) {
          best = { amount: ext.amount, confidence: conf }
        }
      }

      if (best && best.confidence > 0.3) {
        usedAmounts.add(best.amount)
        matched.push({ itemCode: tmpl.itemCode, description: tmpl.description, amount: best.amount, confidence: best.confidence })
      }
    }

    res.json({ data: { rawLines: lines.length, extracted: extracted.length, matched }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

/**
 * POST /:id/construction-budget/import-from-pdf
 *
 * Versión mejorada del parser:
 * 1. Extrae items del PDF (línea con descripción + monto)
 * 2. Para cada item del template, intenta matchear con extraídos
 * 3. Si matchea → setea valorInicial con el monto del PDF, esActivo=true
 * 4. Si NO matchea → se deshabilita en el budget (no se borra, queda hidden)
 * 5. Si hay items en el PDF que no están en el template → se crean como nuevos
 *
 * Resultado: solo aparecen items presentes en el PDF, con su valor inicial cargado.
 */
router.post('/:id/construction-budget/import-from-pdf', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ data: null, error: 'No file uploaded' })
      return
    }

    const projectId = req.params.id
    const { text } = await pdfParse(req.file.buffer)
    const rawLines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    // === EXTRACCIÓN MEJORADA ===
    // Patrón: línea con descripción seguida de monto $X,XXX.XX
    // También captura líneas tipo "Foundation .................. $12,500.00"
    const dollarPattern = /\$[\d,]+(?:\.\d{2})?/g
    const extracted: Array<{ description: string; amount: number; rawLine: string }> = []

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i]
      const amounts = line.match(dollarPattern)
      if (!amounts) continue
      // Limpiar la línea: quitar dots de tabulación, montos, espacios extra
      let desc = line.replace(dollarPattern, '').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim()
      // Si la descripción quedó vacía, intentar líneas anteriores
      if (!desc || desc.length < 3) desc = (rawLines[i - 1] ?? '').replace(dollarPattern, '').trim() || desc
      for (const amt of amounts) {
        const num = parseFloat(amt.replace(/[$,]/g, ''))
        if (num >= 50 && num <= 10000000) {
          extracted.push({ description: desc, amount: num, rawLine: line })
        }
      }
    }

    // === MATCHING contra template ===
    type MatchResult = { template: typeof BUDGET_LINES_TEMPLATE[0]; amount: number; confidence: number }
    const matches: MatchResult[] = []
    const usedExtracted = new Set<number>()

    for (const tmpl of BUDGET_LINES_TEMPLATE) {
      const tmplDesc = tmpl.description.toLowerCase()
      const tmplWords = tmplDesc.split(/\s+/).filter(w => w.length > 3)
      if (tmplWords.length === 0) continue

      let best: { idx: number; amount: number; confidence: number } | null = null
      for (let i = 0; i < extracted.length; i++) {
        if (usedExtracted.has(i)) continue
        const ext = extracted[i]
        const extDesc = ext.description.toLowerCase()
        const overlap = tmplWords.filter(w => extDesc.includes(w)).length
        const confidence = overlap / tmplWords.length
        if (confidence >= 0.4 && (!best || confidence > best.confidence)) {
          best = { idx: i, amount: ext.amount, confidence }
        }
      }
      if (best) {
        usedExtracted.add(best.idx)
        matches.push({ template: tmpl, amount: best.amount, confidence: best.confidence })
      }
    }

    // === APLICAR cambios ===
    await prisma.budgetLine.deleteMany({ where: { projectId } })

    let order = 0
    for (const m of matches) {
      await prisma.budgetLine.create({
        data: {
          projectId,
          divCode: m.template.divCode,
          divName: m.template.divName,
          itemCode: m.template.itemCode,
          description: m.template.description,
          unit: m.template.unit,
          vendor: m.template.vendor || null,
          valorInicial: m.amount,  // ← del PDF
          valorPresentado: 0,
          valorAprobado: 0,
          pagadoSubs: 0,
          order: order++,
        },
      })
    }

    // Items del PDF que NO matchearon con ningún template → crear como "EXTRA-NNN"
    let extraIdx = 1
    for (let i = 0; i < extracted.length; i++) {
      if (usedExtracted.has(i)) continue
      const ext = extracted[i]
      if (ext.description.length < 4) continue
      // Filtrar líneas que claramente no son items (totales, headers, etc.)
      if (/^(total|subtotal|grand total|sub total|gross)/i.test(ext.description)) continue
      await prisma.budgetLine.create({
        data: {
          projectId,
          divCode: 'EX',
          divName: 'EXTRAS DEL PDF',
          itemCode: `EX.${String(extraIdx).padStart(3, '0')}`,
          description: ext.description.slice(0, 200),
          unit: 'LS',
          vendor: null,
          valorInicial: ext.amount,
          valorPresentado: 0,
          valorAprobado: 0,
          pagadoSubs: 0,
          order: order++,
        },
      })
      extraIdx++
    }

    res.json({
      data: {
        rawLines: rawLines.length,
        extractedFromPdf: extracted.length,
        templateMatched: matches.length,
        extrasCreated: extraIdx - 1,
        totalLines: order,
        message: `Construction budget cargado: ${matches.length} items del template + ${extraIdx - 1} items extra = ${order} líneas totales`,
      },
      error: null,
    })
  } catch (e) {
    console.error('[construction-budget/import-from-pdf] error:', e)
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
