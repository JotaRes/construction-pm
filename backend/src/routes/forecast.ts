// ============================================================
// FORECAST DE CRONOGRAMA (Lote B) — "¿cuándo terminas de verdad
// y cuánto te cuesta el atraso?"
//
// Metodología:
//   ritmo real   = % avance físico / días transcurridos desde startDate
//   proyección   = hoy + (100 - avance) / ritmo
//   target ajust = targetCompletionDate + días de COs APROBADOS
//   atraso       = proyección - target ajustado
//   costo atraso = días de atraso × interés diario (UPB actual × tasa / 365)
//   riesgo       = proyección vs vencimiento del préstamo (settlement + term)
// Sin datos suficientes responde qué falta, no inventa.
// ============================================================
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/:projectId/forecast', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        phases: { include: { items: { select: { esNA: true, completado: true } } } },
        draws: { orderBy: { drawNumber: 'asc' } },
        changeOrders: { where: { status: 'APROBADO' }, select: { daysDelta: true, costDelta: true } },
      },
    })
    if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

    const today = new Date()
    const missing: string[] = []
    if (!project.startDate) missing.push('Fecha de inicio (startDate)')
    if (!project.targetCompletionDate) missing.push('Fecha objetivo de entrega')

    const activeItems = project.phases.flatMap(p => p.items.filter(i => !i.esNA))
    const doneItems = activeItems.filter(i => i.completado)
    const avance = activeItems.length > 0 ? (doneItems.length / activeItems.length) * 100 : 0
    if (activeItems.length === 0) missing.push('Ítems de ejecución cargados')

    const coDays = project.changeOrders.reduce((s, c) => s + c.daysDelta, 0)
    const coCost = project.changeOrders.reduce((s, c) => s + c.costDelta, 0)

    if (missing.length > 0) {
      return res.json({ data: { available: false, missing, avance: Math.round(avance * 10) / 10 }, error: null })
    }

    const start = new Date(project.startDate!)
    const target = new Date(project.targetCompletionDate!)
    const targetAdjusted = new Date(target.getTime() + coDays * 86400000)

    const daysElapsed = Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000))
    const pace = avance / daysElapsed // % por día

    // Sin avance aún no hay ritmo medible
    if (avance <= 0 || pace <= 0) {
      return res.json({
        data: {
          available: false,
          missing: ['Avance físico registrado (marca ítems completados en Ejecución)'],
          avance: 0,
        },
        error: null,
      })
    }

    const daysRemaining = Math.ceil((100 - avance) / pace)
    const projectedFinish = new Date(today.getTime() + daysRemaining * 86400000)
    const delayDays = Math.ceil((projectedFinish.getTime() - targetAdjusted.getTime()) / 86400000)

    // Interés diario sobre el UPB actual (último draw) o el desembolso día 1
    const lastDraw = project.draws[project.draws.length - 1]
    const upb = lastDraw?.upbPost || project.day1Disbursement || 0

    // ── T3: PROYECCIÓN DEL PRÓXIMO DRAW ──
    // Ritmo histórico: intervalo promedio entre wires + monto promedio →
    // fecha estimada del próximo draw y cuántos faltan para agotar el holdback.
    const wired = project.draws.filter(d => d.estado === 'WIRED' && d.fechaWire).sort(
      (a, b) => new Date(a.fechaWire!).getTime() - new Date(b.fechaWire!).getTime())
    let nextDrawDate: Date | null = null
    let drawsRemaining: number | null = null
    let avgDrawInterval: number | null = null
    if (wired.length >= 1) {
      const totalWiredAmt = wired.reduce((s2, d) => s2 + d.netWire, 0)
      const avgNet = totalWiredAmt / wired.length
      const remaining = Math.max(0, (project.holdback || 0) - totalWiredAmt)
      drawsRemaining = avgNet > 0 ? Math.ceil(remaining / avgNet) : null
      if (wired.length >= 2) {
        const first = new Date(wired[0].fechaWire!).getTime()
        const last = new Date(wired[wired.length - 1].fechaWire!).getTime()
        avgDrawInterval = Math.round((last - first) / 86400000 / (wired.length - 1))
        if (avgDrawInterval > 0 && remaining > 0) {
          nextDrawDate = new Date(last + avgDrawInterval * 86400000)
        }
      }
    }
    const dailyInterest = (upb * project.interestRate) / 365
    const delayCost = delayDays > 0 ? delayDays * dailyInterest : 0

    // Vencimiento del préstamo
    let loanMaturity: Date | null = null
    let daysToMaturity: number | null = null
    let maturityRisk = false
    if (project.settlementDate && project.loanTermMonths > 0) {
      loanMaturity = new Date(project.settlementDate)
      loanMaturity.setMonth(loanMaturity.getMonth() + project.loanTermMonths)
      daysToMaturity = Math.ceil((loanMaturity.getTime() - today.getTime()) / 86400000)
      maturityRisk = projectedFinish > loanMaturity
    }

    res.json({
      data: {
        available: true,
        avance: Math.round(avance * 10) / 10,
        daysElapsed,
        pacePerWeek: Math.round(pace * 7 * 10) / 10, // % por semana, más legible
        daysRemaining,
        projectedFinish,
        target,
        coDays,
        coCost,
        targetAdjusted,
        delayDays,
        upb,
        interestRate: project.interestRate,
        dailyInterest: Math.round(dailyInterest * 100) / 100,
        delayCost: Math.round(delayCost),
        loanMaturity,
        daysToMaturity,
        maturityRisk,
        // T3
        nextDrawDate,
        drawsRemaining,
        avgDrawInterval,
      },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
