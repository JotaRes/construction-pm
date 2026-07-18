import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import archiver from 'archiver'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import AdmZip from 'adm-zip'
import { buildTechExcel, buildFinanceExcel, readRestoreSnapshotFromXlsx } from '../lib/excelReports'
import { buildSnapshot as buildFinanceSnapshot } from '../finance/routes/backup'
import { collectTechTargets, collectFinanceTargets, collectAdminTargets, appendBinaries, manifestToCsv } from '../lib/backupBinaries'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })
const RESTORE_PASSWORD = process.env.WIPE_PASSWORD

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
        phases: { include: { items: { include: { subactivities: { include: { provider: { select: { name: true } } } } } } } },
        draws: true,
        partners: true,
        providers: { include: { quotes: true, documents: true } },
        notes: true,
        files: true,
        inspections: true,
        tasks: true,
        budgetLines: true,
      },
    })
    const [priceRefs, itemDocuments, subcontractorContracts, drawLineContributions, changeOrders, punchListItems, globalProviders] = await Promise.all([
      prisma.priceRef.findMany(),
      prisma.itemDocument.findMany(),
      prisma.subcontractorContract.findMany({ include: { paymentSchedule: true } }),
      prisma.drawLineContribution.findMany(),
      prisma.changeOrder.findMany(),
      prisma.punchListItem.findMany(),
      // Proveedores GLOBALES (projectId null): no están anidados en ningún
      // proyecto — sin esto se perderían en la restauración.
      prisma.provider.findMany({ where: { projectId: null }, include: { quotes: true, documents: true } }),
    ])

    // Snapshot como objeto: se usa para el JSON del ZIP y se incrusta también
    // en el Excel (hoja oculta _RESTORE) para que el .xlsx sea re-importable.
    const techSnapshotObj = {
      projects,
      globalProviders,
      priceRefs,
      itemDocuments,
      subcontractorContracts,
      drawLineContributions,
      changeOrders,
      punchListItems,
      exportedAt: new Date().toISOString(),
      // v1.6: proveedores globales incluidos + SubActivity.providerId.
      // v1.5: items con budgetLineId y subactividades con control administrativo.
      version: '1.6',
    }
    const techSnapshot = JSON.stringify(techSnapshotObj, null, 2)

    archive.append(techSnapshot, { name: 'data/tech-database.json' })

    // === DASHBOARDS EXCEL (plan B de control, legible para cualquiera) ===
    try {
      const techXlsx = await buildTechExcel({ projects, priceRefs, drawLineContributions, subcontractorContracts, changeOrders, punchListItems, itemDocuments, restoreSnapshot: techSnapshotObj })
      archive.append(techXlsx, { name: 'excel/reporte-tecnico.xlsx' })
    } catch (err) {
      console.error('Backup tech excel failed:', err)
    }

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

    // === MÓDULO ADMINISTRATIVO (gobierno corporativo) ===
    const [admCompanies, admDocTypes, admDocuments, admRequirements, admTasks] =
      await Promise.all([
        prisma.admCompany.findMany(),
        prisma.admDocType.findMany(),
        prisma.admDocument.findMany(),
        prisma.admRequirement.findMany(),
        prisma.admTask.findMany(),
      ])

    const admSnapshot = JSON.stringify(
      {
        companies: admCompanies,
        docTypes: admDocTypes,
        documents: admDocuments,
        requirements: admRequirements,
        tasks: admTasks,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      },
      null,
      2
    )
    archive.append(admSnapshot, { name: 'data/admin-database.json' })

    // Excel financiero (snapshot con relaciones expandidas para nombres legibles)
    let finFull: any = null
    try {
      finFull = await buildFinanceSnapshot()
      const finXlsx = await buildFinanceExcel(finFull as any)
      archive.append(finXlsx, { name: 'excel/reporte-financiero.xlsx' })
    } catch (err) {
      console.error('Backup finance excel failed:', err)
    }

    // README explicativo del backup
    const readme = [
      '# Backup completo — Sistema Restrepo Acosta',
      `Generado: ${new Date().toISOString()}`,
      '',
      '## Contenido',
      '- data/tech-database.json     → datos del módulo TÉCNICO (v1.3, re-importable)',
      '- data/finance-database.json  → datos del módulo FINANCIERO (re-importable)',
      '- data/admin-database.json    → datos del módulo ADMINISTRATIVO (empresas, expedientes, tareas)',
      '- excel/reporte-tecnico.xlsx  → dashboard técnico legible (plan B de control)',
      '- excel/reporte-financiero.xlsx → dashboard financiero legible (plan B de control)',
      '- files/                      → binarios (PDFs/fotos) descargados de Cloudinary',
      '- files/INDICE-ARCHIVOS.csv   → mapa de cada binario a su registro de origen',
      '- code/                       → código fuente completo (backend + frontend)',
      '',
      '## Cómo restaurar los datos',
      'Módulo técnico:    POST /api/backup/restore-tech   (subir este .zip o tech-database.json)',
      'Módulo financiero: POST /api/finance/imports/restore (subir este .zip o finance-data.json)',
      'Ambos requieren la contraseña de restauración en el header X-Restore-Password.',
      '',
      'NOTA: los binarios en files/ son una copia descargada de Cloudinary al momento',
      'del backup. Restaurar los datos NO re-sube estos binarios a Cloudinary; las URLs',
      'guardadas seguirán apuntando a Cloudinary. files/ es tu copia física de respaldo.',
      'Para omitir la descarga de binarios usa /api/backup?nofiles=1.',
      '',
    ].join('\n')
    archive.append(readme, { name: 'LEEME.txt' })

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

    // === BINARIOS (PDFs/fotos) — descarga de Cloudinary e inclusión física ===
    // Best-effort: cada archivo fallido queda registrado en el índice y el backup sigue.
    // Se puede omitir con ?nofiles=1 (útil si hay muchísimos archivos pesados).
    if (req.query.nofiles !== '1' && !aborted) {
      try {
        const techTargets = collectTechTargets(projects, itemDocuments, subcontractorContracts)
        const finTargets = finFull ? collectFinanceTargets(finFull) : []
        const admTargets = collectAdminTargets(admDocuments, admCompanies)
        const targets = [...techTargets, ...finTargets, ...admTargets]
        const manifest = await appendBinaries(archive, targets)
        const okCount = manifest.filter((m) => m.Estado.startsWith('OK')).length
        archive.append(manifestToCsv(manifest), { name: 'files/INDICE-ARCHIVOS.csv' })
        console.log(`Backup binarios: ${okCount}/${targets.length} descargados`)
      } catch (err) {
        console.error('Backup binaries step failed:', err)
      }
    }

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
// Dashboard Excel profesional del módulo TÉCNICO (plan B de control).
router.get('/excel-tech', async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        phases: { include: { items: { include: { subactivities: { include: { provider: { select: { name: true } } } } } } } },
        draws: true,
        partners: true,
        providers: { include: { quotes: true, documents: true } },
        notes: true,
        files: true,
        inspections: true,
        tasks: true,
        budgetLines: true,
      },
    })
    const [priceRefs, drawLineContributions, subcontractorContracts, changeOrders, punchListItems, itemDocuments] = await Promise.all([
      prisma.priceRef.findMany(),
      prisma.drawLineContribution.findMany(),
      prisma.subcontractorContract.findMany({ include: { paymentSchedule: true } }),
      prisma.changeOrder.findMany(),
      prisma.punchListItem.findMany(),
      prisma.itemDocument.findMany(),
    ])

    // Mismo snapshot que el backup ZIP → el Excel descargado desde aquí también
    // es restaurable con fidelidad total (hoja oculta _RESTORE).
    const globalProviders = await prisma.provider.findMany({ where: { projectId: null }, include: { quotes: true, documents: true } })
    const restoreSnapshot = {
      projects,
      globalProviders,
      priceRefs,
      itemDocuments,
      subcontractorContracts,
      drawLineContributions,
      changeOrders,
      punchListItems,
      exportedAt: new Date().toISOString(),
      version: '1.6',
    }
    const buf = await buildTechExcel({ projects, priceRefs, drawLineContributions, subcontractorContracts, changeOrders, punchListItems, itemDocuments, restoreSnapshot })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="reporte-tecnico-${new Date().toISOString().slice(0, 10)}.xlsx"`)
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
    } else if (filename.endsWith('.xlsx')) {
      // Excel del sistema: trae el snapshot exacto en la hoja oculta _RESTORE.
      snapshot = await readRestoreSnapshotFromXlsx(req.file.buffer)
      if (!snapshot) {
        return res.status(400).json({
          data: null,
          error: 'Este Excel no contiene datos de restauración (hoja _RESTORE). Solo los Excel generados por el sistema a partir de esta versión son restaurables — usa un backup ZIP o JSON para archivos anteriores.',
        })
      }
    } else {
      return res.status(400).json({ data: null, error: `Formato no soportado: ${filename}. Use .xlsx, .json o .zip` })
    }

    if (!snapshot || typeof snapshot !== 'object') {
      return res.status(400).json({ data: null, error: 'El snapshot está corrupto o vacío' })
    }
    if (!snapshot.projects || !Array.isArray(snapshot.projects)) {
      return res.status(400).json({ data: null, error: 'El snapshot no contiene proyectos del módulo técnico' })
    }

    // Wipe técnico — orden hijo→padre para respetar las foreign keys
    await prisma.subActivity.deleteMany({}).catch(() => {})
    await prisma.itemDocument.deleteMany({})
    await prisma.changeOrder.deleteMany({}).catch(() => {})
    await prisma.punchListItem.deleteMany({}).catch(() => {})
    await prisma.subcontractorPayment.deleteMany({}).catch(() => {})
    await prisma.subcontractorContract.deleteMany({}).catch(() => {})
    await prisma.drawLineContribution.deleteMany({}).catch(() => {})
    await prisma.budgetLine.deleteMany({})
    await prisma.task.deleteMany({})
    await prisma.inspection.deleteMany({})
    await prisma.projectFile.deleteMany({})
    await prisma.note.deleteMany({})
    await prisma.providerQuote.deleteMany({}).catch(() => {})
    await prisma.providerDocument.deleteMany({}).catch(() => {})
    await prisma.provider.deleteMany({})
    await prisma.partner.deleteMany({})
    await prisma.draw.deleteMany({})
    await prisma.item.deleteMany({})
    await prisma.phase.deleteMany({})
    await prisma.project.deleteMany({})
    await prisma.priceRef.deleteMany({})

    const counts: any = { projects: 0, phases: 0, items: 0, subactivities: 0, draws: 0, partners: 0, providers: 0, providerQuotes: 0, providerDocuments: 0, notes: 0, files: 0, inspections: 0, tasks: 0, budgetLines: 0, priceRefs: 0, itemDocuments: 0, drawLineContributions: 0, subcontractorContracts: 0, subcontractorPayments: 0 }

    const datesFields = ['settlementDate', 'permitIssued', 'permitExpires', 'targetCompletionDate', 'startDate', 'createdAt', 'updatedAt', 'fechaInicioReal', 'fechaFinReal', 'fechaSolicitud', 'fechaInspeccion', 'fechaWire', 'fecha']
    const normDates = (o: any) => {
      const r: any = { ...o }
      for (const f of datesFields) {
        if (r[f] && typeof r[f] === 'string') r[f] = new Date(r[f])
      }
      return r
    }

    // Proveedores GLOBALES primero (v1.6+): Item/SubActivity los referencian por FK
    for (const gp of snapshot.globalProviders || []) {
      const { quotes, documents, ...gpRest } = gp
      await prisma.provider.create({ data: normDates(gpRest) }).catch(() => {})
      counts.providers++
      for (const q of quotes || []) { await prisma.providerQuote.create({ data: normDates(q) }).catch(() => {}); counts.providerQuotes++ }
      for (const doc of documents || []) { await prisma.providerDocument.create({ data: normDates(doc) }).catch(() => {}); counts.providerDocuments++ }
    }

    for (const p of snapshot.projects || []) {
      const { phases, draws, partners, providers, notes, files, inspections, tasks, budgetLines, ...rest } = p
      await prisma.project.create({ data: normDates(rest) })
      counts.projects++
      // ORDEN DE DEPENDENCIAS (FKs):
      // 1) Providers ANTES que items/subactividades (Item.providerId, SubActivity.providerId)
      // 2) BudgetLines ANTES que items (Item.budgetLineId)
      // 3) Phases → Items → SubActivities
      for (const pr of providers || []) {
        const { quotes, documents, ...prRest } = pr
        await prisma.provider.create({ data: normDates(prRest) })
        counts.providers++
        for (const q of quotes || []) { await prisma.providerQuote.create({ data: normDates(q) }).catch(() => {}); counts.providerQuotes++ }
        for (const doc of documents || []) { await prisma.providerDocument.create({ data: normDates(doc) }).catch(() => {}); counts.providerDocuments++ }
      }
      for (const bl of budgetLines || []) { await prisma.budgetLine.create({ data: normDates(bl) }); counts.budgetLines++ }
      for (const ph of phases || []) {
        const { items, ...phRest } = ph
        await prisma.phase.create({ data: normDates(phRest) })
        counts.phases++
        for (const item of items || []) {
          // Las subactividades vienen anidadas en el snapshot (v1.4+): se extraen
          // y se crean por separado — pasarlas anidadas rompía la restauración.
          const { subactivities, budgetLine, provider, ...itemRest } = item
          await prisma.item.create({ data: normDates(itemRest) })
          counts.items++
          for (const sub of subactivities || []) {
            const { provider: _subProv, ...subRest } = sub
            await prisma.subActivity.create({ data: normDates(subRest) }).catch(() => {})
            counts.subactivities++
          }
        }
      }
      for (const d of draws || []) { await prisma.draw.create({ data: normDates(d) }); counts.draws++ }
      for (const pa of partners || []) { await prisma.partner.create({ data: normDates(pa) }); counts.partners++ }
      for (const n of notes || []) { await prisma.note.create({ data: normDates(n) }); counts.notes++ }
      for (const f of files || []) { await prisma.projectFile.create({ data: normDates(f) }); counts.files++ }
      for (const i of inspections || []) { await prisma.inspection.create({ data: normDates(i) }); counts.inspections++ }
      for (const t of tasks || []) { await prisma.task.create({ data: normDates(t) }); counts.tasks++ }
    }

    for (const pr of snapshot.priceRefs || []) { await prisma.priceRef.create({ data: normDates(pr) }); counts.priceRefs++ }
    for (const idoc of snapshot.itemDocuments || []) { await prisma.itemDocument.create({ data: normDates(idoc) }); counts.itemDocuments++ }

    // DrawLineContribution: depende de draws + budgetLines (ya creados arriba)
    for (const c of snapshot.drawLineContributions || []) {
      await prisma.drawLineContribution.create({ data: normDates(c) }).catch(() => {})
      counts.drawLineContributions++
    }

    // Subcontratos + calendario de pagos: dependen de provider + project (ya creados)
    for (const c of snapshot.subcontractorContracts || []) {
      const { paymentSchedule, ...cRest } = c
      await prisma.subcontractorContract.create({ data: normDates(cRest) }).catch(() => {})
      counts.subcontractorContracts++
      for (const pay of paymentSchedule || []) {
        await prisma.subcontractorPayment.create({ data: normDates(pay) }).catch(() => {})
        counts.subcontractorPayments++
      }
    }

    // R3: restaurar también change orders y punch list (tablas nuevas del snapshot v1.4+)
    for (const co of snapshot.changeOrders || []) {
      await prisma.changeOrder.create({ data: normDates(co) }).catch(() => {})
      ;(counts as any).changeOrders = ((counts as any).changeOrders ?? 0) + 1
    }
    for (const pi of snapshot.punchListItems || []) {
      await prisma.punchListItem.create({ data: normDates(pi) }).catch(() => {})
      ;(counts as any).punchListItems = ((counts as any).punchListItems ?? 0) + 1
    }

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
    await prisma.subActivity.deleteMany({}).catch(() => {})
    await prisma.itemDocument.deleteMany({})
    await prisma.changeOrder.deleteMany({}).catch(() => {})
    await prisma.punchListItem.deleteMany({}).catch(() => {})
    await prisma.subcontractorPayment.deleteMany({}).catch(() => {})
    await prisma.subcontractorContract.deleteMany({}).catch(() => {})
    await prisma.drawLineContribution.deleteMany({}).catch(() => {})
    await prisma.task.deleteMany({})
    await prisma.inspection.deleteMany({})
    await prisma.projectFile.deleteMany({})
    await prisma.note.deleteMany({})
    await prisma.providerQuote.deleteMany({}).catch(() => {})
    await prisma.providerDocument.deleteMany({}).catch(() => {})
    await prisma.provider.deleteMany({})
    await prisma.partner.deleteMany({})
    await prisma.draw.deleteMany({})
    await prisma.item.deleteMany({})
    await prisma.budgetLine.deleteMany({})
    await prisma.phase.deleteMany({})
    await prisma.project.deleteMany({})
    await prisma.priceRef.deleteMany({})
    res.json({ data: { wiped: true }, error: null })
  } catch (e: any) {
    res.status(500).json({ data: null, error: String(e) })
  }
})

export default router
