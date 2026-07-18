// ============================================================
// PROVEEDORES GLOBALES (R2) — catálogo general del holding.
// Un proveedor sirve a TODOS los proyectos. Los proveedores creados
// antes (con projectId) siguen siendo visibles aquí.
// Incluye el récord de facturación por proveedor por proyecto,
// alimentado por las facturas adjuntadas en Ejecución.
// ============================================================
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/providers — todos los proveedores (globales + heredados por proyecto)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      include: {
        project: { select: { id: true, name: true } },
        quotes: true,
        documents: true,
      },
      orderBy: { name: 'asc' },
    })
    res.json({ data: providers, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// POST /api/providers — crear proveedor GLOBAL (sin proyecto)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, phoneCountry, phone, email, license, address, notes } = req.body
    if (!name || !String(name).trim()) return res.status(400).json({ data: null, error: 'Nombre requerido' })
    const provider = await prisma.provider.create({
      data: {
        projectId: null,
        name: String(name).trim(),
        type: type?.trim() || null,
        phoneCountry: phoneCountry?.trim() || '+1',
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        license: license?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: { quotes: true, documents: true },
    })
    res.json({ data: provider, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// GET /api/providers/billing — récord de facturación por proveedor por proyecto.
// Fuente: facturas (ItemDocument type FACTURA) con providerId, vía item→fase→proyecto.
router.get('/billing', async (_req: Request, res: Response) => {
  try {
    const docs = await prisma.itemDocument.findMany({
      where: { providerId: { not: null }, type: 'FACTURA' },
      select: {
        providerId: true,
        amount: true,
        createdAt: true,
        item: { select: { itemCode: true, activity: true, phase: { select: { project: { select: { id: true, name: true } } } } } },
      },
    })
    // Agregado: providerId → projectId → { total, count }
    const byProvider: Record<string, Record<string, { projectName: string; total: number; count: number }>> = {}
    for (const d of docs) {
      const pid = d.providerId!
      const proj = d.item.phase.project
      if (!byProvider[pid]) byProvider[pid] = {}
      if (!byProvider[pid][proj.id]) byProvider[pid][proj.id] = { projectName: proj.name, total: 0, count: 0 }
      byProvider[pid][proj.id].total += d.amount ?? 0
      byProvider[pid][proj.id].count += 1
    }
    res.json({ data: byProvider, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// GET /api/providers/:id/record — RÉCORD COMPLETO del proveedor/contratista:
// historial de servicios y pagos alimentado desde Ejecución.
// Fuentes: actividades asignadas (Item.providerId), subactividades asignadas
// (SubActivity.providerId) y facturas registradas (ItemDocument.providerId).
router.get('/:id/record', async (req: Request, res: Response) => {
  try {
    const providerId = req.params.id
    const [items, subs, invoices] = await Promise.all([
      prisma.item.findMany({
        where: { providerId },
        select: {
          id: true, itemCode: true, activity: true, estado: true, completado: true,
          valorEjecutado: true, fechaInicioReal: true, fechaFinReal: true,
          phase: { select: { code: true, name: true, project: { select: { id: true, name: true } } } },
        },
        orderBy: { itemCode: 'asc' },
      }),
      prisma.subActivity.findMany({
        where: { providerId },
        select: {
          id: true, description: true, valorEjecutado: true, fecha: true,
          responsable: true, invoiceUrl: true, invoiceName: true,
          item: {
            select: {
              itemCode: true, activity: true,
              phase: { select: { code: true, project: { select: { id: true, name: true } } } },
            },
          },
        },
        orderBy: { fecha: 'desc' },
      }),
      prisma.itemDocument.findMany({
        where: { providerId },
        select: {
          id: true, type: true, name: true, amount: true, fileUrl: true, createdAt: true,
          item: {
            select: {
              itemCode: true, activity: true,
              phase: { select: { project: { select: { id: true, name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const totalActividades = items.reduce((s, i) => s + (i.valorEjecutado || 0), 0)
    const totalSubactividades = subs.reduce((s, x) => s + (x.valorEjecutado || 0), 0)
    const totalFacturado = invoices.filter(d => d.type === 'FACTURA').reduce((s, d) => s + (d.amount || 0), 0)

    res.json({
      data: {
        activities: items,
        subactivities: subs,
        invoices,
        totals: {
          actividades: totalActividades,
          subactividades: totalSubactividades,
          facturado: totalFacturado,
          servicios: items.length + subs.length,
        },
      },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
