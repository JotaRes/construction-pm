import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId, resourceTypeFor } from '../lib/cloudinary'

const router = Router()
const prisma = new PrismaClient()

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const upload = multer({
  storage: multer.memoryStorage(),
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
    const { name, type, phone, email, license, notes } = req.body
    if (!name?.trim()) return res.status(400).json({ data: null, error: 'Nombre requerido' })
    const provider = await prisma.provider.create({
      data: {
        projectId: req.params.projectId,
        name: name.trim(),
        type: type?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        license: license?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: { quotes: true },
    })
    res.json({ data: provider, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:projectId/providers/:id', async (req: Request, res: Response) => {
  try {
    const { name, type, phone, email, license, notes } = req.body
    const provider = await prisma.provider.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type: type?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(license !== undefined && { license: license?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
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
    let fileUrl: string | null = null
    if (req.file) {
      const { url } = await uploadToCloudinary(req.file.buffer, 'construction-pm/provider-quotes', resourceTypeFor(req.file.mimetype))
      fileUrl = url
    }
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
      const publicId = extractPublicId(quote.fileUrl)
      if (publicId) await deleteFromCloudinary(publicId).catch(() => {})
    }
    await prisma.providerQuote.delete({ where: { id: req.params.quoteId } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
