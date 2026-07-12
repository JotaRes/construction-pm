import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/:projectId/inspections', async (req: Request, res: Response) => {
  try {
    const inspections = await prisma.inspection.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { order: 'asc' },
    })
    res.json({ data: inspections, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:projectId/inspections/:id', async (req: Request, res: Response) => {
  try {
    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ data: inspection, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
