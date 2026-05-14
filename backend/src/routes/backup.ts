import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import archiver from 'archiver'
import path from 'path'
import fs from 'fs'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Export full database snapshot
    const [projects, priceRefs] = await Promise.all([
      prisma.project.findMany({
        include: {
          phases: { include: { items: { include: { documents: true } } } },
          draws: true,
          partners: true,
          providers: { include: { quotes: true } },
          notes: true,
          files: true,
          inspections: true,
          tasks: true,
          budgetLines: true,
        },
      }),
      prisma.priceRef.findMany(),
    ])

    const dbSnapshot = JSON.stringify(
      { projects, priceRefs, exportedAt: new Date().toISOString(), version: '1.0' },
      null,
      2
    )

    const date = new Date().toISOString().split('T')[0]
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="construction-pm-backup-${date}.zip"`)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', (err) => {
      console.error('Backup archive error:', err)
      if (!res.headersSent) res.status(500).json({ error: String(err) })
      else res.destroy()
    })
    archive.pipe(res)

    // Database data
    archive.append(dbSnapshot, { name: 'data/database.json' })

    // Source code — backend
    const backendDir = path.join(__dirname, '../..')
    const repoRoot = path.join(backendDir, '..')

    const addDirIfExists = (src: string, dest: string) => {
      if (fs.existsSync(src)) archive.directory(src, dest)
    }
    const addFileIfExists = (src: string, dest: string) => {
      if (fs.existsSync(src)) archive.file(src, { name: dest })
    }

    addDirIfExists(path.join(backendDir, 'src'), 'code/backend/src')
    addDirIfExists(path.join(backendDir, 'prisma'), 'code/backend/prisma')
    addFileIfExists(path.join(backendDir, 'package.json'), 'code/backend/package.json')
    addFileIfExists(path.join(backendDir, 'tsconfig.json'), 'code/backend/tsconfig.json')
    addFileIfExists(path.join(repoRoot, 'render.yaml'), 'code/render.yaml')

    // Source code — frontend
    addDirIfExists(path.join(repoRoot, 'frontend/src'), 'code/frontend/src')
    addFileIfExists(path.join(repoRoot, 'frontend/package.json'), 'code/frontend/package.json')
    addFileIfExists(path.join(repoRoot, 'frontend/tsconfig.json'), 'code/frontend/tsconfig.json')
    addFileIfExists(path.join(repoRoot, 'frontend/vite.config.ts'), 'code/frontend/vite.config.ts')
    addFileIfExists(path.join(repoRoot, 'frontend/tailwind.config.js'), 'code/frontend/tailwind.config.js')
    addFileIfExists(path.join(repoRoot, 'frontend/index.html'), 'code/frontend/index.html')

    await archive.finalize()
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: String(e) })
  }
})

export default router
