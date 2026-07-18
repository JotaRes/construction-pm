import { useQuery } from '@tanstack/react-query'
import { portfolioApi, type PortfolioSummary } from '../lib/api'
import {
  Building2, Wallet, Landmark, TrendingUp, HardHat, ArrowUpRight,
  AlertTriangle, Layers, CircleDollarSign,
} from 'lucide-react'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function Stat({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode; accent: string
}) {
  return (
    <div className="rounded-2xl p-5" style={{
      background: 'rgba(255,255,255,0.75)',
      border: '1px solid rgba(29,29,31,0.12)',
      borderTop: `3px solid ${accent}`,
      backdropFilter: 'blur(8px)',
    }}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--brand-teal2)' }}>
        <span style={{ color: accent }}>{icon}</span> {label}
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{value}</div>
      {sub && <div className="text-[11px] mt-1" style={{ color: 'var(--brand-teal2)' }}>{sub}</div>}
    </div>
  )
}

export default function HomeExecutiveDashboard() {
  const { data, isLoading } = useQuery<PortfolioSummary>({
    queryKey: ['portfolio-executive'],
    queryFn: () => portfolioApi.executive(),
  })

  if (isLoading || !data) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(29,29,31,0.12)', color: 'var(--brand-teal2)' }}>
        Cargando dashboard ejecutivo…
      </div>
    )
  }

  const { portfolio: p, finance: f } = data
  const varColor = p.budgetVariancePct > 0 ? '#ef4444' : '#16a34a'

  return (
    <div className="space-y-5">
      {/* Title row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold" style={{ color: 'var(--brand-teal)' }}>
            Dashboard Ejecutivo
          </h2>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(29,29,31,0.08)', color: 'var(--brand-teal2)' }}>
            Holding consolidado
          </span>
        </div>
        <div className="flex gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'rgba(29,29,31,0.1)', color: 'var(--brand-teal)' }}>Técnico</span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,113,227,0.15)', color: 'var(--brand-gold)' }}>Financiero</span>
        </div>
      </div>

      {/* KPI row — cruce de ambos módulos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<CircleDollarSign size={14} />} accent="var(--brand-gold)"
          label="Caja consolidada" value={fmt(f.consolidatedCash)}
          sub={<span>
            <span style={{ color: '#16a34a' }}>↑{fmt(f.totalIngresos)}</span>{' · '}
            <span style={{ color: '#ef4444' }}>↓{fmt(f.totalEgresos)}</span>
          </span>} />
        <Stat icon={<TrendingUp size={14} />} accent="var(--brand-teal)"
          label="Budget portafolio" value={fmt(p.totalBudget)}
          sub={<span>Pagado {fmt(p.totalPaid)} · <span style={{ color: varColor }}>{p.budgetVariancePct > 0 ? '+' : ''}{p.budgetVariancePct}%</span></span>} />
        <Stat icon={<Landmark size={14} />} accent="var(--brand-teal)"
          label="Construction loans" value={fmt(p.totalLoan)}
          sub={`Disponible ${fmt(p.totalRemainingLoan)}`} />
        <Stat icon={<HardHat size={14} />} accent="var(--brand-gold)"
          label="Avance global" value={`${p.weightedProgress}%`}
          sub={`${p.projectCount} proyecto${p.projectCount === 1 ? '' : 's'} · ${p.pendingInspections} insp. pend.`} />
      </div>

      {/* Cuentas del holding */}
      {f.accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {f.accounts.map(a => (
            <div key={a.code} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(29,29,31,0.1)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <Wallet size={15} style={{ color: 'var(--brand-teal2)' }} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--brand-teal)' }}>{a.name}</div>
                  <div className="text-[10px] font-mono" style={{ color: 'var(--brand-teal2)' }}>{a.code}</div>
                </div>
              </div>
              <div className="text-sm font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{fmt(a.balance)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Proyectos del portafolio */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--brand-teal2)' }}>
          <Building2 size={13} /> Proyectos en obra
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {p.projects.map(proj => (
            <div key={proj.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(29,29,31,0.12)' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--brand-teal)' }}>{proj.name}</div>
                  {proj.activePhase && (
                    <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--brand-teal2)' }}>
                      <Layers size={10} /> {proj.activePhase.code} · {proj.activePhase.name}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {proj.pendingInspections > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: 'rgba(0,113,227,0.15)', color: 'var(--brand-gold)' }}>
                      <AlertTriangle size={9} /> {proj.pendingInspections}
                    </span>
                  )}
                  {proj.overdueTasks > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                      {proj.overdueTasks} venc.
                    </span>
                  )}
                </div>
              </div>
              {/* progress */}
              <div className="h-1.5 w-full rounded-full mb-2" style={{ background: 'rgba(29,29,31,0.12)' }}>
                <div className="h-1.5 rounded-full" style={{ width: `${proj.progress}%`, background: proj.progress >= 80 ? '#16a34a' : proj.progress >= 40 ? 'var(--brand-gold)' : 'var(--brand-teal)' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--brand-teal2)' }}>
                <span>{proj.progress}% avance</span>
                <span className="font-mono">Budget {fmt(proj.totalBudget)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1" style={{ color: 'var(--brand-teal2)' }}>
                <span className="flex items-center gap-1"><ArrowUpRight size={10} /> Fondeado {fmt(proj.totalFunded)}</span>
                <span className="font-mono">Loan {fmt(proj.loanAmount)}</span>
              </div>
            </div>
          ))}
          {p.projects.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--brand-teal2)' }}>No hay proyectos cargados.</p>
          )}
        </div>
      </div>
    </div>
  )
}
