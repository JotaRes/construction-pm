import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { parseOrError, inspectionUpdateSchema } from '../lib/validate'

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
    const { data, error } = parseOrError(inspectionUpdateSchema, req.body)
    if (error !== null) return res.status(400).json({ data: null, error })
    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data,
    })
    res.json({ data: inspection, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
