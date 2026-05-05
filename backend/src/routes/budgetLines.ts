import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { BUDGET_LINES_TEMPLATE } from '../data/budgetLinesTemplate'

const router = Router()
const prisma = new PrismaClient()

router.get('/:id/construction-budget', async (req: Request, res: Response) => {
  try {
    const lines = await prisma.budgetLine.findMany({
      where: { projectId: req.params.id },
      orderBy: { order: 'asc' },
    })
    res.json({ data: lines, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:projectId/construction-budget/:id', async (req: Request, res: Response) => {
  try {
    const line = await prisma.budgetLine.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ data: line, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Init budget lines for a new project from template
router.post('/:id/construction-budget/init', async (req: Request, res: Response) => {
  try {
    await prisma.budgetLine.deleteMany({ where: { projectId: req.params.id } })
    let order = 0
    for (const t of BUDGET_LINES_TEMPLATE) {
      await prisma.budgetLine.create({
        data: {
          projectId: req.params.id,
          divCode: t.divCode,
          divName: t.divName,
          itemCode: t.itemCode,
          description: t.description,
          unit: t.unit,
          vendor: t.vendor || null,
          valorInicial: t.valorInicial,
          valorPresentado: 0,
          valorAprobado: 0,
          pagadoSubs: 0,
          order: order++,
        },
      })
    }
    res.json({ data: { count: order }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
