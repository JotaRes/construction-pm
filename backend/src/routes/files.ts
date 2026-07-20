import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { uploadToCloudinary, resourceTypeFor } from '../lib/cloudinary'
import { PROJECT_DOC_CHECKLIST, DOC_KEYS, GROUP_LABELS } from '../lib/projectDocChecklist'
import { extractTextFromFile } from '../lib/fileExtract'
import {
  parseHUDText, parseLoanText, parseSurveyText, parsePlansText,
  parsePermitText, parseAppraisalText, parseLOIText, parseHudLineItems,
  parseHudAllFees, parseHudAdjustments,
} from './draws'
import { applyExtractedToExecution } from '../lib/executionAutofill'

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
  carta_lender:   { parser: parseLoanText,      fields: ['lender', 'loanNumber', 'loanAmount', 'interestRate', 'loanTermMonths', 'holdback', 'day1Disbursement', 'interestReserve', 'settlementDate', 'arv'] },
  // Permisos
  permiso_construccion: { parser: parsePermitText, fields: ['permitNumber', 'permitIssued', 'permitExpires', 'county'] },
  permiso_electrico:    { parser: parsePermitText, fields: ['permitNumber', 'permitIssued', 'permitExpires'] },
  permiso_hoa:          { parser: parsePermitText, fields: ['permitNumber', 'permitIssued', 'permitExpires'] },
}

// El mapeo `kind` documental → ítems de EJECUCIÓN y la lógica de aplicación viven en
// lib/executionAutofill.ts (compartido con el panel Financiero en routes/draws.ts).

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
      // Seguros y Excel del lender también deben VERSE en Archivos (antes eran invisibles)
      { kind: 'seguros',      url: project?.builderRiskUrl ?? null,     name: project?.builderRiskName ?? "Builder's Risk" },
      { kind: 'otros',        url: project?.drawsExcelUrl ?? null,      name: project?.drawsExcelName ?? 'Excel draws del lender' },
    ]
    for (const v of virtualMap) {
      if (!v.url) continue
      // Dedupe por URL (no por kind): antes, cualquier archivo real en la categoría
      // OCULTABA el documento del panel Financiero — por eso "no aparecían".
      const existing = byKind.get(v.kind) ?? []
      if (existing.some((f: any) => f.url === v.url)) continue
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

    // Construction Budget: si fue IMPORTADO en la sección Const. Budget pero no hay
    // archivo en el checklist, mostrarlo como cargado (sin link si el import antiguo
    // no guardó el PDF; los imports nuevos sí lo guardan como ProjectFile).
    const budgetLineCount = await prisma.budgetLine.count({ where: { projectId } })
    if (budgetLineCount > 0 && (byKind.get('construction_budget')?.length ?? 0) === 0) {
      byKind.set('construction_budget', [{
        id: 'virtual-construction_budget',
        projectId,
        name: `Construction Budget importado (${budgetLineCount} líneas) — ver sección Const. Budget`,
        kind: 'construction_budget',
        category: 'Construction Budget',
        url: null,
        mimetype: null,
        size: null,
        createdAt: new Date().toISOString(),
        source: 'const-budget',
      }])
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
    let executionApplied: Array<{ itemCode: string; activity: string; applied: string[] }> = []
    let extractionError: string | null = null
    let ocrUsed = false
    const parserCfg = kind ? KIND_PARSER_MAP[kind] : undefined

    if (parserCfg) {
      try {
        let ex = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname)
        ocrUsed = ex.ocrUsed
        let meaningful = (ex.text || '').replace(/\s/g, '').length
        if (meaningful >= 10) {
          extracted = parserCfg.parser(ex.text)
        }

        // ── RETRY INTELIGENTE CON OCR FORZADO ──
        // Caso real: HUD escaneado cuyo "texto" de pdf-parse era basura del
        // scanner → el parser no encontró NINGÚN campo. Si el PDF no pasó por
        // OCR y el parseo vino vacío, se fuerza el OCR y se re-parsea. Así la
        // extracción funciona sea PDF nativo, PDF escaneado, JPG o el formato
        // que sea — sin intervención manual.
        const fieldsFound = Object.values(extracted).filter(v => v !== undefined && v !== null && v !== '').length
        const isPdfFile = req.file.mimetype === 'application/pdf' || /\.pdf$/i.test(req.file.originalname || '')
        if (isPdfFile && !ex.ocrUsed && fieldsFound === 0) {
          console.warn('[files/upload] parseo vacío sin OCR — reintentando con OCR forzado, kind:', kind)
          const retry = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname, { forceOcr: true })
          const retryMeaningful = (retry.text || '').replace(/\s/g, '').length
          if (retry.ocrUsed && retryMeaningful >= 10) {
            const retryExtracted = parserCfg.parser(retry.text)
            const retryFields = Object.values(retryExtracted).filter(v => v !== undefined && v !== null && v !== '').length
            if (retryFields > 0 || retryMeaningful > meaningful) {
              ex = retry
              extracted = retryExtracted
              ocrUsed = true
              meaningful = retryMeaningful
            }
          }
        }

        if (meaningful < 10) {
          extractionError = 'No se pudo leer texto del archivo (imagen de baja calidad o formato no soportado). Puedes completar los datos manualmente.'
        } else {
          applied = await applyExtractedToProject(req.params.projectId, extracted, parserCfg.fields)
          // Además de poblar el Project, diligenciar los ítems de la sección Ejecución.
          // Para los documentos de cierre/aprobación del préstamo, además del mapa
          // semántico se extrae el desglose de gastos individuales (underwriting, title,
          // recording, etc.) y se aplica cada fee a su línea de F01.
          // En su propio try para que un fallo aquí no invalide la extracción ya aplicada.
          try {
            let lineItems: Record<string, number> = {}
            let extraFees: Array<{ label: string; amount: number }> = []
            if (kind === 'hud_cierre') {
              // Fees del cierre del préstamo → ítems de F01, conciliados contra el
              // total del borrower (línea 103/1400) para excluir los del vendedor.
              const target = typeof extracted.closingCosts === 'number' ? extracted.closingCosts as number : undefined
              const all = parseHudAllFees(ex.text, target)
              lineItems = all.mapped
              extraFees = all.extras
            } else if (kind === 'hud_lote') {
              // HUD de compra del LOTE: los fees de título YA están agregados en
              // 00.02 (closingCosts) — itemizarlos duplicaría. Solo se agregan los
              // prorrateos de impuestos/HOA (fuera de la línea 1400) como actividades.
              extraFees = parseHudAdjustments(ex.text)
            } else if (kind === 'carta_lender') {
              lineItems = parseHudLineItems(ex.text)
            }
            executionApplied = await applyExtractedToExecution(
              req.params.projectId, kind!, extracted, lineItems, { url, name: file.name }, extraFees,
            )
          } catch (execErr) {
            console.warn('[files/upload] execution auto-fill failed for kind', kind, execErr)
          }
        }
      } catch (e) {
        extractionError = e instanceof Error ? e.message : String(e)
        console.warn('[files/upload] auto-extract failed for kind', kind, e)
      }
    }

    res.json({ data: { file, extracted, applied, executionApplied, ocrUsed, extractionError }, error: null })
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

