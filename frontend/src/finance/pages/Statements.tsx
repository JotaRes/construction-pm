import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { API } from "../lib/api";
import { dateShort, cls } from "../lib/format";
import { Upload, FileSpreadsheet, Trash2, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

export default function Statements() {
  const qc = useQueryClient();
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const { data } = useQuery({ queryKey: ["statements"], queryFn: API.listStatements });
  const [accountId, setAccountId] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const del = useMutation({
    mutationFn: (id: number) => API.deleteStatement(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["statements"] }); toast.success("Eliminado"); },
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!accountId) { toast.error("Selecciona primero la cuenta"); return; }
    setUploading(true);
    try {
      const res = await API.uploadStatement(+accountId, f);
      toast.success(`Extracto subido: ${res.statement.lines.length} líneas, ${res.reconciliation.matched} conciliadas`);
      qc.invalidateQueries({ queryKey: ["statements"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al subir extracto");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Extractos bancarios</h1>
        <p className="text-sm text-slate-400">Sube CSV / Excel / PDF y el sistema concilia automáticamente con tus movimientos</p>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Subir nuevo extracto</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Cuenta bancaria</label>
            <select className="select w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— seleccionar —</option>
              {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.bank})</option>)}
            </select>
          </div>
          <label className={cls("btn-primary cursor-pointer", uploading && "opacity-60 pointer-events-none")}>
            <Upload size={14} /> {uploading ? "Procesando..." : "Subir archivo"}
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.pdf" onChange={onFile} disabled={uploading || !accountId} />
          </label>
        </div>
        <p className="text-xs text-slate-500 mt-2">Formatos soportados: CSV, Excel (.xlsx, .xls), PDF. El sistema buscará columnas tipo "Fecha", "Concepto", "Débito/Crédito".</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Archivo</th>
              <th className="px-3 py-2 text-left">Cuenta</th>
              <th className="px-3 py-2 text-left">Período</th>
              <th className="px-3 py-2 text-right">Líneas</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {!data || data.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">Aún no hay extractos cargados.</td></tr>
            ) : data.map((s: any) => (
              <tr key={s.id} className="border-b border-line/50 table-row">
                <td className="px-3 py-2 flex items-center gap-2"><FileSpreadsheet size={14} className="text-accent" /> {s.filename}</td>
                <td className="px-3 py-2 text-xs">{s.account?.name}</td>
                <td className="px-3 py-2 text-xs">{dateShort(s.periodStart)} → {dateShort(s.periodEnd)}</td>
                <td className="px-3 py-2 text-right font-mono">{s._count?.lines || 0}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <Link to={`/statements/${s.id}`} className="btn-ghost p-1"><ChevronRight size={14} /></Link>
                    <button onClick={() => del.mutate(s.id)} className="btn-ghost text-negative p-1"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
