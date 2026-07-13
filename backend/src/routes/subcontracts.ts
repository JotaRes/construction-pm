import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId, resourceTypeFor } from '../lib/cloudinary'

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true)
    cb(new Error(`Tipo no permitido: ${file.mimetype}`))
  },
})

const router = Router()

// Listar contratos de subcontratistas por proyecto (con proveedor + calendario de pagos)
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const contracts = await prisma.subcontractorContract.findMany({
      where: { projectId: req.params.projectId },
      include: {
        provider: { select: { id: true, name: true, type: true, phone: true } },
        paymentSchedule: { orderBy: { dueDate: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: contracts, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Crear contrato
router.post('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, ...rest } = req.body ?? {}
    const contract = await prisma.subcontractorContract.create({
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    })
    res.json({ data: contract, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Actualizar contrato
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, ...rest } = req.body ?? {}
    const data: any = { ...rest }
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    const contract = await prisma.subcontractorContract.update({
      where: { id: req.params.id },
      data,
    })
    res.json({ data: contract, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Eliminar contrato (cascade borra sus pagos)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.subcontractorContract.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Agregar pago al calendario del contrato
router.post('/:id/payments', async (req: Request, res: Response) => {
  try {
    const { dueDate, ...rest } = req.body ?? {}
    const payment = await prisma.subcontractorPayment.create({
      data: {
        ...rest,
        contractId: req.params.id,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    })
    res.json({ data: payment, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Marcar pago como pagado — GATE DE LIEN WAIVER (Lote A):
// En Carolina del Sur un sub no pagado (o pagado sin waiver) puede poner un
// mechanic's lien sobre el lote y bloquear la venta. Por eso PAGADO exige
// waiver adjunto, o una excepción EXPLÍCITA con razón que queda registrada.
router.patch('/payments/:paymentId/pay', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.subcontractorPayment.findUnique({ where: { id: req.params.paymentId } })
    if (!existing) return res.status(404).json({ data: null, error: 'Pago no encontrado' })

    const waiverException = typeof req.body?.waiverException === 'string' ? req.body.waiverException.trim() : ''
    if (!existing.lienWaiverUrl && !waiverException) {
      return res.status(409).json({
        data: null,
        error: 'LIEN_WAIVER_REQUERIDO',
        message: 'Este pago no tiene lien waiver adjunto. Sube el waiver firmado del subcontratista, o registra una excepción explícita con la razón (queda en el historial).',
      })
    }

    const payment = await prisma.subcontractorPayment.update({
      where: { id: req.params.paymentId },
      data: {
        status: 'PAGADO',
        paidDate: new Date(),
        ...(waiverException && !existing.lienWaiverUrl ? { waiverException } : {}),
      },
    })
    res.json({ data: payment, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Subir lien waiver firmado de un pago
router.post('/payments/:paymentId/waiver', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'Archivo requerido' })
    const { url } = await uploadToCloudinary(req.file.buffer, 'construction-pm/lien-waivers', resourceTypeFor(req.file.mimetype))
    const payment = await prisma.subcontractorPayment.update({
      where: { id: req.params.paymentId },
      data: {
        lienWaiverUrl: url,
        lienWaiverName: req.file.originalname,
        lienWaiverAt: new Date(),
        waiverException: null, // si ahora hay waiver, la excepción deja de aplicar
      },
    })
    res.json({ data: payment, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Quitar lien waiver (borra el archivo de Cloudinary)
router.delete('/payments/:paymentId/waiver', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.subcontractorPayment.findUnique({ where: { id: req.params.paymentId } })
    if (existing?.lienWaiverUrl) {
      const publicId = extractPublicId(existing.lienWaiverUrl)
      if (publicId) await deleteFromCloudinary(publicId).catch(() => {})
    }
    const payment = await prisma.subcontractorPayment.update({
      where: { id: req.params.paymentId },
      data: { lienWaiverUrl: null, lienWaiverName: null, lienWaiverAt: null },
    })
    res.json({ data: payment, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Eliminar pago del calendario
router.delete('/payments/:paymentId', async (req: Request, res: Response) => {
  try {
    await prisma.subcontractorPayment.delete({ where: { id: req.params.paymentId } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
