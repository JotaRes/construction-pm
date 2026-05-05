import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { PHASES_TEMPLATE, INSPECTIONS_TEMPLATE } from '../data/phasesTemplate'
import { BUDGET_LINES_TEMPLATE } from '../data/budgetLinesTemplate'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      include: { partners: true, draws: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: projects, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        partners: { orderBy: { order: 'asc' } },
        providers: { orderBy: { name: 'asc' } },
        draws: { orderBy: { drawNumber: 'asc' } },
        inspections: { orderBy: { order: 'asc' } },
        phases: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' }, include: { provider: true } } },
        },
      },
    })
    if (!project) return res.status(404).json({ data: null, error: 'Project not found' })
    res.json({ data: project, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.get('/:id/dashboard', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        draws: { orderBy: { drawNumber: 'asc' } },
        phases: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' } } },
        },
        inspections: { orderBy: { order: 'asc' } },
      },
    })
    if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

    const wiredDraws = project.draws.filter(d => d.estado === 'WIRED')
    const totalDrawn = wiredDraws.reduce((s, d) => s + d.netWire, 0)
    const upbActual = totalDrawn
    const saldoHoldback = project.holdback - totalDrawn

    const phaseStats = project.phases.map(phase => {
      const activeItems = phase.items.filter(i => !i.esNA)
      const doneItems = activeItems.filter(i => i.completado)
      const avancePct = activeItems.length === 0 ? 0 : (doneItems.length / activeItems.length) * 100
      const budget = phase.items.reduce((s, i) => s + i.valorPresupuestado, 0)
      const ejecutado = phase.items.reduce((s, i) => s + i.valorEjecutado, 0)
      let estado = 'PENDIENTE'
      if (avancePct === 100) estado = 'DONE'
      else if (avancePct > 0) estado = 'EN_CURSO'
      return {
        id: phase.id,
        code: phase.code,
        name: phase.name,
        groupName: phase.groupName,
        totalItems: phase.items.length,
        doneItems: doneItems.length,
        avancePct,
        budget,
        ejecutado,
        desviacion: ejecutado - budget,
        estado,
      }
    })

    const totalBudget = phaseStats.reduce((s, p) => s + p.budget, 0)
    const totalEjecutado = phaseStats.reduce((s, p) => s + p.ejecutado, 0)

    const avanceGeneral = (() => {
      if (totalBudget === 0) {
        const sum = phaseStats.reduce((s, p) => s + p.avancePct, 0)
        return phaseStats.length === 0 ? 0 : sum / phaseStats.length
      }
      return phaseStats.reduce((s, p) => s + p.avancePct * (p.budget / totalBudget), 0)
    })()

    const today = new Date()
    const permitExpires = project.permitExpires ? new Date(project.permitExpires) : null
    const diasAlPermit = permitExpires
      ? Math.max(0, Math.ceil((permitExpires.getTime() - today.getTime()) / 86400000))
      : null

    const startDate = project.startDate ? new Date(project.startDate) : null
    const targetDate = project.targetCompletionDate ? new Date(project.targetCompletionDate) : null
    const tiempoTranscurrido = (() => {
      if (!startDate || !targetDate) return 0
      if (today <= startDate) return 0
      if (today >= targetDate) return 100
      return ((today.getTime() - startDate.getTime()) / (targetDate.getTime() - startDate.getTime())) * 100
    })()

    const sfHeated = project.sfHeated
    const costoSFPresupuestado = sfHeated > 0 ? totalBudget / sfHeated : 0
    const costoSFEjecutado = sfHeated > 0 ? totalEjecutado / sfHeated : 0
    const costoSFProyectado = sfHeated > 0 ? (totalEjecutado + (totalBudget - totalEjecutado)) / sfHeated : 0
    const arvSF = sfHeated > 0 ? project.arv / sfHeated : 0

    const interestDiario = upbActual * (project.interestRate / 365)
    const diasDesdeSettlement = startDate
      ? Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / 86400000))
      : 0
    const interestEstimado = interestDiario * diasDesdeSettlement

    const gananciaEsperada = project.arv - project.constructionBudget - project.closingCosts
      - (project.arv * (project.listingCommission + project.buyerCommission))

    res.json({
      data: {
        project: {
          id: project.id,
          name: project.name,
          address: project.address,
          permitNumber: project.permitNumber,
          permitExpires: project.permitExpires,
          gcName: project.gcName,
          arv: project.arv,
          constructionBudget: project.constructionBudget,
          sfHeated: project.sfHeated,
          holdback: project.holdback,
          interestRate: project.interestRate,
          benchmarkSfTarget: project.benchmarkSfTarget,
          targetCompletionDate: project.targetCompletionDate,
          startDate: project.startDate,
        },
        kpis: {
          avanceGeneral,
          totalBudget,
          totalEjecutado,
          totalDrawn,
          upbActual,
          saldoHoldback,
          diasAlPermit,
          tiempoTranscurrido,
          desfaseFisicoVsTiempo: avanceGeneral - tiempoTranscurrido,
          costoSFPresupuestado,
          costoSFEjecutado,
          costoSFProyectado,
          arvSF,
          interestEstimado,
          gananciaEsperada,
        },
        phases: phaseStats,
        draws: project.draws,
        inspections: project.inspections,
      },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const b = req.body
    const project = await prisma.project.create({
      data: {
        name: b.name ?? 'Nuevo Proyecto',
        spv: b.spv ?? '',
        holding: b.holding ?? 'Restrepo Acosta Global Holding LLC',
        address: b.address ?? '',
        county: b.county ?? '',
        sfHeated: b.sfHeated ?? 0,
        sfGarage: b.sfGarage ?? 0,
        sfPorches: b.sfPorches ?? 0,
        bedrooms: b.bedrooms ?? 3,
        bathrooms: b.bathrooms ?? '2',
        arv: b.arv ?? 0,
        constructionBudget: b.constructionBudget ?? 0,
        holdback: b.holdback ?? 0,
        loanAmount: b.loanAmount ?? 0,
        day1Disbursement: b.day1Disbursement ?? 0,
        interestReserve: b.interestReserve ?? 0,
        interestRate: b.interestRate ?? 0.085,
        loanTermMonths: b.loanTermMonths ?? 12,
        cashAtSettlement: b.cashAtSettlement ?? 0,
        closingCosts: b.closingCosts ?? 0,
        listingCommission: b.listingCommission ?? 0.03,
        buyerCommission: b.buyerCommission ?? 0.03,
        targetListingPrice: b.targetListingPrice ?? 0,
        contingencyPct: b.contingencyPct ?? 0.05,
        targetMarginPct: b.targetMarginPct ?? 0.20,
        benchmarkSfTarget: b.benchmarkSfTarget ?? 150,
        gcName: b.gcName ?? null,
        gcPhone: b.gcPhone ?? null,
        permitNumber: b.permitNumber ?? null,
        startDate: b.startDate ?? null,
        targetCompletionDate: b.targetCompletionDate ?? null,
        lender: b.lender ?? null,
      },
    })

    for (let pi = 0; pi < PHASES_TEMPLATE.length; pi++) {
      const pt = PHASES_TEMPLATE[pi]
      const phase = await prisma.phase.create({
        data: { projectId: project.id, code: pt.code, name: pt.name, groupName: pt.groupName, order: pi },
      })
      for (let ii = 0; ii < pt.items.length; ii++) {
        const it = pt.items[ii]
        await prisma.item.create({
          data: {
            phaseId: phase.id,
            itemCode: it.itemCode,
            activity: it.activity,
            description: it.description || null,
            responsable: it.responsable || null,
            unit: it.unit || null,
            valorPresupuestado: it.valorPresupuestado ?? 0,
            order: ii,
          },
        })
      }
    }

    for (let i = 1; i <= 8; i++) {
      await prisma.draw.create({
        data: {
          projectId: project.id,
          drawNumber: i,
          estado: 'EMPTY',
          montoSolicitado: 0,
          elegibleTrinity: 0,
          porcentajeFunded: 0,
          netWire: 0,
          upbPre: 0,
          upbPost: 0,
          saldoHoldback: 0,
        },
      })
    }

    for (let i = 0; i < INSPECTIONS_TEMPLATE.length; i++) {
      const ins = INSPECTIONS_TEMPLATE[i]
      await prisma.inspection.create({
        data: {
          projectId: project.id,
          wbs: ins.wbs,
          tipo: ins.tipo,
          prerrequisitos: ins.prerrequisitos ?? null,
          fase: ins.fase ?? null,
          estado: 'PENDIENTE',
          order: i,
        },
      })
    }

    let blOrder = 0
    for (const t of BUDGET_LINES_TEMPLATE) {
      await prisma.budgetLine.create({
        data: {
          projectId: project.id,
          divCode: t.divCode,
          divName: t.divName,
          itemCode: t.itemCode,
          description: t.description,
          unit: t.unit,
          vendor: t.vendor ?? null,
          valorInicial: t.valorInicial,
          valorPresentado: 0,
          valorAprobado: 0,
          pagadoSubs: 0,
          order: blOrder++,
        },
      })
    }

    res.json({ data: project, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ data: project, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
