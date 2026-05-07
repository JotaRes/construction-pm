import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = Router()
const prisma = new PrismaClient()

const quoteDir = path.join(__dirname, '../../uploads/provider-quotes')
if (!fs.existsSync(quoteDir)) fs.mkdirSync(quoteDir, { recursive: true })

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const upload = multer({
  storage: multer.diskStorage({
    destination: quoteDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true)
    cb(new Error(`Tipo no permitido: ${file.mimetype}`))
  },
})

// ── Providers CRUD ──────────────────────────────────────────────
router.get('/:projectId/providers', async (req: Request, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { name: 'asc' },
      include: { quotes: { orderBy: { createdAt: 'desc' } } },
    })
    res.json({ data: providers, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/:projectId/providers', async (req: Request, res: Response) => {
  try {
    const provider = await prisma.provider.create({
      data: { ...req.body, projectId: req.params.projectId },
      include: { quotes: true },
    })
    res.json({ data: provider, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:projectId/providers/:id', async (req: Request, res: Response) => {
  try {
    const provider = await prisma.provider.update({
      where: { id: req.params.id },
      data: req.body,
      include: { quotes: true },
    })
    res.json({ data: provider, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:projectId/providers/:id', async (req: Request, res: Response) => {
  try {
    await prisma.provider.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// ── Provider Quotes ─────────────────────────────────────────────
router.get('/:projectId/providers/:providerId/quotes', async (req: Request, res: Response) => {
  try {
    const quotes = await prisma.providerQuote.findMany({
      where: { providerId: req.params.providerId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: quotes, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/:projectId/providers/:providerId/quotes', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { description, amount, date, notes } = req.body
    const fileUrl = req.file ? `/api/uploads/provider-quotes/${req.file.filename}` : null
    const quote = await prisma.providerQuote.create({
      data: {
        providerId: req.params.providerId,
        description: description || 'Cotización',
        amount: parseFloat(amount) || 0,
        date: date ? new Date(date) : null,
        fileUrl,
        notes: notes || null,
      },
    })
    res.json({ data: quote, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:projectId/providers/:providerId/quotes/:quoteId', async (req: Request, res: Response) => {
  try {
    const quote = await prisma.providerQuote.findUnique({ where: { id: req.params.quoteId } })
    if (quote?.fileUrl) {
      const fp = path.join(__dirname, '../../uploads', quote.fileUrl.replace('/api/uploads/', ''))
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    }
    await prisma.providerQuote.delete({ where: { id: req.params.quoteId } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
