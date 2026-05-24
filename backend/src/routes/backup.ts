import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import archiver from 'archiver'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import AdmZip from 'adm-zip'
import * as XLSX from 'xlsx'

const router = Router()
const prisma = new PrismaClient()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })
const RESTORE_PASSWORD = process.env.WIPE_PASSWORD || '18418598'

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

// === GET /api/backup/excel-tech ===
// Exporta los datos del módulo TÉCNICO a Excel multi-hoja (re-importable manualmente).
router.get('/excel-tech', async (_req: Request, res: Response) => {
  try {
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

    const wb = XLSX.utils.book_new()
    const addSheet = (name: string, rows: any[]) => {
      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ '(sin datos)': '' }])
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
    }

    addSheet('Proyectos', projects.map((p) => ({
      ID: p.id, Nombre: p.name, SPV: p.spv, Holding: p.holding,
      Dirección: p.address, Condado: p.county, HOA: p.hoa,
      'SF Heated': p.sfHeated, 'SF Garage': p.sfGarage, 'SF Porches': p.sfPorches,
      Lender: p.lender, 'Loan #': p.loanNumber, 'Loan Amount': p.loanAmount,
      'Tasa anual': p.interestRate, 'Plazo meses': p.loanTermMonths,
      ARV: p.arv, 'Construction Budget': p.constructionBudget,
      'Settlement': p.settlementDate?.toISOString?.()?.slice(0, 10),
      'Permit #': p.permitNumber,
      'Permit emit': p.permitIssued?.toISOString?.()?.slice(0, 10),
      'Permit vence': p.permitExpires?.toISOString?.()?.slice(0, 10),
    })))

    addSheet('Items', projects.flatMap((p) => p.phases.flatMap((ph) =>
      ph.items.map((i) => ({
        Proyecto: p.name, 'Fase Code': ph.code, 'Fase Name': ph.name,
        'Item Code': i.itemCode, Actividad: i.activity, Estado: i.estado,
        Responsable: i.responsable, 'Valor Presupuestado': i.valorPresupuestado,
        'Valor Ejecutado': i.valorEjecutado,
        'Inicio real': i.fechaInicioReal?.toISOString?.()?.slice(0, 10),
        'Fin real': i.fechaFinReal?.toISOString?.()?.slice(0, 10),
        Completado: i.completado, 'Es NA': i.esNA,
        Observaciones: i.observaciones,
      }))
    )))

    addSheet('Draws', projects.flatMap((p) => p.draws.map((d) => ({
      Proyecto: p.name, '# Draw': d.drawNumber, Estado: d.estado,
      'Fecha solicitud': d.fechaSolicitud?.toISOString?.()?.slice(0, 10),
      'Fecha wire': d.fechaWire?.toISOString?.()?.slice(0, 10),
      'Monto solicitado': d.montoSolicitado, 'Net Wire': d.netWire,
      'UPB post': d.upbPost, 'Saldo holdback': d.saldoHoldback,
    }))))

    addSheet('Providers', projects.flatMap((p) => p.providers.map((pr) => ({
      Proyecto: p.name, Nombre: pr.name, Tipo: pr.type,
      Telefono: pr.phone, Email: pr.email, Licencia: pr.license, Notas: pr.notes,
    }))))

    addSheet('Files', projects.flatMap((p) => p.files.map((f) => ({
      Proyecto: p.name, Nombre: f.name, Categoría: f.category,
      Kind: f.kind, URL: f.url, Tamaño: f.size,
    }))))

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="tech-export-${new Date().toISOString().slice(0, 10)}.xlsx"`)
    res.send(buf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === POST /api/backup/restore-tech ===
// Restaura el módulo técnico desde un ZIP del backup general (busca tech-database.json adentro)
// o desde un .json directo. PROTEGIDO con password.
router.post('/restore-tech', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const pwd = (req.headers['x-restore-password'] as string) || (req.body && req.body.password) || ''
    if (pwd !== RESTORE_PASSWORD) {
      return res.status(403).json({ data: null, error: 'Contraseña incorrecta. El restore fue bloqueado por seguridad.' })
    }
    if (!req.file) return res.status(400).json({ data: null, error: 'No se subió ningún archivo' })

    const filename = (req.file.originalname || '').toLowerCase()
    let snapshot: any = null

    if (filename.endsWith('.json')) {
      snapshot = JSON.parse(req.file.buffer.toString('utf8'))
    } else if (filename.endsWith('.zip')) {
      const zip = new AdmZip(req.file.buffer)
      const entry =
        zip.getEntry('data/tech-database.json') ||
        zip.getEntry('tech-database.json') ||
        zip.getEntry('data.json')
      if (!entry) {
        return res.status(400).json({ data: null, error: 'El ZIP no contiene data/tech-database.json' })
      }
      snapshot = JSON.parse(entry.getData().toString('utf8'))
    } else {
      return res.status(400).json({ data: null, error: `Formato no soportado: ${filename}. Use .json o .zip` })
    }

    if (!snapshot || typeof snapshot !== 'object') {
      return res.status(400).json({ data: null, error: 'El snapshot está corrupto o vacío' })
    }
    if (!snapshot.projects || !Array.isArray(snapshot.projects)) {
      return res.status(400).json({ data: null, error: 'El snapshot no contiene proyectos del módulo técnico' })
    }

    // Wipe técnico
    await prisma.itemDocument.deleteMany({})
    await prisma.budgetLine.deleteMany({})
    await prisma.task.deleteMany({})
    await prisma.inspection.deleteMany({})
    await prisma.projectFile.deleteMany({})
    await prisma.note.deleteMany({})
    await prisma.providerQuote.deleteMany({}).catch(() => {})
    await prisma.provider.deleteMany({})
    await prisma.partner.deleteMany({})
    await prisma.draw.deleteMany({})
    await prisma.item.deleteMany({})
    await prisma.phase.deleteMany({})
    await prisma.project.deleteMany({})
    await prisma.priceRef.deleteMany({})

    const counts: any = { projects: 0, phases: 0, items: 0, draws: 0, partners: 0, providers: 0, notes: 0, files: 0, inspections: 0, tasks: 0, budgetLines: 0, priceRefs: 0, itemDocuments: 0 }

    const datesFields = ['settlementDate', 'permitIssued', 'permitExpires', 'targetCompletionDate', 'startDate', 'createdAt', 'updatedAt', 'fechaInicioReal', 'fechaFinReal', 'fechaSolicitud', 'fechaInspeccion', 'fechaWire']
    const normDates = (o: any) => {
      const r: any = { ...o }
      for (const f of datesFields) {
        if (r[f] && typeof r[f] === 'string') r[f] = new Date(r[f])
      }
      return r
    }

    for (const p of snapshot.projects || []) {
      const { phases, draws, partners, providers, notes, files, inspections, tasks, budgetLines, ...rest } = p
      await prisma.project.create({ data: normDates(rest) })
      counts.projects++
      for (const ph of phases || []) {
        const { items, ...phRest } = ph
        await prisma.phase.create({ data: normDates(phRest) })
        counts.phases++
        for (const item of items || []) {
          await prisma.item.create({ data: normDates(item) })
          counts.items++
        }
      }
      for (const d of draws || []) { await prisma.draw.create({ data: normDates(d) }); counts.draws++ }
      for (const pa of partners || []) { await prisma.partner.create({ data: normDates(pa) }); counts.partners++ }
      for (const pr of providers || []) {
        const { quotes, ...prRest } = pr
        await prisma.provider.create({ data: normDates(prRest) })
        counts.providers++
      }
      for (const n of notes || []) { await prisma.note.create({ data: normDates(n) }); counts.notes++ }
      for (const f of files || []) { await prisma.projectFile.create({ data: normDates(f) }); counts.files++ }
      for (const i of inspections || []) { await prisma.inspection.create({ data: normDates(i) }); counts.inspections++ }
      for (const t of tasks || []) { await prisma.task.create({ data: normDates(t) }); counts.tasks++ }
      for (const bl of budgetLines || []) { await prisma.budgetLine.create({ data: normDates(bl) }); counts.budgetLines++ }
    }

    for (const pr of snapshot.priceRefs || []) { await prisma.priceRef.create({ data: normDates(pr) }); counts.priceRefs++ }
    for (const idoc of snapshot.itemDocuments || []) { await prisma.itemDocument.create({ data: normDates(idoc) }); counts.itemDocuments++ }

    res.json({ data: { restored: true, counts, version: snapshot.version }, error: null })
  } catch (e: any) {
    console.error('[restore-tech] error:', e)
    res.status(500).json({ data: null, error: String(e) })
  }
})

// === DELETE /api/backup/wipe-tech ===
// Borra TODOS los datos del módulo técnico — protegido con password
router.delete('/wipe-tech', async (req: Request, res: Response) => {
  try {
    const pwd = (req.headers['x-wipe-password'] as string) || ''
    if (pwd !== RESTORE_PASSWORD) {
      return res.status(403).json({ data: null, error: 'Contraseña incorrecta. El reseteo fue bloqueado por seguridad.' })
    }
    await prisma.itemDocument.deleteMany({})
    await prisma.budgetLine.deleteMany({})
    await prisma.task.deleteMany({})
    await prisma.inspection.deleteMany({})
    await prisma.projectFile.deleteMany({})
    await prisma.note.deleteMany({})
    await prisma.providerQuote.deleteMany({}).catch(() => {})
    await prisma.provider.deleteMany({})
    await prisma.partner.deleteMany({})
    await prisma.draw.deleteMany({})
    await prisma.item.deleteMany({})
    await prisma.phase.deleteMany({})
    await prisma.project.deleteMany({})
    await prisma.priceRef.deleteMany({})
    res.json({ data: { wiped: true }, error: null })
  } catch (e: any) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
