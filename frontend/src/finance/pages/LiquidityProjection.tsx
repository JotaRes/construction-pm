import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { API } from "../lib/api";
import { KPI } from "../components/KPI";
import { usd, dateShort } from "../lib/format";
import { Wallet, AlertTriangle, CalendarClock, TrendingDown } from "lucide-react";
import { useI18n } from '../../i18n'

export default function LiquidityProjection() {
  const { t } = useI18n()
  const { data, isLoading } = useQuery<any>({
    queryKey: ["liquidity-projection"],
    queryFn: () => API.getLiquidityProjection(),
  });

  if (isLoading || !data) return <p className="text-sm py-12 text-center" style={{ color: "var(--brand-teal2)" }}>{t('fin.liq.cargandoProyeccion')}</p>;

  const negative = data.projectedFreeBalance < 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--brand-teal)" }}>
          {t('fin.liq.proyeccionDeLiquidez90Dias')}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--brand-teal2)" }}>
          {t('fin.liq.saldoConsolidadoVsCompromisosSalientesPago')}
        </p>
      </div>

      {negative && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: "var(--err-bg, #fef2f2)", border: "1px solid var(--err)" }}>
          <AlertTriangle size={16} style={{ color: "var(--err)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--err)" }}>
            {t('fin.liq.saldoLibreProyectadoNegativoSeRequerira')}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label={t('fin.liq.saldoConsolidado')} value={usd(data.currentBalance)} tone="accent" icon={<Wallet size={16} />} />
        <KPI label={t('fin.liq.comprometido90d')} value={usd(data.totalCommitted)} tone="negative" icon={<TrendingDown size={16} />} />
        <KPI label={t('fin.liq.drawsEnCurso')} value={usd(data.totalDrawsPending)} tone="warn" icon={<CalendarClock size={16} />} />
        <KPI label={t('fin.liq.saldoLibreProyectado')} value={usd(data.projectedFreeBalance)} tone={negative ? "negative" : "positive"} />
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--brand-teal)" }}>{t('fin.liq.salidasProyectadasPorSemana')}</h2>
        {(data.weeklyOutflows || []).length === 0 ? (
          <p className="text-sm py-10 text-center" style={{ color: "var(--brand-teal2)" }}>
            {t('fin.liq.noHayPagosASubcontratistasProgramados')}
          </p>
        ) : (
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.weeklyOutflows}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--inf)" }} tickFormatter={(w) => dateShort(w)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--brand-teal3)" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <Tooltip formatter={(v: number) => usd(v)} labelFormatter={(w) => t('fin.liq.semanaDeV0', { v0: dateShort(w) })} />
                <Bar dataKey="amount" name={t('fin.liq.salidas')} fill="var(--err)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--brand-teal)" }}>{t('fin.liq.pagosProgramados')}</h2>
        </div>
        {(data.upcomingPayments || []).length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: "var(--brand-teal2)" }}>{t('fin.liq.sinPagosProgramados')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-secondary)" }} className="text-left">
                {[t('common.fecha'), t('fin.table.project'), "Proveedor", "Hito", t('common.monto')].map(h => (
                  <th key={h} className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.upcomingPayments.map((p: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-5 py-2" style={{ color: "var(--text-secondary)" }}>{dateShort(p.date)}</td>
                  <td className="px-5 py-2" style={{ color: "var(--text-primary)" }}>{p.projectName}</td>
                  <td className="px-5 py-2" style={{ color: "var(--text-secondary)" }}>{p.providerName}</td>
                  <td className="px-5 py-2" style={{ color: "var(--text-secondary)" }}>{p.milestone}</td>
                  <td className="px-5 py-2 font-mono" style={{ color: "var(--text-primary)" }}>{usd(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
