import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, dateShort, cls } from "../lib/format";
import { ArrowLeft, RefreshCcw, Plus } from "lucide-react";
import toast from "react-hot-toast";

const STATUS_BADGE: Record<string, string> = {
  unmatched: "bg-warn/10 text-warn border-warn/30",
  matched_exact: "bg-positive/10 text-positive border-positive/30",
  matched_approx: "bg-accent/10 text-accent border-accent/30",
  matched_manual: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  created: "bg-purple-500/10 text-purple-300 border-purple-500/30",
};

export default function StatementDetail() {
  const { id } = useParams();
  const sid = +(id || 0);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["statement", sid], queryFn: () => API.getStatement(sid), enabled: !!sid });

  const reconcile = useMutation({
    mutationFn: () => API.reconcileStatement(sid),
    onSuccess: (r) => { toast.success(`${r.matched} de ${r.totalLines} conciliados`); qc.invalidateQueries({ queryKey: ["statement", sid] }); },
  });

  const createMov = useMutation({
    mutationFn: (lineId: number) => API.createMovementFromLine(lineId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["statement", sid] }); toast.success("Movimiento creado"); },
  });

  if (!data) return <div className="text-slate-400">Cargando…</div>;

  const matched = data.lines.filter((l: any) => l.matchStatus !== "unmatched").length;
  const unmatched = data.lines.length - matched;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/statements" className="btn-ghost"><ArrowLeft size={14} /> Extractos</Link>
        <button className="btn-secondary" onClick={() => reconcile.mutate()} disabled={reconcile.isPending}>
          <RefreshCcw size={14} /> {reconcile.isPending ? "Conciliando..." : "Re-conciliar"}
        </button>
      </div>

      <div className="card p-4">
        <h2 className="font-semibold text-lg">{data.filename}</h2>
        <p className="text-sm text-slate-400">{data.account?.name} · {dateShort(data.periodStart)} → {dateShort(data.periodEnd)}</p>
        <div className="flex gap-4 mt-3 text-sm">
          <span><strong className="text-positive">{matched}</strong> conciliadas</span>
          <span><strong className="text-warn">{unmatched}</strong> pendientes</span>
          <span><strong>{data.lines.length}</strong> líneas totales</span>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Descripción</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l: any) => (
              <tr key={l.id} className="border-b border-line/50 table-row">
                <td className="px-3 py-2 text-xs font-mono">{dateShort(l.date)}</td>
                <td className="px-3 py-2">{l.description}</td>
                <td className={cls("px-3 py-2 text-right font-mono", l.type === "credit" ? "text-positive" : "text-negative")}>{usd(l.amount)}</td>
                <td className="px-3 py-2 text-xs">{l.type === "credit" ? "Ingreso" : "Egreso"}</td>
                <td className="px-3 py-2"><span className={cls("badge border", STATUS_BADGE[l.matchStatus])}>{l.matchStatus}</span></td>
                <td className="px-3 py-2 text-right">
                  {l.matchStatus === "unmatched" && (
                    <button onClick={() => createMov.mutate(l.id)} className="btn-secondary text-xs"><Plus size={12} /> Crear movimiento</button>
                  )}
                  {l.matchedMovementId && (
                    <Link to={`/movements/${l.matchedMovementId}`} className="text-xs text-accent hover:underline">Ver movimiento →</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
