// ============================================================
// SUBACTIVIDADES de una actividad (Item) de Ejecución
// ============================================================
// El "valor" de cada subactividad es EJECUTADO. Cuando una actividad tiene
// subactividades, su Item.valorEjecutado = Σ subactividades (roll-up guardado),
// de modo que fases, dashboard y alertas lo reflejan sin cambios adicionales.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId, resourceTypeFor } from '../lib/cloudinary'

const router = Router()

// Upload de invoice/soporte de subactividad (mismo patrón que item-docs)
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true)
    cb(new Error(`Tipo no permitido: ${file.mimetype}. Use PDF, JPG o PNG.`))
  },
})

// Recalcula y GUARDA Item.valorEjecutado = valorEjecutadoBase + Σ subactividades.
// Las subactividades SUMAN al valor propio de la actividad, no lo reemplazan.
export async function recomputeItemExecuted(itemId: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { valorEjecutadoBase: true, subactivities: { select: { valorEjecutado: true } } },
  })
  if (!item) return
  const sumSubs = item.subactivities.reduce((s, x) => s + (x.valorEjecutado || 0), 0)
  await prisma.item.update({
    where: { id: itemId },
    data: { valorEjecutado: (item.valorEjecutadoBase || 0) + sumSubs },
  })
}

// Listar subactividades de una actividad
router.get('/items/:itemId/subactivities', async (req: Request, res: Response) => {
  try {
    const subs = await prisma.subActivity.findMany({
      where: { itemId: req.params.itemId },
      orderBy: { order: 'asc' },
    })
    res.json({ data: subs, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Crear subactividad
router.post('/items/:itemId/subactivities', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params
    const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } })
    if (!item) return res.status(404).json({ data: null, error: 'Item not found' })

    const count = await prisma.subActivity.count({ where: { itemId } })
    const sub = await prisma.subActivity.create({
      data: {
        itemId,
        description: (req.body?.description ?? 'Nueva subactividad').toString(),
        valorEjecutado: Number(req.body?.valorEjecutado ?? 0) || 0,
        order: count,
        // Control administrativo (opcional al crear)
        fecha: req.body?.fecha ? new Date(req.body.fecha) : null,
        responsable: req.body?.responsable ? String(req.body.responsable) : null,
        observaciones: req.body?.observaciones ? String(req.body.observaciones) : null,
      },
    })
    await recomputeItemExecuted(itemId)
    res.json({ data: sub, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Editar subactividad (descripción / valor)
router.patch('/subactivities/:id', async (req: Request, res: Response) => {
  try {
    const data: Record<string, unknown> = {}
    if (req.body?.description !== undefined) data.description = String(req.body.description)
    if (req.body?.valorEjecutado !== undefined) data.valorEjecutado = Number(req.body.valorEjecutado) || 0
    if (req.body?.order !== undefined) data.order = Number(req.body.order)
    // Control administrativo: fecha de ejecución, quién lo hizo, observaciones
    if (req.body?.fecha !== undefined) data.fecha = req.body.fecha ? new Date(req.body.fecha) : null
    if (req.body?.responsable !== undefined) data.responsable = req.body.responsable ? String(req.body.responsable) : null
    if (req.body?.observaciones !== undefined) data.observaciones = req.body.observaciones ? String(req.body.observaciones) : null
    const sub = await prisma.subActivity.update({ where: { id: req.params.id }, data })
    await recomputeItemExecuted(sub.itemId)
    res.json({ data: sub, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Subir/reemplazar invoice o soporte de la subactividad (PDF/JPG/PNG → Cloudinary)
router.post('/subactivities/:id/invoice', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'No se subió ningún archivo' })
    const existing = await prisma.subActivity.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ data: null, error: 'Subactividad no encontrada' })

    const { url } = await uploadToCloudinary(req.file.buffer, 'construction-pm/subactivity-invoices', resourceTypeFor(req.file.mimetype))
    // Si había un soporte anterior, se elimina de Cloudinary (best-effort)
    if (existing.invoiceUrl) {
      const publicId = extractPublicId(existing.invoiceUrl)
      if (publicId) deleteFromCloudinary(publicId).catch(() => {})
    }
    const sub = await prisma.subActivity.update({
      where: { id: req.params.id },
      data: { invoiceUrl: url, invoiceName: req.file.originalname || 'invoice.pdf' },
    })
    res.json({ data: sub, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Quitar el invoice de la subactividad (no borra la subactividad)
router.delete('/subactivities/:id/invoice', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.subActivity.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ data: null, error: 'Subactividad no encontrada' })
    if (existing.invoiceUrl) {
      const publicId = extractPublicId(existing.invoiceUrl)
      if (publicId) deleteFromCloudinary(publicId).catch(() => {})
    }
    const sub = await prisma.subActivity.update({
      where: { id: req.params.id },
      data: { invoiceUrl: null, invoiceName: null },
    })
    res.json({ data: sub, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Eliminar subactividad (borra también su invoice de Cloudinary, best-effort)
router.delete('/subactivities/:id', async (req: Request, res: Response) => {
  try {
    const sub = await prisma.subActivity.delete({ where: { id: req.params.id } })
    if (sub.invoiceUrl) {
      const publicId = extractPublicId(sub.invoiceUrl)
      if (publicId) deleteFromCloudinary(publicId).catch(() => {})
    }
    await recomputeItemExecuted(sub.itemId)
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
