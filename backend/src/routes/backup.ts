import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import archiver from 'archiver'
import path from 'path'
import fs from 'fs'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (req: Request, res: Response) => {
  res.setTimeout(0)

  const date = new Date().toISOString().split('T')[0]
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="restrepoacosta-backup-${date}.zip"`)

  const archive = archiver('zip', { zlib: { level: 6 } })
  let aborted = false

  const abort = (reason: string) => {
    if (aborted) return
    aborted = true
    console.warn(`Backup aborted: ${reason}`)
    try { archive.abort() } catch {}
    if (!res.headersSent) res.status(500).json({ error: reason })
    else res.destroy()
  }

  archive.on('error', (err) => {
    console.error('Backup archive error:', err)
    abort(`archive error: ${err.message}`)
  })
  archive.on('warning', (err) => {
    console.warn('Backup archive warning:', err)
  })

  req.on('close', () => {
    if (!res.writableEnded) abort('client closed connection')
  })

  archive.pipe(res)

  try {
    // === MÓDULO TÉCNICO ===
    const projects = await prisma.project.findMany({
      include: {
        phases: { include: { items: true } },
        draws: true,
        partners: true,
        providers: { include: { quotes: true } },
        notes: true,
        files: true,
        inspections: true,
        tasks: true,
        budgetLines: true,
      },
    })
    const [priceRefs, itemDocuments] = await Promise.all([
      prisma.priceRef.findMany(),
      prisma.itemDocument.findMany(),
    ])

    const techSnapshot = JSON.stringify(
      {
        projects,
        priceRefs,
        itemDocuments,
        exportedAt: new Date().toISOString(),
        version: '1.1',
      },
      null,
      2
    )

    archive.append(techSnapshot, { name: 'data/tech-database.json' })

    // === MÓDULO FINANCIERO ===
    const [
      finSpvs, finAccounts, finPartners, finLenders, finProviders,
      finCategories, finOrigins, finProjects, finMovements,
      finCapitalContribs, finLoans, finNonBankContribs,
      finStatements, finStatementLines,
      finMovementDocs, finProjectDocs,
    ] = await Promise.all([
      prisma.finSPV.findMany(),
      prisma.finAccount.findMany(),
      prisma.finPartner.findMany(),
      prisma.finLender.findMany(),
      prisma.finProvider.findMany(),
      prisma.finExpenseCategory.findMany(),
      prisma.finIncomeOrigin.findMany(),
      prisma.finProject.findMany(),
      prisma.finMovement.findMany(),
      prisma.finCapitalContribution.findMany(),
      prisma.finLoan.findMany(),
      prisma.finNonBankContribution.findMany(),
      prisma.finBankStatement.findMany(),
      prisma.finBankStatementLine.findMany(),
      prisma.finMovementDocument.findMany(),
      prisma.finProjectDocument.findMany(),
    ])

    const finSnapshot = JSON.stringify(
      {
        spvs: finSpvs,
        accounts: finAccounts,
        partners: finPartners,
        lenders: finLenders,
        providers: finProviders,
        expenseCategories: finCategories,
        incomeOrigins: finOrigins,
        projects: finProjects,
        movements: finMovements,
        capitalContributions: finCapitalContribs,
        loans: finLoans,
        nonBankContributions: finNonBankContribs,
        bankStatements: finStatements,
        bankStatementLines: finStatementLines,
        movementDocuments: finMovementDocs,
        projectDocuments: finProjectDocs,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      },
      null,
      2
    )

    archive.append(finSnapshot, { name: 'data/finance-database.json' })

    // Source code (best-effort: only included when files are present in the deploy)
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

    addDirIfExists(path.join(repoRoot, 'frontend/src'), 'code/frontend/src')
    addFileIfExists(path.join(repoRoot, 'frontend/package.json'), 'code/frontend/package.json')
    addFileIfExists(path.join(repoRoot, 'frontend/tsconfig.json'), 'code/frontend/tsconfig.json')
    addFileIfExists(path.join(repoRoot, 'frontend/vite.config.ts'), 'code/frontend/vite.config.ts')
    addFileIfExists(path.join(repoRoot, 'frontend/tailwind.config.js'), 'code/frontend/tailwind.config.js')
    addFileIfExists(path.join(repoRoot, 'frontend/index.html'), 'code/frontend/index.html')

    try {
      await archive.finalize()
    } catch (err: any) {
      abort(`finalize failed: ${err?.message ?? String(err)}`)
    }
  } catch (e: any) {
    abort(`prepare failed: ${e?.message ?? String(e)}`)
  }
})

export default router