// DELETE — maneja archivos REALES (ProjectFile) y VIRTUALES (docs guardados en
// campos del Project por el panel Financiero: hudUrl, loiUrl, etc.).
// BUG REPARADO: antes, borrar un doc de "Financiamiento" fallaba con 500 porque
// el id "virtual-hud_cierre" no existe en ProjectFile. Ahora un id virtual
// limpia los campos correspondientes del Project (el doc desaparece de AMBAS
// vistas: Archivos y panel Financiero — es el mismo documento).
const VIRTUAL_FIELD_MAP: Record<string, { url: string; name: string }> = {
  loi_lender:   { url: 'loiUrl',             name: 'loiName' },
  carta_lender: { url: 'approvalLetterUrl',  name: 'approvalLetterName' },
  hud_cierre:   { url: 'hudUrl',             name: 'hudName' },
  otros:        { url: 'otrosFinancieroUrl', name: 'otrosFinancieroName' },
  seguros:      { url: 'builderRiskUrl',     name: 'builderRiskName' },
}

router.delete('/:projectId/files/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    if (id.startsWith('virtual-')) {
      const kind = id.replace('virtual-', '')
      const fieldMap = VIRTUAL_FIELD_MAP[kind]
      if (!fieldMap) {
        return res.status(400).json({ data: null, error: `Documento virtual "${kind}" no se puede eliminar desde aquí.` })
      }
      await prisma.project.update({
        where: { id: req.params.projectId },
        data: { [fieldMap.url]: null, [fieldMap.name]: null },
      })
      return res.json({ data: { ok: true, virtual: true }, error: null })
    }
    await prisma.projectFile.delete({ where: { id } })
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
