import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard } from 'lucide-react'
import ForecastCard from '../components/ForecastCard'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../lib/api'
import { formatUSD, formatPct, formatDate } from '../lib/calculations'
import type { DashboardData } from '../lib/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend
} from 'recharts'

// ── Mini donut progress ─────────────────────────────────────────
function DonutGauge({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 14) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-surface-3)" strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize={13} fontWeight="700" fill={color}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  )
}

// ── Custom tooltip for recharts ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-mono font-semibold text-slate-800">{formatUSD(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

interface Props { projectId: string }

export default function Dashboard({ projectId }: Props) {
  const navigate = useNavigate()
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
  const holdbackLevel = kpis.saldoHoldback < 50000 ? 'critical' : kpis.saldoHoldback < 100000 ? 'warning' : 'ok'

  // ── Chart data ─────────────────────────────────────────────────
  const phaseChartData = phases
    .filter(p => p.budget > 0 || p.ejecutado > 0)
    .map(p => ({
      name: p.code,
      fullName: p.name,
      Budget: p.budget,
      Ejecutado: p.ejecutado,
    }))

  const drawChartData = data.draws.filter(d => d.estado !== 'EMPTY').map(d => ({
    name: `D#${d.drawNumber}`,
    amount: d.netWire,
    elegible: d.elegibleTrinity,
  }))

  const holdbackPieData = [
    { name: 'Desembolsado', value: kpis.totalDrawn, color: '#0071E3' },
    { name: 'Saldo Holdback', value: kpis.saldoHoldback, color: '#D2D2D7' },
  ]

  const progressByGroup = [
    { name: 'Pre-Obra', value: phases.filter(p => p.groupName === 'PRE-OBRA').reduce((s, p) => s + p.avancePct, 0) / Math.max(phases.filter(p => p.groupName === 'PRE-OBRA').length, 1), fill: '#A7CCF3' },
    { name: 'Obra', value: phases.filter(p => p.groupName === 'OBRA').reduce((s, p) => s + p.avancePct, 0) / Math.max(phases.filter(p => p.groupName === 'OBRA').length, 1), fill: '#0071E3' },
    { name: 'Cierre', value: phases.filter(p => p.groupName === 'CIERRE').reduce((s, p) => s + p.avancePct, 0) / Math.max(phases.filter(p => p.groupName === 'CIERRE').length, 1), fill: '#1D9A57' },
  ]

  return (
    <div className="space-y-5 page-content">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><LayoutDashboard className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{project.name}</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">{project.address} · {project.county}</p>
        </div>
        <div className="text-right">
          <div className={`text-xs font-mono px-2.5 py-1 rounded-full ${
            permitLevel === 'critical' ? 'bg-red-50 text-red-500 border border-red-200' :
            permitLevel === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
            'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
            Permit vence: {formatDate(project.permitExpires ?? null)} · {permitDias}d
          </div>
        </div>
      </div>

      {/* Forecast de entrega + costo del atraso (Lote B) */}
      <ForecastCard projectId={projectId} />

      {/* ── Row 1: Progress gauges ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Main donut */}
        <div className="kpi-card col-span-1 flex flex-col items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => navigate('/tech/execution')}>
          <DonutGauge pct={kpis.avanceGeneral} color="#0071E3" size={90} />
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Avance General</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{formatPct(kpis.tiempoTranscurrido)} tiempo</div>
          </div>
        </div>

        <div className="kpi-card cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate('/tech/draws')}>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Desembolsado</div>
          <div className="text-2xl font-bold font-mono text-[var(--brand-teal)]">{formatUSD(kpis.totalDrawn)}</div>
          <div className="text-xs text-slate-400 mt-1">Saldo: {formatUSD(kpis.saldoHoldback)}</div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--brand-teal)] rounded-full" style={{ width: `${Math.min(100, (kpis.totalDrawn / (kpis.totalDrawn + kpis.saldoHoldback)) * 100)}%` }} />
          </div>
        </div>

        <div className={`kpi-card cursor-pointer hover:scale-[1.02] transition-transform ${holdbackLevel === 'critical' ? 'border-red-300 bg-red-50/60' : ''}`}
          onClick={() => navigate('/tech/financial')}>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Saldo Holdback</div>
          <div className={`text-2xl font-bold font-mono ${holdbackLevel === 'critical' ? 'text-red-500' : holdbackLevel === 'warning' ? 'text-[var(--brand-gold)]' : 'text-slate-900'}`}>
            {formatUSD(kpis.saldoHoldback)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{data.draws.filter(d => d.estado === 'WIRED').length} / 8 draws wired</div>
        </div>

        <div className="kpi-card cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate('/tech/construction-budget')}>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Budget vs Ejecutado</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{formatUSD(kpis.totalBudget)}</div>
          <div className="text-xs text-slate-400 mt-1">Ejec: {formatUSD(kpis.totalEjecutado)}</div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--brand-gold)] rounded-full" style={{ width: `${Math.min(100, kpis.totalBudget > 0 ? (kpis.totalEjecutado / kpis.totalBudget) * 100 : 0)}%` }} />
          </div>
        </div>
      </div>

      {/* ── Row 2: Progress by group + $/SF ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {/* Radial bar for groups */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-700 mb-3">Avance por Grupo</div>
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart cx="50%" cy="50%" innerRadius={20} outerRadius={70} data={progressByGroup} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={4} />
              <Legend iconSize={8} iconType="circle" formatter={(val) => <span className="text-[10px] text-slate-600">{val}</span>} />
              <Tooltip formatter={(val: number) => [`${val.toFixed(1)}%`, '']} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* $/SF KPIs */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-700">Benchmarks $/SF</div>
          {[
            { label: 'Presup. $/SF', val: kpis.costoSFPresupuestado, target: project.benchmarkSfTarget ?? 220 },
            { label: 'Ejecutado $/SF', val: kpis.costoSFEjecutado, target: project.benchmarkSfTarget ?? 220 },
            { label: 'Proyectado $/SF', val: kpis.costoSFProyectado, target: project.benchmarkSfTarget ?? 220 },
            { label: 'ARV $/SF', val: kpis.arvSF, target: 0 },
          ].map(({ label, val, target }) => {
            const over = target > 0 && val > target
            return (
              <div key={label}>
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>{label}</span>
                  <span className={`font-mono font-semibold ${over ? 'text-red-500' : 'text-slate-800'}`}>${val.toFixed(0)}/SF</span>
                </div>
                {target > 0 && (
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${over ? 'bg-red-400' : 'bg-[var(--brand-teal)]'}`} style={{ width: `${Math.min(100, (val / (target * 1.3)) * 100)}%` }} />
                  </div>
                )}
              </div>
            )
          })}
          <div className="pt-1 text-[10px] text-slate-400">Benchmark target: ${project.benchmarkSfTarget}/SF</div>
        </div>

        {/* Holdback Pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-700 mb-1">Distribución Holdback</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={holdbackPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value">
                {holdbackPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(val: number) => [formatUSD(val), '']} />
              <Legend iconSize={8} iconType="circle" formatter={(val) => <span className="text-[10px] text-slate-600">{val}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 3: Phase bar chart ─────────────────────────── */}
      {phaseChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs font-semibold text-slate-700 mb-4">Budget vs Ejecutado por Fase</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={phaseChartData} barGap={2} barCategoryGap="25%">
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={(p) => <MoneyTooltip {...p} />} />
              <Bar dataKey="Budget" fill="var(--bg-surface-3)" radius={[3,3,0,0]} />
              <Bar dataKey="Ejecutado" fill="#0071E3" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-slate-200 inline-block"/>Budget</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[var(--brand-teal)] inline-block"/>Ejecutado</span>
          </div>
        </div>
      )}

      {/* ── Row 4: Draws bar + Inspections ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Draws chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-700 mb-3">Historial de Draws</div>
          {drawChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={drawChartData} barGap={2} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(val: number) => [formatUSD(val), '']} />
                <Bar dataKey="elegible" name="Elegible" fill="#A7CCF3" radius={[3,3,0,0]} />
                <Bar dataKey="amount" name="Net Wire" fill="#0071E3" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-32 flex items-center justify-center text-slate-400 text-xs">Sin draws ejecutados</div>
          )}
          <div className="mt-2 divide-y divide-slate-100">
            {data.draws.filter(d => d.estado !== 'EMPTY').slice(0, 3).map(draw => (
              <div key={draw.id} className="py-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-600">Draw #{draw.drawNumber}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-emerald-600">{formatUSD(draw.netWire)}</span>
                  <span className="text-slate-400">{formatDate(draw.fechaWire)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inspections */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-700 mb-3">Inspecciones</div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Aprobadas', count: data.inspections.filter(i => i.estado === 'APROBADA').length, color: 'text-emerald-500 bg-emerald-50' },
              { label: 'Pendientes', count: data.inspections.filter(i => i.estado === 'PENDIENTE').length, color: 'text-slate-500 bg-slate-50' },
              { label: 'Programadas', count: data.inspections.filter(i => i.estado === 'PROGRAMADA').length, color: 'text-[var(--brand-gold)] bg-amber-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg p-2 text-center ${s.color}`}>
                <div className="text-lg font-bold font-mono">{s.count}</div>
                <div className="text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {data.inspections.filter(i => i.estado !== 'APROBADA').slice(0, 4).map(ins => (
              <div key={ins.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-xs text-slate-800">{ins.tipo}</div>
                  <div className="text-[10px] text-slate-400">{ins.fase ?? ins.wbs}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                  ${ins.estado === 'PROGRAMADA' ? 'bg-[#0071E3]/15 text-[var(--brand-gold)]' : 'bg-slate-100 text-slate-500'}`}>
                  {ins.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
