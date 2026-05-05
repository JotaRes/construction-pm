import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../lib/api'
import { formatUSD, formatPct, formatDate } from '../lib/calculations'
import type { DashboardData, PhaseStats } from '../lib/types'
import { Activity } from 'lucide-react'

function KpiCard({ label, value, sub, level = 'neutral', href }: {
  label: string; value: string; sub?: string; level?: 'ok' | 'warning' | 'critical' | 'neutral'; href?: string
}) {
  const navigate = useNavigate()
  const colors = {
    ok: 'text-emerald-600',
    warning: 'text-[#C8922A]',
    critical: 'text-red-400',
    neutral: 'text-[#2D4B52]',
  }
  return (
    <div
      className={`kpi-card ${href ? 'cursor-pointer hover:scale-[1.02]' : ''} transition-transform`}
      onClick={href ? () => navigate(href) : undefined}
    >
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${colors[level]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      {href && <div className="text-[9px] text-slate-500 mt-2 uppercase tracking-wider">→ ver detalle</div>}
    </div>
  )
}

function ProgressBar({ pct, color = 'blue' }: { pct: number; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-[#2D4B52]',
    green: 'bg-emerald-500',
    amber: 'bg-[#2D4B52]',
    red: 'bg-red-500',
    slate: 'bg-slate-500',
  }
  return (
    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colors[color] || 'bg-[#2D4B52]'}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

function phaseColor(estado: string) {
  if (estado === 'DONE') return 'green'
  if (estado === 'EN_CURSO') return 'amber'
  return 'slate'
}

function estadoBadge(estado: string) {
  if (estado === 'DONE') return <span className="badge-done">DONE</span>
  if (estado === 'EN_CURSO') return <span className="badge-in-progress">EN CURSO</span>
  return <span className="badge-pending">PENDIENTE</span>
}

interface Props { projectId: string }

export default function Dashboard({ projectId }: Props) {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard', projectId],
    queryFn: () => projectsApi.dashboard(projectId),
    refetchInterval: 30000,
  })

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando dashboard...</div>
  if (error || !data) return <div className="text-red-400 text-sm">Error cargando dashboard</div>

  const { kpis, phases, project } = data

  const permitDias = kpis.diasAlPermit
  const permitLevel = permitDias === null ? 'neutral' : permitDias < 30 ? 'critical' : permitDias < 60 ? 'warning' : 'ok'
  const desfaseLevel = kpis.desfaseFisicoVsTiempo < -10 ? 'critical' : kpis.desfaseFisicoVsTiempo < -5 ? 'warning' : 'ok'
  const holdbackLevel = kpis.saldoHoldback < 50000 ? 'critical' : kpis.saldoHoldback < 100000 ? 'warning' : 'ok'
  const sfLevel = kpis.costoSFProyectado > (project.benchmarkSfTarget ?? 220) ? 'critical' : kpis.costoSFProyectado > 185 ? 'warning' : 'ok'

  const preObraPhases = phases.filter(p => p.groupName === 'PRE-OBRA')
  const obraPhases = phases.filter(p => p.groupName === 'OBRA')
  const cierrePhases = phases.filter(p => p.groupName === 'CIERRE')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{project.address} · {project.county}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Permit: {project.permitNumber}</div>
          <div className={`text-xs font-mono mt-0.5 ${permitLevel === 'critical' ? 'text-red-400' : permitLevel === 'warning' ? 'text-[#C8922A]' : 'text-emerald-400'}`}>
            Vence: {formatDate(project.permitExpires ?? null)} ({permitDias}d)
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Avance General"
          value={formatPct(kpis.avanceGeneral)}
          sub={`${formatPct(kpis.tiempoTranscurrido)} tiempo transcurrido`}
          level={desfaseLevel}
          href="/execution"
        />
        <KpiCard
          label="Budget Maestro"
          value={formatUSD(kpis.totalBudget)}
          sub={`Ejecutado: ${formatUSD(kpis.totalEjecutado)}`}
          href="/budget"
        />
        <KpiCard
          label="Draw Desembolsado"
          value={formatUSD(kpis.totalDrawn)}
          sub={`Saldo holdback: ${formatUSD(kpis.saldoHoldback)}`}
          level={holdbackLevel}
          href="/draws"
        />
        <KpiCard
          label="Días al Permit"
          value={permitDias !== null ? String(permitDias) + 'd' : '—'}
          sub={`Vence ${formatDate(project.permitExpires ?? null)}`}
          level={permitLevel}
          href="/inspections"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Presup $/SF"
          value={`$${kpis.costoSFPresupuestado.toFixed(0)}/SF`}
          sub={`Budget total / ${project.sfHeated} SF`}
          href="/construction-budget"
        />
        <KpiCard
          label="Ejecutado $/SF"
          value={`$${kpis.costoSFEjecutado.toFixed(0)}/SF`}
          sub="Costo vivo actual"
          href="/budget"
        />
        <KpiCard
          label="Proyectado $/SF"
          value={`$${kpis.costoSFProyectado.toFixed(0)}/SF`}
          sub={`Benchmark: $${project.benchmarkSfTarget}/SF`}
          level={sfLevel}
          href="/financial"
        />
        <KpiCard
          label="ARV $/SF"
          value={`$${kpis.arvSF.toFixed(0)}/SF`}
          sub={`ARV: ${formatUSD(project.arv ?? 0)}`}
          level="ok"
        />
      </div>

      {/* Phase Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#C8922A]" />
          <h2 className="text-sm font-semibold text-slate-800">Avance por Fase — Budget vs Ejecutado</h2>
        </div>

        {/* PRE-OBRA */}
        <PhaseGroup label="PRE-OBRA (F00–F04)" phases={preObraPhases} />
        {/* OBRA */}
        <PhaseGroup label="OBRA (F05–F17)" phases={obraPhases} />
        {/* CIERRE */}
        <PhaseGroup label="CIERRE (F18–F19)" phases={cierrePhases} />

        {/* Totals */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">TOTAL</span>
          <div className="flex gap-8">
            <span className="text-slate-700">{formatUSD(kpis.totalBudget)} budget</span>
            <span className="text-slate-700">{formatUSD(kpis.totalEjecutado)} ejecutado</span>
            <span className={kpis.totalEjecutado > kpis.totalBudget ? 'text-red-400' : 'text-emerald-400'}>
              {formatUSD(Math.abs(kpis.totalEjecutado - kpis.totalBudget))} {kpis.totalEjecutado > kpis.totalBudget ? '▲' : '▼'}
            </span>
          </div>
        </div>
      </div>

      {/* Inspections + Draws row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pending Inspections */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800">Próximas Inspecciones</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.inspections.slice(0, 5).map(ins => (
              <div key={ins.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-800">{ins.tipo}</div>
                  <div className="text-[10px] text-slate-400">{ins.fase}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                  ${ins.estado === 'APROBADA' ? 'bg-emerald-500/20 text-emerald-400'
                  : ins.estado === 'RECHAZADA' ? 'bg-red-500/20 text-red-400'
                  : ins.estado === 'PROGRAMADA' ? 'bg-[#C8922A]/15 text-[#C8922A]'
                  : 'bg-slate-200 text-slate-500'}`}>
                  {ins.estado}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Draws */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800">Draw Tracker</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.draws.filter(d => d.estado !== 'EMPTY').slice(0, 5).map(draw => (
              <div key={draw.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-800">Draw #{draw.drawNumber}</div>
                  <div className="text-[10px] text-slate-400">{draw.notas}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-emerald-400">{formatUSD(draw.netWire)}</div>
                  <div className="text-[10px] text-slate-400">{formatDate(draw.fechaWire)}</div>
                </div>
              </div>
            ))}
            {data.draws.filter(d => d.estado !== 'EMPTY').length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-400">Sin draws ejecutados</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PhaseGroup({ label, phases }: { label: string; phases: PhaseStats[] }) {
  if (phases.length === 0) return null
  return (
    <>
      <div className="px-5 py-2 bg-slate-50/60 border-b border-slate-200">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      {phases.map(phase => (
        <div key={phase.id} className="table-row-base px-5 py-3">
          <div className="flex items-center gap-4">
            <div className="w-8 text-xs font-mono text-slate-400">{phase.code}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-800 truncate">{phase.name}</span>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-xs font-mono text-slate-500">
                    {phase.doneItems}/{phase.totalItems}
                  </span>
                  {estadoBadge(phase.estado)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <ProgressBar pct={phase.avancePct} color={phaseColor(phase.estado)} />
                </div>
                <span className="text-xs font-mono text-slate-400 w-10 text-right">
                  {phase.avancePct.toFixed(0)}%
                </span>
                <span className="text-xs font-mono text-slate-400 w-24 text-right">
                  {formatUSD(phase.budget)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
