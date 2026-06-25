import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// Listar contratos de subcontratistas por proyecto (con proveedor + calendario de pagos)
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const contracts = await prisma.subcontractorContract.findMany({
      where: { projectId: req.params.projectId },
      include: {
        provider: { select: { id: true, name: true, type: true, phone: true } },
        paymentSchedule: { orderBy: { dueDate: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: contracts, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Crear contrato
router.post('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, ...rest } = req.body ?? {}
    const contract = await prisma.subcontractorContract.create({
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    })
    res.json({ data: contract, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Actualizar contrato
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, ...rest } = req.body ?? {}
    const data: any = { ...rest }
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    const contract = await prisma.subcontractorContract.update({
      where: { id: req.params.id },
      data,
    })
    res.json({ data: contract, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Eliminar contrato (cascade borra sus pagos)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.subcontractorContract.delete({ where: { id: req.params.id } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Agregar pago al calendario del contrato
router.post('/:id/payments', async (req: Request, res: Response) => {
  try {
    const { dueDate, ...rest } = req.body ?? {}
    const payment = await prisma.subcontractorPayment.create({
      data: {
        ...rest,
        contractId: req.params.id,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    })
    res.json({ data: payment, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Marcar pago como pagado
router.patch('/payments/:paymentId/pay', async (req: Request, res: Response) => {
  try {
    const payment = await prisma.subcontractorPayment.update({
      where: { id: req.params.paymentId },
      data: { status: 'PAGADO', paidDate: new Date() },
    })
    res.json({ data: payment, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// Eliminar pago del calendario
router.delete('/payments/:paymentId', async (req: Request, res: Response) => {
  try {
    await prisma.subcontractorPayment.delete({ where: { id: req.params.paymentId } })
    res.json({ data: { ok: true }, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
