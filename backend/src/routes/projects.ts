import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { PHASES_TEMPLATE, INSPECTIONS_TEMPLATE } from '../data/phasesTemplate'
import { parseAmountFlexible } from '../lib/parseAmount'

const router = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// ── POST /api/projects/parse-hud — parse HUD PDF to auto-fill new project form ──
// Standalone (no projectId required) — called BEFORE project creation.
router.post('/parse-hud', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ data: null, error: 'No se subió ningún archivo' }); return }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { extractPdfText } = await import('../lib/pdfOcr')
    const { text } = await extractPdfText(req.file.buffer)
    const t = text.replace(/\x00/g, ' ').replace(/\n/g, ' ')
    const mp = '\\$?([\\d,]+\\.?\\d*)'
    const result: Record<string, unknown> = {}

    // Property address — look for common HUD patterns
    const addrMatch =
      t.match(/(?:property\s*(?:address|location|street|described\s*as)|premises\s*(?:located|described|at)|located\s*at)\s*:?\s*(\d+[^,\n$]{5,80})/i) ??
      t.match(/(?:subject\s*property|property)\s*:?\s*(\d+\s+[A-Za-z][^,\n$]{5,60})/i)
    if (addrMatch) result.address = addrMatch[1].trim().replace(/\s{2,}/g, ' ')

    // County
    const countyMatch = t.match(/([A-Za-z][a-zA-Z\s]{2,20})\s+county/i)
    if (countyMatch) result.county = countyMatch[1].trim()

    // State
    const stateMatch = t.match(/(?:South\s*Carolina|SC|North\s*Carolina|NC|Georgia|GA|Florida|FL|Tennessee|TN)/i)
    if (stateMatch) result.state = stateMatch[0].trim()

    // Purchase price
    const priceMatch =
      t.match(/\b101\.\s*contract\s*sales?\s*price\s*\$?([\d,]+\.?\d*)/i) ??
      t.match(new RegExp(`contract\\s*sales?\\s*price\\s*:?\\s*${mp}`, 'i')) ??
      t.match(new RegExp(`(?:purchase|sale)\\s*price\\s*:?\\s*${mp}`, 'i'))
    if (priceMatch) result.contractSalesPrice = parseAmountFlexible(priceMatch[1])

    // Loan amount
    const loanMatch = t.match(new RegExp(`(?:loan|principal|construction)\\s*amount\\s*:?\\s*${mp}`, 'i'))
    if (loanMatch) result.loanAmount = parseAmountFlexible(loanMatch[1])

    // Holdback
    const holdbackMatch = t.match(new RegExp(`(?:holdback|retainage|construction\\s*holdback)\\s*:?\\s*${mp}`, 'i'))
    if (holdbackMatch) result.holdback = parseAmountFlexible(holdbackMatch[1])

    // Cash at settlement
    const cashMatch =
      t.match(/\b303\.\s*cash\s*\$?([\d,]+\.?\d*)/i) ??
      t.match(new RegExp(`cash\\s*(?:at|to)\\s*(?:close|settlement)\\s*:?\\s*${mp}`, 'i'))
    if (cashMatch) result.cashAtSettlement = parseAmountFlexible(cashMatch[1])

    res.json({ data: result, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

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

    res.json({ data: project, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Whitelist explícita — campos editables del proyecto desde la UI.
// Bloquea mass-assignment de id/createdAt/foreignKeys que rompan integridad.
const PROJECT_EDITABLE_FIELDS = new Set([
  // Identidad
  'name', 'spv', 'holding', 'address', 'county', 'hoa', 'parcelId',
  // Físico
  'lotAcres', 'sfHeated', 'sfGarage', 'sfPorches', 'bedrooms', 'bathrooms',
  'architecturalPlan', 'foundationType',
  // Permisos
  'permitNumber', 'permitIssued', 'permitExpires', 'inspectorPhone', 'hoaPhone',
  // GC
  'gcName', 'gcPhone', 'gcLicense', 'gcEmail',
  // Financiamiento
  'lender', 'loanNumber', 'loanAmount', 'day1Disbursement', 'interestReserve',
  'holdback', 'interestRate', 'loanTermMonths', 'settlementDate',
  'cashAtSettlement', 'closingCosts', 'contractSalesPrice', 'settlementAgent',
  // Valoración
  'arv', 'constructionBudget',
  // Inspector
  'trinityName', 'trinityPhone', 'trinityEmail',
  // Target
  'targetCompletionDate', 'startDate',
  // Realtor
  'realtorName', 'realtorBrokerage', 'realtorPhone', 'realtorEmail',
  'listingCommission', 'buyerCommission', 'targetListingPrice', 'expectedPricePerSqft',
  // Benchmarks
  'contingencyPct', 'targetMarginPct', 'benchmarkSfTarget',
  // Draws: modo de reporte del lender (ACUMULADO | INCREMENTAL)
  'drawValuesMode',
  // Documentos financieros (URLs)
  'loiUrl', 'loiName', 'approvalLetterUrl', 'approvalLetterName',
  'hudUrl', 'hudName', 'otrosFinancieroUrl', 'otrosFinancieroName',
  // LOI extraído
  'loiSalePrice', 'loiOfferDate', 'loiExpectedClose', 'loiEarnestMoney',
])

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(req.body || {})) {
      if (PROJECT_EDITABLE_FIELDS.has(k)) data[k] = v
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ data: null, error: 'No hay campos editables en el payload' })
    }
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data,
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

// === POST /:id/reset-execution — borra datos de ejecución de TODOS los items ===
// Resetea valorEjecutado, completado, estado, fechas reales, observaciones, esNA.
// MANTIENE la estructura de fases e items (valorPresupuestado intacto).
router.post('/:id/reset-execution', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id
    // Buscar todos los items del proyecto
    const phases = await prisma.phase.findMany({ where: { projectId }, include: { items: true } })
    const itemIds = phases.flatMap((p) => p.items.map((i) => i.id))
    if (itemIds.length === 0) {
      return res.json({ data: { reset: 0 }, error: null })
    }
    // Resetear en batch
    await prisma.item.updateMany({
      where: { id: { in: itemIds } },
      data: {
        valorEjecutado: 0,
        completado: false,
        estado: 'PENDIENTE',
        fechaInicioReal: null,
        fechaFinReal: null,
        observaciones: null,
        esNA: false,
      },
    })
    // También borrar documentos de ítems (facturas, cotizaciones, etc.)
    await prisma.itemDocument.deleteMany({ where: { itemId: { in: itemIds } } })
    res.json({ data: { reset: itemIds.length, message: `${itemIds.length} ítems reseteados` }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === POST /:id/reset-budget — borra valorPresupuestado de TODOS los items ===
router.post('/:id/reset-budget', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id
    const phases = await prisma.phase.findMany({ where: { projectId }, include: { items: true } })
    const itemIds = phases.flatMap((p) => p.items.map((i) => i.id))
    if (itemIds.length === 0) return res.json({ data: { reset: 0 }, error: null })
    await prisma.item.updateMany({
      where: { id: { in: itemIds } },
      data: { valorPresupuestado: 0 },
    })
    res.json({ data: { reset: itemIds.length, message: `${itemIds.length} ítems con presupuesto reseteado` }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === POST /:id/reset-draws-section — limpia TODO el módulo Draws ===
// Borra todos los draws del proyecto Y resetea los campos contractuales del
// HUD-1 (loanAmount, holdback, day1Disbursement, interestReserve) que alimentan
// las KPIs de la sección. Caso de uso: el usuario terminó un proyecto o quiere
// volver a cargar el HUD desde cero. SIN esto, project.holdback queda con un
// valor stale (ej. $395,350) que sigue apareciendo en "Holdback inicial" aunque
// no haya ningún draw en la base.
router.post('/:id/reset-draws-section', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id
    const deleted = await prisma.draw.deleteMany({ where: { projectId } })
    await prisma.project.update({
      where: { id: projectId },
      data: {
        loanAmount: 0,
        holdback: 0,
        day1Disbursement: 0,
        interestReserve: 0,
      },
    })
    res.json({
      data: { drawsDeleted: deleted.count, message: `${deleted.count} draw(s) eliminados y campos contractuales reseteados.` },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === POST /:id/reset-construction-budget — borra TODAS las líneas del construction budget ===
// Si hay draws con APPROVAL PDF cargado, esos draws aplicaron valorAprobado
// a las líneas que vamos a borrar. Como no almacenamos la planilla original por
// draw, borrar el budget orfana ese estado: hay que avisar y exigir confirm.
router.post('/:id/reset-construction-budget', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id
    const force = req.query.force === '1' || req.body?.force === true
    const drawsWithApproval = await prisma.draw.count({
      where: { projectId, lenderApprovalUrl: { not: null } },
    })
    if (drawsWithApproval > 0 && !force) {
      return res.status(409).json({
        data: null,
        error: `Hay ${drawsWithApproval} draw(s) con aprobación cargada. Borrar el budget desvincula esa información. Re-envía con force=1 para confirmar y luego re-sube los PDFs de aprobación.`,
        meta: { drawsWithApproval },
      })
    }
    const result = await prisma.budgetLine.deleteMany({ where: { projectId } })
    res.json({ data: { reset: result.count, message: `${result.count} líneas eliminadas` }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
