import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const refs = await prisma.priceRef.findMany({
      orderBy: [{ category: 'asc' }, { description: 'asc' }],
    })
    res.json({ data: refs, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const ref = await prisma.priceRef.create({ data: req.body })
    res.json({ data: ref, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const ref = await prisma.priceRef.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ data: ref, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.priceRef.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
