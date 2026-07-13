import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { uploadToCloudinary } from '../lib/cloudinary'
import { BUDGET_LINES_TEMPLATE } from '../data/budgetLinesTemplate'
import { parseAmountFlexible } from '../lib/parseAmount'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

const router = Router()


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

// Whitelist explícita — req.body sólo puede tocar campos editables por el
// usuario desde la UI. Bloquea mass-assignment de projectId/itemCode/order/etc.
// IMPORTANTE: valorAprobado NO está aquí — es derivado de DrawLineContribution
// (suma de aportes por draw vivo). Editarlo manualmente rompe la trazabilidad
// y el siguiente recompute lo sobrescribiría.
const BUDGET_LINE_EDITABLE_FIELDS = new Set([
  'description', 'unit', 'vendor', 'quantity',
  'valorInicial', 'valorPresentado', 'pagadoSubs',
])

router.patch('/:projectId/construction-budget/:id', async (req: Request, res: Response) => {
  try {
    // Defensa: el id debe existir y pertenecer al projectId del path.
    const existing = await prisma.budgetLine.findUnique({
      where: { id: req.params.id }, select: { projectId: true },
    })
    if (!existing || existing.projectId !== req.params.projectId) {
      return res.status(404).json({ data: null, error: 'Budget line no encontrada en este proyecto' })
    }
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(req.body || {})) {
      if (!BUDGET_LINE_EDITABLE_FIELDS.has(k)) continue
      if (k === 'quantity') data[k] = (v === null || v === '') ? null : Number(v)
      else data[k] = v
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ data: null, error: 'No hay campos editables en el payload' })
    }
    const line = await prisma.budgetLine.update({
      where: { id: req.params.id },
      data,
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
 * Extrae items del construction budget directamente del PDF.
 *
 * Reconoce la estructura típica:
 *   "1. Soft Costs $45.200,00"       ← SECTION (skip, es total agregado)
 *   "2a. Site Preparation"           ← SUBSECTION header (skip, es total)
 *   "1.1 Survey $2.500,00"           ← ITEM real
 *   "Totals: $465.750,00"            ← GRAND TOTAL (skip)
 *
 * Solo crea budget lines de los items REALES (patron N.N descripcion $monto).
 */
interface ParsedBudgetItem {
  itemCode: string
  description: string
  amount: number
  divCode: string
  divName: string
}

function parseConstructionBudgetText(text: string): ParsedBudgetItem[] {
  // Normalizar: convertir \r\n a \n, eliminar NBSP, líneas vacías
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/ /g, ' ')
    .replace(/\x00/g, ' ')
  const rawLines = normalized.split('\n').map(l => l.trim()).filter(Boolean)

  // Pattern para detectar monto al final de la línea (US o EU)
  const amountAtEnd = /\$\s*([\d.,]+)\s*$/
  // Patterns de prefijos jerárquicos
  const sectionHeader     = /^(\d+)\.\s+(.+?)$/   // "1. Soft Costs $45.200,00" o "1. Soft Costs"
  const subsectionHeader  = /^(\d+[a-z])\.\s+(.+?)$/   // "2a. Site Preparation"
  const itemPattern       = /^(\d+\.\d+)\s+(.+?)$/   // "1.1 Survey $2.500,00"
  // Líneas a ignorar
  const ignoreLine = /^(construction budget|address|owner|time of execution|lot area|building area|labor\/materials|cost|phone|email|totals?:?)/i

  let currentSection: { code: string; name: string } = { code: 'SEC.0', name: 'Sin sección' }
  const items: ParsedBudgetItem[] = []

  for (const line of rawLines) {
    if (ignoreLine.test(line)) continue

    // Quitar el monto al final si existe para analizar el prefijo
    const amtMatch = line.match(amountAtEnd)
    const amount = amtMatch ? parseAmountFlexible(amtMatch[0]) : 0
    const withoutAmount = amtMatch ? line.slice(0, line.lastIndexOf('$')).trim() : line

    // Detectar tipo de línea
    const itemMatch = withoutAmount.match(itemPattern)
    if (itemMatch) {
      // ITEM real (N.N descripción)
      const code = itemMatch[1]
      const desc = itemMatch[2].trim()
      if (amount > 0 && desc.length >= 2) {
        items.push({
          itemCode: code,
          description: desc,
          amount,
          divCode: currentSection.code,
          divName: currentSection.name,
        })
      }
      continue
    }

    const subMatch = withoutAmount.match(subsectionHeader)
    if (subMatch) {
      // SUBSECTION header (2a, 2b, 6a, 6b...) → actualizar contexto, NO crear item
      currentSection = {
        code: `SEC.${subMatch[1]}`,
        name: subMatch[2].trim(),
      }
      continue
    }

    const secMatch = withoutAmount.match(sectionHeader)
    if (secMatch) {
      // SECTION header (1, 2, 3...) → actualizar contexto, NO crear item
      currentSection = {
        code: `SEC.${secMatch[1]}`,
        name: secMatch[2].trim(),
      }
      continue
    }
  }

  return items
}

/**
 * Fallback parser para PDFs cuya extracción separa los montos de las descripciones
 * en columnas distintas (todas las descripciones, luego todos los montos).
 *
 * Solo se usa si el parser principal no encontró suficientes items.
 */
function parseConstructionBudgetColumnSplit(text: string): ParsedBudgetItem[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/ /g, ' ')
  const rawLines = normalized.split('\n').map(l => l.trim()).filter(Boolean)

  const itemPattern      = /^(\d+\.\d+)\s+(.+)$/
  const subsectionHeader = /^(\d+[a-z])\.\s+(.+)$/
  const sectionHeader    = /^(\d+)\.\s+(.+)$/
  const amountLine       = /^\$\s*[\d.,]+\s*$/
  const ignoreLine = /^(construction budget|address|owner|time of execution|lot area|building area|labor\/materials|cost|phone|email|totals?:?)/i

  // Recolectar items sin monto y montos por separado
  let currentSection: { code: string; name: string } = { code: 'SEC.0', name: 'Sin sección' }
  const items: Array<Omit<ParsedBudgetItem, 'amount'>> = []
  const amounts: number[] = []

  for (const line of rawLines) {
    if (ignoreLine.test(line)) continue
    if (amountLine.test(line)) {
      amounts.push(parseAmountFlexible(line))
      continue
    }
    const im = line.match(itemPattern)
    if (im) {
      items.push({
        itemCode: im[1],
        description: im[2].replace(/\$.*$/, '').trim(),
        divCode: currentSection.code,
        divName: currentSection.name,
      })
      continue
    }
    const ssm = line.match(subsectionHeader)
    if (ssm) {
      currentSection = { code: `SEC.${ssm[1]}`, name: ssm[2].replace(/\$.*$/, '').trim() }
      continue
    }
    const sm = line.match(sectionHeader)
    if (sm) {
      currentSection = { code: `SEC.${sm[1]}`, name: sm[2].replace(/\$.*$/, '').trim() }
      continue
    }
  }

  // Alinear por secuencia
  const result: ParsedBudgetItem[] = []
  for (let i = 0; i < items.length && i < amounts.length; i++) {
    if (amounts[i] > 0) {
      result.push({ ...items[i], amount: amounts[i] })
    }
  }
  return result
}

