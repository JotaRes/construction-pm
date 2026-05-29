/* eslint-disable @typescript-eslint/no-require-imports */
// Test end-to-end de la interconexión Draw ↔ ConstructionBudget.
// Crea un proyecto sandbox, ejecuta el ciclo completo con los archivos reales
// del Lote 87, y reporta PASS/FAIL por cada invariante.
//
// Uso:  DATABASE_URL=file:./dev.db npx tsx scripts/test-draw-budget-interconnection.ts

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import {
  parseTrinityDrawApprovals,
  applyDrawApprovalsToBudget,
  clearDrawContributions,
  recomputeBudgetLinesFromContributions,
  recomputeProjectBudgetFromContributions,
} from '../src/routes/draws'

const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

const prisma = new PrismaClient()

const PROJECT_NAME = '__TEST_DRAW_BUDGET__'
const TRINITY_PDF = '/Users/juandavid/Desktop/CLAUDE/DIRECTOR CONSTRUCTIVO/LOTES/LOTE 87/HERA LENDER/DRAW 1/Draw_1_Lot 87.pdf'

interface TestResult { name: string; pass: boolean; detail?: string }
const results: TestResult[] = []
function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition, detail })
  const icon = condition ? '✅' : '❌'
  console.log(`${icon} ${name}${detail ? ' — ' + detail : ''}`)
}

async function cleanup() {
  const p = await prisma.project.findFirst({ where: { name: PROJECT_NAME } })
  if (p) await prisma.project.delete({ where: { id: p.id } })
}

