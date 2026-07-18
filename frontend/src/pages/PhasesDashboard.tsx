import { useQuery } from '@tanstack/react-query'
import { phasesApi, type PhaseSummary } from '../lib/api'
import { Layers, TrendingUp, Calendar } from 'lucide-react'
import MiniDonut from '../components/MiniDonut'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// Progreso siempre en verde (homogéneo con Const. Budget); el estado se
// diferencia con el badge, no con el color de la barra.
function statusStyle(s: PhaseSummary['status']) {
  if (s === 'COMPLETA') return { bar: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-600', label: 'Completa' }
  if (s === 'EN_CURSO') return { bar: 'bg-emerald-500', badge: 'bg-[#0071E3]/15 text-[var(--brand-gold)]', label: 'En curso' }
  return { bar: 'bg-slate-300', badge: 'bg-slate-100 text-slate-500', label: 'Pendiente' }
}

export default function PhasesDashboard({ projectId }: { projectId: string }) {
  const { data: phases = [], isLoading } = useQuery<PhaseSummary[]>({
    queryKey: ['phases-summary', projectId],
    queryFn: () => phasesApi.summary(projectId),
  })

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando fases...</div>

  const totalBudget = phases.reduce((s, p) => s + p.budgetTotal, 0)
  const totalPaid = phases.reduce((s, p) => s + p.paidTotal, 0)
  const totalItems = phases.reduce((s, p) => s + p.totalItems, 0)
  const doneItems = phases.reduce((s, p) => s + p.completedItems, 0)
  const globalPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0
  const variance = totalPaid - totalBudget

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><Layers className="w-[22px] h-[22px]" strokeWidth={2.2} /></span><span>Control de Fases Constructivas</span></h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Avance, fechas reales y presupuesto vs pagado por etapa (Fases 0–9)
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <MiniDonut pct={globalPct} size={56} />
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400"><Layers className="w-3 h-3" /> Avance global</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{doneItems}/{totalItems} ítems</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><TrendingUp className="w-3 h-3" /> Budget total</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{fmt(totalBudget)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><TrendingUp className="w-3 h-3" /> Pagado</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{fmt(totalPaid)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><TrendingUp className="w-3 h-3" /> Variación</div>
          <div className={`text-2xl font-bold font-mono ${variance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {variance > 0 ? '+' : ''}{fmt(variance)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                {['#', 'Fase', 'Progreso', 'Inicio Real', 'Fin Real', 'Budget', 'Pagado', 'Var %', 'Estado'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {phases.map(p => {
                const st = statusStyle(p.status)
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-3 font-mono font-semibold text-slate-700">{p.code}</td>
                    <td className="px-3 py-3 text-slate-800 min-w-[160px]">
                      <div className="font-medium">{p.name}</div>
                      {p.groupName && <div className="text-[10px] text-slate-400">{p.groupName}</div>}
                    </td>
                    <td className="px-3 py-3 min-w-[150px]">
                      <div className="h-2 w-32 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-2 rounded-full bar-fill ${st.bar}`} style={{ width: `${p.progressPct}%` }} />
                      </div>
                      <span className={`text-[11px] font-mono font-semibold ${p.progressPct > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{p.progressPct}%</span>
                      <span className="text-[11px] text-slate-400"> ({p.completedItems}/{p.totalItems})</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-300" />{fmtDate(p.startDateReal)}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(p.endDateReal)}</td>
                    <td className="px-3 py-3 font-mono text-slate-700 whitespace-nowrap">{fmt(p.budgetTotal)}</td>
                    <td className="px-3 py-3 font-mono text-slate-700 whitespace-nowrap">{fmt(p.paidTotal)}</td>
                    <td className={`px-3 py-3 font-mono font-semibold whitespace-nowrap ${p.variancePct > 10 ? 'text-red-500' : p.variancePct > 0 ? 'text-[var(--brand-gold)]' : 'text-emerald-600'}`}>
                      {p.variancePct > 0 ? '+' : ''}{p.variancePct}%
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.badge} whitespace-nowrap`}>{st.label}</span>
                    </td>
                  </tr>
                )
              })}
              {phases.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">
                  No hay fases cargadas para este proyecto todavía.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
