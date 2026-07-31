// ============================================================
// TEST DE SINCRONIZACIÓN Draw → Construction Budget
// Reproduce el caso REAL del proyecto 827 (screenshot del usuario, jul-2026):
// el PDF de Trinity reporta "Lumber and materials", "Labor" y "Roofing" al
// 100%, con "Exterior Finishes" como fila de sección en $0. El budget tiene
// descripciones con guion ("- Labor") y VARIOS "Labor" en secciones distintas.
// Ejecutar:  npx tsx scripts/test-draw-matching.ts
// ============================================================
import { parseTrinityDrawApprovals, matchApprovalsToLines } from '../src/lib/drawMatching'

let failures = 0
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`)
  } else {
    failures++
    console.error(`  ✗ FALLO: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── 1. PARSEO del texto Trinity (formato B 2026, valores del screenshot) ────
console.log('\n[1] parseTrinityDrawApprovals — reporte draw 5 / 827')
const pdfText = [
  '23Lumber and materials5.80%$26,753.00$0.00100%$26,753.00100%$26,753.00',
  '24Labor2.85%$13,133.00$0.00100%$13,133.00100%$13,133.00',
  '25Exterior Finishes0.00%$0.00$0.000%$0.000%$0.00',
  '26Roofing4.38%$20,235.00$0.000%$0.00100%$20,235.00',
].join('\n')

const approvals = parseTrinityDrawApprovals(pdfText)
check('parsea las 4 filas', approvals.length === 4, `parseó ${approvals.length}`)
check('Lumber current = $26,753', approvals[0]?.currentAmountAvailable === 26753)
check('Labor current = $13,133', approvals[1]?.currentAmountAvailable === 13133)
check('Exterior Finishes (sección) current = $0', approvals[2]?.currentAmountAvailable === 0)
check('Roofing current = $20,235', approvals[3]?.currentAmountAvailable === 20235)

// ── 2. MATCHING contra un budget como el del 827 ────────────────────────────
// Incluye: guiones, "Labor" DUPLICADO en otra sección (drywall) y ruido.
console.log('\n[2] matchApprovalsToLines — budget con descripciones con guion y "Labor" duplicado')
const budget = [
  { id: 'L31', itemCode: '3.1', description: '- Lumber and materials' },
  { id: 'L32', itemCode: '3.2', description: '- Labor' },
  { id: 'L41', itemCode: '4.1', description: 'Roofing' },
  { id: 'L42', itemCode: '4.2', description: 'Siding' },
  { id: 'L43', itemCode: '4.3', description: 'Windows' },
  { id: 'L44', itemCode: '4.4', description: 'Exterior paint' },
  { id: 'L61', itemCode: '6.1', description: 'Drywall' },
  { id: 'L62', itemCode: '6.2', description: '- Labor' }, // segundo "Labor" — antes causaba ambigüedad
]

const { decisions, unmatched } = matchApprovalsToLines(approvals, budget)
const byPdf = new Map(decisions.map(d => [d.approval.description, d]))

check('Lumber → 3.1', byPdf.get('Lumber and materials')?.lineCode === '3.1',
  `cayó en ${byPdf.get('Lumber and materials')?.lineCode ?? 'NINGUNA'}`)
check('Labor → 3.2 (posicional: sigue a 3.1, NO el 6.2)', byPdf.get('Labor')?.lineCode === '3.2',
  `cayó en ${byPdf.get('Labor')?.lineCode ?? 'NINGUNA'}`)
check('Exterior Finishes se salta como fila de sección', byPdf.get('Exterior Finishes')?.headerRow === true)
check('Roofing → 4.1', byPdf.get('Roofing')?.lineCode === '4.1',
  `cayó en ${byPdf.get('Roofing')?.lineCode ?? 'NINGUNA'}`)
check('cero líneas sin matchear', unmatched.length === 0, `unmatched: ${unmatched.join(', ')}`)

// ── 3. Draw posterior: el "Labor" de drywall (6.2) en un reporte más adelante ─
console.log('\n[3] Segundo escenario — draw avanzado con Drywall y su Labor')
const pdfText2 = [
  '23Lumber and materials5.80%$26,753.00$0.00100%$26,753.00100%$26,753.00',
  '24Labor2.85%$13,133.00$0.00100%$13,133.00100%$13,133.00',
  '40Drywall3.00%$9,000.00$0.000%$0.00100%$9,000.00',
  '41Labor2.00%$6,000.00$0.000%$0.00100%$6,000.00',
].join('\n')
const approvals2 = parseTrinityDrawApprovals(pdfText2)
const r2 = matchApprovalsToLines(approvals2, budget)
const labors = r2.decisions.filter(d => d.approval.description === 'Labor')
check('primer Labor → 3.2 (tras Lumber)', labors[0]?.lineCode === '3.2', `cayó en ${labors[0]?.lineCode}`)
check('segundo Labor → 6.2 (tras Drywall)', labors[1]?.lineCode === '6.2', `cayó en ${labors[1]?.lineCode}`)

// ── 4. Variantes de nombre (difuso) ─────────────────────────────────────────
console.log('\n[4] Matching difuso — variantes de nombre entre lender y budget')
const pdfText3 = '30Lumber Package2.00%$5,000.00$0.000%$0.00100%$5,000.00'
const approvals3 = parseTrinityDrawApprovals(pdfText3)
const budget3 = [
  { id: 'A', itemCode: '3.1', description: 'Lumber' },
  { id: 'B', itemCode: '9.9', description: 'Appliance Package' },
]
const r3 = matchApprovalsToLines(approvals3, budget3)
check('"Lumber Package" → "Lumber" (contención de tokens)', r3.decisions[0]?.lineCode === '3.1',
  `cayó en ${r3.decisions[0]?.lineCode ?? 'NINGUNA'}`)

// ── Resultado ───────────────────────────────────────────────────────────────
console.log('')
if (failures > 0) {
  console.error(`✗ ${failures} test(s) FALLARON — la sincronización NO es confiable. NO desplegar.`)
  process.exit(1)
}
console.log('✓ TODOS los tests pasaron — matching Draw → Budget validado (caso 827 incluido).')
