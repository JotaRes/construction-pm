/**
 * Helper compartido para parsear montos monetarios desde strings.
 *
 * Soporta formato US ($45,200.00) y formato europeo ($45.200,00).
 * Heurística: el separador decimal es el que aparece más a la derecha.
 *
 * Ejemplos:
 *   "$45,200.00" → 45200    (US: , miles, . decimal)
 *   "$45.200,00" → 45200    (EU: . miles, , decimal)
 *   "$2,500"     → 2500
 *   "$465.750,00"→ 465750
 *   "1500"       → 1500
 *   "USD 1,234.56" → 1234.56
 *
 * Devuelve 0 si el string no es parseable.
 */
export function parseAmountFlexible(raw: string | number | null | undefined): number {
  if (raw == null) return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0

  // Limpiar: quitar símbolos de moneda, espacios, USD, etc.
  let s = String(raw)
    .replace(/USD|US\$|us\$/gi, '')
    .replace(/[$€£¥]/g, '')
    .replace(/\s/g, '')
    .trim()
  if (!s) return 0

  // Manejar signo negativo (paréntesis estilo contable o guion)
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  }

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')

  let n: number
  if (lastDot === -1 && lastComma === -1) {
    n = parseFloat(s) || 0
  } else if (lastDot > -1 && lastComma > -1) {
    // Ambos presentes: el de más a la derecha es decimal
    if (lastDot > lastComma) {
      // US: quitar comas (miles), dejar punto (decimal)
      n = parseFloat(s.replace(/,/g, '')) || 0
    } else {
      // EU: quitar puntos (miles), cambiar coma (decimal) por punto
      n = parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
    }
  } else if (lastDot > -1) {
    // Solo punto: si va seguido de 2 dígitos al final → decimal; si va seguido de 3 → miles
    const after = s.length - lastDot - 1
    if (after === 2) {
      n = parseFloat(s) || 0
    } else {
      n = parseFloat(s.replace(/\./g, '')) || 0
    }
  } else {
    // Solo coma
    const after = s.length - lastComma - 1
    if (after === 2) {
      n = parseFloat(s.replace(',', '.')) || 0
    } else {
      n = parseFloat(s.replace(/,/g, '')) || 0
    }
  }

  return negative ? -n : n
}
