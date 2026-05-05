import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/:projectId/notes', async (req: Request, res: Response) => {
  try {
    const notes = await prisma.note.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: notes, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/:projectId/notes', async (req: Request, res: Response) => {
  try {
    const note = await prisma.note.create({
      data: { ...req.body, projectId: req.params.projectId },
    })
    res.json({ data: note, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:projectId/notes/:id', async (req: Request, res: Response) => {
  try {
    const note = await prisma.note.update({ where: { id: req.params.id }, data: req.body })
    res.json({ data: note, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:projectId/notes/:id', async (req: Request, res: Response) => {
  try {
    await prisma.note.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