/**
 * POST /:id/construction-budget/import-from-pdf
 *
 * Versión rediseñada (2026-05):
 * - Parse directo del PDF: extrae TODOS los items con su jerarquía
 * - Sin matching contra template — usa la estructura propia del PDF
 * - Soporta formato monetario US ($45,200.00) y Europeo ($45.200,00)
 * - Ignora section totals, grand totals y headers ornamentales
 * - Fallback si el PDF viene en formato columnar separado
 */
router.post('/:id/construction-budget/import-from-pdf', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ data: null, error: 'No file uploaded' })
      return
    }

    const projectId = req.params.id
    const { text } = await pdfParse(req.file.buffer)

    // Intentar parser principal (items inline con montos)
    let items = parseConstructionBudgetText(text)

    // Fallback: si encontró muy pocos items, probar formato columnar
    if (items.length < 5) {
      const fallback = parseConstructionBudgetColumnSplit(text)
      if (fallback.length > items.length) items = fallback
    }

    if (items.length === 0) {
      res.status(422).json({
        data: { rawLines: text.split('\n').length, itemsFound: 0, preview: text.slice(0, 2000) },
        error: 'No se pudieron extraer items del PDF. Verifica que sea un construction budget legible (no escaneado/imagen) con items numerados tipo "1.1 Descripción $monto".',
      })
      return
    }

    // Reemplazar el budget actual con los items extraídos
    await prisma.budgetLine.deleteMany({ where: { projectId } })
    let order = 0
    for (const it of items) {
      await prisma.budgetLine.create({
        data: {
          projectId,
          divCode: it.divCode,
          divName: it.divName,
          itemCode: it.itemCode,
          description: it.description.slice(0, 200),
          unit: 'LS',
          vendor: null,
          valorInicial: it.amount,
          valorPresentado: 0,
          valorAprobado: 0,
          pagadoSubs: 0,
          order: order++,
        },
      })
    }

    // FIX: guardar el PDF importado en Cloudinary + registrarlo como ProjectFile
    // (kind construction_budget) para que APAREZCA en la sección Archivos.
    // Best-effort: si Cloudinary falla, el import de líneas NO se pierde.
    try {
      const { url } = await uploadToCloudinary(req.file.buffer, `construction-pm/project-files/${projectId}`, 'raw')
      // Evitar duplicados: un solo ProjectFile de este kind por import (reemplaza el anterior)
      await prisma.projectFile.deleteMany({ where: { projectId, kind: 'construction_budget' } })
      await prisma.projectFile.create({
        data: {
          projectId,
          name: req.file.originalname || 'construction-budget.pdf',
          kind: 'construction_budget',
          category: 'Construction Budget',
          url,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
      })
    } catch (fileErr) {
      console.warn('[construction-budget/import] no se pudo archivar el PDF:', fileErr)
    }

    const totalParsed = items.reduce((s, i) => s + i.amount, 0)
    const sections = Array.from(new Set(items.map(i => i.divName))).filter(n => n !== 'Sin sección')

    res.json({
      data: {
        itemsImported: items.length,
        sections: sections.length,
        sectionNames: sections,
        totalAmount: totalParsed,
        message: `Construction budget importado: ${items.length} items en ${sections.length} sección(es), total ${totalParsed.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      },
      error: null,
    })
  } catch (e) {
    console.error('[construction-budget/import-from-pdf] error:', e)
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