async function main() {
  console.log('🧪 Test E2E: Draw ↔ ConstructionBudget interconnection\n')

  await cleanup()

  // 1. Crear proyecto sandbox + budget lines del template
  const project = await prisma.project.create({
    data: {
      name: PROJECT_NAME,
      spv: 'Sandbox SPV LLC',
      holding: 'Sandbox Holding LLC',
      address: 'Sandbox 123',
      county: 'Oconee',
      sfHeated: 2400,
      holdback: 395350,
      loanAmount: 402350,
      interestRate: 0.085,
      loanTermMonths: 18,
      arv: 619000,
      constructionBudget: 465750,
    },
  })

  // 2. Parse Trinity PDF PRIMERO — vamos a sembrar el budget con SUS códigos
  //    (en producción el budget se importa desde el PDF de Construction Budget
  //    de Hera, que comparte el esquema de códigos N.N con el reporte Trinity)
  if (!fs.existsSync(TRINITY_PDF)) {
    console.error(`❌ Archivo de prueba no encontrado: ${TRINITY_PDF}`)
    process.exit(1)
  }
  const pdfBuffer = fs.readFileSync(TRINITY_PDF)
  const pdfData = await pdfParse(pdfBuffer)
  const approvals = parseTrinityDrawApprovals(pdfData.text)

  let order = 0
  for (const a of approvals) {
    await prisma.budgetLine.create({
      data: {
        projectId: project.id,
        divCode: 'SEC.0',
        divName: 'Trinity Budget',
        itemCode: a.itemCode,
        description: a.description,
        unit: 'LS',
        valorInicial: a.currentAmountAvailable > 0 ? a.currentAmountAvailable * 2 : 1000,
        order: order++,
      },
    })
  }
  console.log(`  Sandbox project ${project.id} con ${order} budget lines\n`)
  assert('PDF Trinity parsea ≥1 ítem',          approvals.length > 0, `${approvals.length} ítems`)
  const totalThisDraw = approvals.reduce((s, a) => s + a.deltaThisDraw, 0)
  console.log(`  PDF: ${approvals.length} líneas, total $${totalThisDraw.toFixed(2)}\n`)

  // 3. Crear draw 1 y aplicar approvals
  const draw1 = await prisma.draw.create({
    data: { projectId: project.id, drawNumber: 1, estado: 'PENDING' },
  })
  const r1 = await applyDrawApprovalsToBudget(project.id, draw1.id, approvals)
  assert('Draw 1 aplicado: matched ≥1',         r1.matched > 0,             `${r1.matched} matched`)
  assert('Draw 1 aplicado: newly ≥1',           r1.newlyApprovedItems > 0,   `${r1.newlyApprovedItems} nuevos`)
  assert('Draw 1 aplicado: cumulativeApproved > 0', r1.cumulativeApproved > 0, `$${r1.cumulativeApproved.toFixed(2)}`)

  // 4. Verificar que se guardaron contribuciones
  const contribs1 = await prisma.drawLineContribution.findMany({ where: { drawId: draw1.id } })
  assert('Contribuciones guardadas para draw 1', contribs1.length === r1.newlyApprovedItems,
    `${contribs1.length} contribs vs ${r1.newlyApprovedItems} newly`)

  // 5. Verificar que valorAprobado de las líneas = suma de contribuciones
  const linesAfter1 = await prisma.budgetLine.findMany({ where: { projectId: project.id } })
  const sumAprobado1 = linesAfter1.reduce((s, l) => s + l.valorAprobado, 0)
  const sumContribs1 = contribs1.reduce((s, c) => s + c.deltaAmount, 0)
  assert('Suma valorAprobado = suma contribuciones del draw 1',
    Math.abs(sumAprobado1 - sumContribs1) < 0.01,
    `aprobado $${sumAprobado1.toFixed(2)} vs contribs $${sumContribs1.toFixed(2)}`)

  // 6. IDEMPOTENCIA: re-aplicar el MISMO PDF al mismo draw → resultado idéntico
  const r1bis = await applyDrawApprovalsToBudget(project.id, draw1.id, approvals)
  const contribs1bis = await prisma.drawLineContribution.findMany({ where: { drawId: draw1.id } })
  const linesAfter1bis = await prisma.budgetLine.findMany({ where: { projectId: project.id } })
  const sumAprobado1bis = linesAfter1bis.reduce((s, l) => s + l.valorAprobado, 0)
  assert('Re-aplicar mismo PDF NO duplica contribuciones',
    contribs1bis.length === contribs1.length,
    `${contribs1bis.length} contribs (esperado ${contribs1.length})`)
  assert('Re-aplicar mismo PDF NO duplica valorAprobado',
    Math.abs(sumAprobado1bis - sumAprobado1) < 0.01,
    `aprobado $${sumAprobado1bis.toFixed(2)} (esperado $${sumAprobado1.toFixed(2)})`)
  assert('Re-aplicar mismo PDF reporta misma cumulativeApproved',
    Math.abs(r1bis.cumulativeApproved - r1.cumulativeApproved) < 0.01,
    `$${r1bis.cumulativeApproved.toFixed(2)} vs $${r1.cumulativeApproved.toFixed(2)}`)

  // 7. CLEAR contribuciones (= borrar APPROVAL pdf) → valorAprobado vuelve a 0
  await clearDrawContributions(draw1.id)
  const linesAfterClear = await prisma.budgetLine.findMany({ where: { projectId: project.id } })
  const sumAprobadoClear = linesAfterClear.reduce((s, l) => s + l.valorAprobado, 0)
  const contribsClear = await prisma.drawLineContribution.findMany({ where: { drawId: draw1.id } })
  assert('Clear contribuciones borra todas las del draw',
    contribsClear.length === 0, `${contribsClear.length} contribs restantes`)
  assert('Clear contribuciones resetea valorAprobado a 0',
    sumAprobadoClear < 0.01, `$${sumAprobadoClear.toFixed(2)} restante`)

  // 8. RE-APLICAR después de clear (simula re-upload del PDF tras borrarlo)
  const r1re = await applyDrawApprovalsToBudget(project.id, draw1.id, approvals)
  const linesAfterRe = await prisma.budgetLine.findMany({ where: { projectId: project.id } })
  const sumAprobadoRe = linesAfterRe.reduce((s, l) => s + l.valorAprobado, 0)
  assert('Re-aplicar tras clear restaura valorAprobado',
    Math.abs(sumAprobadoRe - sumAprobado1) < 0.01,
    `$${sumAprobadoRe.toFixed(2)} (esperado $${sumAprobado1.toFixed(2)})`)
  assert('cumulativeApproved post-clear = original',
    Math.abs(r1re.cumulativeApproved - r1.cumulativeApproved) < 0.01)

  // 9. DEDUPLICACIÓN del 2do draw — simular un draw 2 con MISMAS líneas
  //    pero todas con priorAmount = currentAmountAvailable (carryover puro).
  //    deltaThisDraw debe ser 0 → 0 nuevos items, 0 contribuciones.
  const draw2 = await prisma.draw.create({
    data: { projectId: project.id, drawNumber: 2, estado: 'PENDING' },
  })
  const carryoverApprovals = approvals.map(a => ({
    ...a,
    priorAmount: a.currentAmountAvailable,
    deltaThisDraw: 0,
  }))
  const r2carry = await applyDrawApprovalsToBudget(project.id, draw2.id, carryoverApprovals)
  assert('Draw 2 con sólo carryover: 0 nuevos items',
    r2carry.newlyApprovedItems === 0, `${r2carry.newlyApprovedItems} nuevos`)
  const contribs2carry = await prisma.drawLineContribution.findMany({ where: { drawId: draw2.id } })
  assert('Draw 2 con sólo carryover: 0 contribuciones guardadas',
    contribs2carry.length === 0, `${contribs2carry.length} contribs`)
  const linesAfterCarry = await prisma.budgetLine.findMany({ where: { projectId: project.id } })
  const sumAprobadoCarry = linesAfterCarry.reduce((s, l) => s + l.valorAprobado, 0)
  assert('Draw 2 carryover NO cambia valorAprobado',
    Math.abs(sumAprobadoCarry - sumAprobado1) < 0.01,
    `$${sumAprobadoCarry.toFixed(2)} (esperado $${sumAprobado1.toFixed(2)})`)

  // 10. DEDUPLICACIÓN — draw 2 con un ítem NUEVO real
  //     Tomamos un ítem del draw 1 que NO esté al 100% y le agregamos delta.
  const firstApproval = approvals.find(a => a.deltaThisDraw > 0)
  if (firstApproval) {
    const newDelta = 1000
    const draw2NewItem = [{
      itemCode: firstApproval.itemCode,
      description: firstApproval.description,
      priorAmount: firstApproval.currentAmountAvailable,
      thisInspectionPct: 100,
      currentAmountAvailable: firstApproval.currentAmountAvailable + newDelta,
      deltaThisDraw: newDelta,
    }]
    const r2new = await applyDrawApprovalsToBudget(project.id, draw2.id, draw2NewItem)
    assert('Draw 2 con ítem nuevo: 1 newlyApprovedItem',
      r2new.newlyApprovedItems === 1, `${r2new.newlyApprovedItems}`)
    assert('Draw 2 con ítem nuevo: newlyApprovedAmount = delta',
      Math.abs(r2new.newlyApprovedAmount - newDelta) < 0.01,
      `$${r2new.newlyApprovedAmount.toFixed(2)} (esperado $${newDelta})`)

    // 11. La línea afectada ahora suma contribución de draw 1 + draw 2
    const targetLine = await prisma.budgetLine.findFirst({
      where: { projectId: project.id, itemCode: firstApproval.itemCode },
    })
    assert('Línea con dos draws: valorAprobado = suma',
      targetLine !== null &&
      Math.abs(targetLine.valorAprobado - (firstApproval.deltaThisDraw + newDelta)) < 0.01,
      `$${targetLine?.valorAprobado.toFixed(2)} (esperado $${(firstApproval.deltaThisDraw + newDelta).toFixed(2)})`)

    // 12. BORRAR draw 2 → la línea vuelve sólo al aporte de draw 1
    await clearDrawContributions(draw2.id)
    const targetLineAfterDel = await prisma.budgetLine.findFirst({
      where: { projectId: project.id, itemCode: firstApproval.itemCode },
    })
    assert('Borrar draw 2: línea vuelve al aporte sólo de draw 1',
      targetLineAfterDel !== null &&
      Math.abs(targetLineAfterDel.valorAprobado - firstApproval.deltaThisDraw) < 0.01,
      `$${targetLineAfterDel?.valorAprobado.toFixed(2)} (esperado $${firstApproval.deltaThisDraw.toFixed(2)})`)

    // 13. BORRAR draw 1 → cascade limpia sus contribuciones, valorAprobado = 0
    const contribsBeforeDel = await prisma.drawLineContribution.findMany({ where: { drawId: draw1.id } })
    const touchedIds = contribsBeforeDel.map(c => c.budgetLineId)
    await prisma.draw.delete({ where: { id: draw1.id } })
    // Reproducir lo que hace el endpoint DELETE: recalcular líneas afectadas
    await recomputeBudgetLinesFromContributions(touchedIds)
    const linesFinal = await prisma.budgetLine.findMany({ where: { projectId: project.id } })
    const sumFinal = linesFinal.reduce((s, l) => s + l.valorAprobado, 0)
    assert('Borrar draw 1 (cascade): valorAprobado total = 0',
      sumFinal < 0.01, `$${sumFinal.toFixed(2)}`)
    const contribsFinal = await prisma.drawLineContribution.findMany({
      where: { draw: { projectId: project.id } },
    })
    assert('Borrar draw 1 (cascade): 0 contribuciones huérfanas',
      contribsFinal.length === 0, `${contribsFinal.length} restantes`)
  }

  // 14. CASO LEGACY: simular aprobaciones cargadas SIN contribuciones (estado
  //     anterior a DrawLineContribution). El usuario carga valores directos a
  //     valorAprobado, después borra el draw → el budget debe quedar limpio.
  console.log('\n  --- CASO LEGACY (sin contribuciones) ---')
  const legacyDraw = await prisma.draw.create({
    data: { projectId: project.id, drawNumber: 5, estado: 'WIRED', netWire: 10000 },
  })
  // Simular estado legacy: asignar valorAprobado directo, SIN contribución.
  const someLines = await prisma.budgetLine.findMany({
    where: { projectId: project.id }, take: 3,
  })
  for (const l of someLines) {
    await prisma.budgetLine.update({
      where: { id: l.id }, data: { valorAprobado: 5000 },
    })
  }
  const legacySumBefore = (await prisma.budgetLine.findMany({
    where: { projectId: project.id }, select: { valorAprobado: true },
  })).reduce((s, l) => s + l.valorAprobado, 0)
  assert('Setup legacy: 3 líneas con $5,000 cada una (sin contrib)',
    legacySumBefore === 15000, `$${legacySumBefore}`)
  const contribsLegacy = await prisma.drawLineContribution.findMany({
    where: { drawId: legacyDraw.id },
  })
  assert('Setup legacy: 0 contribuciones del draw',
    contribsLegacy.length === 0, `${contribsLegacy.length} contribs`)

  // Acción: borrar draw legacy y hacer recompute project-wide
  await prisma.draw.delete({ where: { id: legacyDraw.id } })
  await recomputeProjectBudgetFromContributions(project.id)
  const legacySumAfter = (await prisma.budgetLine.findMany({
    where: { projectId: project.id }, select: { valorAprobado: true },
  })).reduce((s, l) => s + l.valorAprobado, 0)
  assert('LEGACY: borrar draw + recompute project-wide → valorAprobado = 0',
    legacySumAfter < 0.01, `$${legacySumAfter.toFixed(2)} restante`)

  // CLEANUP
  await cleanup()

  console.log('\n📊 Resumen:')
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`   ${passed} passed · ${failed} failed`)
  if (failed > 0) {
    console.log('\nFALLAS:')
    for (const r of results.filter(r => !r.pass)) {
      console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
    }
    process.exit(1)
  }
  process.exit(0)
}

main()
  .catch(async (e) => { console.error('FATAL:', e); await cleanup(); process.exit(1) })
  .finally(() => prisma.$disconnect())
