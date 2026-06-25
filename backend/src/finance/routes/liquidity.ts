import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { ok, fail } from '../lib/respond'

const router = Router()

// GET /api/finance/liquidity-projection
// Saldo consolidado vs compromisos salientes (pagos a subcontratistas + draws en curso) a 90 días.
router.get('/', async (_req, res) => {
  try {
    const today = new Date()
    const in90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)

    const [payments, draws, accounts, movements] = await Promise.all([
      prisma.subcontractorPayment.findMany({
        where: { dueDate: { gte: today, lte: in90 }, status: 'PENDIENTE' },
        include: {
          contract: {
            include: {
              project: { select: { id: true, name: true } },
              provider: { select: { name: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.draw.findMany({
        where: { estado: { in: ['SOLICITADO', 'APROBADO'] } },
        include: { project: { select: { name: true } } },
      }),
      prisma.finAccount.findMany(),
      prisma.finMovement.findMany(),
    ])

    // Saldo consolidado calculado desde movimientos (currentBalance no se mantiene)
    const balances = new Map<number, number>()
    for (const a of accounts) balances.set(a.id, a.initialBalance || 0)
    for (const m of movements) {
      if (m.type === 'Ingreso') balances.set(m.accountId, (balances.get(m.accountId) || 0) + m.amount)
      else if (m.type === 'Egreso') balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount)
      else if (m.type === 'Interbancario') {
        balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount)
        if (m.destAccountId) balances.set(m.destAccountId, (balances.get(m.destAccountId) || 0) + m.amount)
      }
    }
    const totalBalance = Array.from(balances.values()).reduce((s, v) => s + v, 0)

    const totalCommitted = payments.reduce((s, p) => s + p.amount, 0)
    const totalDrawsPending = draws.reduce((s, d) => s + d.montoSolicitado, 0)

    // Salidas agrupadas por semana (lunes)
    const weekly: Record<string, number> = {}
    for (const p of payments) {
      const w = new Date(p.dueDate!)
      w.setDate(w.getDate() - ((w.getDay() + 6) % 7))
      const key = w.toISOString().slice(0, 10)
      weekly[key] = (weekly[key] || 0) + p.amount
    }

    ok(res, {
      currentBalance: totalBalance,
      totalCommitted,
      totalDrawsPending,
      projectedFreeBalance: totalBalance - totalCommitted,
      accounts: accounts.map(a => ({ name: a.name, code: a.code, balance: balances.get(a.id) || 0 })),
      upcomingPayments: payments.map(p => ({
        date: p.dueDate,
        amount: p.amount,
        projectName: p.contract.project.name,
        providerName: p.contract.provider.name,
        milestone: p.milestoneDesc,
      })),
      weeklyOutflows: Object.entries(weekly)
        .map(([week, amount]) => ({ week, amount }))
        .sort((a, b) => a.week.localeCompare(b.week)),
      draws: draws.map(d => ({
        project: d.project.name,
        drawNumber: d.drawNumber,
        amount: d.montoSolicitado,
        status: d.estado,
      })),
    })
  } catch (e) {
    fail(res, e)
  }
})

export default router
