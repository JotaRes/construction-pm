// ============================================================
// CHANGE ORDERS — control formal de cambios de alcance (Lote A)
// Presupuesto ajustado = budget original + SUM(costDelta APROBADOS).
// Cronograma ajustado = target + SUM(daysDelta APROBADOS).
// ============================================================
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId, resourceTypeFor } from '../lib/cloudinary'
import { changeOrderCreateSchema, changeOrderUpdateSchema, zodMsg } from '../lib/validate'

const router = Router()

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true)
    cb(new Error(`Tipo no permitido: ${file.mimetype}`))
  },
})

const includeRefs = {
  contract: { include: { provider: { select: { id: true, name: true } } } },
  budgetLine: { select: { id: true, itemCode: true, description: true } },
}

// Listar COs del proyecto + totales
router.get('/:projectId/change-orders', async (req: Request, res: Response) => {
  try {
    const orders = await prisma.changeOrder.findMany({
      where: { projectId: req.params.projectId },
      include: includeRefs,
      orderBy: { coNumber: 'desc' },
    })
    const approved = orders.filter(o => o.status === 'APROBADO')
    const totals = {
      approvedCost: approved.reduce((s, o) => s + o.costDelta, 0),
      approvedDays: approved.reduce((s, o) => s + o.daysDelta, 0),
      approvedCount: approved.length,
      pendingCount: orders.filter(o => o.status === 'BORRADOR').length,
    }
    res.json({ data: { orders, totals }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Crear CO (consecutivo automático por proyecto)
router.post('/:projectId/change-orders', async (req: Request, res: Response) => {
  try {
    const parsed = changeOrderCreateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ data: null, error: zodMsg(parsed.error) })
    const last = await prisma.changeOrder.findFirst({
      where: { projectId: req.params.projectId },
      orderBy: { coNumber: 'desc' },
      select: { coNumber: true },
    })
    const order = await prisma.changeOrder.create({
      data: { ...parsed.data, projectId: req.params.projectId, coNumber: (last?.coNumber ?? 0) + 1 },
      include: includeRefs,
    })
    res.json({ data: order, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Editar CO (solo en BORRADOR se permite editar montos/días)
router.patch('/:projectId/change-orders/:id', async (req: Request, res: Response) => {
  try {
    const parsed = changeOrderUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ data: null, error: zodMsg(parsed.error) })
    const existing = await prisma.changeOrder.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ data: null, error: 'Change order no encontrado' })
    if (existing.status !== 'BORRADOR' && (parsed.data.costDelta !== undefined || parsed.data.daysDelta !== undefined)) {
      return res.status(409).json({ data: null, error: 'Un CO aprobado/rechazado no se puede modificar en monto o días. Crea un CO nuevo.' })
    }
    const order = await prisma.changeOrder.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: includeRefs,
    })
    res.json({ data: order, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Aprobar / Rechazar
router.post('/:projectId/change-orders/:id/decide', async (req: Request, res: Response) => {
  try {
    const { decision, approvedBy } = req.body as { decision?: string; approvedBy?: string }
    if (decision !== 'APROBADO' && decision !== 'RECHAZADO') {
      return res.status(400).json({ data: null, error: 'decision debe ser APROBADO o RECHAZADO' })
    }
    if (!approvedBy || !approvedBy.trim()) {
      return res.status(400).json({ data: null, error: 'Indica quién toma la decisión (approvedBy)' })
    }
    const order = await prisma.changeOrder.update({
      where: { id: req.params.id },
      data: { status: decision, approvedBy: approvedBy.trim(), approvedAt: new Date() },
      include: includeRefs,
    })
    res.json({ data: order, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Subir documento soporte (CO firmado)
router.post('/:projectId/change-orders/:id/document', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'Archivo requerido' })
    const { url } = await uploadToCloudinary(req.file.buffer, 'construction-pm/change-orders', resourceTypeFor(req.file.mimetype))
    const order = await prisma.changeOrder.update({
      where: { id: req.params.id },
      data: { docUrl: url, docName: req.file.originalname },
      include: includeRefs,
    })
    res.json({ data: order, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Eliminar CO (borra soporte en Cloudinary si existe)
router.delete('/:projectId/change-orders/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.changeOrder.findUnique({ where: { id: req.params.id } })
    if (existing?.docUrl) {
      const publicId = extractPublicId(existing.docUrl)
      if (publicId) await deleteFromCloudinary(publicId).catch(() => {})
    }
    await prisma.changeOrder.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
