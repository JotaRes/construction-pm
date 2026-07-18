import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { API } from "../lib/api";
import { dateShort, cls } from "../lib/format";
import { Upload, FileSpreadsheet, Trash2, ChevronRight, AlertCircle, CheckCircle2, FileText, Info, Download, Mail, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirm } from "../../components/ConfirmDialog";

export default function Statements() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const { data } = useQuery({ queryKey: ["statements"], queryFn: API.listStatements });
  const [accountId, setAccountId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string; details?: any } | null>(null);

  const del = useMutation({
    mutationFn: (id: number) => API.deleteStatement(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["statements"] }); toast.success("Extracto eliminado"); },
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!accountId) {
      toast.error("Selecciona primero la cuenta bancaria");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setLastResult(null);
    try {
      const res = await API.uploadStatement(+accountId, f);
      const linesCount = res.statement.lines?.length || 0;
      const matched = res.reconciliation?.matched || 0;
      const created = res.reconciliation?.created || 0;
      toast.success(`Extracto procesado: ${linesCount} líneas, ${matched} conciliadas con movimientos existentes`);
      setLastResult({
        ok: true,
        message: `Procesado exitosamente`,
        details: { linesCount, matched, created, filename: f.name },
      });
      qc.invalidateQueries({ queryKey: ["statements"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["unreconciledLines"] });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Error al subir extracto";
      toast.error(msg, { duration: 6000 });
      setLastResult({ ok: false, message: msg });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-5 page-content">
      <div>
        <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><FileText className="w-[22px] h-[22px]" strokeWidth={2.2} /></span><span>Extractos bancarios</span></h1>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>
          Sube CSV, Excel o PDF · El sistema concilia automáticamente con tus movimientos manuales para detectar omisiones
        </p>
      </div>

      {/* Información explicativa */}
      <div className="card p-4 flex items-start gap-3" style={{ background: 'var(--brand-cream2)' }}>
        <Info size={18} style={{ color: 'var(--brand-gold)', flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm" style={{ color: 'var(--brand-teal)' }}>
          <strong>¿Cómo funciona?</strong> Al subir un extracto, el sistema:
          <ol className="list-decimal ml-5 mt-1 space-y-0.5 text-xs" style={{ color: 'var(--brand-teal2)' }}>
            <li>Lee cada línea (fecha, concepto, monto)</li>
            <li>Compara con los movimientos que registraste manualmente</li>
            <li>Marca como <span className="text-emerald-600 font-semibold">coincide</span> los que están en ambos lados</li>
            <li>Te alerta de los que están en el extracto pero no registraste (te falta capturar) — aparecen en <Link to="/finance/movements" className="font-semibold hover:underline" style={{ color: 'var(--brand-gold)' }}>Movimientos</Link></li>
          </ol>
        </div>
      </div>

      {/* Subir nuevo extracto */}
      <div className="card p-5">
        <h2 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
          <Upload size={16} style={{ color: 'var(--brand-gold)' }} /> Subir nuevo extracto
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="label">Cuenta bancaria *</label>
            <select className="select w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— seleccionar cuenta —</option>
              {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.bank})</option>)}
            </select>
          </div>
          <label className={cls(
            "btn-primary cursor-pointer",
            (uploading || !accountId) && "opacity-60 pointer-events-none"
          )}>
            <Upload size={14} />
            {uploading ? "Procesando..." : "Subir archivo"}
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.pdf"
              onChange={onFile}
              disabled={uploading || !accountId}
            />
          </label>
        </div>

        <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(29,29,31,0.08)' }}>
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-teal)' }}>Formatos y columnas soportadas:</div>
          <ul className="text-xs space-y-0.5" style={{ color: 'var(--brand-teal2)' }}>
            <li>✓ <span className="font-mono">CSV</span> · <span className="font-mono">.xlsx</span> · <span className="font-mono">.xls</span> · <span className="font-mono">.pdf</span></li>
            <li>✓ Detecta columnas: <span className="font-mono">Fecha/Date</span>, <span className="font-mono">Descripción/Memo</span>, <span className="font-mono">Monto/Amount</span> o <span className="font-mono">Debit/Credit</span></li>
            <li>✓ Compatible con Ocean Bank, Chase, Bank of America, Wells Fargo</li>
          </ul>
        </div>

        {/* Feedback del último upload */}
        {lastResult && (
          <div className={cls(
            "mt-3 p-3 rounded-lg flex items-start gap-2",
            lastResult.ok ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
          )}>
            {lastResult.ok ? (
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              <div className={lastResult.ok ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}>
                {lastResult.message}
              </div>
              {lastResult.ok && lastResult.details && (
                <div className="text-xs text-emerald-600 mt-1">
                  Archivo: <span className="font-mono">{lastResult.details.filename}</span> · {lastResult.details.linesCount} líneas extraídas
                  {lastResult.details.matched > 0 && ` · ${lastResult.details.matched} conciliadas`}
                </div>
              )}
              {!lastResult.ok && (
                <div className="text-xs text-red-600 mt-1">
                  Verifica que el archivo tenga columnas Fecha, Concepto y Monto. Si el formato es de tu banco específico, asegúrate que las columnas sean reconocibles.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista de extractos cargados */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(29,29,31,0.1)', background: 'var(--brand-cream2)' }}>
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
            <FileText size={16} style={{ color: 'var(--brand-gold)' }} /> Extractos cargados
          </h2>
          <span className="text-xs font-semibold" style={{ color: 'var(--brand-teal2)' }}>{data?.length || 0} archivos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(29,29,31,0.04)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                <th className="px-4 py-3 text-left font-semibold">Archivo</th>
                <th className="px-4 py-3 text-left font-semibold">Cuenta</th>
                <th className="px-4 py-3 text-left font-semibold">Período</th>
                <th className="px-4 py-3 text-right font-semibold">Líneas</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {!data || data.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center" style={{ color: 'var(--brand-teal2)' }}>
                  <FileSpreadsheet size={36} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                  Aún no hay extractos cargados. Sube tu primer archivo arriba.
                </td></tr>
              ) : data.map((s: any) => (
                <tr key={s.id} className="table-row" style={{ borderBottom: '1px solid rgba(29,29,31,0.06)' }}>
                  <td className="px-4 py-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
                    <FileSpreadsheet size={14} style={{ color: 'var(--brand-gold)' }} />
                    <span className="font-medium">{s.filename}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--brand-teal2)' }}>{s.account?.name}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--brand-teal2)' }}>
                    {dateShort(s.periodStart)} → {dateShort(s.periodEnd)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>
                    {s._count?.lines || 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1 items-center">
                      {s.url ? (
                        <>
                          <a href={s.url} target="_blank" rel="noreferrer" className="btn-ghost p-1" title="Ver archivo original">
                            <FileText size={14} />
                          </a>
                          <a href={s.url} download className="btn-ghost p-1" title="Descargar archivo">
                            <Download size={14} />
                          </a>
                          <a
                            href={`mailto:?subject=${encodeURIComponent(`Extracto ${s.account?.name ?? ''} ${dateShort(s.periodStart)}–${dateShort(s.periodEnd)}`)}&body=${encodeURIComponent(`Adjunto el extracto bancario:\n\n${s.url}`)}`}
                            className="btn-ghost p-1"
                            title="Enviar por email"
                          >
                            <Mail size={14} />
                          </a>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`Extracto ${s.account?.name ?? ''} ${dateShort(s.periodStart)}–${dateShort(s.periodEnd)}\n${s.url}`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-ghost p-1"
                            title="Compartir por WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </a>
                        </>
                      ) : (
                        <span className="text-[10px] italic mr-2" style={{ color: 'var(--brand-teal2)' }} title="Sube el extracto de nuevo para ver/descargar el archivo">
                          archivo no guardado
                        </span>
                      )}
                      <Link to={`/finance/statements/${s.id}`} className="btn-ghost p-1" title="Ver detalle de líneas">
                        <ChevronRight size={14} />
                      </Link>
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Eliminar extracto bancario',
                            message: `¿Seguro que quieres eliminar el extracto "${s.filename}"?`,
                            detail: `Se eliminarán también todas las líneas del extracto y la conciliación con movimientos.`,
                            destructive: true,
                            confirmText: 'Sí, eliminar',
                          })
                          if (ok) del.mutate(s.id);
                        }}
                        className="btn-ghost p-1 text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
