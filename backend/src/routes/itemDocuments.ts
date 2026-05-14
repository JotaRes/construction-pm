import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from '../lib/cloudinary'

const router = Router()
const prisma = new PrismaClient()

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
      const { url } = await uploadToCloudinary(req.file.buffer, 'construction-pm/item-docs')
      fileUrl = url
    }
    const doc = await prisma.itemDocument.create({
      data: {
        itemId: req.params.itemId,
        type,
        name: name || req.file?.originalname || 'Documento',
        vendor: vendor || null,
        amount: amount ? parseFloat(amount) : null,
        fileUrl,
        notes: notes || null,
      },
    })
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
