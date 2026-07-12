// ============================================================
// VALIDACIÓN DE VARIABLES DE ENTORNO — FAIL FAST
// ============================================================
// Antes el código tenía fallbacks hardcodeados (
// valores conocidos publicamente): si faltaba una env var, el sistema arrancaba
// "protegido" por una clave pública conocida por cualquiera con acceso al
// repo. Eso es peor que no arrancar.
//
// Ahora: si falta una variable obligatoria, el proceso NO arranca y el log
// dice exactamente cuál falta. En local, los valores viven en backend/.env
// (gitignored). En Render, en el dashboard → Environment.

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'APP_PASSWORD', 'WIPE_PASSWORD'] as const

export function validateEnv(): void {
  const missing = REQUIRED.filter((k) => !process.env[k] || process.env[k]!.trim() === '')
  if (missing.length > 0) {
    console.error('============================================================')
    console.error('❌ ARRANQUE ABORTADO — faltan variables de entorno obligatorias:')
    for (const k of missing) console.error(`   - ${k}`)
    console.error('Local: definirlas en backend/.env · Render: dashboard → Environment')
    console.error('============================================================')
    process.exit(1)
  }
}

export const env = {
  get JWT_SECRET(): string { return process.env.JWT_SECRET! },
  get APP_PASSWORD(): string { return process.env.APP_PASSWORD! },
  get WIPE_PASSWORD(): string { return process.env.WIPE_PASSWORD! },
}
