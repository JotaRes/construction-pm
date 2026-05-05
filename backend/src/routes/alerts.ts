import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/:projectId/alerts', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        draws: true,
        phases: { include: { items: true } },
      },
    })
    if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

    const today = new Date()
    const alerts = []

    // 1. PERMIT DEADLINE
    if (project.permitExpires) {
      const dias = Math.ceil((new Date(project.permitExpires).getTime() - today.getTime()) / 86400000)
      let level = 'ok'
      if (dias < 30) level = 'critical'
      else if (dias < 60) level = 'warning'
      alerts.push({
        id: 'permit-deadline',
        level,
        title: 'Permit Deadline',
        message: `${dias} días restantes (vence ${new Date(project.permitExpires).toLocaleDateString('es-CO')})`,
        action: 'Contactar lender Hera + solicitar extensión al condado de Oconee',
        source: 'CONFIG — Permit ' + project.permitNumber,
      })
    }

    // 2. BUDGET DEVIATION
    const totalBudget = project.phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorPresupuestado, 0), 0)
    const totalEjecutado = project.phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorEjecutado, 0), 0)
    let budgetLevel = 'ok'
    if (totalBudget > 0 && totalEjecutado > totalBudget) budgetLevel = 'critical'
    else if (totalBudget > 0 && totalEjecutado > totalBudget * 0.95) budgetLevel = 'warning'
    alerts.push({
      id: 'budget-deviation',
      level: budgetLevel,
      title: 'Desviación Presupuestal',
      message: `Ejecutado $${totalEjecutado.toLocaleString('en-US', { maximumFractionDigits: 0 })} de $${totalBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })} budget`,
      action: 'Revisar PROYECCIONES para identificar partida inflada. Evaluar change order.',
      source: 'PRESUPUESTO MAESTRO',
    })

    // 3. PHYSICAL VS TIME
    const wiredDraws = project.draws.filter(d => d.estado === 'WIRED')
    const totalDrawn = wiredDraws.reduce((s, d) => s + d.netWire, 0)
    const activeItems = project.phases.flatMap(p => p.items.filter(i => !i.esNA))
    const doneItems = activeItems.filter(i => i.completado)
    const avanceFisico = activeItems.length === 0 ? 0 : (doneItems.length / activeItems.length) * 100

    const startDate = project.startDate ? new Date(project.startDate) : null
    const targetDate = project.targetCompletionDate ? new Date(project.targetCompletionDate) : null
    let desfase = 0
    if (startDate && targetDate) {
      const tiempoTranscurrido = today <= startDate ? 0
        : today >= targetDate ? 100
        : ((today.getTime() - startDate.getTime()) / (targetDate.getTime() - startDate.getTime())) * 100
      desfase = avanceFisico - tiempoTranscurrido
    }
    let desfaseLevel = 'ok'
    if (desfase < -10) desfaseLevel = 'critical'
    else if (desfase < -5) desfaseLevel = 'warning'
    alerts.push({
      id: 'physical-vs-time',
      level: desfaseLevel,
      title: 'Desfase Físico vs Tiempo',
      message: `${avanceFisico.toFixed(1)}% físico • ${desfase >= 0 ? '+' : ''}${desfase.toFixed(1)}% desfase`,
      action: 'Identificar fase bloqueante en EJECUCIÓN, notificar a GC AMA LLC.',
      source: 'EJECUCIÓN + CONFIG target date',
    })

    // 4. HOLDBACK BALANCE
    const saldoHoldback = project.holdback - totalDrawn
    let holdbackLevel = 'ok'
    if (saldoHoldback < 50000) holdbackLevel = 'critical'
    else if (saldoHoldback < 100000) holdbackLevel = 'warning'
    alerts.push({
      id: 'holdback-balance',
      level: holdbackLevel,
      title: 'Saldo Holdback Disponible',
      message: `$${saldoHoldback.toLocaleString('en-US', { maximumFractionDigits: 0 })} disponible (Hera Holdings)`,
      action: 'Planificar próximo draw con anticipación.',
      source: 'DRAW TRACKER',
    })

    // 5. COSTO/SF
    const sfHeated = project.sfHeated
    const costoSFProyectado = sfHeated > 0 ? (totalEjecutado + (totalBudget - totalEjecutado)) / sfHeated : 0
    const benchmark = project.benchmarkSfTarget
    let sfLevel = 'ok'
    if (costoSFProyectado > benchmark) sfLevel = 'critical'
    else if (costoSFProyectado > 185) sfLevel = 'warning'
    alerts.push({
      id: 'cost-per-sf',
      level: sfLevel,
      title: 'Costo/SF Proyectado',
      message: `$${costoSFProyectado.toFixed(0)}/SF proyectado vs benchmark $${benchmark}/SF`,
      action: 'Revisar PROYECCIONES. Costo alto comprime margen de utilidad.',
      source: 'PRESUPUESTO MAESTRO + CONFIG',
    })

    res.json({ data: alerts, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
