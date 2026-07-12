import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId, resourceTypeFor } from '../lib/cloudinary'

const router = Router()

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

router.get('/:itemId/documents', async (req: Request, res: Response) => {
  try {
    const docs = await prisma.itemDocument.findMany({
      where: { itemId: req.params.itemId },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ data: docs, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/:itemId/documents', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { type = 'OTRO', name, vendor, amount, notes } = req.body
    let fileUrl: string | null = null
    if (req.file) {
      const { url } = await uploadToCloudinary(req.file.buffer, 'construction-pm/item-docs', resourceTypeFor(req.file.mimetype))
      fileUrl = url
    }
    const docName = name || req.file?.originalname || 'Documento'
    const docAmount = amount ? parseFloat(amount) : null
    const doc = await prisma.itemDocument.create({
      data: {
        itemId: req.params.itemId,
        type,
        name: docName,
        vendor: vendor || null,
        amount: docAmount,
        fileUrl,
        notes: notes || null,
      },
    })

    // Anti-duplicidad: si el item tiene proveedor asignado y el doc es FACTURA o COTIZACION,
    // espejarlo automáticamente en el repositorio del proveedor.
    try {
      const item = await prisma.item.findUnique({ where: { id: req.params.itemId } })
      const typeUpper = String(type).toUpperCase()
      if (item?.providerId && (typeUpper === 'FACTURA' || typeUpper === 'COTIZACION') && fileUrl) {
        // Solo si no existe ya un doc del mismo proveedor con la misma URL
        const exists = await prisma.providerDocument.findFirst({
          where: { providerId: item.providerId, fileUrl },
        })
        if (!exists) {
          await prisma.providerDocument.create({
            data: {
              providerId: item.providerId,
              type: typeUpper,
              name: docName,
              amount: docAmount,
              fileUrl,
              mimetype: req.file?.mimetype ?? null,
              size: req.file?.size ?? null,
              notes: `Auto-vinculado desde item ${item.itemCode ?? item.id}`,
            },
          })
        }
      }
    } catch (mirrorErr) {
      console.warn('No se pudo espejar doc al proveedor:', mirrorErr)
    }

    res.json({ data: doc, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:itemId/documents/:docId', async (req: Request, res: Response) => {
  try {
    const doc = await prisma.itemDocument.findUnique({ where: { id: req.params.docId } })
    if (doc?.fileUrl) {
      const publicId = extractPublicId(doc.fileUrl)
      if (publicId) await deleteFromCloudinary(publicId).catch(() => {})
    }
    await prisma.itemDocument.delete({ where: { id: req.params.docId } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
