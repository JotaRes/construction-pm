import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/:projectId/alerts', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        draws: true,
        phases: { include: { items: { include: { documents: true, budgetLine: true, subactivities: true } } } },
        providers: { include: { contracts: { select: { id: true, status: true } } } },
        changeOrders: true,
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

    // 2. BUDGET DEVIATION — solo si existe presupuesto o ejecución cargada.
    // Sin datos (usuario borró los ítems/budget) no tiene sentido mostrar "$0 de $0".
    const totalBudget = project.phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorPresupuestado, 0), 0)
    const totalEjecutado = project.phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorEjecutado, 0), 0)
    if (totalBudget > 0 || totalEjecutado > 0) {
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
    }

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
    // Solo si hay ítems activos cargados; sin ítems no hay avance que medir.
    if (activeItems.length > 0) {
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
    }

    // 4. HOLDBACK BALANCE — solo si el HUD/contrato fue cargado (holdback > 0) o hay draws.
    // Tras reset-draws-section holdback queda en 0 y no hay draws: no debe persistir la alerta.
    const saldoHoldback = project.holdback - totalDrawn
    if (project.holdback > 0 || totalDrawn > 0) {
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
    }

    // 5. COSTO/SF — requiere SF cargados y presupuesto/ejecución. Sin presupuesto el
    // costo proyectado es $0/SF y no aporta nada (dato fantasma tras borrar el budget).
    const sfHeated = project.sfHeated
    const costoSFProyectado = sfHeated > 0 ? (totalEjecutado + (totalBudget - totalEjecutado)) / sfHeated : 0
    const benchmark = project.benchmarkSfTarget
    if (sfHeated > 0 && (totalBudget > 0 || totalEjecutado > 0)) {
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
    }

    // 6. FACTURAS FALTANTES — actividades ejecutadas/completadas sin factura adjunta.
    const itemsSinFactura = project.phases
      .flatMap(p => p.items)
      .filter(i => !i.esNA && (i.valorEjecutado > 0 || i.completado) &&
        !(i.documents ?? []).some(d => d.type === 'FACTURA'))
    if (itemsSinFactura.length > 0) {
      alerts.push({
        id: 'missing-invoices',
        level: 'warning',
        title: 'Facturas faltantes',
        message: `${itemsSinFactura.length} actividad(es) ejecutada(s) sin factura adjunta`,
        action: 'Adjuntar la factura en cada actividad (columna Doc en EJECUCIÓN).',
        source: 'EJECUCIÓN — soportes',
      })
    }

    // 6b. SOBRECOSTO VS CONSTRUCTION BUDGET (asociaciones actividad ↔ budget).
    // Agrupado por línea del budget: su presupuesto cuenta UNA vez aunque varias
    // actividades apunten a la misma línea. Crítico para el draw: si gastaste más
    // de lo que el lender presupuestó, el draw no lo va a cubrir.
    const allItemsWithLink = project.phases.flatMap(p => p.items).filter(i => i.budgetLineId && i.budgetLine)
    const byLine = new Map<string, { code: string; desc: string; budget: number; ejec: number }>()
    for (const i of allItemsWithLink) {
      const bl = i.budgetLine!
      const cur = byLine.get(bl.id) ?? { code: bl.itemCode, desc: bl.description, budget: bl.valorInicial, ejec: 0 }
      cur.ejec += i.valorEjecutado
      byLine.set(bl.id, cur)
    }
    const overLines = Array.from(byLine.values()).filter(l => l.budget > 0 && l.ejec > l.budget)
    if (overLines.length > 0) {
      const totalOver = overLines.reduce((s, l) => s + (l.ejec - l.budget), 0)
      alerts.push({
        id: 'budget-link-overrun',
        level: 'critical',
        title: 'Sobrecosto vs Construction Budget (lender)',
        message: `${overLines.length} línea(s) del budget superada(s) por $${totalOver.toLocaleString('en-US', { maximumFractionDigits: 0 })}: ` +
          overLines.slice(0, 3).map(l => `${l.code} +$${(l.ejec - l.budget).toLocaleString('en-US', { maximumFractionDigits: 0 })}`).join(' · ') +
          (overLines.length > 3 ? ` (+${overLines.length - 3} más)` : ''),
        action: 'El lender NO cubre sobrecostos: la diferencia sale de tu caja. Revisar antes del próximo draw y evaluar change order.',
        source: 'EJECUCIÓN — asociaciones al Construction Budget',
      })
    }

    // 6c. SUBACTIVIDADES CON GASTO SIN INVOICE — trazabilidad del desglose.
    const subsSinInvoice = project.phases
      .flatMap(p => p.items.filter(i => !i.esNA))
      .flatMap(i => (i.subactivities ?? []).filter(s => s.valorEjecutado > 0 && !s.invoiceUrl)
        .map(s => ({ item: i.itemCode, desc: s.description })))
    if (subsSinInvoice.length > 0) {
      alerts.push({
        id: 'subactivity-missing-invoices',
        level: 'warning',
        title: 'Subactividades con gasto sin invoice',
        message: `${subsSinInvoice.length} subactividad(es) con valor ejecutado sin soporte: ` +
          subsSinInvoice.slice(0, 3).map(s => `${s.item} · ${s.desc.slice(0, 25)}`).join(' · ') +
          (subsSinInvoice.length > 3 ? ` (+${subsSinInvoice.length - 3} más)` : ''),
        action: 'Adjuntar el invoice en el desglose de la actividad (botón Invoice en cada subactividad).',
        source: 'EJECUCIÓN — subactividades',
      })
    }

    // 7. SECUENCIA CONSTRUCTIVA (T1) — el principio rector del control de obra:
    // ninguna fase debería tener trabajo EN CURSO o HECHO si la fase anterior
    // va por debajo del 80%. Trabajo fuera de secuencia = retrabajos, inspecciones
    // reprobadas y draws sin soporte.
    const orderedPhases = [...project.phases].sort((a, b) => a.order - b.order)
    const outOfSequence: string[] = []
    for (let i = 1; i < orderedPhases.length; i++) {
      const prev = orderedPhases[i - 1]
      const curr = orderedPhases[i]
      const prevActive = prev.items.filter(it => !it.esNA)
      const prevPct = prevActive.length ? prevActive.filter(it => it.completado).length / prevActive.length : 1
      const currStarted = curr.items.some(it => !it.esNA && (it.completado || it.estado === 'EN_CURSO' || it.valorEjecutado > 0))
      if (currStarted && prevPct < 0.8) {
        outOfSequence.push(`${curr.code} arrancó con ${prev.code} al ${(prevPct * 100).toFixed(0)}%`)
      }
    }
    if (outOfSequence.length > 0) {
      alerts.push({
        id: 'out-of-sequence',
        level: 'critical',
        title: 'Trabajo FUERA de secuencia constructiva',
        message: outOfSequence.join(' · '),
        action: 'Verificar en obra: trabajo fuera de secuencia genera retrabajos, inspecciones reprobadas y draws sin soporte físico.',
        source: 'EJECUCIÓN — secuencia de fases',
      })
    }

    // 8. INSPECCIONES PROGRAMADAS SIN PREREQUISITOS (T2)
    const inspPend = await prisma.inspection.findMany({
      where: { projectId: req.params.projectId, fechaSolicitada: { not: null }, resultado: null },
      select: { tipo: true, wbs: true, prereqs: true, fechaSolicitada: true },
    })
    const inspSinPrereq: string[] = []
    for (const insp of inspPend) {
      try {
        const list = insp.prereqs ? JSON.parse(insp.prereqs) as Array<{ label: string; done: boolean }> : []
        const pending = list.filter(p => !p.done)
        if (list.length > 0 && pending.length > 0) {
          inspSinPrereq.push(`${insp.tipo}: ${pending.length} prerequisito(s) sin cumplir`)
        }
      } catch { /* prereqs malformado: ignorar */ }
    }
    if (inspSinPrereq.length > 0) {
      alerts.push({
        id: 'inspection-prereqs-pending',
        level: 'critical',
        title: 'Inspección programada SIN prerequisitos cumplidos',
        message: inspSinPrereq.join(' · '),
        action: 'NO llamar la inspección hasta cerrar el checklist. Una reprobación cuesta dinero Y bloquea la secuencia.',
        source: 'INSPECCIONES — checklist previo',
      })
    }

    // 7. SEGUROS (Lote A) — builder's risk del proyecto
    if (project.builderRiskExpiresAt) {
      const dias = Math.ceil((new Date(project.builderRiskExpiresAt).getTime() - today.getTime()) / 86400000)
      if (dias < 60) {
        alerts.push({
          id: 'builder-risk-expiry',
          level: dias < 0 ? 'critical' : dias < 30 ? 'critical' : 'warning',
          title: dias < 0 ? "Builder's Risk VENCIDO" : "Builder's Risk por vencer",
          message: dias < 0
            ? `Venció hace ${Math.abs(dias)} día(s) — el proyecto está SIN cobertura`
            : `${dias} día(s) restantes (${project.builderRiskCarrier ?? 'aseguradora sin registrar'})`,
          action: 'Renovar la póliza YA. Un siniestro sin cobertura puede costar el proyecto completo.',
          source: 'CONFIG — Seguros',
        })
      }
    } else {
      alerts.push({
        id: 'builder-risk-missing',
        level: 'warning',
        title: "Builder's Risk sin registrar",
        message: 'No hay póliza builder\'s risk cargada para este proyecto',
        action: 'Registrar la póliza y su vencimiento en Configuración del proyecto.',
        source: 'CONFIG — Seguros',
      })
    }

    // 8. COI de subcontratistas con contrato ACTIVO (Lote A)
    const activeProviders = (project.providers ?? []).filter(p => (p.contracts ?? []).some(c => c.status === 'ACTIVO'))
    const coiProblems: string[] = []
    let coiWorst = 'warning'
    for (const p of activeProviders) {
      if (!p.coiExpiresAt) {
        coiProblems.push(`${p.name}: sin COI registrado`)
      } else {
        const dias = Math.ceil((new Date(p.coiExpiresAt).getTime() - today.getTime()) / 86400000)
        if (dias < 0) { coiProblems.push(`${p.name}: COI VENCIDO hace ${Math.abs(dias)}d`); coiWorst = 'critical' }
        else if (dias < 30) coiProblems.push(`${p.name}: COI vence en ${dias}d`)
      }
    }
    if (coiProblems.length > 0) {
      alerts.push({
        id: 'coi-subcontractors',
        level: coiWorst,
        title: 'Seguros de subcontratistas (COI)',
        message: coiProblems.join(' · '),
        action: 'Exigir COI vigente antes de dejar entrar al sub a la obra. Su accidente sin seguro es TU responsabilidad.',
        source: 'PROVEEDORES — COI',
      })
    }

    // 9. CHANGE ORDERS (Lote A) — impacto en presupuesto y pendientes de decisión
    const cos = project.changeOrders ?? []
    const approvedCOs = cos.filter(c => c.status === 'APROBADO')
    const pendingCOs = cos.filter(c => c.status === 'BORRADOR')
    const coCost = approvedCOs.reduce((s2, c) => s2 + c.costDelta, 0)
    const coDays = approvedCOs.reduce((s2, c) => s2 + c.daysDelta, 0)
    if (approvedCOs.length > 0) {
      alerts.push({
        id: 'change-orders-impact',
        level: coCost > 0 ? 'warning' : 'ok',
        title: 'Impacto de Change Orders',
        message: `${approvedCOs.length} CO aprobado(s): ${coCost >= 0 ? '+' : ''}$${coCost.toLocaleString('en-US', { maximumFractionDigits: 0 })} · ${coDays >= 0 ? '+' : ''}${coDays} día(s)`,
        action: 'El presupuesto y cronograma ajustados ya reflejan estos cambios.',
        source: 'CHANGE ORDERS',
      })
    }
    if (pendingCOs.length > 0) {
      alerts.push({
        id: 'change-orders-pending',
        level: 'warning',
        title: 'Change Orders sin decidir',
        message: `${pendingCOs.length} CO en borrador esperando aprobación o rechazo`,
        action: 'Decidir cada CO: un cambio sin aprobar es un sobrecosto sin control.',
        source: 'CHANGE ORDERS',
      })
    }

    res.json({ data: alerts, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Hitos próximos (≤30 días) del proyecto activo: inspecciones, permiso y tareas.
// Guardas: solo emite ítems que realmente existen (sin fantasmas tras borrar datos).
router.get('/:projectId/upcoming', async (req: Request, res: Response) => {
  const { projectId } = req.params
  try {
    const today = new Date()
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, permitExpires: true, permitNumber: true },
    })
    if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

    const inspecciones = await prisma.inspection.findMany({
      where: { projectId, fechaSolicitada: { gte: today, lte: in30 }, resultado: null },
      orderBy: { fechaSolicitada: 'asc' },
    })

    const tareas = await prisma.task.findMany({
      where: { projectId, done: false, dueDate: { lte: in30 } },
      orderBy: { dueDate: 'asc' },
    })

    // Actividades de ejecución con fecha fin (cronograma): vencidas o próximas ≤30 días.
    // Estas fechas son las mismas que alimentan el Gantt (Item.fechaFinReal).
    const actividades = await prisma.item.findMany({
      where: {
        phase: { projectId },
        esNA: false,
        completado: false,
        fechaFinReal: { not: null, lte: in30 },
      },
      orderBy: { fechaFinReal: 'asc' },
    })

    const items: any[] = []

    for (const i of inspecciones) {
      items.push({
        type: 'INSPECCION',
        severity: i.fechaSolicitada! < in7 ? 'HIGH' : 'MEDIUM',
        title: 'Inspección próxima',
        description: `${i.tipo}${i.wbs ? ` — WBS ${i.wbs}` : ''}`,
        date: i.fechaSolicitada,
      })
    }

    if (project.permitExpires && project.permitExpires >= today && project.permitExpires <= in30) {
      items.push({
        type: 'PERMISO',
        severity: project.permitExpires < in7 ? 'CRITICAL' : 'HIGH',
        title: 'Permiso por vencer',
        description: `Permiso #${project.permitNumber ?? ''} vence`,
        date: project.permitExpires,
      })
    }

    for (const t of tareas) {
      const esNota = t.tipo === 'NOTA'
      const vencida = !!(t.dueDate && t.dueDate < today)
      items.push({
        type: esNota ? 'NOTA' : 'TAREA',
        severity: vencida ? 'CRITICAL' : 'MEDIUM',
        title: vencida ? (esNota ? 'Nota vencida' : 'Tarea vencida') : (esNota ? 'Nota próxima' : 'Tarea próxima'),
        description: t.title,
        date: t.dueDate,
      })
    }

    for (const a of actividades) {
      const overdue = a.fechaFinReal! < today
      items.push({
        type: 'ACTIVIDAD',
        severity: overdue ? 'CRITICAL' : (a.fechaFinReal! < in7 ? 'HIGH' : 'MEDIUM'),
        title: overdue ? 'Actividad vencida' : 'Actividad próxima a vencer',
        description: `${a.itemCode} — ${a.activity}`,
        date: a.fechaFinReal,
      })
    }

    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    res.json({ data: items, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
