import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { API } from "../lib/api";
import { downloadAuthed } from "../../lib/api";
import { Modal } from "../components/Modal";
import {
  Upload, Database, Download, AlertTriangle, FileSpreadsheet,
  Archive, RotateCcw, Lock, CheckCircle2, ShieldAlert, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { useI18n } from '../../i18n'

export default function Import() {
  const { t } = useI18n()
  const qc = useQueryClient();
  const [wipe, setWipe] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [resetModal, setResetModal] = useState(false);
  const [restoreModal, setRestoreModal] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const importDisk = useMutation({
    mutationFn: () => API.importExcelFromDisk(wipe),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success(t('fin.import.v0MovimientosImportados', { v0: r.movements })); },
    onError: (e: any) => toast.error(e.response?.data?.error || t('common.error')),
  });

  const importUpload = useMutation({
    mutationFn: (file: File) => API.importExcel(file, wipe),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success(t('fin.import.importacionCompletaV0Movimientos', { v0: r.movements })); },
    onError: (e: any) => toast.error(e.response?.data?.error || t('common.error')),
  });

  const wipeAll = useMutation({
    mutationFn: (password: string) => API.wipeAllData(password),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t('fin.import.baseDeDatosDelModuloFinanciero'), { duration: 5000 });
      setResetModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || t('fin.import.errorAlBorrarDatos')),
  });

  const restore = useMutation({
    mutationFn: ({ file, password }: { file: File; password: string }) => API.restoreFromFile(file, password),
    onSuccess: (r) => {
      qc.invalidateQueries();
      const totalRecords = Object.values(r.counts || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
      toast.success(t('fin.import.restauracionCompletaV0RegistrosCargados', { v0: totalRecords }), { duration: 6000 });
      setRestoreModal(false);
      setRestoreFile(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || t('fin.import.errorAlRestaurar')),
  });

  const downloadFile = (url: string, filename: string) => {
    downloadAuthed(url, filename).catch(() => toast.error(t('fin.import.errorAlDescargarElArchivo')));
  };

  return (
    <div className="space-y-5 page-content">
      <div>
        <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><Archive className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('fin.import.importarBackup')}</span></h1>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>{t('fin.import.exportaTusDatosAExcelO')}</p>
      </div>

      {/* === EXPORTAR === */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Download size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.exportarDatos')}</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>
          {t('fin.import.descargaTodaLaInformacionFinancieraPara')} <strong>{t('fin.import.reImportables')}</strong>{t('fin.import.siReseteasOPierdesDatosPuedes')}
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          {/* Excel */}
          <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(29,29,31,0.08)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.excelXlsx')}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  {t('fin.import.multiHojaLegibleUtilParaAnalisis')}
                </div>
              </div>
            </div>
            <button
              onClick={() => downloadFile(API.excelExportUrl(), `finance-${new Date().toISOString().slice(0, 10)}.xlsx`)}
              className="btn-primary w-full justify-center text-sm"
            >
              <Download size={14} /> {t('fin.import.descargarExcel')}
            </button>
          </div>

          {/* JSON / ZIP */}
          <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(29,29,31,0.08)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(62,90,112,0.12)', color: 'var(--brand-gold)' }}>
                <Archive size={20} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.backupCompletoZipJson')}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  {t('fin.import.snapshotExacto')} <strong>{t('fin.import.recomendadoParaRestore')}</strong>
                </div>
              </div>
            </div>
            <button
              onClick={() => downloadFile(API.backupUrl(), `finance-backup-${new Date().toISOString().slice(0, 10)}.zip`)}
              className="btn-secondary w-full justify-center text-sm"
            >
              <Archive size={14} /> {t('fin.import.descargarZip')}
            </button>
          </div>
        </div>
      </div>

      {/* === RESTAURAR DESDE BACKUP === */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.restaurarDesdeBackup')}</h2>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--brand-teal2)' }}>
          {t('fin.import.cargaUnArchivoDeBackupPrevio')}
          <strong className="text-red-600 ml-1">{t('fin.import.estaAccionBorraTodosLosDatos')}</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRestoreModal(true)}
            className="btn-primary text-sm"
          >
            <Upload size={14} /> {t('fin.import.cargarBackupYRestaurar')}
          </button>
        </div>
      </div>

      {/* === IMPORTAR EXCEL MAESTRO === */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Upload size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.importarExcelMaestro')}</h2>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--brand-teal2)' }}>
          {t('fin.import.cargaLasHojas')} <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(62,90,112,0.1)', color: 'var(--brand-gold)' }}>{t('fin.import.mov2025')}</code>, <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(62,90,112,0.1)', color: 'var(--brand-gold)' }}>{t('fin.import.mov2026')}</code>, <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(62,90,112,0.1)', color: 'var(--brand-gold)' }}>CAPITALIZACION</code> {t('fin.import.y')} <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(62,90,112,0.1)', color: 'var(--brand-gold)' }}>PROYECTOS</code> {t('fin.import.deTuArchivoDocFinanciero')}
        </p>

        <label className="flex items-center gap-2 text-sm p-3 rounded-lg mb-3 cursor-pointer" style={{ background: 'var(--brand-cream2)' }}>
          <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} className="rounded" />
          <AlertTriangle size={14} className="text-amber-600" />
          <span style={{ color: 'var(--brand-teal)' }}>{t('fin.import.borrarMovimientosYCapitalizacionExistentes')}</span>
        </label>

        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" onClick={() => importDisk.mutate()} disabled={importDisk.isPending}>
            <Database size={14} />{importDisk.isPending ? t('common.importando') : t('fin.import.importarDesdeServidor')}
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload size={14} /> {t('fin.import.subirArchivoExcel')}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importUpload.mutate(f); e.target.value = ""; }}
              disabled={importUpload.isPending}
            />
          </label>
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(29,29,31,0.08)' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.importacionExitosa')}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs" style={{ color: 'var(--brand-teal2)' }}>
              <div>{t('fin.import.movimientos')} <strong style={{ color: 'var(--brand-teal)' }}>{result.movements}</strong></div>
              <div>{t('fin.import.aportesCapital')} <strong style={{ color: 'var(--brand-teal)' }}>{result.capitalContribs}</strong></div>
              <div>{t('fin.import.prestamos')} <strong style={{ color: 'var(--brand-teal)' }}>{result.loans}</strong></div>
              <div>{t('fin.import.aportesNoBanc')} <strong style={{ color: 'var(--brand-teal)' }}>{result.nonBank}</strong></div>
              <div>{t('fin.import.proyectos')} <strong style={{ color: 'var(--brand-teal)' }}>{result.projectsTouched}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* === ZONA PELIGROSA === */}
      <div className="card p-5" style={{ borderColor: 'rgba(220,38,38,0.3)', borderWidth: 2 }}>
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={18} className="text-red-600" />
          <h2 className="text-base font-bold text-red-600">{t('fin.import.zonaPeligrosaResetCompleto')}</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>
          {t('fin.import.borra')} <strong>TODOS</strong> {t('fin.import.losDatosDelModuloFinanciero')} <strong className="text-red-600">{t('fin.import.noSePuedeDeshacer')}</strong>
          <span className="block mt-1">{t('fin.import.estaAccionRequiereUna')} <strong>{t('fin.import.contrasenaDeConfirmacion')}</strong> {t('fin.import.paraEvitarBorradosAccidentales')}</span>
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary text-sm"
            onClick={() => downloadFile(API.backupUrl(), `finance-pre-wipe-${new Date().toISOString().slice(0, 10)}.zip`)}
          >
            <Archive size={14} /> {t('fin.import.descargarBackupPrimero')}
          </button>
          <button
            className="btn-danger text-sm"
            onClick={() => setResetModal(true)}
          >
            <RotateCcw size={14} /> {t('fin.import.resetearTodoDesdeCero')}
          </button>
        </div>
      </div>

      {/* === MODAL RESET CON PASSWORD === */}
      <ResetPasswordModal
        open={resetModal}
        onClose={() => setResetModal(false)}
        onConfirm={(password) => wipeAll.mutate(password)}
        isPending={wipeAll.isPending}
      />

      {/* === MODAL RESTORE CON PASSWORD === */}
      <RestoreModal
        open={restoreModal}
        onClose={() => { setRestoreModal(false); setRestoreFile(null); }}
        file={restoreFile}
        setFile={setRestoreFile}
        fileRef={restoreFileRef}
        onConfirm={(password) => {
          if (!restoreFile) return toast.error(t('fin.import.seleccionaUnArchivo'));
          restore.mutate({ file: restoreFile, password });
        }}
        isPending={restore.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL: Password para reset
// ─────────────────────────────────────────────────────────────
function ResetPasswordModal({ open, onClose, onConfirm, isPending }: { open: boolean; onClose: () => void; onConfirm: (password: string) => void; isPending: boolean }) {
  const { t } = useI18n()
  const [pwd, setPwd] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const handleClose = () => { setPwd(""); setStep(1); onClose(); };
  const handleNext = () => {
    if (!pwd) return toast.error(t('fin.import.ingresaLaContrasena'));
    setStep(2);
  };
  const handleConfirm = () => {
    onConfirm(pwd);
  };

  return (
    <Modal open={open} onClose={handleClose} title={t('fin.import.confirmarResetTotal')} size="md">
      {step === 1 ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <ShieldAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              {t('fin.import.estasAPuntoDeBorrar')} <strong>{t('fin.import.todosLosDatos')}</strong> {t('fin.import.delModuloFinancieroCuentasMovimientosProye')}
              <strong className="block mt-1">{t('fin.import.estaAccionNoSePuedeDeshacer')}</strong>
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Lock size={12} /> {t('fin.import.contrasenaDeConfirmacion2')}</label>
            <input
              type="password"
              className="input w-full"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="••••••••"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleNext(); }}
            />
            <p className="text-[11px] mt-1" style={{ color: 'var(--brand-teal2)' }}>
              {t('fin.import.estaContrasenaFueConfiguradaPorEl')}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.1)' }}>
            <button className="btn-secondary" onClick={handleClose}>{t('common.cancelar')}</button>
            <button className="btn-danger" onClick={handleNext} disabled={!pwd}>{t('fin.import.continuar')}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <ShieldAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <strong>{t('fin.import.ultimaConfirmacion')}</strong> {t('fin.import.estas100SeguroEstaEsTu')}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.1)' }}>
            <button className="btn-secondary" onClick={handleClose}>{t('common.cancelar')}</button>
            <button className="btn-danger" onClick={handleConfirm} disabled={isPending}>
              {isPending ? t('common.borrando') : t('fin.import.siBorrarTodoAhora')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL: Restore desde archivo
// ─────────────────────────────────────────────────────────────
function RestoreModal({
  open, onClose, file, setFile, fileRef, onConfirm, isPending,
}: {
  open: boolean;
  onClose: () => void;
  file: File | null;
  setFile: (f: File | null) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  onConfirm: (password: string) => void;
  isPending: boolean;
}) {
  const { t } = useI18n()
  const [pwd, setPwd] = useState("");
  const handleClose = () => { setPwd(""); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title={t('fin.import.restaurarDesdeBackup')} size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(62,90,112,0.08)', border: '1px solid rgba(62,90,112,0.25)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--brand-gold)' }} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm" style={{ color: 'var(--brand-teal)' }}>
            <strong>{t('fin.import.elRestoreBorraTodosLosDatos')}</strong> {t('fin.import.antesDeCargarElBackupSe')}
          </div>
        </div>

        <div>
          <label className="label">{t('fin.import.archivoDeBackup')}</label>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.zip"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full px-3 py-3 rounded-lg flex items-center gap-2 transition-all"
            style={{
              background: file ? 'rgba(16,185,129,0.08)' : 'var(--brand-cream2)',
              border: `1.5px solid ${file ? 'rgba(16,185,129,0.3)' : 'rgba(29,29,31,0.15)'}`,
            }}
          >
            {file ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-sm font-medium" style={{ color: 'var(--brand-teal)' }}>{file.name}</span>
                <span className="text-[11px] ml-auto" style={{ color: 'var(--brand-teal2)' }}>{(file.size / 1024).toFixed(1)} KB</span>
              </>
            ) : (
              <>
                <Upload size={16} style={{ color: 'var(--brand-gold)' }} />
                <span className="text-sm" style={{ color: 'var(--brand-teal2)' }}>{t('fin.import.seleccionarArchivoJsonOZip')}</span>
              </>
            )}
          </button>
        </div>

        <div>
          <label className="label flex items-center gap-1.5"><Lock size={12} /> {t('fin.import.contrasena')}</label>
          <input
            type="password"
            className="input w-full"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => { if (e.key === "Enter" && file && pwd) onConfirm(pwd); }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.1)' }}>
          <button className="btn-secondary" onClick={handleClose}>{t('common.cancelar')}</button>
          <button
            className="btn-primary"
            onClick={() => onConfirm(pwd)}
            disabled={!file || !pwd || isPending}
          >
            <RefreshCw size={14} /> {isPending ? t('fin.import.restaurando') : t('fin.import.restaurarAhora')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
