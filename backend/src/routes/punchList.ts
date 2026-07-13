// ============================================================
// PUNCH LIST (Lote B) — cierre de obra (Etapa 9).
// Cada defecto tiene responsable, severidad, evidencia fotográfica
// y flujo ABIERTO → CORREGIDO → VERIFICADO. Los ALTA bloquean cierre.
// ============================================================
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId, resourceTypeFor } from '../lib/cloudinary'
import { punchCreateSchema, punchUpdateSchema, zodMsg } from '../lib/validate'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype)
    ok ? cb(null, true) : cb(new Error(`Tipo no permitido: ${file.mimetype}`))
  },
})

router.get('/:projectId/punch-list', async (req: Request, res: Response) => {
  try {
    const items = await prisma.punchListItem.findMany({
      where: { projectId: req.params.projectId },
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
    })
    const totals = {
      abiertos: items.filter(i => i.status === 'ABIERTO').length,
      corregidos: items.filter(i => i.status === 'CORREGIDO').length,
      verificados: items.filter(i => i.status === 'VERIFICADO').length,
      altasAbiertas: items.filter(i => i.status !== 'VERIFICADO' && i.severity === 'ALTA').length,
    }
    res.json({ data: { items, totals }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/:projectId/punch-list', async (req: Request, res: Response) => {
  try {
    const parsed = punchCreateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ data: null, error: zodMsg(parsed.error) })
    const item = await prisma.punchListItem.create({
      data: { ...parsed.data, projectId: req.params.projectId },
    })
    res.json({ data: item, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:projectId/punch-list/:id', async (req: Request, res: Response) => {
  try {
    const parsed = punchUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ data: null, error: zodMsg(parsed.error) })
    const data: Record<string, unknown> = { ...parsed.data }
    // resolvedAt automático al VERIFICAR; se limpia si reabre
    if (parsed.data.status === 'VERIFICADO') data.resolvedAt = new Date()
    else if (parsed.data.status === 'ABIERTO') data.resolvedAt = null
    const item = await prisma.punchListItem.update({ where: { id: req.params.id }, data })
    res.json({ data: item, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/:projectId/punch-list/:id/photo', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'Archivo requerido' })
    const { url } = await uploadToCloudinary(req.file.buffer, 'construction-pm/punch-list', resourceTypeFor(req.file.mimetype))
    const item = await prisma.punchListItem.update({
      where: { id: req.params.id },
      data: { photoUrl: url, photoName: req.file.originalname },
    })
    res.json({ data: item, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:projectId/punch-list/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.punchListItem.findUnique({ where: { id: req.params.id } })
    if (existing?.photoUrl) {
      const publicId = extractPublicId(existing.photoUrl)
      if (publicId) await deleteFromCloudinary(publicId).catch(() => {})
    }
    await prisma.punchListItem.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
