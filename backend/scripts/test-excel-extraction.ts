// Test del parser de Excel del lender Trinity: verifica que cada campo
// crítico se extrae automáticamente con el valor esperado.
//
// Uso:  DATABASE_URL=file:./dev.db npx tsx scripts/test-excel-extraction.ts

import * as fs from 'fs'
import ExcelJS from 'exceljs'
import { parseDrawExcel } from '../src/routes/draws'

const EXCEL = '/Users/juandavid/Desktop/CLAUDE/DIRECTOR CONSTRUCTIVO/LOTES/LOTE 87/HERA LENDER/DRAW 1/Draw_1_Lot 87.xlsx'

interface TestResult { name: string; pass: boolean; detail?: string }
const results: TestResult[] = []
function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition, detail })
  console.log(`${condition ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function loadFirstSheetRows(buffer: Buffer): Promise<{ name: string; rows: any[][] }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  const sheet = wb.worksheets[0]
  const rows: any[][] = []
  const lastRow = sheet.actualRowCount > 0 ? sheet.rowCount : 0
  const lastCol = sheet.actualColumnCount > 0 ? sheet.columnCount : 0
  for (let r = 1; r <= lastRow; r++) {
    const row = sheet.getRow(r)
    const arr: any[] = []
    for (let c = 1; c <= lastCol; c++) {
      const v = row.getCell(c).value
      if (v && typeof v === 'object' && 'result' in (v as object)) arr.push((v as { result: unknown }).result ?? null)
      else if (v && typeof v === 'object' && 'richText' in (v as object)) arr.push((v as { richText: Array<{ text: string }> }).richText.map(t => t.text).join(''))
      else if (v && typeof v === 'object' && 'text' in (v as object)) arr.push((v as { text: string }).text)
      else arr.push(v === undefined ? null : v)
    }
    rows.push(arr)
  }
  return { name: sheet.name, rows }
}

async function main() {
  const xlsxBuffer = fs.readFileSync(EXCEL)
  const { name, rows } = await loadFirstSheetRows(xlsxBuffer)

  console.log('🧪 Test: parser Excel Trinity Draw 1\n')
  console.log(`  Sheet: ${name}`)
  console.log(`  Header row 6: ${JSON.stringify(rows[6])}`)
  console.log(`  Data row 7:   ${JSON.stringify(rows[7])}\n`)

  // Detectar dinámicamente el índice de Draw Number en la dataRow:
  // exceljs y xlsx tienen indexación distinta al manejar columnas vacías.
  const headerRow = rows[6] as any[]
  const dataRow   = rows[7] as any[]
  const sectionRow = rows[5] as any[]
  // Buscar índice del header "Draw Number"; los demás índices serán relativos.
  const drawNumHeaderIdx = headerRow.findIndex((c: any) => typeof c === 'string' && /draw\s*number/i.test(c))
  const baseIdx = drawNumHeaderIdx >= 0 ? drawNumHeaderIdx : 3
  // Helper para acceder por nombre de columna del header Trinity
  const colByName = (re: RegExp) => {
    const idx = headerRow.findIndex((c: any) => typeof c === 'string' && re.test(c))
    return idx >= 0 ? dataRow[idx] : undefined
  }

  assert('Excel: sheet existe',                !!name, name)
  assert('Excel: header row tiene >=12 cols',  headerRow.length >= 12)

  const drawNumCell = dataRow[baseIdx]
  assert('Excel: data row tiene Draw Number = 1',
    drawNumCell === '1' || drawNumCell === 1, `Draw # = ${drawNumCell}`)
  const matchAmount = (v: any, expected: number) => {
    if (typeof v === 'number') return Math.abs(v - expected) < 0.01
    return String(v).includes(expected.toLocaleString('en-US'))
  }
  // Lookup por nombre de columna — más robusto que índices numéricos
  assert('Excel: Refurb Loan Amount visible',  matchAmount(colByName(/refurb\s*loan\s*amount/i), 395350), `${colByName(/refurb\s*loan\s*amount/i)}`)
  assert('Excel: Draw Amount visible',         matchAmount(colByName(/draw\s*amount/i), 80131.06), `${colByName(/draw\s*amount/i)}`)
  assert('Excel: Net Wire visible',            matchAmount(colByName(/net\s*wire/i), 80131.06), `${colByName(/net\s*wire/i)}`)
  // UPB y Refurb Balance aparecen dos veces (Pre y Post). Buscamos el último.
  const upbAll = headerRow.map((c: any, i: number) => /^upb$/i.test(String(c).trim()) ? i : -1).filter((i: number) => i >= 0)
  const upbPostIdx = upbAll[upbAll.length - 1]
  assert('Excel: UPB Post visible', matchAmount(dataRow[upbPostIdx], 87131.06), `${dataRow[upbPostIdx]}`)
  const refurbBalAll = headerRow.map((c: any, i: number) => /refurb\s*balance|refurb\s*loan\s*balance/i.test(String(c)) ? i : -1).filter((i: number) => i >= 0)
  const refurbBalPostIdx = refurbBalAll[refurbBalAll.length - 1]
  assert('Excel: Refurb Balance Post visible', matchAmount(dataRow[refurbBalPostIdx], 315218.94), `${dataRow[refurbBalPostIdx]}`)
  const pct = colByName(/%\s*complete/i)
  assert('Excel: % Complete visible',
    (typeof pct === 'number' && Math.abs(pct - 0.2027) < 0.001) || String(pct).includes('20.27'),
    `${pct}`)
  assert('Excel: tiene secciones Pre/Post',
    sectionRow.some((c: any) => typeof c === 'string' && /pre/i.test(c)) &&
    sectionRow.some((c: any) => typeof c === 'string' && /post/i.test(c)))

  const { parsed } = await parseDrawExcel(xlsxBuffer)
  console.log('\n  Parsed result:', JSON.stringify(parsed, null, 2))
  assert('Parser: drawNumber = 1',                  parsed.drawNumber === 1, String(parsed.drawNumber))
  assert('Parser: montoSolicitado ≈ $80,131.06',    Math.abs((parsed.montoSolicitado as number ?? 0) - 80131.06) < 1, String(parsed.montoSolicitado))
  assert('Parser: netWire ≈ $80,131.06',            Math.abs((parsed.netWire as number ?? 0) - 80131.06) < 1, String(parsed.netWire))
  assert('Parser: upbPost ≈ $87,131.06',            Math.abs((parsed.upbPost as number ?? 0) - 87131.06) < 1, String(parsed.upbPost))
  assert('Parser: saldoHoldback ≈ $315,218.94',     Math.abs((parsed.saldoHoldback as number ?? 0) - 315218.94) < 1, String(parsed.saldoHoldback))
  assert('Parser: projectHoldback ≈ $395,350.00',   Math.abs((parsed.projectHoldback as number ?? 0) - 395350) < 1, String(parsed.projectHoldback))
  assert('Parser: porcentajeFunded ≈ 0.2027',       Math.abs((parsed.porcentajeFunded as number ?? 0) - 0.2027) < 0.001, String(parsed.porcentajeFunded))

  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`\n📊 ${passed} passed · ${failed} failed`)
  if (failed > 0) {
    console.log('\nFALLAS:')
    for (const r of results.filter(r => !r.pass)) console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
