import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, dateShort, cls } from "../lib/format";
import { ArrowLeft, FileText, Upload, Trash2, Link2, Unlink, AlertCircle, FileCheck } from "lucide-react";
import toast from "react-hot-toast";

export default function MovementDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const mid = +(id || 0);

  const { data: m } = useQuery({ queryKey: ["movement", mid], queryFn: () => API.getMovement(mid), enabled: !!mid });

  const updateMutation = useMutation({
    mutationFn: (data: any) => API.updateMovement(mid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movement", mid] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      toast.success("Actualizado");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => API.uploadMovementDoc(mid, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movement", mid] });
      toast.success("Soporte cargado");
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => API.deleteMovementDoc(mid, docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movement", mid] });
      toast.success("Soporte eliminado");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => API.unlinkMovement(mid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movement", mid] }),
  });

  if (!m) return <div className="text-slate-400">Cargando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/finance/movements" className="btn-ghost"><ArrowLeft size={14} /> Movimientos</Link>
        <div className="flex gap-2">
          <button
            className={cls("btn-secondary", m.needsReview && "text-warn")}
            onClick={() => updateMutation.mutate({ needsReview: !m.needsReview })}
          >
            <AlertCircle size={14} /> {m.needsReview ? "Quitar marca revisar" : "Marcar por revisar"}
          </button>
          <button
            className={cls("btn-secondary", m.isReconciled && "text-positive")}
            onClick={() => updateMutation.mutate({ isReconciled: !m.isReconciled })}
          >
            <FileCheck size={14} /> {m.isReconciled ? "Conciliado" : "Marcar conciliado"}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="grid md:grid-cols-3 gap-4">
          <div><span className="label">Fecha</span><div className="text-lg font-mono">{dateShort(m.date)}</div></div>
          <div><span className="label">Tipo</span><div className="text-lg">{m.type}</div></div>
          <div><span className="label">Monto</span>
            <div className={cls("text-2xl font-mono font-semibold",
              m.type === "Ingreso" ? "text-positive" : m.type === "Egreso" ? "text-negative" : "text-accent"
            )}>{usd(m.amount)}</div>
          </div>
          <div className="md:col-span-3"><span className="label">Concepto</span><div className="text-base">{m.concept}</div></div>
          <div><span className="label">Cuenta</span><div>{m.account?.name}</div></div>
          {m.destAccount && <div><span className="label">Cuenta destino</span><div>{m.destAccount?.name}</div></div>}
          {m.category && <div><span className="label">Categoría</span><div>{m.category.name}</div></div>}
          {m.origin && <div><span className="label">Origen</span><div>{m.origin.name}</div></div>}
          {m.provider && <div><span className="label">Proveedor</span><div>{m.provider.name}</div></div>}
          {m.project && <div><span className="label">Proyecto</span><div><Link className="hover:text-accent" to={`/projects/${m.project.id}`}>{m.project.code} · {m.project.name}</Link></div></div>}
          {m.partner && <div><span className="label">Socio</span><div>{m.partner.code} · {m.partner.fullName}</div></div>}
          {m.lender && <div><span className="label">Lender</span><div>{m.lender.name}</div></div>}
          {m.notes && <div className="md:col-span-3"><span className="label">Notas</span><div className="text-sm text-slate-300">{m.notes}</div></div>}
        </div>

        <div className="border-t border-line mt-5 pt-4 flex items-center gap-3 flex-wrap text-xs">
          {m.isIntercompany && (
            <span className="badge bg-accent/15 text-accent border border-accent/30">
              <Link2 size={11} className="mr-1" /> Intercompany
              {m.linkedMovementId && <Link to={`/movements/${m.linkedMovementId}`} className="ml-2 underline">→ ver par</Link>}
            </span>
          )}
          {m.isEquity && <span className="badge bg-positive/10 text-positive">Equity socio</span>}
          {m.isLoan && <span className="badge bg-warn/10 text-warn">Préstamo</span>}
          {m.isLoanRepayment && <span className="badge bg-warn/10 text-warn">Devolución préstamo</span>}
          {m.isIntercompany && (
            <button onClick={() => unlinkMutation.mutate()} className="btn-ghost"><Unlink size={12} /> Desvincular</button>
          )}
        </div>
      </div>

      {/* Soportes */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Soportes documentales</h2>
          <label className="btn-primary cursor-pointer">
            <Upload size={14} /> Subir archivo
            <input
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); }}
            />
          </label>
        </div>
        {!m.documents || m.documents.length === 0 ? (
          <p className="text-sm text-slate-500">Sin soportes. Adjunta facturas, recibos o evidencia.</p>
        ) : (
          <ul className="space-y-1">
            {m.documents.map((d: any) => (
              <li key={d.id} className="flex items-center justify-between p-2 card-soft">
                <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-accent">
                  <FileText size={14} /> {d.filename} <span className="text-xs text-slate-500">· {(d.size / 1024).toFixed(0)} KB</span>
                </a>
                <button onClick={() => deleteDocMutation.mutate(d.id)} className="btn-ghost text-negative p-1"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
