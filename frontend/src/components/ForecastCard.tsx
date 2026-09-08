// ============================================================
// FORECAST CARD (Lote B) — proyección de entrega y costo del atraso.
// Responde: ¿a este ritmo cuándo terminas de verdad, cuántos días de
// atraso llevas contra el target (ajustado por change orders) y cuánto
// te cuesta cada día de atraso en intereses del préstamo?
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { forecastApi } from '../lib/api'
import { CalendarClock, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import { useI18n, currentLocale } from '../i18n'

const fmtUSD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString(currentLocale(), { day: '2-digit', month: 'short', year: 'numeric' })

export default function ForecastCard({ projectId }: { projectId: string }) {
  const { t } = useI18n()
  const { data: f, isLoading } = useQuery({
    queryKey: ['forecast', projectId],
    queryFn: () => forecastApi.get(projectId),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading || !f) return null

  if (!f.available) {
    return (
      <div className="kpi-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
          <CalendarClock className="w-4 h-4 text-[var(--brand-gold)]" /> {t('ui.forecast.forecastDeEntrega')}
        </div>
        <p className="text-xs text-slate-400">
          {t('ui.forecast.paraProyectarNecesito')} {f.missing?.join(' · ')}
        </p>
      </div>
    )
  }

  const late = (f.delayDays ?? 0) > 0
  const Icon = late ? TrendingDown : TrendingUp

  return (
    <div className={`kpi-card p-4 ${late ? 'kpi-card-amber' : ''}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarClock className="w-4 h-4 text-[var(--brand-gold)]" /> {t('ui.forecast.forecastDeEntrega')}
        </div>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          late ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
          <Icon className="w-3 h-3" />
          {late ? t('ui.forecast.v0DiaSDeAtrasoProyectado', { v0: f.delayDays ?? 0 }) : t('ui.forecast.aTiempoOAdelantado')}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">{t('ui.forecast.ritmoReal')}</div>
          <div className="text-lg font-bold font-mono text-slate-800">{f.pacePerWeek}%<span className="text-xs text-slate-400">/sem</span></div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">{t('ui.forecast.finProyectado')}</div>
          <div className={`text-lg font-bold font-mono ${late ? 'text-amber-600' : 'text-emerald-600'}`}>
            {f.projectedFinish ? fmtDate(f.projectedFinish) : '—'}
          </div>
          <div className="text-[10px] text-slate-400">
            {t('ui.forecast.target')} {f.targetAdjusted ? fmtDate(f.targetAdjusted) : '—'}{(f.coDays ?? 0) !== 0 ? t('ui.forecast.inclV0DDeCos', { v0: f.coDays ?? 0 }) : ''}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">{t('ui.forecast.costoDelAtraso')}</div>
          <div className={`text-lg font-bold font-mono ${(f.delayCost ?? 0) > 0 ? 'text-red-500' : 'text-slate-800'}`}>
            {fmtUSD(f.delayCost ?? 0)}
          </div>
          <div className="text-[10px] text-slate-400">{fmtUSD(f.dailyInterest ?? 0)}/día de interés (UPB {fmtUSD(f.upb ?? 0)})</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">{t('ui.forecast.prestamoVence')}</div>
          <div className={`text-lg font-bold font-mono ${f.maturityRisk ? 'text-red-500' : 'text-slate-800'}`}>
            {f.loanMaturity ? fmtDate(f.loanMaturity) : '—'}
          </div>
          {f.daysToMaturity !== null && f.daysToMaturity !== undefined && (
            <div className="text-[10px] text-slate-400">{f.daysToMaturity} {t('ui.forecast.diaSRestantes')}</div>
          )}
        </div>
      </div>

      {/* T3: proyección del próximo draw según ritmo histórico */}
      {(f as any).nextDrawDate && (
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-slate-500 border-t border-slate-100 pt-2">
          <span className="font-semibold text-[var(--brand-teal)]">{t('ui.forecast.proximoDrawProyectado')}</span>
          <span className="font-mono font-semibold">{fmtDate((f as any).nextDrawDate)}</span>
          {(f as any).avgDrawInterval && <span>{t('ui.forecast.ritmo')} {String((f as any).avgDrawInterval)}{t('ui.forecast.dEntreDraws')}</span>}
          {(f as any).drawsRemaining !== null && (f as any).drawsRemaining !== undefined && (
            <span>· ~{String((f as any).drawsRemaining)} {t('ui.forecast.drawSParaAgotarHoldback')}</span>
          )}
        </div>
      )}

      {f.maturityRisk && (
        <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {t('ui.forecast.aEsteRitmoTerminasDespuesDel')}
        </div>
      )}
    </div>
  )
}
