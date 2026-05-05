import { Item, Phase, Draw } from './types'

export function avanceFase(items: Item[]): number {
  const activos = items.filter(i => !i.esNA)
  if (activos.length === 0) return 0
  return (activos.filter(i => i.completado).length / activos.length) * 100
}

export function avanceGeneral(phases: Phase[]): number {
  const budgetTotal = phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorPresupuestado, 0), 0)
  if (budgetTotal === 0) {
    if (phases.length === 0) return 0
    return phases.reduce((s, p) => s + avanceFase(p.items), 0) / phases.length
  }
  return phases.reduce((s, p) => {
    const phaseBudget = p.items.reduce((ss, i) => ss + i.valorPresupuestado, 0)
    return s + avanceFase(p.items) * (phaseBudget / budgetTotal)
  }, 0)
}

export function tiempoTranscurrido(startDate: Date, targetDate: Date): number {
  const now = new Date()
  if (now <= startDate) return 0
  if (now >= targetDate) return 100
  return ((now.getTime() - startDate.getTime()) / (targetDate.getTime() - startDate.getTime())) * 100
}

export function interesDiario(upb: number, tasaAnual: number): number {
  return upb * (tasaAnual / 365)
}

export function upbActual(draws: Draw[]): number {
  return draws.filter(d => d.estado === 'WIRED').reduce((s, d) => s + d.netWire, 0)
}

export function saldoHoldback(holdbackOriginal: number, draws: Draw[]): number {
  return holdbackOriginal - upbActual(draws)
}

export function costoSFProyectado(ejecutado: number, pendienteBudget: number, sfHeated: number): number {
  if (sfHeated === 0) return 0
  return (ejecutado + pendienteBudget) / sfHeated
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatUSDFull(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function diasRestantes(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const today = new Date()
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export function budgetTotal(phases: Phase[]): number {
  return phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorPresupuestado, 0), 0)
}

export function ejecutadoTotal(phases: Phase[]): number {
  return phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorEjecutado, 0), 0)
}
