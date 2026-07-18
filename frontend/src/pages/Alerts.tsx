import { useQuery } from '@tanstack/react-query'
import { alertsApi, type UpcomingAlert } from '../lib/api'
import type { Alert } from '../lib/types'
import { AlertTriangle, CheckCircle, XCircle, Info, CalendarClock, Search, FileWarning, ListChecks } from 'lucide-react'

const UPCOMING_SEVERITY: Record<UpcomingAlert['severity'], { dot: string; badge: string }> = {
  CRITICAL: { dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-500' },
  HIGH: { dot: 'bg-[var(--brand-gold)]', badge: 'bg-[#3E6B85]/15 text-[var(--brand-gold)]' },
  MEDIUM: { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-500' },
}

function UpcomingPanel({ projectId }: { projectId: string }) {
  const { data: items = [] } = useQuery<UpcomingAlert[]>({
    queryKey: ['upcoming', projectId],
    queryFn: () => alertsApi.upcoming(projectId),
    refetchInterval: 60000,
  })

  if (items.length === 0) return null

  const iconFor = (t: UpcomingAlert['type']) =>
    t === 'INSPECCION' ? Search : t === 'PERMISO' ? FileWarning : ListChecks

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <CalendarClock className="w-3.5 h-3.5" /> Hitos próximos (30 días)
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((a, i) => {
          const sev = UPCOMING_SEVERITY[a.severity]
          const Icon = iconFor(a.type)
          return (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sev.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-800">{a.title}</span>
                </div>
                <div className="text-xs text-slate-500 truncate">{a.description}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sev.badge}`}>{a.severity}</span>
                  {a.date && (
                    <span className="text-[11px] text-slate-400">
                      {new Date(a.date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const config = {
    ok: { icon: CheckCircle, border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-400', iconColor: 'text-emerald-400' },
    warning: { icon: AlertTriangle, border: 'border-l-amber-500', bg: 'bg-blue-500/5', text: 'text-[var(--brand-gold)]', iconColor: 'text-[var(--brand-gold)]' },
    critical: { icon: XCircle, border: 'border-l-red-500', bg: 'bg-red-500/5', text: 'text-red-400', iconColor: 'text-red-400' },
  }[alert.level]

  const Icon = config.icon

  return (
    <div className={`${config.bg} border border-slate-200 border-l-4 ${config.border} rounded-xl p-5`}>
      <div className="flex items-start gap-4">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold ${config.text}`}>{alert.title}</span>
            <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium
              ${alert.level === 'ok' ? 'bg-emerald-500/20 text-emerald-400'
              : alert.level === 'warning' ? 'bg-[#3E6B85]/15 text-[var(--brand-gold)]'
              : 'bg-red-500/20 text-red-400'}`}>
              {alert.level.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-slate-700 mb-3">{alert.message}</p>
          <div className="flex items-start gap-2">
            <Info className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-400">{alert.action}</p>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400">{alert.source}</div>
        </div>
      </div>
    </div>
  )
}

export default function Alerts({ projectId }: { projectId: string }) {
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts', projectId],
    queryFn: () => alertsApi.list(projectId),
    refetchInterval: 30000,
  })

  const critical = alerts.filter(a => a.level === 'critical')
  const warning = alerts.filter(a => a.level === 'warning')
  const ok = alerts.filter(a => a.level === 'ok')

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Calculando alertas...</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Centro de Alertas</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {critical.length > 0 && <span className="text-red-400">{critical.length} crítica{critical.length > 1 ? 's' : ''} · </span>}
          {warning.length > 0 && <span className="text-[var(--brand-gold)]">{warning.length} advertencia{warning.length > 1 ? 's' : ''} · </span>}
          {ok.length > 0 && <span className="text-emerald-400">{ok.length} OK</span>}
        </p>
      </div>

      <UpcomingPanel projectId={projectId} />

      {critical.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider">Críticas</h2>
          {critical.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>
      )}

      {warning.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-[var(--brand-gold)] uppercase tracking-wider">Advertencias</h2>
          {warning.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>
      )}

      {ok.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">OK</h2>
          {ok.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>
      )}
    </div>
  )
}
