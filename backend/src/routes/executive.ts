import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// Dashboard Ejecutivo Cruzado: estado técnico de UN proyecto de obra +
// posición de caja consolidada del holding (módulo financiero).
// Aprovecha que tech y finance comparten el mismo cliente Prisma / la misma DB.
router.get('/:projectId/executive-summary', async (req: Request, res: Response) => {
  const { projectId } = req.params
  try {
    const [project, phases, draws, inspections, tasks, budgetLines, finAccounts, finMovements] =
      await Promise.all([
        prisma.project.findUnique({ where: { id: projectId } }),
        prisma.phase.findMany({ where: { projectId }, include: { items: true }, orderBy: { order: 'asc' } }),
        prisma.draw.findMany({ where: { projectId }, orderBy: { drawNumber: 'desc' } }),
        prisma.inspection.findMany({ where: { projectId } }),
        prisma.task.findMany({ where: { projectId, done: false } }),
        prisma.budgetLine.findMany({ where: { projectId } }),
        prisma.finAccount.findMany(),
        prisma.finMovement.findMany(),
      ])

    if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

    // === TÉCNICO ===
    const activeItems = phases.flatMap(p => p.items.filter(i => !i.esNA))
    const doneItems = activeItems.filter(i => i.completado)
    const globalProgress = activeItems.length > 0
      ? Math.round((doneItems.length / activeItems.length) * 100) : 0

    const activePhase = phases.find(p => p.items.some(i => !i.completado && !i.esNA))

    const totalBudget = budgetLines.reduce((s, b) => s + b.valorInicial, 0)
    const totalPaid = budgetLines.reduce((s, b) => s + b.pagadoSubs, 0)

    const wiredDraws = draws.filter(d => d.estado === 'WIRED')
    const latestDraw = draws[0] || null
    const totalFunded = wiredDraws.reduce((s, d) => s + d.netWire, 0)

    const pendingInspections = inspections.filter(i => !i.resultado && i.estado !== 'APROBADA').length
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length

    const upbPost = latestDraw?.upbPost ?? 0
    const remainingLoanBalance = Math.max(0, (project.loanAmount || 0) - upbPost)

    // === FINANCIERO (caja consolidada del holding) ===
    // currentBalance no se mantiene; se calcula initialBalance + Ingreso - Egreso (± Interbancario).
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
    const accountsBreakdown = finAccounts
      .map(a => ({ name: a.name, code: a.code, balance: balances.get(a.id) || 0 }))
      .sort((a, b) => b.balance - a.balance)

    res.json({
      data: {
        project: {
          name: project.name,
          address: project.address,
          lender: project.lender,
          spv: project.spv,
        },
        tech: {
          globalProgress,
          activePhase: activePhase ? { code: activePhase.code, name: activePhase.name } : null,
          totalBudget,
          totalPaid,
          budgetVariancePct: totalBudget > 0 ? Math.round(((totalPaid - totalBudget) / totalBudget) * 100) : 0,
          draws: {
            total: draws.length,
            totalFunded,
            latest: latestDraw
              ? { number: latestDraw.drawNumber, status: latestDraw.estado, amount: latestDraw.netWire }
              : null,
          },
          loanAmount: project.loanAmount || 0,
          upbPost,
          remainingLoanBalance,
          pendingInspections,
          overdueTasks,
        },
        finance: {
          consolidatedCash,
          totalIngresos,
          totalEgresos,
          netFlow: totalIngresos - totalEgresos,
          accounts: accountsBreakdown,
        },
      },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
