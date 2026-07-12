import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { uploadToCloudinary, resourceTypeFor } from '../lib/cloudinary'
import { PROJECT_DOC_CHECKLIST, DOC_KEYS, GROUP_LABELS } from '../lib/projectDocChecklist'
import { extractTextFromFile } from '../lib/fileExtract'
import {
  parseHUDText, parseLoanText, parseSurveyText, parsePlansText,
  parsePermitText, parseAppraisalText, parseLOIText,
} from './draws'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// Mapeo de `kind` del checklist documental a parser + campos que se aplican al proyecto.
// Cuando el usuario sube un archivo con cualquiera de estos kinds, el sistema
// extrae automáticamente los datos del PDF (con OCR si está escaneado) y
// actualiza el Project SIN sobrescribir valores ya configurados a mano.
//
// Cualquier nuevo tipo de documento se agrega aquí — TODO upload pasa por el
// mismo flujo: archivo → Cloudinary → parser → aplicar al Project.
const KIND_PARSER_MAP: Record<string, {
  parser: (text: string) => Record<string, unknown>;
  fields: string[];
}> = {
  // Documentos de diseño: plano principal + variantes (site, drenaje, landscape)
  planos:         { parser: parsePlansText,     fields: ['sfHeated', 'sfGarage', 'sfPorches', 'bedrooms', 'bathrooms', 'foundationType', 'architecturalPlan'] },
  licencia_plano: { parser: parsePlansText,     fields: ['sfHeated', 'sfGarage', 'sfPorches', 'bedrooms', 'bathrooms', 'foundationType'] },
  siteplan:       { parser: parsePlansText,     fields: ['sfHeated', 'sfGarage', 'sfPorches', 'foundationType'] },
  drenaje:        { parser: parsePlansText,     fields: ['foundationType'] },
  landscape:      { parser: parsePlansText,     fields: ['sfPorches'] },
  // Lote
  survey:         { parser: parseSurveyText,    fields: ['parcelId', 'lotAcres', 'address', 'county'] },
  hud_lote:       { parser: parseHUDText,       fields: ['settlementDate', 'closingCosts', 'cashAtSettlement', 'contractSalesPrice'] },
  // Financiamiento
  hud_cierre:     { parser: parseHUDText,       fields: ['settlementDate', 'closingCosts', 'cashAtSettlement', 'contractSalesPrice', 'loanAmount', 'holdback'] },
  loi_lender:     { parser: parseLOIText,       fields: ['loiSalePrice', 'loiOfferDate', 'loiExpectedClose', 'loiEarnestMoney'] },
  carta_lender:   { parser: parseLoanText,      fields: ['lender', 'loanNumber', 'loanAmount', 'interestRate', 'loanTermMonths', 'holdback', 'day1Disbursement', 'interestReserve', 'settlementDate'] },
  // Permisos
  permiso_construccion: { parser: parsePermitText, fields: ['permitNumber', 'permitIssued', 'permitExpires', 'county'] },
  permiso_electrico:    { parser: parsePermitText, fields: ['permitNumber', 'permitIssued', 'permitExpires'] },
  permiso_hoa:          { parser: parsePermitText, fields: ['permitNumber', 'permitIssued', 'permitExpires'] },
}

// Aplica datos extraídos al proyecto SIN sobrescribir valores ya configurados.
// Sólo actualiza un campo si su valor actual es null/0/'' (placeholder).
// Esto evita que un re-upload accidental pise datos curados a mano.
async function applyExtractedToProject(
  projectId: string,
  extracted: Record<string, unknown>,
  allowedFields: string[],
): Promise<string[]> {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return []
  const update: Record<string, unknown> = {}
  const applied: string[] = []
  for (const k of allowedFields) {
    const v = extracted[k]
    if (v === undefined || v === null || v === '') continue
    const current = (project as Record<string, unknown>)[k]
    // Sólo aplicar si el valor actual es vacío/zero
    const isEmpty = current === null || current === undefined || current === '' || current === 0
    if (!isEmpty) continue
    update[k] = v
    applied.push(k)
  }
  if (applied.length > 0) {
    await prisma.project.update({ where: { id: projectId }, data: update })
  }
  return applied
}

