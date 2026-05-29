/* eslint-disable @typescript-eslint/no-require-imports */
// Test del parser de Excel del lender Trinity: verifica que cada campo
// crítico se extrae automáticamente con el valor esperado.
//
// Uso:  DATABASE_URL=file:./dev.db npx tsx scripts/test-excel-extraction.ts

import * as fs from 'fs'
import * as XLSX from 'xlsx'

const EXCEL = '/Users/juandavid/Desktop/CLAUDE/DIRECTOR CONSTRUCTIVO/LOTES/LOTE 87/HERA LENDER/DRAW 1/Draw_1_Lot 87.xlsx'

interface TestResult { name: string; pass: boolean; detail?: string }
const results: TestResult[] = []
function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition, detail })
  console.log(`${condition ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

// Re-importar el parser interno (NO exportado): cargar el módulo y usar
// el endpoint público parseDrawExcel. El módulo lo define internamente.
// Para test directo lo replicamos llamando a /draws POST como integración,
// pero es más rápido invocar el parser directo via ts-node si fuera export.
// Plan B: invocamos las helpers vía require del módulo TS compilado.

const xlsxBuffer = fs.readFileSync(EXCEL)
const wb = XLSX.read(xlsxBuffer, { type: 'buffer', cellDates: true })
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: null })

console.log('🧪 Test: parser Excel Trinity Draw 1\n')
console.log(`  Sheet: ${wb.SheetNames[0]}`)
console.log(`  Header row 6: ${JSON.stringify(rows[6])}`)
console.log(`  Data row 7:   ${JSON.stringify(rows[7])}\n`)

// Llamar directamente al endpoint POST /draws/:id/document via HTTP no es
// posible sin server corriendo. En su lugar invocamos el parseDrawExcel
// del módulo source. Tiene que ser exportado para llamarse en test.
//
// Verificación funcional: el upload real lo ejecutamos cuando deployemos
// a Render. Aquí validamos que XLSX lee correctamente lo que el parser
// necesita.

const headerRow = rows[6] as any[]
const dataRow = rows[7] as any[]
const sectionRow = rows[5] as any[]

assert('Excel: sheet existe',                wb.SheetNames.length > 0, wb.SheetNames[0])
assert('Excel: header row tiene >=12 cols',  headerRow.length >= 12)
assert('Excel: data row tiene Draw Number',  dataRow[3] === '1', `Draw # = ${dataRow[3]}`)
assert('Excel: Refurb Loan Amount visible',  String(dataRow[4]).includes('395,350'), `${dataRow[4]}`)
assert('Excel: Draw Amount visible',         String(dataRow[8]).includes('80,131.06'), `${dataRow[8]}`)
assert('Excel: Net Wire visible',            String(dataRow[11]).includes('80,131.06'), `${dataRow[11]}`)
assert('Excel: UPB Post visible',            String(dataRow[12]).includes('87,131.06'), `${dataRow[12]}`)
assert('Excel: Refurb Balance Post visible', String(dataRow[14]).includes('315,218.94'), `${dataRow[14]}`)
assert('Excel: % Complete visible',          String(dataRow[15]).includes('20.27'), `${dataRow[15]}`)
assert('Excel: tiene secciones Pre/Post',
  sectionRow.some((c: any) => typeof c === 'string' && /pre/i.test(c)) &&
  sectionRow.some((c: any) => typeof c === 'string' && /post/i.test(c)),
  JSON.stringify(sectionRow))

// Ahora invocar parseDrawExcel del módulo real para validar end-to-end
const drawsModule = require('../src/routes/draws')
if (typeof drawsModule.parseDrawExcel === 'function') {
  const { parsed } = drawsModule.parseDrawExcel(xlsxBuffer)
  console.log('\n  Parsed result:', JSON.stringify(parsed, null, 2))
  assert('Parser: drawNumber = 1',                  parsed.drawNumber === 1, String(parsed.drawNumber))
  assert('Parser: montoSolicitado ≈ $80,131.06',    Math.abs((parsed.montoSolicitado ?? 0) - 80131.06) < 1, String(parsed.montoSolicitado))
  assert('Parser: netWire ≈ $80,131.06',            Math.abs((parsed.netWire ?? 0) - 80131.06) < 1, String(parsed.netWire))
  assert('Parser: upbPost ≈ $87,131.06',            Math.abs((parsed.upbPost ?? 0) - 87131.06) < 1, String(parsed.upbPost))
  assert('Parser: saldoHoldback ≈ $315,218.94',     Math.abs((parsed.saldoHoldback ?? 0) - 315218.94) < 1, String(parsed.saldoHoldback))
  assert('Parser: projectHoldback ≈ $395,350.00',   Math.abs((parsed.projectHoldback ?? 0) - 395350) < 1, String(parsed.projectHoldback))
  assert('Parser: porcentajeFunded ≈ 0.2027',       Math.abs((parsed.porcentajeFunded ?? 0) - 0.2027) < 0.001, String(parsed.porcentajeFunded))
} else {
  console.log('\n⚠ parseDrawExcel NO está exportado — saltando validación end-to-end del parser')
  assert('parseDrawExcel exportado', false, 'función no exportada — agregar export')
}

const passed = results.filter(r => r.pass).length
const failed = results.filter(r => !r.pass).length
console.log(`\n📊 ${passed} passed · ${failed} failed`)
if (failed > 0) {
  console.log('\nFALLAS:')
  for (const r of results.filter(r => !r.pass)) console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
}
process.exit(failed > 0 ? 1 : 0)
