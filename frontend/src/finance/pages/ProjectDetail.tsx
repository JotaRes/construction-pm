import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, pct, dateShort, cls } from "../lib/format";
import {
  ArrowLeft, TrendingUp, Wallet, Banknote, Upload, FileText,
  Briefcase, Target, DollarSign, Activity, AlertTriangle,
  MapPin, Layers, Calendar, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";

export default function ProjectDetail() {
  const { id } = useParams();
  const pid = +(id || 0);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["project-summary", pid], queryFn: () => API.getProjectSummary(pid), enabled: !!pid });
  const { data: full } = useQuery({ queryKey: ["project-full", pid], queryFn: () => API.getProject(pid), enabled: !!pid });

  const upload = useMutation({
    mutationFn: (file: File) => API.uploadProjectDoc(pid, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-full", pid] }); toast.success("Documento subido"); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al subir"),
  });

  if (isLoading || !data || !full) {
    return (
      <div className="space-y-4 page-content">
        <Link to="/finance/projects" className="btn-ghost inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} /> Proyectos</Link>
        <div className="card p-12 text-center" style={{ color: 'var(--brand-teal)' }}>Cargando datos del proyecto…</div>
      </div>
    );
  }

  const k = data.kpis;
  const p = data.project;

  // Métricas adicionales calculadas
  const costoTotal = p.purchasePrice + k.egresos;
  const gananciaProyectada = (p.arv || 0) - costoTotal;
  const margenProyectado = p.arv > 0 ? gananciaProyectada / p.arv : 0;
  const pctEjecutado = p.expectedCost > 0 ? k.egresos / p.expectedCost : 0;
  const cashIn = p.cashIn || 0;

  const statusColor =
    p.status === "Vendido" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    p.status === "En Construcción" ? "bg-amber-100 text-amber-700 border-amber-200" :
    p.status === "Pausado" ? "bg-stone-100 text-stone-600 border-stone-200" :
    p.status === "Cerrado" ? "bg-red-50 text-red-600 border-red-200" :
    "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <div className="space-y-5 page-content">
      <Link to="/finance/projects" className="btn-ghost inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={14} /> Proyectos
      </Link>

      {/* Header del proyecto */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: 'linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-gold) 100%)' }} />
        <div className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,113,227,0.12)', color: 'var(--brand-gold)' }}
              >
                <Briefcase size={28} />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--brand-teal2)' }}>{p.code}</div>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-teal)' }}>{p.name}</h1>
                <div className="flex items-center gap-2 flex-wrap text-sm mt-2">
                  {full.spv?.name && (
                    <span className="px-2 py-1 rounded font-mono text-xs" style={{ background: 'rgba(29,29,31,0.08)', color: 'var(--brand-teal)' }}>
                      <Layers size={12} className="inline mr-1" /> {full.spv.name}
                    </span>
                  )}
                  {p.line && (
                    <span className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(0,113,227,0.1)', color: 'var(--brand-gold)' }}>
                      {p.line}
                    </span>
                  )}
                  {p.model && (
                    <span className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(29,29,31,0.04)', color: 'var(--brand-teal2)' }}>
                      {p.model}
                    </span>
                  )}
                  <span className={cls("badge border", statusColor)}>{p.status}</span>
                </div>
                {p.address && (
                  <div className="flex items-center gap-1 text-sm mt-2" style={{ color: 'var(--brand-teal2)' }}>
                    <MapPin size={13} /> {p.address}
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>Ganancia proyectada</div>
              <div className={cls("text-3xl font-bold font-mono", gananciaProyectada >= 0 ? "text-emerald-600" : "text-red-600")}>
                {usd(gananciaProyectada)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--brand-teal2)' }}>
                Margen: <span className={cls("font-semibold font-mono", margenProyectado >= 0 ? "text-emerald-600" : "text-red-600")}>{pct(margenProyectado)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === MÉTRICAS PRINCIPALES === */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="kpi-card kpi-card-gold">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>ARV</span>
            <Target size={12} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(p.arv, { compact: true })}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>Valor proyectado</div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Costo esperado</span>
            <DollarSign size={12} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(p.expectedCost, { compact: true })}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>Presupuesto inicial</div>
        </div>
        <div className="kpi-card kpi-card-green">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Ingresos</span>
            <ArrowDownLeft size={12} className="text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600">{usd(k.ingresos, { compact: true })}</div>
        </div>
        <div className="kpi-card kpi-card-red">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Egresos</span>
            <ArrowUpRight size={12} className="text-red-600" />
          </div>
          <div className="text-xl font-bold font-mono text-red-600">{usd(k.egresos, { compact: true })}</div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Costo acumulado</span>
            <Activity size={12} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(costoTotal, { compact: true })}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>Compra + egresos</div>
        </div>
        <div className={cls("kpi-card", k.roiEst >= 0 ? "kpi-card-green" : "kpi-card-red")}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>ROI estimado</span>
            <TrendingUp size={12} className={k.roiEst >= 0 ? "text-emerald-600" : "text-red-600"} />
          </div>
          <div className={cls("text-xl font-bold font-mono", k.roiEst >= 0 ? "text-emerald-600" : "text-red-600")}>
            {pct(k.roiEst)}
          </div>
        </div>
      </div>

      {/* === ANÁLISIS PROYECTADO: VENTA VS COSTO === */}
      <div className="card p-5">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
          <Target size={16} style={{ color: 'var(--brand-gold)' }} /> Proyección venta vs. costo
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl" style={{ background: 'var(--brand-cream2)' }}>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--brand-teal2)' }}>1) Precio de compra</div>
            <div className="text-2xl font-bold font-mono mb-1" style={{ color: 'var(--brand-teal)' }}>{usd(p.purchasePrice)}</div>
            <div className="text-xs" style={{ color: 'var(--brand-teal2)' }}>Inversión inicial</div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'var(--brand-cream2)' }}>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--brand-teal2)' }}>2) Costo de construcción/renovación</div>
            <div className="text-2xl font-bold font-mono mb-1 text-red-600">{usd(k.egresos)}</div>
            <div className="text-xs" style={{ color: 'var(--brand-teal2)' }}>
              {pct(pctEjecutado)} del esperado ({usd(p.expectedCost, { compact: true })})
            </div>
            {/* Barra de progreso */}
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(29,29,31,0.1)' }}>
              <div
                className={cls(
                  "h-full transition-all",
                  pctEjecutado > 1 ? "bg-red-500" : pctEjecutado > 0.8 ? "bg-amber-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, pctEjecutado * 100)}%` }}
              />
            </div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: gananciaProyectada >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${gananciaProyectada >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--brand-teal2)' }}>3) Ganancia proyectada</div>
            <div className={cls("text-2xl font-bold font-mono mb-1", gananciaProyectada >= 0 ? "text-emerald-600" : "text-red-600")}>
              {usd(gananciaProyectada)}
            </div>
            <div className="text-xs" style={{ color: 'var(--brand-teal2)' }}>
              ARV {usd(p.arv, { compact: true })} − Costo total {usd(costoTotal, { compact: true })}
            </div>
          </div>
        </div>

        {/* Alertas */}
        {pctEjecutado > 1 && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <strong>Sobrecosto detectado:</strong> los egresos ({usd(k.egresos)}) superan el costo esperado ({usd(p.expectedCost)}) en {usd(k.egresos - p.expectedCost, { sign: true })}.
            </div>
          </div>
        )}
        {gananciaProyectada < 0 && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <strong>Proyecto en pérdida proyectada:</strong> Costo total ({usd(costoTotal)}) supera ARV ({usd(p.arv)}).
            </div>
          </div>
        )}
      </div>

      {/* === ESTRUCTURA DE CAPITAL === */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="kpi-card kpi-card-green">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Equity inyectado</span>
            <Wallet size={14} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{usd(k.equityTotal)}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--brand-teal2)' }}>{data.capitalContribs.length} aporte(s)</div>
        </div>
        <div className="kpi-card kpi-card-amber">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Deuda recibida</span>
            <Banknote size={14} className="text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600">{usd(k.debtTotal)}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--brand-teal2)' }}>
            Viva: <span className="font-mono">{usd(k.debtOutstanding, { compact: true })}</span> · {data.loans.length} préstamo(s)
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Cash In</span>
            <DollarSign size={14} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(cashIn)}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--brand-teal2)' }}>Capital propio total</div>
        </div>
      </div>

      {/* === MOVIMIENTOS ASOCIADOS === */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(29,29,31,0.1)', background: 'var(--brand-cream2)' }}>
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
            <Activity size={16} style={{ color: 'var(--brand-gold)' }} /> Movimientos del proyecto
          </h2>
          <span className="text-xs font-semibold" style={{ color: 'var(--brand-teal2)' }}>
            {full.movements?.length || 0} movimientos
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(29,29,31,0.04)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                <th className="px-4 py-3 text-left font-semibold">Cuenta</th>
                <th className="px-4 py-3 text-right font-semibold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {!full.movements || full.movements.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center" style={{ color: 'var(--brand-teal2)' }}>
                  Sin movimientos asociados a este proyecto todavía.
                </td></tr>
              ) : full.movements.map((m: any) => (
                <tr key={m.id} className="table-row" style={{ borderBottom: '1px solid rgba(29,29,31,0.06)' }}>
                  <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--brand-teal2)' }}>
                    <Calendar size={11} className="inline mr-1" /> {dateShort(m.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cls(
                      "badge border text-[10px]",
                      m.type === "Ingreso" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      m.type === "Egreso" ? "bg-red-50 text-red-700 border-red-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    )}>{m.type}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[280px] truncate" style={{ color: 'var(--brand-teal)' }}>
                    <Link to={`/finance/movements/${m.id}`} className="hover:underline font-medium" title={m.concept}>{m.concept}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--brand-teal2)' }}>
                    {m.category?.name || m.origin?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--brand-teal2)' }}>{m.account?.name || "—"}</td>
                  <td className={cls(
                    "px-4 py-3 text-right font-mono font-semibold",
                    m.type === "Ingreso" ? "text-emerald-600" : "text-red-600"
                  )}>{usd(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* === CAPITAL Y DEUDA === */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
            <Wallet size={16} style={{ color: 'var(--brand-gold)' }} /> Equity inyectado
          </h2>
          {data.capitalContribs.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--brand-teal2)' }}>Sin aportes de capital registrados.</p>
          ) : (
            <ul className="space-y-2">
              {data.capitalContribs.map((c: any) => (
                <li key={c.id} className="flex justify-between items-center p-3 rounded-lg text-sm" style={{ background: 'var(--brand-cream2)' }}>
                  <div className="min-w-0">
                    <div className="font-semibold truncate" style={{ color: 'var(--brand-teal)' }}>{c.concept}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                      {dateShort(c.date)} · {c.partner?.code} · {c.partner?.fullName}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-600">{usd(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
            <Banknote size={16} style={{ color: 'var(--brand-gold)' }} /> Préstamos asociados
          </h2>
          {data.loans.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--brand-teal2)' }}>Sin préstamos asociados.</p>
          ) : (
            <ul className="space-y-2">
              {data.loans.map((l: any) => (
                <li key={l.id} className="flex justify-between items-center p-3 rounded-lg text-sm" style={{ background: 'var(--brand-cream2)' }}>
                  <div className="min-w-0">
                    <div className="font-semibold truncate" style={{ color: 'var(--brand-teal)' }}>{l.lender?.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                      {dateShort(l.date)}
                      {l.interestRate ? ` · ${l.interestRate}% tasa` : ""}
                      {l.termMonths ? ` · ${l.termMonths}m` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-amber-600">{usd(l.amount, { compact: true })}</div>
                    {l.totalRepaid > 0 && (
                      <div className="text-[10px]" style={{ color: 'var(--brand-teal2)' }}>Pagado: {usd(l.totalRepaid, { compact: true })}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* === DOCUMENTOS === */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
            <FileText size={16} style={{ color: 'var(--brand-gold)' }} /> Documentos
          </h2>
          <label className="btn-primary cursor-pointer text-xs">
            <Upload size={13} /> Subir archivo
            <input
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }}
            />
          </label>
        </div>
        {!full.documents || full.documents.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--brand-teal2)' }}>
            Sin documentos. Adjunta escrituras, contratos, planos, facturas globales del proyecto.
          </p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-2">
            {full.documents.map((d: any) => (
              <li key={d.id} className="flex items-center justify-between p-3 rounded-lg text-sm" style={{ background: 'var(--brand-cream2)' }}>
                <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-medium hover:underline min-w-0 flex-1" style={{ color: 'var(--brand-teal)' }}>
                  <FileText size={14} style={{ color: 'var(--brand-gold)' }} className="flex-shrink-0" />
                  <span className="truncate">{d.filename}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
