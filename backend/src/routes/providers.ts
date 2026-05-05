import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/:projectId/providers', async (req: Request, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { name: 'asc' },
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

export default router
