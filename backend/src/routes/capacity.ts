import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// Límite de capacidad documental (Cloudinary free tier = 25 GB) — override con env CAPACITY_LIMIT_GB
const CAPACITY_LIMIT_BYTES = (() => {
  const envGb = Number(process.env.CAPACITY_LIMIT_GB)
  const gb = Number.isFinite(envGb) && envGb > 0 ? envGb : 25
  return gb * 1024 * 1024 * 1024
})()

// Suma del tamaño de todos los archivos almacenados en la plataforma
router.get('/capacity', async (_req: Request, res: Response) => {
  try {
    const [pf, idoc, pdoc, finmd, finpd] = await Promise.all([
      prisma.projectFile.aggregate({ _sum: { size: true }, _count: true }),
      // ItemDocument no tiene size, lo aproximamos por count × 500 KB
      prisma.itemDocument.count(),
      prisma.providerDocument.aggregate({ _sum: { size: true }, _count: true }),
      prisma.finMovementDocument.aggregate({ _sum: { size: true }, _count: true }),
      prisma.finProjectDocument.aggregate({ _sum: { size: true }, _count: true }),
    ])

    const knownBytes =
      (pf._sum.size ?? 0) +
      (pdoc._sum.size ?? 0) +
      (finmd._sum.size ?? 0) +
      (finpd._sum.size ?? 0)
    const estimatedItemDocBytes = idoc * 500 * 1024 // estimación: 500 KB/doc
    const totalBytes = knownBytes + estimatedItemDocBytes
    const totalDocs = pf._count + idoc + pdoc._count + finmd._count + finpd._count

    const pct = CAPACITY_LIMIT_BYTES > 0 ? totalBytes / CAPACITY_LIMIT_BYTES : 0
    const level: 'ok' | 'warning' | 'critical' =
      pct >= 0.9 ? 'critical' : pct >= 0.8 ? 'warning' : 'ok'

    res.json({
      data: {
        totalBytes,
        totalDocs,
        limitBytes: CAPACITY_LIMIT_BYTES,
        pct,
        level,
        breakdown: {
          projectFiles:    { count: pf._count,    bytes: pf._sum.size ?? 0 },
          itemDocs:        { count: idoc,         bytes: estimatedItemDocBytes, estimated: true },
          providerDocs:    { count: pdoc._count,  bytes: pdoc._sum.size ?? 0 },
          finMovementDocs: { count: finmd._count, bytes: finmd._sum.size ?? 0 },
          finProjectDocs:  { count: finpd._count, bytes: finpd._sum.size ?? 0 },
        },
      },
      error: null,
    })
  } catch (e) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
