import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { API } from "../lib/api";
import { dateShort, cls } from "../lib/format";
import { Upload, FileSpreadsheet, Trash2, ChevronRight, AlertCircle, CheckCircle2, FileText, Info, Download, Mail, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirm } from "../../components/ConfirmDialog";
import { useI18n } from '../../i18n'

export default function Statements() {
  const { t } = useI18n()
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const { data } = useQuery({ queryKey: ["statements"], queryFn: API.listStatements });
  const [accountId, setAccountId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string; details?: any } | null>(null);

  const del = useMutation({
    mutationFn: (id: number) => API.deleteStatement(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["statements"] }); toast.success(t('fin.acctDet.extractoEliminado')); },
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!accountId) {
      toast.error(t('fin.stmts.seleccionaPrimeroLaCuentaBancaria'));
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
      toast.success(t('fin.acctDet.extractoProcesadoV0LineasV1Conciliadas', { v0: linesCount, v1: matched }));
      setLastResult({
        ok: true,
        message: t('fin.stmts.procesadoExitosamente'),
        details: { linesCount, matched, created, filename: f.name },
      });
      qc.invalidateQueries({ queryKey: ["statements"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["unreconciledLines"] });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || t('fin.acctDet.errorAlSubirExtracto');
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
        <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><FileText className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('fin.stmts.extractosBancarios')}</span></h1>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>
          {t('fin.stmts.subeCsvExcelOPdfEl')}
        </p>
      </div>

      {/* Información explicativa */}
      <div className="card p-4 flex items-start gap-3" style={{ background: 'var(--brand-cream2)' }}>
        <Info size={18} style={{ color: 'var(--brand-gold)', flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm" style={{ color: 'var(--brand-teal)' }}>
          <strong>{t('fin.stmts.comoFunciona')}</strong> {t('fin.stmts.alSubirUnExtractoElSistema')}
          <ol className="list-decimal ml-5 mt-1 space-y-0.5 text-xs" style={{ color: 'var(--brand-teal2)' }}>
            <li>{t('fin.stmts.leeCadaLineaFechaConceptoMonto')}</li>
            <li>{t('fin.stmts.comparaConLosMovimientosQueRegistraste')}</li>
            <li>{t('fin.stmts.marcaComo')} <span className="text-emerald-600 font-semibold">{t('fin.stmts.coincide')}</span> {t('fin.stmts.losQueEstanEnAmbosLados')}</li>
            <li>{t('fin.stmts.teAlertaDeLosQueEstan')} <Link to="/finance/movements" className="font-semibold hover:underline" style={{ color: 'var(--brand-gold)' }}>{t('common.movimientos')}</Link></li>
          </ol>
        </div>
      </div>

      {/* Subir nuevo extracto */}
      <div className="card p-5">
        <h2 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
          <Upload size={16} style={{ color: 'var(--brand-gold)' }} /> {t('fin.stmts.subirNuevoExtracto')}
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="label">{t('fin.stmts.cuentaBancaria')}</label>
            <select className="select w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">{t('fin.stmts.seleccionarCuenta')}</option>
              {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.bank})</option>)}
            </select>
          </div>
          <label className={cls(
            "btn-primary cursor-pointer",
            (uploading || !accountId) && "opacity-60 pointer-events-none"
          )}>
            <Upload size={14} />
            {uploading ? t('common.procesando') : t('common.subirArchivo')}
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
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-teal)' }}>{t('fin.stmts.formatosYColumnasSoportadas')}</div>
          <ul className="text-xs space-y-0.5" style={{ color: 'var(--brand-teal2)' }}>
            <li>✓ <span className="font-mono">CSV</span> · <span className="font-mono">{t('fin.stmts.xlsx')}</span> · <span className="font-mono">{t('fin.stmts.xls')}</span> · <span className="font-mono">{t('fin.stmts.pdf')}</span></li>
            <li>{t('fin.stmts.detectaColumnas')} <span className="font-mono">Fecha/Date</span>, <span className="font-mono">{t('fin.stmts.descripcionMemo')}</span>, <span className="font-mono">Monto/Amount</span> {t('fin.stmts.o')} <span className="font-mono">Debit/Credit</span></li>
            <li>{t('fin.stmts.compatibleConOceanBankChaseBank')}</li>
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
                  {t('fin.stmts.archivo')} <span className="font-mono">{lastResult.details.filename}</span> · {lastResult.details.linesCount} {t('fin.stmts.lineasExtraidas')}
                  {lastResult.details.matched > 0 && ` · ${lastResult.details.matched} conciliadas`}
                </div>
              )}
              {!lastResult.ok && (
                <div className="text-xs text-red-600 mt-1">
                  {t('fin.stmts.verificaQueElArchivoTengaColumnas')}
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
            <FileText size={16} style={{ color: 'var(--brand-gold)' }} /> {t('fin.stmts.extractosCargados')}
          </h2>
          <span className="text-xs font-semibold" style={{ color: 'var(--brand-teal2)' }}>{data?.length || 0} {t('fin.stmts.archivos')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(29,29,31,0.04)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                <th className="px-4 py-3 text-left font-semibold">{t('fin.stmts.archivo2')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('common.cuenta2')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('fin.stmts.periodo')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('fin.stmts.lineas')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {!data || data.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center" style={{ color: 'var(--brand-teal2)' }}>
                  <FileSpreadsheet size={36} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                  {t('fin.stmts.aunNoHayExtractosCargadosSube')}
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
                          <a href={s.url} target="_blank" rel="noreferrer" className="btn-ghost p-1" title={t('fin.stmtDet.verArchivoOriginal')}>
                            <FileText size={14} />
                          </a>
                          <a href={s.url} download className="btn-ghost p-1" title={t('fin.stmts.descargarArchivo')}>
                            <Download size={14} />
                          </a>
                          <a
                            href={`mailto:?subject=${encodeURIComponent(t('fin.stmts.shareSubject', { account: s.account?.name ?? '', from: dateShort(s.periodStart), to: dateShort(s.periodEnd) }))}&body=${encodeURIComponent(t('fin.stmts.shareBody', { url: s.url ?? '' }))}`}
                            className="btn-ghost p-1"
                            title={t('common.enviarPorEmail')}
                          >
                            <Mail size={14} />
                          </a>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`Extracto ${s.account?.name ?? ''} ${dateShort(s.periodStart)}–${dateShort(s.periodEnd)}\n${s.url}`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-ghost p-1"
                            title={t('common.compartirPorWhatsapp')}
                          >
                            <MessageCircle size={14} />
                          </a>
                        </>
                      ) : (
                        <span className="text-[10px] italic mr-2" style={{ color: 'var(--brand-teal2)' }} title={t('fin.stmts.subeElExtractoDeNuevoPara')}>
                          {t('fin.stmts.archivoNoGuardado')}
                        </span>
                      )}
                      <Link to={`/finance/statements/${s.id}`} className="btn-ghost p-1" title={t('fin.stmts.verDetalleDeLineas')}>
                        <ChevronRight size={14} />
                      </Link>
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: t('fin.acctDet.eliminarExtractoBancario'),
                            message: t('fin.acctDet.seguroQueQuieresEliminarElExtracto', { v0: s.filename }),
                            detail: t('fin.stmts.seEliminaranTambienTodasLasLineas'),
                            destructive: true,
                            confirmText: t('tech.projects.siEliminar'),
                          })
                          if (ok) del.mutate(s.id);
                        }}
                        className="btn-ghost p-1 text-red-600"
                        title={t('common.eliminar')}
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
