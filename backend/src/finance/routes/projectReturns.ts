import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { ok, fail } from '../lib/respond'

const router = Router()

// GET /api/finance/project-returns — ROI / margen / deuda-equity por proyecto financiero.
router.get('/', async (_req, res) => {
  try {
    const finProjects = await prisma.finProject.findMany({
      include: { movements: true, loans: true, capitalContribs: true },
    })

    const results = finProjects.map(proj => {
      const totalInverted = proj.movements
        .filter(m => m.type === 'Egreso' || m.isLoan)
        .reduce((s, m) => s + m.amount, 0)

      const totalIncome = proj.movements
        .filter(m => m.type === 'Ingreso' && !m.isLoan && !m.isIntercompany)
        .reduce((s, m) => s + m.amount, 0)

      const totalEquity = proj.capitalContribs.reduce((s, c) => s + c.amount, 0)
      const totalDebt = proj.loans.reduce((s, l) => s + l.amount, 0)

      const grossProfit = totalIncome - totalInverted
      const profitMarginPct = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0
      const roi = totalEquity > 0 ? (grossProfit / totalEquity) * 100 : 0

      return {
        id: proj.id,
        code: proj.code,
        name: proj.name,
        status: proj.status,
        arv: proj.arv,
        expectedCost: proj.expectedCost,
        totalInverted,
        totalIncome,
        grossProfit,
        profitMarginPct: Math.round(profitMarginPct * 10) / 10,
        roi: Math.round(roi * 10) / 10,
        totalEquity,
        totalDebt,
        debtEquityRatio: totalEquity > 0 ? Math.round((totalDebt / totalEquity) * 100) / 100 : null,
      }
    })

    ok(res, results)
  } catch (e) {
    fail(res, e)
  }
})

export default router
