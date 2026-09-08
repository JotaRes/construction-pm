import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, dateShort, cls } from "../lib/format";
import { ArrowLeft, RefreshCcw, Plus, Download, Mail, MessageCircle, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { useI18n } from '../../i18n'

const STATUS_BADGE: Record<string, string> = {
  unmatched: "bg-warn/10 text-warn border-warn/30",
  matched_exact: "bg-positive/10 text-positive border-positive/30",
  matched_approx: "bg-accent/10 text-accent border-accent/30",
  matched_manual: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  created: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]",
};

export default function StatementDetail() {
  const { t } = useI18n()
  const { id } = useParams();
  const sid = +(id || 0);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["statement", sid], queryFn: () => API.getStatement(sid), enabled: !!sid });

  const reconcile = useMutation({
    mutationFn: () => API.reconcileStatement(sid),
    onSuccess: (r) => { toast.success(t('fin.stmtDet.v0DeV1Conciliados', { v0: r.matched, v1: r.totalLines })); qc.invalidateQueries({ queryKey: ["statement", sid] }); },
  });

  const createMov = useMutation({
    mutationFn: (lineId: number) => API.createMovementFromLine(lineId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["statement", sid] }); toast.success(t('fin.movs.movimientoCreado')); },
  });

  if (!data) return <div className="text-slate-400">{t('common.cargando')}</div>;

  const matched = data.lines.filter((l: any) => l.matchStatus !== "unmatched").length;
  const unmatched = data.lines.length - matched;

  // Compartir extracto por email/WhatsApp/descarga
  const fileUrl: string | null = data.url ?? null
  const shareLabel = t('fin.stmts.shareSubject', { account: data.account?.name ?? '', from: dateShort(data.periodStart), to: dateShort(data.periodEnd) })
  const emailHref = fileUrl ? `mailto:?subject=${encodeURIComponent(shareLabel)}&body=${encodeURIComponent(t('fin.stmts.shareBody', { url: fileUrl }))}` : null
  const waHref = fileUrl ? `https://wa.me/?text=${encodeURIComponent(`${shareLabel}\n${fileUrl}`)}` : null

  return (
    <div className="space-y-4 page-content">
      <div className="flex items-center justify-between">
        {/* Path relativo (sin slash inicial) — Link absoluto a "/statements" matchea el
            catch-all del router root y rebota a la landing, lo que vuelve a evaluar el
            AuthGate y muestra el prompt de password. */}
        <Link to="../statements" className="btn-ghost"><ArrowLeft size={14} /> {t('fin.stmtDet.extractos')}</Link>
        <div className="flex items-center gap-2">
          {fileUrl ? (
            <>
              <a href={fileUrl} target="_blank" rel="noreferrer" className="btn-ghost" title={t('fin.stmtDet.verArchivoOriginal')}>
                <FileText size={14} /> {t('fin.stmtDet.verArchivo')}
              </a>
              <a href={fileUrl} download className="btn-ghost" title={t('common.descargar')}>
                <Download size={14} /> {t('common.descargar')}
              </a>
              {emailHref && (
                <a href={emailHref} className="btn-ghost" title={t('common.enviarPorEmail')}>
                  <Mail size={14} />
                </a>
              )}
              {waHref && (
                <a href={waHref} target="_blank" rel="noreferrer" className="btn-ghost" title={t('common.compartirPorWhatsapp')}>
                  <MessageCircle size={14} />
                </a>
              )}
            </>
          ) : (
            <span className="text-xs text-slate-400 italic">{t('fin.stmtDet.archivoOriginalNoDisponibleExtractoCargado')}</span>
          )}
          <button className="btn-secondary" onClick={() => reconcile.mutate()} disabled={reconcile.isPending}>
            <RefreshCcw size={14} /> {reconcile.isPending ? t('fin.stmtDet.conciliando') : t('fin.stmtDet.reConciliar')}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-semibold text-lg">{data.filename}</h2>
        <p className="text-sm text-slate-400">{data.account?.name} · {dateShort(data.periodStart)} → {dateShort(data.periodEnd)}</p>
        <div className="flex gap-4 mt-3 text-sm flex-wrap">
          <span><strong className="text-positive">{matched}</strong> {t('fin.stmtDet.conciliadas')}</span>
          <span><strong className="text-warn">{unmatched}</strong> {t('common.pendientes')}</span>
          <span><strong>{data.lines.length}</strong> {t('fin.stmtDet.lineasTotales')}</span>
          {data.openingBalance != null && <span>{t('fin.stmtDet.apertura')} <strong className="font-mono">{usd(data.openingBalance)}</strong></span>}
          {data.closingBalance != null && <span>{t('fin.stmtDet.cierre')} <strong className="font-mono">{usd(data.closingBalance)}</strong></span>}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">{t('common.fecha')}</th>
              <th className="px-3 py-2 text-left">{t('common.descripcion')}</th>
              <th className="px-3 py-2 text-right">{t('common.monto')}</th>
              <th className="px-3 py-2 text-left">{t('common.tipo')}</th>
              <th className="px-3 py-2 text-left">{t('common.estado')}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l: any) => (
              <tr key={l.id} className="border-b border-line/50 table-row">
                <td className="px-3 py-2 text-xs font-mono">{dateShort(l.date)}</td>
                <td className="px-3 py-2">{l.description}</td>
                <td className={cls("px-3 py-2 text-right font-mono", l.type === "credit" ? "text-positive" : "text-negative")}>{usd(l.amount)}</td>
                <td className="px-3 py-2 text-xs">{l.type === "credit" ? t('common.ingreso') : t('common.egreso')}</td>
                <td className="px-3 py-2"><span className={cls("badge border", STATUS_BADGE[l.matchStatus])}>{l.matchStatus}</span></td>
                <td className="px-3 py-2 text-right">
                  {l.matchStatus === "unmatched" && (
                    <button onClick={() => createMov.mutate(l.id)} className="btn-secondary text-xs"><Plus size={12} /> {t('common.crearMovimiento')}</button>
                  )}
                  {l.matchedMovementId && (
                    <Link to={`../movements/${l.matchedMovementId}`} className="text-xs text-accent hover:underline">{t('fin.stmtDet.verMovimiento')}</Link>
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
