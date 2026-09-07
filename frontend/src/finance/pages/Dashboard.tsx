import { useQuery } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, pct, cls } from "../lib/format";
import { KPI } from "../components/KPI";
import {
  Wallet, Users, Banknote, Building2, AlertTriangle, TrendingUp, TrendingDown,
  Activity, PieChart as PieIcon, AlertOctagon, Landmark, ArrowRight,
  Calendar, ShieldAlert, Info,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";

// Paleta DS v2.1 — usa CSS vars como fills => las gráficas reaccionan a dark/light en vivo
const COLORS = [
  "var(--inf)", "var(--accent)", "var(--ok)", "var(--brand-teal3)",
  "var(--warn)", "var(--err)", "#3E5A70", "#7A93A6",
];

export default function Dashboard() {
  const { t, tc, locale } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: API.getDashboard,
    refetchInterval: 60_000,
  });
  const { data: forecast } = useQuery({
    queryKey: ["cashflow-forecast"],
    queryFn: API.getCashflowForecast,
    refetchInterval: 120_000,
  });
  const { data: insights } = useQuery({
    queryKey: ["insights"],
    queryFn: API.getInsights,
    refetchInterval: 120_000,
  });

  if (isLoading || !data) return <div style={{ color: 'var(--brand-teal)' }}>{t('dash.loading')}</div>;
  const k = data.kpis;
  const accountsDetail: any[] = data.accountsDetail || [];

  // Los `name` alimentan leyendas y tooltips de Recharts → se traducen aquí.
  const equityVsDebt = [
    { name: t('fin.chart.partnerEquity'), value: k.totalEquity },
    { name: t('fin.chart.outstandingDebt'), value: k.outstandingDebt },
  ];

  const corpVsProject = [
    { name: t('fin.chart.projectSpend'), value: k.projectExpenses },
    { name: t('fin.chart.corpSpend'), value: k.corpExpenses },
    { name: t('fin.chart.otherSpend'), value: k.otherExpenses },
  ];

  return (
    <div className="space-y-6 page-content">
      <div className="fin-section flex items-end justify-between flex-wrap gap-3 mb-2">
        <div>
          <div className="fin-page-title">{t('fin.dash.title')}</div>
          <div className="fin-page-sub">{t('fin.dash.sub')} · {new Date().toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KPI label={t('fin.kpi.liquidity')} value={usd(k.totalLiquidez, { compact: true })} icon={<Wallet size={16} />} tone="accent" hint={t('fin.kpi.activeAccounts', { n: accountsDetail.length })} />
        <KPI label={t('fin.kpi.equity')} value={usd(k.totalEquity, { compact: true })} icon={<Users size={16} />} tone="positive" hint={t('fin.kpi.partners', { n: data.equityByPartner.length })} />
        <KPI label={t('fin.kpi.debt')} value={usd(k.outstandingDebt, { compact: true })} icon={<Banknote size={16} />} tone={k.outstandingDebt > 0 ? "negative" : "default"} hint={t('fin.kpi.ofTotal', { pct: k.totalLoans > 0 ? pct(k.outstandingDebt / k.totalLoans) : "0%" })} />
        <KPI label={t('fin.kpi.netChange')} value={usd(k.variacion ?? 0, { compact: true, sign: true })} icon={<Activity size={16} />} tone={(k.variacion ?? 0) >= 0 ? "positive" : "negative"} hint={t('fin.kpi.incomeMinusExpenses')} />
        <KPI label={t('fin.kpi.movements')} value={k.totalMovements.toLocaleString(locale)} icon={<Activity size={16} />} hint={t('fin.kpi.transfers', { n: k.intercompanyMovs })} />
      </div>

      {/* === SALDOS EN CUENTAS Y TOTALES === */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            <Landmark size={18} style={{ color: 'var(--accent)' }} /> {t('fin.accounts.title')}
          </h2>
          <Link to="/finance/accounts" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
            {t('common.viewAll')} <ArrowRight size={12} />
          </Link>
        </div>
        {accountsDetail.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--brand-teal2)' }}>
            {t('fin.accounts.emptyLead')} <Link to="/finance/accounts" className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}>{t('nav.fin.accounts')}</Link> {t('fin.accounts.emptyTail')}
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
                    border: '1px solid rgba(29,29,31,0.1)',
                  }}
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate" style={{ color: 'var(--brand-teal)' }} title={a.name}>{a.name}</div>
                      <div className="text-[10px] font-mono uppercase tracking-wide" style={{ color: 'var(--brand-teal2)' }}>{a.bank}</div>
                    </div>
                    <span className="badge" style={{
                      background: 'rgba(62,90,112,0.12)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(62,90,112,0.3)',
                    }}>{a.type}</span>
                  </div>
                  <div className={cls(
                    "text-xl font-bold font-mono",
                    a.balance >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {usd(a.balance)}
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>
                    {tc('fin.movementCount', a.movementCount)}
                    {a.accountNumber ? ` · #${a.accountNumber.slice(-4)}` : ""}
                  </div>
                </Link>
              ))}
            </div>
            {/* Totales */}
            <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: '1px solid rgba(29,29,31,0.1)' }}>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>{t('fin.totals.income')}</div>
                <div className="text-lg font-bold font-mono text-emerald-600">{usd(k.totalIngresos ?? 0, { compact: true })}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>{t('fin.totals.expenses')}</div>
                <div className="text-lg font-bold font-mono text-red-600">{usd(k.totalEgresos ?? 0, { compact: true })}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>{t('fin.totals.consolidated')}</div>
                <div className={cls("text-lg font-bold font-mono", k.totalLiquidez >= 0 ? "text-emerald-600" : "text-red-600")}>{usd(k.totalLiquidez, { compact: true })}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* === CASHFLOW FORECAST 90 DÍAS === */}
      {forecast && forecast.forecast90Days && forecast.forecast90Days.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              <Calendar size={16} style={{ color: 'var(--accent)' }} /> {t('fin.forecast.title')}
            </h2>
            <div className="flex items-center gap-4 text-xs flex-wrap">
              {forecast.runwayDays != null && (
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--brand-teal2)' }}>{t('fin.forecast.runway')}</span>
                  <span className="font-mono font-bold" style={{
                    color: forecast.runwayDays > 180 ? 'var(--ok)' :
                           forecast.runwayDays > 90 ? 'var(--warn)' : 'var(--err)'
                  }}>
                    {t('fin.forecast.days', { n: forecast.runwayDays })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span style={{ color: 'var(--brand-teal2)' }}>{t('fin.forecast.dailyInterest')}</span>
                <span className="font-mono font-bold text-red-600">{usd(forecast.interestPerDay)}</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={forecast.forecast90Days}>
                <defs>
                  <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,29,31,0.1)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#48484A" }} interval={9} />
                <YAxis tick={{ fontSize: 10, fill: "#48484A" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid rgba(29,29,31,0.15)", borderRadius: 8 }}
                  formatter={(v: any) => usd(v as number)}
                  labelFormatter={(d) => `📅 ${d}`}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--inf)" strokeWidth={2} fill="url(#balanceFill)" name={t('fin.forecast.projectedBalance')} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {forecast.upcomingMaturity && forecast.upcomingMaturity.length > 0 && (
            <div className="mt-3 p-3" style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn-border)', borderRadius: 8 }}>
              <div className="text-xs font-bold mb-1" style={{ color: 'var(--warn)' }}>{t('fin.forecast.maturities')}</div>
              <ul className="text-xs space-y-0.5" style={{ color: 'var(--warn)' }}>
                {forecast.upcomingMaturity.slice(0, 5).map((m: any) => (
                  <li key={m.loanId}>
                    · {m.date?.slice(0, 10)}: <span className="font-mono font-semibold">{usd(m.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* === INSIGHTS EJECUTIVOS (CFO) === */}
      {insights && insights.total > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              <ShieldAlert size={16} style={{ color: 'var(--accent)' }} /> {t('fin.insights.title')}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              {insights.bySeverity.red > 0 && (
                <span className="fin-badge fin-b-err">{t('fin.insights.critical', { n: insights.bySeverity.red })}</span>
              )}
              {insights.bySeverity.warn > 0 && (
                <span className="fin-badge fin-b-warn">{t('fin.insights.warnings', { n: insights.bySeverity.warn })}</span>
              )}
              {insights.bySeverity.info > 0 && (
                <span className="fin-badge fin-b-inf">{t('fin.insights.info', { n: insights.bySeverity.info })}</span>
              )}
            </div>
          </div>
          <ul className="space-y-1.5">
            {insights.insights.slice(0, 10).map((ins: any, i: number) => {
              const sevColor = ins.severity === "red" ? 'var(--err)' : ins.severity === "warn" ? 'var(--warn)' : 'var(--inf)';
              return (
              <li key={i} className="flex items-start gap-2 p-2.5 text-sm" style={{
                background: ins.severity === "red"  ? 'var(--err-soft)' :
                            ins.severity === "warn" ? 'var(--warn-soft)' : 'var(--inf-soft)',
                borderColor: ins.severity === "red"  ? 'var(--err-border)' :
                             ins.severity === "warn" ? 'var(--warn-border)' : 'var(--inf-border)',
                borderWidth: 1, borderStyle: 'solid', borderRadius: 8,
              }}>
                {ins.severity === "red" && <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" style={{ color: sevColor }} />}
                {ins.severity === "warn" && <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: sevColor }} />}
                {ins.severity === "info" && <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: sevColor }} />}
                <div className="flex-1" style={{ color: sevColor }}>
                  <span className="text-[10px] uppercase tracking-wider font-bold opacity-70 mr-2">{ins.category}</span>
                  {ins.message}
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Alertas rojas */}
      {data.alerts.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon size={16} style={{ color: 'var(--warn)' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{t('fin.alerts.title')}</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.alerts.map((a: any) => (
              <div key={a.code} className="flex items-center gap-3" style={{
                background: a.severity === "red" ? 'var(--err-soft)' : a.severity === "warn" ? 'var(--warn-soft)' : 'var(--bg-surface-3)',
                border: `1px solid ${a.severity === "red" ? 'var(--err-border)' : a.severity === "warn" ? 'var(--warn-border)' : 'var(--border)'}`,
                color: a.severity === "red" ? 'var(--err)' : a.severity === "warn" ? 'var(--warn)' : 'var(--text-secondary)',
                borderRadius: 8, padding: '8px 12px',
              }}>
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
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}><Building2 size={14} style={{ color: 'var(--accent)' }} /> {t('fin.portfolio.title')}</h2>
            <Link to="/finance/projects" className="text-xs hover:underline font-semibold" style={{ color: 'var(--accent)' }}>{t('common.viewAllArrow')}</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="fin-dt">
              <thead>
                <tr>
                  <th>{t('fin.table.code')}</th>
                  <th>{t('fin.table.project')}</th>
                  <th>{t('fin.table.line')}</th>
                  <th>{t('fin.table.status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('fin.table.income')}</th>
                  <th style={{ textAlign: 'right' }}>{t('fin.table.expenses')}</th>
                  <th style={{ textAlign: 'right' }}>{t('fin.table.net')}</th>
                  <th style={{ textAlign: 'right' }}>{t('fin.table.roi')}</th>
                </tr>
              </thead>
              <tbody>
                {data.byProject.length === 0 ? (
                  <tr><td colSpan={8} className="py-6 text-center" style={{ color: 'var(--brand-teal2)' }}>{t('fin.portfolio.empty')}</td></tr>
                ) : data.byProject.map((p: any) => (
                  <tr key={p.id}>
                    <td className="py-2 px-2 font-mono text-xs" style={{ color: 'var(--brand-teal2)' }}>{p.code}</td>
                    <td className="py-2 px-2">
                      <Link to={`/finance/projects/${p.id}`} className="font-medium hover:underline" style={{ color: 'var(--brand-teal)' }}>{p.name}</Link>
                    </td>
                    <td className="py-2 px-2 text-xs" style={{ color: 'var(--brand-teal2)' }}>{p.line || "—"}</td>
                    <td className="py-2 px-2"><span className="badge" style={{ background: 'rgba(29,29,31,0.08)', color: 'var(--brand-teal)' }}>{p.status}</span></td>
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
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}><Users size={14} style={{ color: 'var(--accent)' }} /> {t('fin.capital.title')}</h2>
          {data.equityByPartner.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--brand-teal2)' }}>{t('fin.capital.empty')}</p>
          ) : (
            <>
              <div className="space-y-2">
                {data.equityByPartner.map((p: any) => (
                  <div key={p.code} className="rounded-lg p-3" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(29,29,31,0.08)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--brand-teal)' }}>{p.name}</span>
                      <span className="font-mono font-semibold text-emerald-600">{usd(p.total, { compact: true })}</span>
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--brand-teal2)' }}>
                      {t('fin.capital.banked')}: {usd(p.equity, { compact: true })} · {t('fin.capital.nonBanked')}: {usd(p.nonBank, { compact: true })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={equityVsDebt} dataKey="value" nameKey="name" outerRadius={60} innerRadius={40} label={(d) => usd(d.value as number, { compact: true })}>
                      {equityVsDebt.map((_, i) => <Cell key={i} fill={i === 0 ? "var(--ok)" : "var(--err)"} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(29,29,31,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
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
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}><PieIcon size={14} style={{ color: 'var(--accent)' }} /> {t('fin.chart.spendTitle')}</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={corpVsProject} dataKey="value" nameKey="name" outerRadius={80} label={(d) => usd(d.value as number, { compact: true })}>
                  {corpVsProject.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(29,29,31,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}><TrendingDown size={14} style={{ color: 'var(--accent)' }} /> {t('fin.chart.topCategories')}</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data.topCategories.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#48484A" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "var(--inf)" }} width={140} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(29,29,31,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                <Bar dataKey="amount" fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Por línea */}
      <div className="card p-4">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}><TrendingUp size={14} style={{ color: 'var(--accent)' }} /> {t('fin.chart.byLine')}</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data.byLine}>
              <XAxis dataKey="line" tick={{ fontSize: 11, fill: "var(--inf)" }} />
              <YAxis tick={{ fontSize: 10, fill: "#48484A" }} tickFormatter={(v) => usd(v, { compact: true })} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(29,29,31,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ingresos" fill="var(--ok)" name={t('fin.table.income')} />
              <Bar dataKey="egresos" fill="var(--err)" name={t('fin.table.expenses')} />
              <Bar dataKey="neto" fill="var(--accent)" name={t('fin.table.net')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
