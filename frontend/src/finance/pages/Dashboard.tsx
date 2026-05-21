import { useQuery } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, pct, cls } from "../lib/format";
import { KPI } from "../components/KPI";
import {
  Wallet, Users, Banknote, Building2, AlertTriangle, TrendingUp, TrendingDown,
  Activity, PieChart as PieIcon, AlertOctagon, Landmark, ArrowRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Link } from "react-router-dom";

// Paleta de gráficos: tonos teal/gold + secundarios verde/rojo
const COLORS = ["#2D4B52", "#C8922A", "#059669", "#3A5F68", "#E0AD4F", "#dc2626", "#8b5cf6", "#3b82f6"];

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: API.getDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) return <div style={{ color: 'var(--brand-teal)' }}>Cargando dashboard...</div>;
  const k = data.kpis;
  const accountsDetail: any[] = data.accountsDetail || [];

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
    <div className="space-y-6 page-content">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Dashboard ejecutivo</h1>
          <p className="text-sm" style={{ color: 'var(--brand-teal2)' }}>Lectura consolidada del negocio · {new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KPI label="Liquidez total" value={usd(k.totalLiquidez, { compact: true })} icon={<Wallet size={16} />} tone="accent" hint={`${accountsDetail.length} cuentas activas`} />
        <KPI label="Equity aportado" value={usd(k.totalEquity, { compact: true })} icon={<Users size={16} />} tone="positive" hint={`${data.equityByPartner.length} socios`} />
        <KPI label="Deuda viva" value={usd(k.outstandingDebt, { compact: true })} icon={<Banknote size={16} />} tone={k.outstandingDebt > 0 ? "negative" : "default"} hint={`${k.totalLoans > 0 ? pct(k.outstandingDebt / k.totalLoans) : "0%"} del total`} />
        <KPI label="Variación neta" value={usd(k.variacion ?? 0, { compact: true, sign: true })} icon={<Activity size={16} />} tone={(k.variacion ?? 0) >= 0 ? "positive" : "negative"} hint="ingresos − egresos" />
        <KPI label="Movimientos" value={k.totalMovements.toLocaleString()} icon={<Activity size={16} />} hint={`${k.intercompanyMovs} transferencias`} />
      </div>

      {/* === SALDOS EN CUENTAS Y TOTALES === */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
            <Landmark size={18} style={{ color: 'var(--brand-gold)' }} /> Saldos en cuentas
          </h2>
          <Link to="/finance/accounts" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--brand-gold)' }}>
            Ver todas <ArrowRight size={12} />
          </Link>
        </div>
        {accountsDetail.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--brand-teal2)' }}>
            Sin cuentas registradas. Ve a <Link to="/finance/accounts" className="font-semibold hover:underline" style={{ color: 'var(--brand-gold)' }}>Cuentas bancarias</Link> para crear la primera.
          </p>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              {accountsDetail.map((a: any) => (
                <Link
                  to={`/finance/accounts/${a.id}`}
                  key={a.id}
                  className="rounded-xl p-3 transition-all hover:shadow-md"
                  style={{
                    background: 'var(--brand-cream2)',
                    border: '1px solid rgba(45,75,82,0.1)',
                  }}
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate" style={{ color: 'var(--brand-teal)' }} title={a.name}>{a.name}</div>
                      <div className="text-[10px] font-mono uppercase tracking-wide" style={{ color: 'var(--brand-teal2)' }}>{a.bank}</div>
                    </div>
                    <span className="badge" style={{
                      background: 'rgba(200,146,42,0.12)',
                      color: 'var(--brand-gold)',
                      border: '1px solid rgba(200,146,42,0.3)',
                    }}>{a.type}</span>
                  </div>
                  <div className={cls(
                    "text-xl font-bold font-mono",
                    a.balance >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {usd(a.balance)}
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>
                    {a.movementCount} movimiento{a.movementCount !== 1 ? "s" : ""}
                    {a.accountNumber ? ` · #${a.accountNumber.slice(-4)}` : ""}
                  </div>
                </Link>
              ))}
            </div>
            {/* Totales */}
            <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>Ingresos totales</div>
                <div className="text-lg font-bold font-mono text-emerald-600">{usd(k.totalIngresos ?? 0, { compact: true })}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>Egresos totales</div>
                <div className="text-lg font-bold font-mono text-red-600">{usd(k.totalEgresos ?? 0, { compact: true })}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>Saldo consolidado</div>
                <div className={cls("text-lg font-bold font-mono", k.totalLiquidez >= 0 ? "text-emerald-600" : "text-red-600")}>{usd(k.totalLiquidez, { compact: true })}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Alertas rojas */}
      {data.alerts.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon size={16} style={{ color: '#d97706' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--brand-teal)' }}>Alertas activas</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.alerts.map((a: any) => (
              <div key={a.code} className={cls(
                "flex items-center gap-3 px-3 py-2 rounded-lg",
                a.severity === "red" ? "bg-red-50 border border-red-200 text-red-700" :
                a.severity === "warn" ? "bg-amber-50 border border-amber-200 text-amber-700" :
                "bg-stone-50 border border-stone-200 text-stone-700"
              )}>
                <AlertTriangle size={14} />
                <div className="flex-1">
                  <div className="text-xs font-medium">{a.message}</div>
                </div>
                {a.count != null && (
                  <span className="text-xs font-mono bg-white/70 px-2 py-0.5 rounded">{a.count}</span>
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
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}><Building2 size={14} style={{ color: 'var(--brand-gold)' }} /> Portafolio por proyecto</h2>
            <Link to="/finance/projects" className="text-xs hover:underline font-semibold" style={{ color: 'var(--brand-gold)' }}>Ver todos →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--brand-teal2)', borderBottom: '1px solid rgba(45,75,82,0.1)' }}>
                  <th className="py-2 px-2 font-semibold">Código</th>
                  <th className="py-2 px-2 font-semibold">Proyecto</th>
                  <th className="py-2 px-2 font-semibold">Línea</th>
                  <th className="py-2 px-2 font-semibold">Estado</th>
                  <th className="py-2 px-2 text-right font-semibold">Ingresos</th>
                  <th className="py-2 px-2 text-right font-semibold">Egresos</th>
                  <th className="py-2 px-2 text-right font-semibold">Neto</th>
                  <th className="py-2 px-2 text-right font-semibold">ROI est.</th>
                </tr>
              </thead>
              <tbody>
                {data.byProject.length === 0 ? (
                  <tr><td colSpan={8} className="py-6 text-center" style={{ color: 'var(--brand-teal2)' }}>Sin proyectos registrados.</td></tr>
                ) : data.byProject.map((p: any) => (
                  <tr key={p.id} className="table-row" style={{ borderBottom: '1px solid rgba(45,75,82,0.06)' }}>
                    <td className="py-2 px-2 font-mono text-xs" style={{ color: 'var(--brand-teal2)' }}>{p.code}</td>
                    <td className="py-2 px-2">
                      <Link to={`/finance/projects/${p.id}`} className="font-medium hover:underline" style={{ color: 'var(--brand-teal)' }}>{p.name}</Link>
                    </td>
                    <td className="py-2 px-2 text-xs" style={{ color: 'var(--brand-teal2)' }}>{p.line || "—"}</td>
                    <td className="py-2 px-2"><span className="badge" style={{ background: 'rgba(45,75,82,0.08)', color: 'var(--brand-teal)' }}>{p.status}</span></td>
                    <td className="py-2 px-2 text-right text-emerald-600 font-mono">{usd(p.ingresos, { compact: true })}</td>
                    <td className="py-2 px-2 text-right text-red-600 font-mono">{usd(p.egresos, { compact: true })}</td>
                    <td className={cls("py-2 px-2 text-right font-mono font-semibold", p.neto >= 0 ? "text-emerald-600" : "text-red-600")}>{usd(p.neto, { compact: true })}</td>
                    <td className={cls("py-2 px-2 text-right font-mono", p.roiEst >= 0 ? "text-emerald-600" : "text-red-600")}>{pct(p.roiEst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}><Users size={14} style={{ color: 'var(--brand-gold)' }} /> Capital por socio</h2>
          {data.equityByPartner.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--brand-teal2)' }}>Sin aportes registrados.</p>
          ) : (
            <>
              <div className="space-y-2">
                {data.equityByPartner.map((p: any) => (
                  <div key={p.code} className="rounded-lg p-3" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.08)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--brand-teal)' }}>{p.name}</span>
                      <span className="font-mono font-semibold text-emerald-600">{usd(p.total, { compact: true })}</span>
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--brand-teal2)' }}>
                      Bancarizado: {usd(p.equity, { compact: true })} · No-banc: {usd(p.nonBank, { compact: true })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={equityVsDebt} dataKey="value" nameKey="name" outerRadius={60} innerRadius={40} label={(d) => usd(d.value as number, { compact: true })}>
                      {equityVsDebt.map((_, i) => <Cell key={i} fill={i === 0 ? "#059669" : "#dc2626"} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Distribuciones */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}><PieIcon size={14} style={{ color: 'var(--brand-gold)' }} /> Gasto: proyecto vs corporativo</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={corpVsProject} dataKey="value" nameKey="name" outerRadius={80} label={(d) => usd(d.value as number, { compact: true })}>
                  {corpVsProject.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}><TrendingDown size={14} style={{ color: 'var(--brand-gold)' }} /> Top categorías de gasto</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data.topCategories.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#3A5F68" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#2D4B52" }} width={140} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                <Bar dataKey="amount" fill="#C8922A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Por línea */}
      <div className="card p-4">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}><TrendingUp size={14} style={{ color: 'var(--brand-gold)' }} /> Performance por línea de negocio</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data.byLine}>
              <XAxis dataKey="line" tick={{ fontSize: 11, fill: "#2D4B52" }} />
              <YAxis tick={{ fontSize: 10, fill: "#3A5F68" }} tickFormatter={(v) => usd(v, { compact: true })} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ingresos" fill="#059669" name="Ingresos" />
              <Bar dataKey="egresos" fill="#dc2626" name="Egresos" />
              <Bar dataKey="neto" fill="#C8922A" name="Neto" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
