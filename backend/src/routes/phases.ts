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
            subactivities: {
              orderBy: { order: 'asc' },
              include: { provider: { select: { id: true, name: true } } },
            },
            // Línea del Construction Budget asociada (para "Presup. según budget" y Desv.)
            budgetLine: {
              select: {
                id: true, divCode: true, divName: true, itemCode: true,
                description: true, valorInicial: true, valorAprobado: true,
              },
            },
          },
        },
      },
    })

    // Auto-reparación de valorEjecutadoBase: si el backfill de la migración no
    // pobló el valor base (quedó en 0) pero el total ejecutado ya reflejaba un
    // valor, se deriva base = total − Σ subactividades. Idempotente: una vez
    // corregido, la condición deja de cumplirse y no vuelve a escribir. Esto
    // evita perder el valor original al agregar subactividades.
    const repairs: Promise<unknown>[] = []
    for (const phase of phases) {
      for (const item of phase.items) {
        const sumSubs = item.subactivities.reduce((s, x) => s + (x.valorEjecutado || 0), 0)
        const derivedBase = item.valorEjecutado - sumSubs
        if (item.valorEjecutadoBase === 0 && derivedBase > 0) {
          item.valorEjecutadoBase = derivedBase
          repairs.push(prisma.item.update({ where: { id: item.id }, data: { valorEjecutadoBase: derivedBase } }))
        }
        // Auto-reparación de NEGATIVOS: un presupuesto o ejecutado negativo no
        // tiene sentido de obra y contamina los KPIs (caso real: "Presupuesto
        // total -$2"). Se normaliza a 0 una sola vez (idempotente).
        const fix: Record<string, number> = {}
        if (item.valorPresupuestado < 0) { item.valorPresupuestado = 0; fix.valorPresupuestado = 0 }
        if (item.valorEjecutadoBase < 0) { item.valorEjecutadoBase = 0; fix.valorEjecutadoBase = 0 }
        if (item.valorEjecutado < 0) { item.valorEjecutado = Math.max(0, sumSubs); fix.valorEjecutado = item.valorEjecutado }
        if (Object.keys(fix).length > 0) {
          repairs.push(prisma.item.update({ where: { id: item.id }, data: fix }))
        }
      }
    }
    if (repairs.length > 0) await Promise.all(repairs)

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

      // Enlace fase ↔ budget: si la fase tiene budgetDivCode (uno o varios
      // divCode coma-separados, editable), se respeta. Si no, se auto-mapea por
      // número de división (fallback heurístico).
      const mappedCodes = (phase.budgetDivCode ?? '')
        .split(',').map((s) => s.trim()).filter(Boolean)
      const phaseDiv = divNum(phase.code)
      const phaseLines = mappedCodes.length > 0
        ? budgetLines.filter((bl) => mappedCodes.includes(bl.divCode))
        : budgetLines.filter((bl) =>
            bl.divCode === phase.code ||
            (phaseDiv !== null && divNum(bl.divCode) === phaseDiv)
          )
      const budgetTotal = phaseLines.reduce((s, bl) => s + bl.valorInicial, 0)
      const approvedTotal = phaseLines.reduce((s, bl) => s + bl.valorAprobado, 0)
      const paidTotal = phaseLines.reduce((s, bl) => s + bl.pagadoSubs, 0)
      // Gastado (ejecutado) real de la fase = Σ valorEjecutado de sus actividades
      // (ya incluye subactividades por el roll-up guardado).
      const ejecutadoTotal = phase.items.reduce((s, i) => s + i.valorEjecutado, 0)

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
        budgetDivCode: phase.budgetDivCode ?? null,
        budgetTotal,
        approvedTotal,
        paidTotal,
        ejecutadoTotal,
        // Desviación del gasto real (ejecutado) frente al presupuesto del budget
        variancePct: budgetTotal > 0
          ? Math.round(((ejecutadoTotal - budgetTotal) / budgetTotal) * 100)
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

// Enlace fase ↔ budget: setear qué divCode(s) del Construction Budget mapean a
// una fase (coma-separados). Habilita la comparativa ejecutado vs presupuestado.
// También permite renombrar la fase (alineación con el Construction Budget de
// cada nuevo proyecto) sin tocar código, orden ni items.
router.patch('/:projectId/phases/:phaseId', async (req: Request, res: Response) => {
  try {
    const data: Record<string, unknown> = {}
    if (req.body?.budgetDivCode !== undefined) {
      data.budgetDivCode = req.body.budgetDivCode ? String(req.body.budgetDivCode) : null
    }
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim()
      if (name) data.name = name
    }
    const phase = await prisma.phase.update({ where: { id: req.params.phaseId }, data })
    res.json({ data: phase, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Divisiones disponibles del Construction Budget (para el selector de enlace).
router.get('/:projectId/budget-divisions', async (req: Request, res: Response) => {
  try {
    const lines = await prisma.budgetLine.findMany({
      where: { projectId: req.params.projectId },
      select: { divCode: true, divName: true, valorInicial: true },
      orderBy: { order: 'asc' },
    })
    const byDiv = new Map<string, { divCode: string; divName: string; total: number }>()
    for (const l of lines) {
      const cur = byDiv.get(l.divCode) ?? { divCode: l.divCode, divName: l.divName, total: 0 }
      cur.total += l.valorInicial
      byDiv.set(l.divCode, cur)
    }
    res.json({ data: Array.from(byDiv.values()), error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
