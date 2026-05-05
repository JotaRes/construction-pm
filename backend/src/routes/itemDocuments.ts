import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = Router()
const prisma = new PrismaClient()

const uploadDir = path.join(__dirname, '../../uploads/item-docs')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]
const upload = multer({
  storage,
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
    const fileUrl = req.file ? `/api/uploads/item-docs/${req.file.filename}` : null
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
      const filePath = path.join(
        __dirname,
        '../../uploads',
        doc.fileUrl.replace('/api/uploads/', ''),
      )
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
    await prisma.itemDocument.delete({ where: { id: req.params.docId } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
