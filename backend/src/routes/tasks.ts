import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

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
        tipo: req.body.tipo === 'NOTA' ? 'NOTA' : 'TAREA',
        title: req.body.title ?? 'Nueva tarea',
        responsable: req.body.responsable ?? null,
        responsableEmail: req.body.responsableEmail ?? null,
        priority: req.body.priority ?? 'NORMAL',
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
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
    const data: any = { ...req.body }
    if (data.dueDate && typeof data.dueDate === 'string') data.dueDate = new Date(data.dueDate)
    // Si se marca como completada, registrar la fecha
    if (data.done === true) {
      const current = await prisma.task.findUnique({ where: { id: req.params.id } })
      if (current && !current.done) data.completedAt = new Date()
    } else if (data.done === false) {
      data.completedAt = null
    }
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
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
