import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// Dashboard Ejecutivo del HOLDING (página principal): consolida TODOS los
// proyectos técnicos + la posición de caja del módulo financiero en una sola
// vista. Aprovecha que tech y finance comparten el mismo cliente Prisma / DB.
router.get('/executive-summary', async (_req: Request, res: Response) => {
  try {
    const [projects, finAccounts, finMovements] = await Promise.all([
      prisma.project.findMany({
        include: {
          phases: { include: { items: true } },
          draws: { orderBy: { drawNumber: 'desc' } },
          inspections: true,
          tasks: { where: { done: false } },
          budgetLines: true,
        },
      }),
      prisma.finAccount.findMany(),
      prisma.finMovement.findMany(),
    ])

    const now = new Date()

    // === TÉCNICO: por proyecto + agregados ===
    const projectSummaries = projects.map(p => {
      const activeItems = p.phases.flatMap(ph => ph.items.filter(i => !i.esNA))
      const doneItems = activeItems.filter(i => i.completado)
      const progress = activeItems.length > 0 ? Math.round((doneItems.length / activeItems.length) * 100) : 0

      const activePhase = p.phases.find(ph => ph.items.some(i => !i.completado && !i.esNA))
      const totalBudget = p.budgetLines.reduce((s, b) => s + b.valorInicial, 0)
      const totalPaid = p.budgetLines.reduce((s, b) => s + b.pagadoSubs, 0)

      const wired = p.draws.filter(d => d.estado === 'WIRED')
      const totalFunded = wired.reduce((s, d) => s + d.netWire, 0)
      const latestDraw = p.draws[0] || null
      const upbPost = latestDraw?.upbPost ?? 0
      const remainingLoan = Math.max(0, (p.loanAmount || 0) - upbPost)

      const pendingInspections = p.inspections.filter(i => !i.resultado && i.estado !== 'APROBADA').length
      const overdueTasks = p.tasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length

      return {
        id: p.id,
        name: p.name,
        address: p.address,
        spv: p.spv,
        lender: p.lender,
        progress,
        activePhase: activePhase ? { code: activePhase.code, name: activePhase.name } : null,
        totalBudget,
        totalPaid,
        totalItems: activeItems.length,
        loanAmount: p.loanAmount || 0,
        totalFunded,
        remainingLoan,
        latestDraw: latestDraw ? { number: latestDraw.drawNumber, status: latestDraw.estado } : null,
        pendingInspections,
        overdueTasks,
      }
    })

    const totals = projectSummaries.reduce(
      (acc, p) => {
        acc.totalBudget += p.totalBudget
        acc.totalPaid += p.totalPaid
        acc.totalLoan += p.loanAmount
        acc.totalFunded += p.totalFunded
        acc.totalRemainingLoan += p.remainingLoan
        acc.pendingInspections += p.pendingInspections
        acc.overdueTasks += p.overdueTasks
        acc.itemsDone += projectSummaries.length ? 0 : 0
        return acc
      },
      { totalBudget: 0, totalPaid: 0, totalLoan: 0, totalFunded: 0, totalRemainingLoan: 0, pendingInspections: 0, overdueTasks: 0, itemsDone: 0 }
    )

    // Avance global ponderado por nº de ítems
    const allItems = projectSummaries.reduce((s, p) => s + p.totalItems, 0)
    const weightedProgress = allItems > 0
      ? Math.round(projectSummaries.reduce((s, p) => s + p.progress * p.totalItems, 0) / allItems)
      : 0

    // === FINANCIERO: caja consolidada (calculada desde movimientos) ===
    const balances = new Map<number, number>()
    for (const a of finAccounts) balances.set(a.id, a.initialBalance || 0)
    for (const m of finMovements) {
      if (m.type === 'Ingreso') balances.set(m.accountId, (balances.get(m.accountId) || 0) + m.amount)
      else if (m.type === 'Egreso') balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount)
      else if (m.type === 'Interbancario') {
        balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount)
        if (m.destAccountId) balances.set(m.destAccountId, (balances.get(m.destAccountId) || 0) + m.amount)
      }
    }
    const consolidatedCash = Array.from(balances.values()).reduce((s, v) => s + v, 0)
    const totalIngresos = finMovements.filter(m => m.type === 'Ingreso').reduce((s, m) => s + m.amount, 0)
    const totalEgresos = finMovements.filter(m => m.type === 'Egreso').reduce((s, m) => s + m.amount, 0)

    res.json({
      data: {
        portfolio: {
          projectCount: projectSummaries.length,
          weightedProgress,
          ...totals,
          budgetVariancePct: totals.totalBudget > 0
            ? Math.round(((totals.totalPaid - totals.totalBudget) / totals.totalBudget) * 100) : 0,
          projects: projectSummaries.sort((a, b) => b.totalBudget - a.totalBudget),
        },
        finance: {
          consolidatedCash,
          totalIngresos,
          totalEgresos,
          netFlow: totalIngresos - totalEgresos,
          accounts: finAccounts
            .map(a => ({ name: a.name, code: a.code, balance: balances.get(a.id) || 0 }))
            .sort((a, b) => b.balance - a.balance),
        },
      },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
