// ============================================================
// TAX BUCKETS (Lote C) — mapeo de categorías internas a buckets
// fiscales estándar de EE.UU. para el paquete anual del contador.
// Prioridad: FinExpenseCategory.taxBucket (si el usuario lo fijó)
// → heurística por nombre/grupo → "Otros gastos".
// ============================================================

export const TAX_BUCKETS = [
  'Costo directo de construcción (COGS)',
  'Permisos e inspecciones (COGS)',
  'Intereses de financiamiento',
  'Seguros',
  'Impuestos y tasas (property tax)',
  'Servicios públicos (utilities)',
  'Servicios profesionales (legal/CPA)',
  'HOA y administración',
  'Costos de venta y cierre',
  'Gastos administrativos',
  'Otros gastos',
] as const

const RULES: Array<{ pattern: RegExp; bucket: string }> = [
  { pattern: /construc|hard cost|material|mano de obra|subcontrat|labor|framing|drywall|plomer|el[eé]ctric|hvac|roof|fundaci|sitework|grading|acabad/i, bucket: 'Costo directo de construcción (COGS)' },
  { pattern: /permiso|licencia|inspecci|survey|impact fee|tap fee/i, bucket: 'Permisos e inspecciones (COGS)' },
  { pattern: /inter[eé]s|interest|deuda|pr[eé]stamo|loan|financ/i, bucket: 'Intereses de financiamiento' },
  { pattern: /seguro|insurance|builder.?s risk|liability/i, bucket: 'Seguros' },
  { pattern: /impuesto|property tax|tax|county tax/i, bucket: 'Impuestos y tasas (property tax)' },
  { pattern: /utilit|servicios p[uú]blicos|agua|luz|electric bill|power|internet|gas/i, bucket: 'Servicios públicos (utilities)' },
  { pattern: /legal|abogado|attorney|cpa|contab|accounting|profesional|notar/i, bucket: 'Servicios profesionales (legal/CPA)' },
  { pattern: /hoa|homeowner|administraci[oó]n de propiedad/i, bucket: 'HOA y administración' },
  { pattern: /comisi[oó]n|realtor|closing|cierre|escrow|title|staging|listing/i, bucket: 'Costos de venta y cierre' },
]

export function resolveTaxBucket(category: { name: string; group?: string | null; isCorporate?: boolean; taxBucket?: string | null } | null | undefined): string {
  if (!category) return 'Otros gastos'
  if (category.taxBucket && category.taxBucket.trim()) return category.taxBucket.trim()
  for (const rule of RULES) {
    if (rule.pattern.test(category.name)) return rule.bucket
  }
  if (category.isCorporate || /corporativo/i.test(category.group ?? '')) return 'Gastos administrativos'
  return 'Otros gastos'
}
