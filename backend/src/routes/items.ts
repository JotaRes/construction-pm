import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { recomputeItemExecuted } from './subactivities'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const { phaseId, activity, unit, valorPresupuestado, responsable, description } = req.body
    if (!phaseId) return res.status(400).json({ data: null, error: 'phaseId required' })

    const phase = await prisma.phase.findUnique({ where: { id: phaseId }, include: { items: true } })
    if (!phase) return res.status(404).json({ data: null, error: 'Phase not found' })

    const existingCodes = phase.items.map(i => i.itemCode)
    let idx = phase.items.length + 1
    let newCode = `${phase.code.replace('F', '')}.A${String(idx).padStart(2, '0')}`
    while (existingCodes.includes(newCode)) { idx++; newCode = `${phase.code.replace('F', '')}.A${String(idx).padStart(2, '0')}` }

    const item = await prisma.item.create({
      data: {
        phaseId,
        itemCode: newCode,
        activity: activity ?? 'Nueva actividad',
        unit: unit ?? 'LS',
        valorPresupuestado: valorPresupuestado ?? 0,
        responsable: responsable ?? null,
        description: description ?? null,
        order: phase.items.length,
      },
      include: { provider: true },
    })
    res.json({ data: item, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const {
      activity, description, responsable, unit, esNA, completado,
      valorPresupuestado, valorEjecutado, valorEjecutadoBase, providerId, estado,
      fechaInicioReal, fechaFinReal, observaciones, order, quantity,
    } = req.body
    const data: Record<string, unknown> = {}
    if (activity !== undefined) data.activity = activity
    if (description !== undefined) data.description = description || null
    if (responsable !== undefined) data.responsable = responsable || null
    if (unit !== undefined) data.unit = unit || null
    if (esNA !== undefined) data.esNA = esNA
    if (completado !== undefined) data.completado = completado
    if (quantity !== undefined) data.quantity = (quantity === null || quantity === '') ? null : Number(quantity)
    if (valorPresupuestado !== undefined) data.valorPresupuestado = Number(valorPresupuestado)
    // El valor "ejecutado" que edita el usuario es el VALOR BASE de la actividad.
    // El total (valorEjecutado) se recomputa como base + Σ subactividades.
    const baseIncoming = valorEjecutadoBase !== undefined ? valorEjecutadoBase
      : valorEjecutado !== undefined ? valorEjecutado : undefined
    let recompute = false
    if (baseIncoming !== undefined) { data.valorEjecutadoBase = Number(baseIncoming); recompute = true }
    if (providerId !== undefined) data.providerId = providerId || null
    if (estado !== undefined) data.estado = estado
    if (fechaInicioReal !== undefined) data.fechaInicioReal = fechaInicioReal ? new Date(fechaInicioReal) : null
    if (fechaFinReal !== undefined) data.fechaFinReal = fechaFinReal ? new Date(fechaFinReal) : null
    if (observaciones !== undefined) data.observaciones = observaciones || null
    if (order !== undefined) data.order = Number(order)
    await prisma.item.update({ where: { id: req.params.id }, data })
    // Recomputar el total ejecutado = base + Σ subactividades tras cambiar la base.
    if (recompute) await recomputeItemExecuted(req.params.id)
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: { provider: true, subactivities: { orderBy: { order: 'asc' } } },
    })
    res.json({ data: item, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.item.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
