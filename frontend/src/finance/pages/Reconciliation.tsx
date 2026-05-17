import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { API } from "../lib/api";
import { usd, dateShort, cls } from "../lib/format";
import { AlertCircle, FileCheck, ShieldQuestion, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

export default function Reconciliation() {
  const qc = useQueryClient();
  const { data: needsReview } = useQuery({
    queryKey: ["movements-review"],
    queryFn: () => API.listMovements({ needsReview: "true", limit: 500 }),
  });
  const { data: unreconciled } = useQuery({
    queryKey: ["movements-unreconciled"],
    queryFn: () => API.listMovements({ isReconciled: "false", limit: 500 }),
  });
  const { data: dashboard } = useQuery({ queryKey: ["dashboard"], queryFn: API.getDashboard });

  const detect = useMutation({
    mutationFn: API.detectIntercompany,
    onSuccess: (r) => { toast.success(`${r.linked} pares vinculados`); qc.invalidateQueries(); },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Conciliación</h1>
          <p className="text-sm text-slate-400">Movimientos ambiguos, sin conciliar, alertas y detección automática</p>
        </div>
        <button className="btn-primary" onClick={() => detect.mutate()} disabled={detect.isPending}>
          <Sparkles size={14} /> Detectar intercompany
        </button>
      </div>

      {/* Alertas activas */}
      {dashboard?.alerts && dashboard.alerts.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertCircle size={14} /> Alertas activas</h2>
          <div className="grid md:grid-cols-2 gap-2">
            {dashboard.alerts.map((a: any) => (
              <div key={a.code} className={cls(
                "card-soft p-3 flex items-center justify-between",
                a.severity === "red" ? "border-red-500/30" : a.severity === "warn" ? "border-warn/30" : ""
              )}>
                <span className="text-sm">{a.message}</span>
                <span className="font-mono text-sm">{a.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movimientos por revisar */}
      <div className="card">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2"><ShieldQuestion size={14} /> Por revisar ({needsReview?.movements?.length || 0})</h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {!needsReview?.movements?.length && <tr><td className="p-4 text-center text-slate-500">Ningún movimiento marcado para revisar.</td></tr>}
            {needsReview?.movements?.map((m: any) => (
              <tr key={m.id} className="border-b border-line/50 table-row">
                <td className="px-3 py-2 text-xs font-mono w-24">{dateShort(m.date)}</td>
                <td className="px-3 py-2">{m.concept}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{m.account?.name}</td>
                <td className="px-3 py-2 text-right font-mono">{usd(m.amount)}</td>
                <td className="px-3 py-2 text-right"><Link to={`/movements/${m.id}`} className="text-accent hover:underline">Revisar →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sin conciliar */}
      <div className="card">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold flex items-center gap-2"><FileCheck size={14} /> Sin conciliar ({unreconciled?.movements?.length || 0})</h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {unreconciled?.movements?.slice(0, 50).map((m: any) => (
              <tr key={m.id} className="border-b border-line/50 table-row">
                <td className="px-3 py-2 text-xs font-mono w-24">{dateShort(m.date)}</td>
                <td className="px-3 py-2">{m.concept}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{m.account?.name}</td>
                <td className="px-3 py-2 text-right font-mono">{usd(m.amount)}</td>
                <td className="px-3 py-2 text-right"><Link to={`/movements/${m.id}`} className="text-accent hover:underline">→</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {unreconciled && unreconciled.movements && unreconciled.movements.length > 50 && (
          <div className="px-4 py-2 text-xs text-slate-500">Mostrando 50 de {unreconciled.movements.length}.</div>
        )}
      </div>
    </div>
  );
}
