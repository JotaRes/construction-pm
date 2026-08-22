// ============================================================
// RUNNER DE TESTS — red de seguridad automática
// ============================================================
// Cada archivo test-*.ts es un test autocontenido que termina con
// process.exit(1) si falla. Por eso NO se pueden importar juntos (el primer
// exit mataría al resto): este runner los ejecuta como SUBPROCESOS
// independientes y agrega los resultados.
//
// Dos alcances:
//   • "pure" (por defecto sin argumento en CI sin BD) — solo tests de lógica
//     que NO tocan la base de datos. Corren en cualquier entorno.
//   • "all" — incluye además los tests que crean/leen datos en Postgres.
//     Requieren DATABASE_URL apuntando a una BD migrada (local o servicio CI).
//
// Uso:
//   npx tsx scripts/run-tests.ts          → all si hay DATABASE_URL, si no pure
//   npx tsx scripts/run-tests.ts pure     → fuerza solo lógica pura
//   npx tsx scripts/run-tests.ts all      → fuerza suite completa
// ============================================================
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Tests de lógica pura — sin base de datos. Seguros en cualquier entorno.
const PURE = [
  'test-draw-matching.ts',
  'test-statement-parser.ts',
  'test-excel-extraction.ts',
  'test-all-document-parsers.ts',
]

// Tests que crean/leen datos reales en Postgres. Se autoabastecen de fixtures
// y limpian tras de sí, pero necesitan una BD migrada (DATABASE_URL).
const DB = [
  'test-holdback-balance.ts',
  'test-project-edit.ts',
  'test-draw-budget-interconnection.ts',
  'test-file-upload-autoextract.ts',
  'test-statement-full-flow.ts',
  'test-trinity-newformat-realpdf.ts',
]

function resolveScope(): 'pure' | 'all' {
  const arg = (process.argv[2] || '').toLowerCase()
  if (arg === 'pure' || arg === 'all') return arg
  // Auto: si hay una BD configurada, corre todo; si no, solo lo puro.
  return process.env.DATABASE_URL ? 'all' : 'pure'
}

const scope = resolveScope()
const files = scope === 'all' ? [...PURE, ...DB] : PURE

console.log('============================================================')
console.log(`RUNNER DE TESTS — alcance: ${scope.toUpperCase()} (${files.length} archivos)`)
if (scope === 'pure') {
  console.log('(sin DATABASE_URL → se omiten los tests con base de datos)')
}
console.log('============================================================')

const results: { file: string; ok: boolean; ms: number }[] = []

for (const file of files) {
  const full = path.join(__dirname, file)
  console.log(`\n▶ ${file}`)
  const started = Date.now()
  const res = spawnSync('npx', ['tsx', full], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  })
  const ms = Date.now() - started
  const ok = res.status === 0
  results.push({ file, ok, ms })
}

console.log('\n============================================================')
console.log('RESUMEN')
console.log('============================================================')
let failed = 0
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.file}  (${(r.ms / 1000).toFixed(1)}s)`)
  if (!r.ok) failed++
}
console.log('------------------------------------------------------------')
if (failed > 0) {
  console.error(`✗ ${failed} de ${results.length} test(s) FALLARON — NO desplegar.`)
  process.exit(1)
}
console.log(`✓ Los ${results.length} tests pasaron.`)
