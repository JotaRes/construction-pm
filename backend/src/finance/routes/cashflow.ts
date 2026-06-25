import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { ok, fail } from '../lib/respond'

const router = Router()

// GET /api/finance/cashflow?groupBy=week|month&months=6
// Ingresos / egresos / neto agrupados por período + saldo corriente acumulado.
router.get('/', async (req, res) => {
  try {
    const months = parseInt(req.query.months as string) || 6
    const groupBy = (req.query.groupBy as string) === 'week' ? 'week' : 'month'

    const since = new Date()
    since.setMonth(since.getMonth() - months)

    const movements = await prisma.finMovement.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
    })

    const buckets: Record<string, { period: string; ingresos: number; egresos: number; neto: number }> = {}

    for (const m of movements) {
      const d = new Date(m.date)
      let key: string
      if (groupBy === 'week') {
        const monday = new Date(d)
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
        key = monday.toISOString().slice(0, 10)
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }
      if (!buckets[key]) buckets[key] = { period: key, ingresos: 0, egresos: 0, neto: 0 }
      if (m.type === 'Ingreso') buckets[key].ingresos += m.amount
      else if (m.type === 'Egreso') buckets[key].egresos += m.amount
    }

    let running = 0
    const result = Object.values(buckets)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(b => {
        b.neto = b.ingresos - b.egresos
        running += b.neto
        return { ...b, runningBalance: running }
      })

    ok(res, result)
  } catch (e) {
    fail(res, e)
  }
})

export default router
