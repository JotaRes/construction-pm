// ============================================================
// SUBACTIVIDADES de una actividad (Item) de Ejecución
// ============================================================
// El "valor" de cada subactividad es EJECUTADO. Cuando una actividad tiene
// subactividades, su Item.valorEjecutado = Σ subactividades (roll-up guardado),
// de modo que fases, dashboard y alertas lo reflejan sin cambios adicionales.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// Recalcula y GUARDA Item.valorEjecutado = Σ subactividades cuando existan.
// Si la actividad ya no tiene subactividades, se respeta el valor manual actual.
export async function recomputeItemExecuted(itemId: string) {
  const subs = await prisma.subActivity.findMany({
    where: { itemId },
    select: { valorEjecutado: true },
  })
  if (subs.length === 0) return
  const sum = subs.reduce((s, x) => s + (x.valorEjecutado || 0), 0)
  await prisma.item.update({ where: { id: itemId }, data: { valorEjecutado: sum } })
}

// Listar subactividades de una actividad
router.get('/items/:itemId/subactivities', async (req: Request, res: Response) => {
  try {
    const subs = await prisma.subActivity.findMany({
      where: { itemId: req.params.itemId },
      orderBy: { order: 'asc' },
    })
    res.json({ data: subs, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Crear subactividad
router.post('/items/:itemId/subactivities', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params
    const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } })
    if (!item) return res.status(404).json({ data: null, error: 'Item not found' })

    const count = await prisma.subActivity.count({ where: { itemId } })
    const sub = await prisma.subActivity.create({
      data: {
        itemId,
        description: (req.body?.description ?? 'Nueva subactividad').toString(),
        valorEjecutado: Number(req.body?.valorEjecutado ?? 0) || 0,
        order: count,
      },
    })
    await recomputeItemExecuted(itemId)
    res.json({ data: sub, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Editar subactividad (descripción / valor)
router.patch('/subactivities/:id', async (req: Request, res: Response) => {
  try {
    const data: Record<string, unknown> = {}
    if (req.body?.description !== undefined) data.description = String(req.body.description)
    if (req.body?.valorEjecutado !== undefined) data.valorEjecutado = Number(req.body.valorEjecutado) || 0
    if (req.body?.order !== undefined) data.order = Number(req.body.order)
    const sub = await prisma.subActivity.update({ where: { id: req.params.id }, data })
    await recomputeItemExecuted(sub.itemId)
    res.json({ data: sub, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Eliminar subactividad
router.delete('/subactivities/:id', async (req: Request, res: Response) => {
  try {
    const sub = await prisma.subActivity.delete({ where: { id: req.params.id } })
    await recomputeItemExecuted(sub.itemId)
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
