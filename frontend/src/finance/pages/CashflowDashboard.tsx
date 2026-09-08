import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { API } from "../lib/api";
import { KPI } from "../components/KPI";
import { usd } from "../lib/format";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { useI18n } from '../../i18n'

export default function CashflowDashboard() {
  const { t } = useI18n()
  const [groupBy, setGroupBy] = useState<"week" | "month">("month");
  const [months, setMonths] = useState(12);

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["cashflow-v2", groupBy, months],
    queryFn: () => API.getCashflowV2(groupBy, months),
  });

  const totalIng = data.reduce((s, b) => s + b.ingresos, 0);
  const totalEgr = data.reduce((s, b) => s + b.egresos, 0);
  const neto = totalIng - totalEgr;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--brand-teal)" }}>
            {t('fin.cashflow.flujoDeCajaConsolidado')}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--brand-teal2)" }}>
            {t('fin.cashflow.ingresosEgresosYSaldoCorrientePor')}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: "var(--bg-surface-2)" }}>
            {(["week", "month"] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className="px-3 py-1.5 rounded-md text-xs font-medium"
                style={groupBy === g
                  ? { background: "var(--accent)", color: "#fff" }
                  : { color: "var(--text-secondary)" }}>
                {g === "week" ? t('fin.cashflow.semana') : t('fin.cashflow.mes')}
              </button>
            ))}
          </div>
          <select value={months} onChange={e => setMonths(Number(e.target.value))}
            className="text-xs rounded-lg px-2 border"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)", color: "var(--text-primary)" }}>
            {[3, 6, 12, 24].map(m => <option key={m} value={m}>{t('fin.cashflow.ultimos')} {m} {t('fin.cashflow.meses')}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI label={t('fin.cashflow.ingresosDelPeriodo')} value={usd(totalIng)} tone="positive" icon={<ArrowUpRight size={16} />} />
        <KPI label={t('fin.cashflow.egresosDelPeriodo')} value={usd(totalEgr)} tone="negative" icon={<ArrowDownRight size={16} />} />
        <KPI label={t('fin.cashflow.flujoNeto')} value={usd(neto)} tone={neto >= 0 ? "positive" : "negative"} icon={<TrendingUp size={16} />} />
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "var(--brand-teal)" }}>
          <Activity size={14} style={{ color: "var(--brand-gold)" }} /> {t('fin.cashflow.ingresosVsEgresosSaldoCorriente')}
        </h2>
        {isLoading ? (
          <p className="text-sm py-12 text-center" style={{ color: "var(--brand-teal2)" }}>{t('common.cargando2')}</p>
        ) : data.length === 0 ? (
          <p className="text-sm py-12 text-center" style={{ color: "var(--brand-teal2)" }}>
            {t('fin.cashflow.sinMovimientosEnElRangoSeleccionado')}
          </p>
        ) : (
          <div style={{ height: 340 }}>
            <ResponsiveContainer>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--inf)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--brand-teal3)" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <Tooltip formatter={(v: number) => usd(v)} />
                <Legend />
                <Bar dataKey="ingresos" name={t('common.ingresos')} fill="var(--ok)" />
                <Bar dataKey="egresos" name={t('common.egresos')} fill="var(--err)" />
                <Line type="monotone" dataKey="runningBalance" name={t('fin.cashflow.saldoCorriente')} stroke="var(--accent)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
