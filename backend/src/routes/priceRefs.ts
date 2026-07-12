import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const refs = await prisma.priceRef.findMany({
      orderBy: [{ category: 'asc' }, { description: 'asc' }],
    })
    res.json({ data: refs, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// ── Precios de referencia AUTO-CALCULADOS (general al módulo técnico) ──────────
// Saca promedios de cada ítem de presupuesto (BudgetLine) y de ejecución (Item)
// de TODOS los proyectos, agrupados por actividad + unidad de medida (SF, LF, CY,
// AC, EA, MO, LS...). Devuelve dos cosas ("Ambos"):
//   - avgCost      = costo promedio total por actividad (siempre disponible)
//   - avgUnitPrice = precio promedio por unidad = valor/cantidad (solo donde hay cantidad)
function normName(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñ ]/gi, ' ').replace(/\s+/g, ' ').trim()
}
function normUnit(u: string | null | undefined): string {
  const x = (u ?? 'LS').trim().toUpperCase()
  const map: Record<string, string> = {
    'SQ FT': 'SF', 'SQFT': 'SF', 'PIE2': 'SF', 'FT2': 'SF',
    'LIN FT': 'LF', 'ML': 'LF', 'METRO LINEAL': 'LF',
    'CUBIC YARD': 'CY', 'YD3': 'CY', 'YARDA CUBICA': 'CY',
    'ACRE': 'AC', 'ACRES': 'AC', 'EACH': 'EA', 'UND': 'EA', 'UNIDAD': 'EA',
    'MONTH': 'MO', 'MES': 'MO',
  }
  return map[x] ?? x
}

router.get('/computed', async (_req: Request, res: Response) => {
  try {
    const [budgetLines, items] = await Promise.all([
      prisma.budgetLine.findMany({
        select: { description: true, divName: true, unit: true, quantity: true, valorInicial: true, valorAprobado: true },
      }),
      prisma.item.findMany({
        where: { esNA: false },
        select: { activity: true, description: true, unit: true, quantity: true, valorPresupuestado: true, valorEjecutado: true, phase: { select: { groupName: true, name: true } } },
      }),
    ])

    type Rec = { name: string; category: string; unit: string; cost: number; qty: number | null }
    const records: Rec[] = []

    for (const b of budgetLines) {
      const cost = b.valorAprobado > 0 ? b.valorAprobado : b.valorInicial
      if (cost <= 0) continue
      records.push({ name: b.description || '(sin descripción)', category: b.divName || 'Otro', unit: normUnit(b.unit), cost, qty: b.quantity ?? null })
    }
    for (const i of items) {
      const cost = i.valorEjecutado > 0 ? i.valorEjecutado : i.valorPresupuestado
      if (cost <= 0) continue
      const cat = i.phase?.groupName || i.phase?.name || 'Ejecución'
      records.push({ name: i.activity || i.description || '(sin actividad)', category: cat, unit: normUnit(i.unit), cost, qty: i.quantity ?? null })
    }

    // Agrupar por unidad + actividad normalizada.
    const groups = new Map<string, { unit: string; category: string; activity: string; costs: number[]; unitPrices: number[] }>()
    for (const r of records) {
      const key = `${r.unit}||${normName(r.name)}`
      let g = groups.get(key)
      if (!g) { g = { unit: r.unit, category: r.category, activity: r.name, costs: [], unitPrices: [] }; groups.set(key, g) }
      g.costs.push(r.cost)
      if (r.qty && r.qty > 0) g.unitPrices.push(r.cost / r.qty)
    }

    const avg = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0
    const byActivity = [...groups.values()].map(g => ({
      unit: g.unit,
      category: g.category,
      activity: g.activity,
      count: g.costs.length,
      avgCost: avg(g.costs),
      minCost: Math.min(...g.costs),
      maxCost: Math.max(...g.costs),
      qtyCount: g.unitPrices.length,
      avgUnitPrice: g.unitPrices.length ? avg(g.unitPrices) : null,
      minUnitPrice: g.unitPrices.length ? Math.min(...g.unitPrices) : null,
      maxUnitPrice: g.unitPrices.length ? Math.max(...g.unitPrices) : null,
    })).sort((a, b) => a.unit.localeCompare(b.unit) || b.count - a.count || a.activity.localeCompare(b.activity))

    // Resumen por unidad de medida.
    const unitMap = new Map<string, { unit: string; count: number; costs: number[]; unitPrices: number[] }>()
    for (const g of groups.values()) {
      let u = unitMap.get(g.unit)
      if (!u) { u = { unit: g.unit, count: 0, costs: [], unitPrices: [] }; unitMap.set(g.unit, u) }
      u.count += g.costs.length
      u.costs.push(...g.costs)
      u.unitPrices.push(...g.unitPrices)
    }
    const byUnit = [...unitMap.values()].map(u => ({
      unit: u.unit,
      count: u.count,
      avgCost: avg(u.costs),
      avgUnitPrice: u.unitPrices.length ? avg(u.unitPrices) : null,
    })).sort((a, b) => b.count - a.count)

    res.json({ data: { byActivity, byUnit, totalRecords: records.length }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const ref = await prisma.priceRef.create({ data: req.body })
    res.json({ data: ref, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const ref = await prisma.priceRef.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ data: ref, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.priceRef.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