// === GET /projects/:id/files — listar todos los archivos ===
router.get('/:projectId/files', async (req: Request, res: Response) => {
  try {
    const files = await prisma.projectFile.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: files, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === GET /projects/:id/document-checklist — estado del checklist ===
// Retorna cada categoría con sus archivos y el estado (complete/empty/missing).
router.get('/:projectId/document-checklist', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId
    const [files, project] = await Promise.all([
      prisma.projectFile.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
      prisma.project.findUnique({ where: { id: projectId } }),
    ])

    const byKind = new Map<string, any[]>()
    for (const f of files) {
      const k = f.kind || 'otros'
      if (!byKind.has(k)) byKind.set(k, [])
      byKind.get(k)!.push(f)
    }

    // Anti-duplicidad: incluir docs del módulo Financiero como "virtual files"
    // para que aparezcan en el checklist sin duplicar el upload.
    // Cada doc almacenado en Project (loiUrl, approvalLetterUrl, hudUrl, otrosFinancieroUrl)
    // se materializa como un ProjectFile virtual con el kind del checklist correspondiente.
    const virtualMap: Array<{ kind: string; url: string | null; name: string | null }> = [
      { kind: 'loi_lender',   url: project?.loiUrl ?? null,             name: project?.loiName ?? null },
      { kind: 'carta_lender', url: project?.approvalLetterUrl ?? null,  name: project?.approvalLetterName ?? null },
      { kind: 'hud_cierre',   url: project?.hudUrl ?? null,             name: project?.hudName ?? null },
      { kind: 'otros',        url: project?.otrosFinancieroUrl ?? null, name: project?.otrosFinancieroName ?? null },
    ]
    for (const v of virtualMap) {
      if (!v.url) continue
      // Si ya hay un ProjectFile real para ese kind, no agregamos el virtual (priorizamos lo real)
      if ((byKind.get(v.kind)?.length ?? 0) > 0) continue
      const virt = {
        id: `virtual-${v.kind}`,
        projectId,
        name: v.name || v.kind,
        kind: v.kind,
        category: PROJECT_DOC_CHECKLIST.find((d) => d.key === v.kind)?.label ?? 'Financiero',
        url: v.url,
        mimetype: null,
        size: null,
        createdAt: new Date().toISOString(),
        source: 'financiero',  // marca de origen para el frontend
      }
      if (!byKind.has(v.kind)) byKind.set(v.kind, [])
      byKind.get(v.kind)!.push(virt)
    }

    const items = PROJECT_DOC_CHECKLIST.map((spec) => {
      const filesInKind = byKind.get(spec.key) || []
      const status = filesInKind.length > 0 ? 'complete' : spec.required ? 'missing' : 'optional'
      return {
        ...spec,
        files: filesInKind,
        count: filesInKind.length,
        status,
      }
    })

    // Categorización adicional: archivos antiguos sin kind asignado
    const unclassified = files.filter((f) => !f.kind || !DOC_KEYS.includes(f.kind))

    const required = items.filter((i) => i.required)
    const missingRequired = required.filter((i) => i.status === 'missing')
    const completePct = required.length > 0 ? (required.length - missingRequired.length) / required.length : 1

    res.json({
      data: {
        items,
        groups: Object.entries(GROUP_LABELS).map(([key, label]) => ({
          key, label,
          items: items.filter((i) => i.group === key),
        })),
        summary: {
          totalRequired: required.length,
          completed: required.length - missingRequired.length,
          missing: missingRequired.length,
          missingKeys: missingRequired.map((i) => i.key),
          completePct,
          unclassifiedCount: unclassified.length,
        },
        unclassified,
      },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === POST /projects/:id/files — referencia simple por URL (legacy) ===
router.post('/:projectId/files', async (req: Request, res: Response) => {
  try {
    const file = await prisma.projectFile.create({
      data: { ...req.body, projectId: req.params.projectId },
    })
    res.json({ data: file, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === POST /projects/:id/files/upload — sube archivo + auto-extrae datos ===
// Form-data: file (binario), kind (categoría del checklist), name (opcional)
// Si el kind tiene parser asociado (KIND_PARSER_MAP), el sistema:
//   1. Sube el archivo a Cloudinary
//   2. Extrae texto del PDF (OCR fallback si está escaneado)
//   3. Aplica los campos extraídos al Project sin sobrescribir valores existentes
//   4. Devuelve { file, extracted, applied } para que el frontend muestre feedback
//
// Resuelve el bug: antes del fix, subir un plano sólo guardaba el PDF; ahora
// también puebla sfHeated/sfGarage/etc en el Project que alimenta CFO Dashboard.
router.post('/:projectId/files/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'No se subió archivo' })
    const { kind, name } = req.body
    if (kind && !DOC_KEYS.includes(kind)) {
      return res.status(400).json({ data: null, error: `Categoría "${kind}" no válida` })
    }

    const folder = `construction-pm/project-files/${req.params.projectId}`
    const { url } = await uploadToCloudinary(
      req.file.buffer,
      folder,
      resourceTypeFor(req.file.mimetype)
    )

    const file = await prisma.projectFile.create({
      data: {
        projectId: req.params.projectId,
        name: name || req.file.originalname,
        kind: kind || 'otros',
        category: kind ? PROJECT_DOC_CHECKLIST.find((d) => d.key === kind)?.label : 'Otro',
        url,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    })

    // Auto-extracción UNIVERSAL: si el kind tiene parser, se extrae texto del
    // archivo sin importar el formato (PDF, imagen con OCR, Word .docx, Excel) y
    // se autocompletan las casillas vacías del proyecto.
    let extracted: Record<string, unknown> = {}
    let applied: string[] = []
    let extractionError: string | null = null
    let ocrUsed = false
    const parserCfg = kind ? KIND_PARSER_MAP[kind] : undefined

    if (parserCfg) {
      try {
        const ex = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname)
        ocrUsed = ex.ocrUsed
        const meaningful = (ex.text || '').replace(/\s/g, '').length
        if (meaningful < 10) {
          extractionError = 'No se pudo leer texto del archivo (imagen de baja calidad o formato no soportado). Puedes completar los datos manualmente.'
        } else {
          extracted = parserCfg.parser(ex.text)
          applied = await applyExtractedToProject(req.params.projectId, extracted, parserCfg.fields)
        }
      } catch (e) {
        extractionError = e instanceof Error ? e.message : String(e)
        console.warn('[files/upload] auto-extract failed for kind', kind, e)
      }
    }

    res.json({ data: { file, extracted, applied, ocrUsed, extractionError }, error: null })
  } catch (e) {
    console.error('[files/upload] error:', e)
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === PATCH /projects/:id/files/:fileId — actualizar metadata (cambiar categoría, renombrar) ===
router.patch('/:projectId/files/:id', async (req: Request, res: Response) => {
  try {
    const allowed: any = {}
    if (req.body.name !== undefined) allowed.name = req.body.name
    if (req.body.kind !== undefined) {
      if (req.body.kind && !DOC_KEYS.includes(req.body.kind)) {
        return res.status(400).json({ data: null, error: `Categoría "${req.body.kind}" no válida` })
      }
      allowed.kind = req.body.kind
      allowed.category = req.body.kind ? PROJECT_DOC_CHECKLIST.find((d) => d.key === req.body.kind)?.label : null
    }
    if (req.body.category !== undefined) allowed.category = req.body.category
    const updated = await prisma.projectFile.update({
      where: { id: req.params.id },
      data: allowed,
    })
    res.json({ data: updated, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:projectId/files/:id', async (req: Request, res: Response) => {
  try {
    await prisma.projectFile.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === GET /projects/:id/files/checklist-spec — lista del catálogo (para frontend) ===
router.get('/checklist-spec', async (_req: Request, res: Response) => {
  res.json({ data: { items: PROJECT_DOC_CHECKLIST, groups: GROUP_LABELS }, error: null })
})

export default router
