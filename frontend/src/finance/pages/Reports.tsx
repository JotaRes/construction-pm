import { FileBarChart } from 'lucide-react'
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { API } from "../lib/api";
import { usd, dateShort, pct, cls } from "../lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LineChart, Line,
} from "recharts";
import {
  TrendingUp, TrendingDown, Activity, Briefcase, FileText, History,
  Plus, Edit3, Trash2, RotateCcw, Upload, FolderDown,
} from "lucide-react";
import axios from "axios";

// Descarga autenticada del paquete anual del contador (ZIP con Excel por SPV)
async function downloadTaxPackage(year: number, setBusy: (b: boolean) => void) {
  setBusy(true);
  try {
    const token = localStorage.getItem("pm_auth_token");
    const res = await axios.get(`/api/finance/tax-package?year=${year}`, {
      responseType: "blob",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paquete-contador-${year}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    setBusy(false);
  }
}

const ACTION_ICON: Record<string, any> = {
  create: Plus,
  update: Edit3,
  delete: Trash2,
  "wipe-all": RotateCcw,
  restore: Upload,
};
const ACTION_COLOR: Record<string, string> = {
  create: "text-emerald-600 bg-emerald-50 border-emerald-200",
  update: "text-blue-600 bg-blue-50 border-blue-200",
  delete: "text-red-600 bg-red-50 border-red-200",
  "wipe-all": "text-red-700 bg-red-100 border-red-300",
  restore: "text-amber-600 bg-amber-50 border-amber-200",
};

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [taxBusy, setTaxBusy] = useState(false);
  const [tab, setTab] = useState<"flow" | "ratios" | "audit">("flow");
  const { data: sources } = useQuery({ queryKey: ["sources-uses"], queryFn: API.getSourcesUses });
  const { data: cashflow } = useQuery({ queryKey: ["cashflow", year], queryFn: () => API.getCashflow(year) });
  const { data: ratios } = useQuery({ queryKey: ["project-ratios"], queryFn: API.getProjectRatios, enabled: tab === "ratios" });
  const { data: auditLog } = useQuery({ queryKey: ["audit-log"], queryFn: () => API.getAuditLog(100), enabled: tab === "audit" });

  return (
    <div className="space-y-5 page-content">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><FileBarChart className="w-[22px] h-[22px]" strokeWidth={2.2} /></span><span>Reportes & Trazabilidad</span></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>
            Análisis ejecutivo · Fuentes y usos · Ratios por proyecto · Historial de operaciones
          </p>
        </div>
        {/* Paquete anual para el contador (Lote C) */}
        <button onClick={() => downloadTaxPackage(year, setTaxBusy)} disabled={taxBusy}
          className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          style={{ background: 'var(--brand-teal)' }}
          title="ZIP con un Excel por SPV: egresos clasificados por bucket fiscal US, ingresos y resumen para el CPA">
          <FolderDown className="w-4 h-4" />
          {taxBusy ? 'Generando…' : `Paquete contador ${year}`}
        </button>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'var(--brand-cream2)' }}>
          {[
            { key: "flow", label: "Flujo de caja", icon: Activity },
            { key: "ratios", label: "Ratios por proyecto", icon: Briefcase },
            { key: "audit", label: "Auditoría / historial", icon: History },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className="px-5 py-3 text-sm font-bold transition-all inline-flex items-center gap-2"
                style={
                  tab === t.key
                    ? { background: 'var(--bg-surface-2)', color: 'var(--text-primary)', borderBottom: '2px solid var(--accent)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* === TAB: Flujo === */}
      {tab === "flow" && (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
                <TrendingUp size={14} className="text-emerald-600" /> Fuentes (de dónde viene el dinero)
              </h2>
              {!sources?.sources || sources.sources.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--brand-teal2)' }}>Sin ingresos registrados.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={sources.sources.slice(0, 8)} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,75,82,0.1)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "var(--brand-teal3)" }} tickFormatter={(v) => usd(v, { compact: true })} />
                      <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "var(--inf)" }} width={150} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v)} />
                      <Bar dataKey="amount" fill="var(--ok)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
                <TrendingDown size={14} className="text-red-600" /> Usos (a dónde va el dinero)
              </h2>
              {!sources?.uses || sources.uses.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--brand-teal2)' }}>Sin egresos registrados.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={sources.uses.slice(0, 8)} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,75,82,0.1)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "var(--brand-teal3)" }} tickFormatter={(v) => usd(v, { compact: true })} />
                      <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "var(--inf)" }} width={150} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v)} />
                      <Bar dataKey="amount" fill="var(--err)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
                <Activity size={14} style={{ color: 'var(--brand-gold)' }} /> Flujo de caja mensual {year}
              </h2>
              <select className="select" value={year} onChange={(e) => setYear(+e.target.value)}>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={cashflow?.months || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,75,82,0.1)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--inf)" }} tickFormatter={(m) => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1]} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--brand-teal3)" }} tickFormatter={(v) => usd(v, { compact: true })} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="ingresos" stroke="var(--ok)" strokeWidth={2} name="Ingresos" />
                  <Line type="monotone" dataKey="egresos" stroke="var(--err)" strokeWidth={2} name="Egresos" />
                  <Line type="monotone" dataKey="neto" stroke="var(--accent)" strokeWidth={2} name="Neto" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* === TAB: Ratios === */}
      {tab === "ratios" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'var(--brand-cream2)' }}>
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
              <Briefcase size={15} style={{ color: 'var(--brand-gold)' }} /> Ratios financieros por proyecto
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--brand-teal2)' }}>
              LTV (Loan-to-Value) · LTC (Loan-to-Cost) · Margen proyectado · Semáforos: 🟢 saludable · 🟡 atención · 🔴 crítico
            </p>
          </div>
          {!ratios?.projects || ratios.projects.length === 0 ? (
            <p className="text-sm py-12 text-center" style={{ color: 'var(--brand-teal2)' }}>Sin proyectos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'rgba(45,75,82,0.04)' }}>
                  <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                    <th className="px-3 py-3 text-left font-semibold">Proyecto</th>
                    <th className="px-3 py-3 text-right font-semibold">ARV</th>
                    <th className="px-3 py-3 text-right font-semibold">Costo total</th>
                    <th className="px-3 py-3 text-right font-semibold">Equity</th>
                    <th className="px-3 py-3 text-right font-semibold">Deuda viva</th>
                    <th className="px-3 py-3 text-center font-semibold">LTV</th>
                    <th className="px-3 py-3 text-center font-semibold">LTC</th>
                    <th className="px-3 py-3 text-center font-semibold">% Ejecutado</th>
                    <th className="px-3 py-3 text-center font-semibold">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {ratios.projects.map((p: any) => {
                    const lightColor = (l: string) => l === "green" ? "🟢" : l === "yellow" ? "🟡" : "🔴";
                    return (
                      <tr key={p.id} className="table-row" style={{ borderBottom: '1px solid rgba(45,75,82,0.06)' }}>
                        <td className="px-3 py-3">
                          <Link to={`/finance/projects/${p.id}`} className="font-semibold hover:underline" style={{ color: 'var(--brand-teal)' }}>{p.name}</Link>
                          <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--brand-teal2)' }}>{p.code} · {p.spv}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(p.arv, { compact: true })}</td>
                        <td className="px-3 py-3 text-right font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(p.expectedCost, { compact: true })}</td>
                        <td className="px-3 py-3 text-right font-mono text-emerald-600">{usd(p.equity, { compact: true })}</td>
                        <td className="px-3 py-3 text-right font-mono text-red-600">{usd(p.debtOutstanding, { compact: true })}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>{pct(p.ratios.ltv)}</div>
                          <div className="text-[10px]">{lightColor(p.lights.ltv)}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>{pct(p.ratios.ltc)}</div>
                          <div className="text-[10px]">{lightColor(p.lights.ltc)}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>{pct(p.ratios.completionPct)}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className={cls("font-mono font-bold", p.ratios.margenPct >= 0 ? "text-emerald-600" : "text-red-600")}>{pct(p.ratios.margenPct)}</div>
                          <div className="text-[10px]">{lightColor(p.lights.margin)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === TAB: Audit log === */}
      {tab === "audit" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'var(--brand-cream2)' }}>
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
              <History size={15} style={{ color: 'var(--brand-gold)' }} /> Historial de operaciones
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--brand-teal2)' }}>
              Últimas 100 operaciones críticas: crear / editar / borrar movimientos, restore, wipe-all
            </p>
          </div>
          {!auditLog || auditLog.length === 0 ? (
            <p className="text-sm py-12 text-center" style={{ color: 'var(--brand-teal2)' }}>Sin operaciones registradas todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'rgba(45,75,82,0.04)' }}>
                  <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                    <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-3 py-3 text-left font-semibold">Acción</th>
                    <th className="px-3 py-3 text-left font-semibold">Entidad</th>
                    <th className="px-3 py-3 text-left font-semibold">Detalle</th>
                    <th className="px-3 py-3 text-left font-semibold">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((log: any) => {
                    const Icon = ACTION_ICON[log.action] || FileText;
                    const colorClass = ACTION_COLOR[log.action] || "text-stone-600 bg-stone-50 border-stone-200";
                    return (
                      <tr key={log.id} className="table-row" style={{ borderBottom: '1px solid rgba(45,75,82,0.06)' }}>
                        <td className="px-3 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--brand-teal2)' }}>
                          {dateShort(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cls("badge border text-[10px] inline-flex items-center gap-1", colorClass)}>
                            <Icon size={10} /> {log.action}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs font-mono" style={{ color: 'var(--brand-teal2)' }}>
                          {log.entity}{log.entityId ? `#${log.entityId}` : ""}
                        </td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--brand-teal)' }}>{log.detail || "—"}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--brand-teal2)' }}>{log.user || "system"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
