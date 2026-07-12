import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/:projectId/phases', async (req: Request, res: Response) => {
  try {
    const phases = await prisma.phase.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { order: 'asc' },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: {
            provider: true,
            documents: { select: { id: true, type: true } },
          },
        },
      },
    })
    res.json({ data: phases, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Resumen consolidado de fases: % avance, fechas reales y Budget vs Actual por fase.
// Budget se cruza por BudgetLine.divCode === Phase.code.
router.get('/:projectId/phases-summary', async (req: Request, res: Response) => {
  const { projectId } = req.params
  try {
    const phases = await prisma.phase.findMany({
      where: { projectId },
      include: { items: { include: { documents: true } } },
      orderBy: { order: 'asc' },
    })

    const budgetLines = await prisma.budgetLine.findMany({ where: { projectId } })

    // Las fases usan código "F07" y las BudgetLine "DIV 07": normalizamos al
    // número de división para cruzar budget vs avance. Fallback a igualdad exacta.
    const divNum = (s: string | null | undefined): number | null => {
      if (!s) return null
      const m = s.match(/(\d+)\s*$/)
      return m ? parseInt(m[1], 10) : null
    }

    const summary = phases.map((phase) => {
      const totalItems = phase.items.length
      const completedItems = phase.items.filter((i) => i.completado).length
      const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

      const phaseDiv = divNum(phase.code)
      const phaseLines = budgetLines.filter((bl) =>
        bl.divCode === phase.code ||
        (phaseDiv !== null && divNum(bl.divCode) === phaseDiv)
      )
      const budgetTotal = phaseLines.reduce((s, bl) => s + bl.valorInicial, 0)
      const approvedTotal = phaseLines.reduce((s, bl) => s + bl.valorAprobado, 0)
      const paidTotal = phaseLines.reduce((s, bl) => s + bl.pagadoSubs, 0)

      const startDates = phase.items
        .filter((i) => i.fechaInicioReal)
        .map((i) => i.fechaInicioReal!.getTime())
      const endDates = phase.items
        .filter((i) => i.fechaFinReal)
        .map((i) => i.fechaFinReal!.getTime())

      return {
        id: phase.id,
        code: phase.code,
        name: phase.name,
        groupName: phase.groupName,
        order: phase.order,
        totalItems,
        completedItems,
        progressPct,
        budgetTotal,
        approvedTotal,
        paidTotal,
        variancePct: budgetTotal > 0
          ? Math.round(((paidTotal - budgetTotal) / budgetTotal) * 100)
          : 0,
        startDateReal: startDates.length > 0 ? new Date(Math.min(...startDates)) : null,
        endDateReal: endDates.length > 0 ? new Date(Math.max(...endDates)) : null,
        status: progressPct === 100 ? 'COMPLETA'
          : progressPct > 0 ? 'EN_CURSO'
          : 'PENDIENTE',
      }
    })

    res.json({ data: summary, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
