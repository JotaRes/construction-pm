import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, pct, dateShort, cls } from "../lib/format";
import { KPI } from "../components/KPI";
import { ArrowLeft, TrendingUp, Wallet, Banknote, Upload, FileText } from "lucide-react";
import toast from "react-hot-toast";

export default function ProjectDetail() {
  const { id } = useParams();
  const pid = +(id || 0);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["project-summary", pid], queryFn: () => API.getProjectSummary(pid), enabled: !!pid });
  const { data: full } = useQuery({ queryKey: ["project-full", pid], queryFn: () => API.getProject(pid), enabled: !!pid });

  const upload = useMutation({
    mutationFn: (file: File) => API.uploadProjectDoc(pid, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-full", pid] }); toast.success("Documento subido"); },
  });

  if (!data || !full) return <div className="text-slate-400">Cargando…</div>;
  const k = data.kpis;
  const p = data.project;

  return (
    <div className="space-y-5">
      <Link to="/projects" className="btn-ghost"><ArrowLeft size={14} /> Proyectos</Link>

      <div className="card p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-slate-500 font-mono">{p.code}</div>
            <h1 className="text-2xl font-semibold">{p.name}</h1>
            <div className="text-sm text-slate-400 mt-1">{full.spv?.name || "Sin SPV"} · {p.line || "—"} · {p.model || "—"} · <span className="badge bg-bg-hover">{p.status}</span></div>
            {p.address && <div className="text-xs text-slate-500 mt-1">{p.address}</div>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-right">
            <div><span className="label">ARV</span><div className="font-mono font-semibold">{usd(p.arv)}</div></div>
            <div><span className="label">Costo esperado</span><div className="font-mono">{usd(p.expectedCost)}</div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPI label="Ingresos" value={usd(k.ingresos, { compact: true })} tone="positive" />
        <KPI label="Egresos" value={usd(k.egresos, { compact: true })} tone="negative" />
        <KPI label="Neto" value={usd(k.neto, { compact: true })} tone={k.neto >= 0 ? "positive" : "negative"} />
        <KPI label="Equity inyectado" value={usd(k.equityTotal, { compact: true })} icon={<Wallet size={14} />} />
        <KPI label="Deuda recibida" value={usd(k.debtTotal, { compact: true })} icon={<Banknote size={14} />} hint={`Viva: ${usd(k.debtOutstanding, { compact: true })}`} />
        <KPI label="ROI est." value={pct(k.roiEst)} icon={<TrendingUp size={14} />} tone={k.roiEst >= 0 ? "positive" : "negative"} hint={`% costo: ${pct(k.pctCosto)}`} />
      </div>

      {/* Movimientos */}
      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-sm font-semibold">Movimientos asociados ({full.movements?.length || 0})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-left">Cuenta</th>
              <th className="px-3 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {full.movements?.map((m: any) => (
              <tr key={m.id} className="border-b border-line/50 table-row">
                <td className="px-3 py-2 text-xs font-mono">{dateShort(m.date)}</td>
                <td className="px-3 py-2 text-xs">{m.type}</td>
                <td className="px-3 py-2 max-w-[300px] truncate"><Link to={`/movements/${m.id}`} className="hover:text-accent">{m.concept}</Link></td>
                <td className="px-3 py-2 text-xs text-slate-400">{m.category?.name || m.origin?.name || "—"}</td>
                <td className="px-3 py-2 text-xs">{m.account?.name}</td>
                <td className={cls("px-3 py-2 text-right font-mono", m.type === "Ingreso" ? "text-positive" : "text-negative")}>{usd(m.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Capital aportado al proyecto */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Equity inyectado</h2>
          {data.capitalContribs.length === 0 ? <p className="text-sm text-slate-500">Sin aportes registrados.</p> : (
            <ul className="space-y-2">
              {data.capitalContribs.map((c: any) => (
                <li key={c.id} className="flex justify-between text-sm card-soft p-2">
                  <span>{dateShort(c.date)} · {c.partner?.code} · {c.concept}</span>
                  <span className="font-mono text-positive">{usd(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Préstamos asociados</h2>
          {data.loans.length === 0 ? <p className="text-sm text-slate-500">Sin préstamos.</p> : (
            <ul className="space-y-2">
              {data.loans.map((l: any) => (
                <li key={l.id} className="flex justify-between text-sm card-soft p-2">
                  <span>{dateShort(l.date)} · {l.lender?.name}{l.interestRate ? ` · ${l.interestRate}%` : ""}</span>
                  <span className="font-mono">{usd(l.amount, { compact: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Documentos del proyecto */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Documentos del proyecto</h2>
          <label className="btn-primary cursor-pointer">
            <Upload size={14} /> Subir archivo
            <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
          </label>
        </div>
        {!full.documents || full.documents.length === 0 ? (
          <p className="text-sm text-slate-500">Sin documentos. Adjunta escrituras, contratos, planos, facturas globales.</p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-2">
            {full.documents.map((d: any) => (
              <li key={d.id} className="card-soft p-2 flex items-center justify-between">
                <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-accent">
                  <FileText size={14} /> {d.filename}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
