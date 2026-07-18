import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { API } from "../lib/api";
import { KPI } from "../components/KPI";
import { usd } from "../lib/format";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

export default function CashflowDashboard() {
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
            Flujo de Caja Consolidado
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--brand-teal2)" }}>
            Ingresos, egresos y saldo corriente por período
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
                {g === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
          <select value={months} onChange={e => setMonths(Number(e.target.value))}
            className="text-xs rounded-lg px-2 border"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)", color: "var(--text-primary)" }}>
            {[3, 6, 12, 24].map(m => <option key={m} value={m}>Últimos {m} meses</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI label="Ingresos del período" value={usd(totalIng)} tone="positive" icon={<ArrowUpRight size={16} />} />
        <KPI label="Egresos del período" value={usd(totalEgr)} tone="negative" icon={<ArrowDownRight size={16} />} />
        <KPI label="Flujo neto" value={usd(neto)} tone={neto >= 0 ? "positive" : "negative"} icon={<TrendingUp size={16} />} />
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "var(--brand-teal)" }}>
          <Activity size={14} style={{ color: "var(--brand-gold)" }} /> Ingresos vs Egresos + saldo corriente
        </h2>
        {isLoading ? (
          <p className="text-sm py-12 text-center" style={{ color: "var(--brand-teal2)" }}>Cargando...</p>
        ) : data.length === 0 ? (
          <p className="text-sm py-12 text-center" style={{ color: "var(--brand-teal2)" }}>
            Sin movimientos en el rango seleccionado. Amplía el período o registra movimientos.
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
                <Bar dataKey="ingresos" name="Ingresos" fill="var(--ok)" />
                <Bar dataKey="egresos" name="Egresos" fill="var(--err)" />
                <Line type="monotone" dataKey="runningBalance" name="Saldo corriente" stroke="var(--accent)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
