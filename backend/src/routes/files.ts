import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { uploadToCloudinary, resourceTypeFor } from '../lib/cloudinary'
import { PROJECT_DOC_CHECKLIST, DOC_KEYS, GROUP_LABELS } from '../lib/projectDocChecklist'

const router = Router()
const prisma = new PrismaClient()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

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
    const files = await prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    const byKind = new Map<string, any[]>()
    for (const f of files) {
      const k = f.kind || 'otros'
      if (!byKind.has(k)) byKind.set(k, [])
      byKind.get(k)!.push(f)
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

// === POST /projects/:id/files/upload — sube archivo a Cloudinary y crea ProjectFile ===
// Form-data: file (binario), kind (categoría del checklist), name (opcional)
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

    res.json({ data: file, error: null })
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
