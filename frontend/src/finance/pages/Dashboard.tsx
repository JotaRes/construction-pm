import { useQuery } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, pct, cls } from "../lib/format";
import { KPI } from "../components/KPI";
import {
  Wallet, Users, Banknote, Building2, AlertTriangle, TrendingUp, TrendingDown,
  Activity, PieChart as PieIcon, AlertOctagon
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Link } from "react-router-dom";

const COLORS = ["#5eead4", "#2dd4bf", "#0d9488", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6"];

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: API.getDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) return <div className="text-slate-400">Cargando dashboard...</div>;
  const k = data.kpis;

  const equityVsDebt = [
    { name: "Equity socios", value: k.totalEquity },
    { name: "Deuda viva", value: k.outstandingDebt },
  ];

  const corpVsProject = [
    { name: "Gasto proyecto", value: k.projectExpenses },
    { name: "Gasto corporativo", value: k.corpExpenses },
    { name: "Otros", value: k.otherExpenses },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Dashboard ejecutivo</h1>
          <p className="text-sm text-slate-400">Lectura consolidada del negocio · {new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KPI label="Liquidez total" value={usd(k.totalLiquidez, { compact: true })} icon={<Wallet size={16} />} tone="accent" hint="suma de saldos por cuenta" />
        <KPI label="Equity aportado" value={usd(k.totalEquity, { compact: true })} icon={<Users size={16} />} tone="positive" hint={`${data.equityByPartner.length} socios`} />
        <KPI label="Deuda viva" value={usd(k.outstandingDebt, { compact: true })} icon={<Banknote size={16} />} tone={k.outstandingDebt > 0 ? "negative" : "default"} hint={`${k.totalLoans > 0 ? pct(k.outstandingDebt / k.totalLoans) : "0%"} del total`} />
        <KPI label="Tasa promedio" value={pct(k.avgRate / 100, 2)} icon={<Activity size={16} />} hint="promedio simple" />
        <KPI label="Movimientos" value={k.totalMovements.toLocaleString()} icon={<Activity size={16} />} hint={`${k.intercompanyMovs} intercompany`} />
      </div>

      {/* Alertas rojas */}
      {data.alerts.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon size={16} className="text-warn" />
            <h2 className="text-sm font-semibold">Alertas activas</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.alerts.map((a: any) => (
              <div key={a.code} className={cls(
                "flex items-center gap-3 px-3 py-2 rounded-lg border",
                a.severity === "red" ? "bg-red-500/5 border-red-500/30 text-red-300" :
                a.severity === "warn" ? "bg-amber-500/5 border-amber-500/30 text-amber-300" :
                "bg-bg-soft border-line text-slate-300"
              )}>
                <AlertTriangle size={14} />
                <div className="flex-1">
                  <div className="text-xs font-medium">{a.message}</div>
                </div>
                {a.count != null && (
                  <span className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded">{a.count}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portafolio */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 size={14} /> Portafolio por proyecto</h2>
            <Link to="/projects" className="text-xs text-accent hover:underline">Ver todos →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 text-xs border-b border-line">
                  <th className="py-2 px-2">Código</th>
                  <th className="py-2 px-2">Proyecto</th>
                  <th className="py-2 px-2">Línea</th>
                  <th className="py-2 px-2">Estado</th>
                  <th className="py-2 px-2 text-right">Ingresos</th>
                  <th className="py-2 px-2 text-right">Egresos</th>
                  <th className="py-2 px-2 text-right">Neto</th>
                  <th className="py-2 px-2 text-right">ROI est.</th>
                </tr>
              </thead>
              <tbody>
                {data.byProject.map((p: any) => (
                  <tr key={p.id} className="border-b border-line/50 table-row">
                    <td className="py-2 px-2 font-mono text-xs">{p.code}</td>
                    <td className="py-2 px-2">
                      <Link to={`/projects/${p.id}`} className="hover:text-accent">{p.name}</Link>
                    </td>
                    <td className="py-2 px-2 text-xs text-slate-400">{p.line || "—"}</td>
                    <td className="py-2 px-2"><span className="badge bg-bg-hover text-slate-300">{p.status}</span></td>
                    <td className="py-2 px-2 text-right text-positive font-mono">{usd(p.ingresos, { compact: true })}</td>
                    <td className="py-2 px-2 text-right text-negative font-mono">{usd(p.egresos, { compact: true })}</td>
                    <td className={cls("py-2 px-2 text-right font-mono", p.neto >= 0 ? "text-positive" : "text-negative")}>{usd(p.neto, { compact: true })}</td>
                    <td className={cls("py-2 px-2 text-right font-mono", p.roiEst >= 0 ? "text-slate-200" : "text-negative")}>{pct(p.roiEst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={14} /> Capital por socio</h2>
          <div className="space-y-3">
            {data.equityByPartner.map((p: any) => (
              <div key={p.code} className="card-soft p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="font-mono text-positive">{usd(p.total, { compact: true })}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Bancarizado: {usd(p.equity, { compact: true })} · No-banc: {usd(p.nonBank, { compact: true })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={equityVsDebt} dataKey="value" nameKey="name" outerRadius={60} innerRadius={40} label={(d) => usd(d.value as number, { compact: true })}>
                  {equityVsDebt.map((_, i) => <Cell key={i} fill={i === 0 ? "#22c55e" : "#ef4444"} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#161b24", border: "1px solid #222a37", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Distribuciones */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><PieIcon size={14} /> Gasto: proyecto vs corporativo</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={corpVsProject} dataKey="value" nameKey="name" outerRadius={80} label={(d) => usd(d.value as number, { compact: true })}>
                  {corpVsProject.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#161b24", border: "1px solid #222a37", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingDown size={14} /> Top categorías de gasto</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data.topCategories.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#cbd5e1" }} width={140} />
                <Tooltip contentStyle={{ background: "#161b24", border: "1px solid #222a37", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                <Bar dataKey="amount" fill="#5eead4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Por línea */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={14} /> Performance por línea de negocio</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data.byLine}>
              <XAxis dataKey="line" tick={{ fontSize: 11, fill: "#cbd5e1" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => usd(v, { compact: true })} />
              <Tooltip contentStyle={{ background: "#161b24", border: "1px solid #222a37", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ingresos" fill="#22c55e" name="Ingresos" />
              <Bar dataKey="egresos" fill="#ef4444" name="Egresos" />
              <Bar dataKey="neto" fill="#5eead4" name="Neto" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
