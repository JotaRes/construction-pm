import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/:id/tasks', async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { projectId: req.params.id },
      orderBy: [{ done: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    })
    res.json({ data: tasks, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/:id/tasks', async (req: Request, res: Response) => {
  try {
    const count = await prisma.task.count({ where: { projectId: req.params.id } })
    const task = await prisma.task.create({
      data: {
        projectId: req.params.id,
        title: req.body.title ?? 'Nueva tarea',
        priority: req.body.priority ?? 'NORMAL',
        dueDate: req.body.dueDate ?? null,
        notes: req.body.notes ?? null,
        order: count,
      },
    })
    res.json({ data: task, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:projectId/tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ data: task, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:projectId/tasks/:id', async (req: Request, res: Response) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
