import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/:projectId/files', async (req: Request, res: Response) => {
  try {
    const files = await prisma.projectFile.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: files, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/:projectId/files', async (req: Request, res: Response) => {
  try {
    const file = await prisma.projectFile.create({
      data: { ...req.body, projectId: req.params.projectId },
    })
    res.json({ data: file, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:projectId/files/:id', async (req: Request, res: Response) => {
  try {
    await prisma.projectFile.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
