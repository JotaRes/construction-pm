import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

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
          },
        },
      },
    })
    res.json({ data: phases, error: null })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
