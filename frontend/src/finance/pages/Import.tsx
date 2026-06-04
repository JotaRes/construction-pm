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

export default function Import() {
  const qc = useQueryClient();
  const [wipe, setWipe] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [resetModal, setResetModal] = useState(false);
  const [restoreModal, setRestoreModal] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const importDisk = useMutation({
    mutationFn: () => API.importExcelFromDisk(wipe),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success(`${r.movements} movimientos importados`); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error"),
  });

  const importUpload = useMutation({
    mutationFn: (file: File) => API.importExcel(file, wipe),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success(`Importación completa: ${r.movements} movimientos`); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error"),
  });

  const wipeAll = useMutation({
    mutationFn: (password: string) => API.wipeAllData(password),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Base de datos del módulo financiero borrada completamente", { duration: 5000 });
      setResetModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al borrar datos"),
  });

  const restore = useMutation({
    mutationFn: ({ file, password }: { file: File; password: string }) => API.restoreFromFile(file, password),
    onSuccess: (r) => {
      qc.invalidateQueries();
      const totalRecords = Object.values(r.counts || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
      toast.success(`✓ Restauración completa: ${totalRecords} registros cargados`, { duration: 6000 });
      setRestoreModal(false);
      setRestoreFile(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al restaurar"),
  });

  const downloadFile = (url: string, filename: string) => {
    downloadAuthed(url, filename).catch(() => toast.error("Error al descargar el archivo"));
  };

  return (
    <div className="space-y-5 page-content">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Importar / Backup</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>Exporta tus datos a Excel o JSON, restaura desde backup, importa desde Excel maestro, o resetea desde cero</p>
      </div>

      {/* === EXPORTAR === */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Download size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Exportar datos</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>
          Descarga toda la información financiera para respaldo, análisis externo o migración. Ambos formatos son <strong>re-importables</strong>: si reseteas o pierdes datos, puedes cargarlos de vuelta y recuperar el estado exacto.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          {/* Excel */}
          <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.08)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>Excel (.xlsx)</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  Multi-hoja legible — útil para análisis manual en Excel
                </div>
              </div>
            </div>
            <button
              onClick={() => downloadFile(API.excelExportUrl(), `finance-${new Date().toISOString().slice(0, 10)}.xlsx`)}
              className="btn-primary w-full justify-center text-sm"
            >
              <Download size={14} /> Descargar Excel
            </button>
          </div>

          {/* JSON / ZIP */}
          <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.08)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(200,146,42,0.12)', color: 'var(--brand-gold)' }}>
                <Archive size={20} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>Backup completo (ZIP + JSON)</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  Snapshot exacto · <strong>Recomendado para restore</strong>
                </div>
              </div>
            </div>
            <button
              onClick={() => downloadFile(API.backupUrl(), `finance-backup-${new Date().toISOString().slice(0, 10)}.zip`)}
              className="btn-secondary w-full justify-center text-sm"
            >
              <Archive size={14} /> Descargar ZIP
            </button>
          </div>
        </div>
      </div>

      {/* === RESTAURAR DESDE BACKUP === */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Restaurar desde backup</h2>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--brand-teal2)' }}>
          Carga un archivo de backup previo (ZIP o JSON) para restaurar tu sistema al estado exacto cuando lo descargaste.
          <strong className="text-red-600 ml-1">Esta acción BORRA todos los datos actuales antes de restaurar.</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRestoreModal(true)}
            className="btn-primary text-sm"
          >
            <Upload size={14} /> Cargar backup y restaurar
          </button>
        </div>
      </div>

      {/* === IMPORTAR EXCEL MAESTRO === */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Upload size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Importar Excel maestro</h2>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--brand-teal2)' }}>
          Carga las hojas <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,146,42,0.1)', color: 'var(--brand-gold)' }}>MOV 2025</code>, <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,146,42,0.1)', color: 'var(--brand-gold)' }}>MOV 2026</code>, <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,146,42,0.1)', color: 'var(--brand-gold)' }}>CAPITALIZACION</code> y <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,146,42,0.1)', color: 'var(--brand-gold)' }}>PROYECTOS</code> de tu archivo "DOC FINANCIERO".
        </p>

        <label className="flex items-center gap-2 text-sm p-3 rounded-lg mb-3 cursor-pointer" style={{ background: 'var(--brand-cream2)' }}>
          <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} className="rounded" />
          <AlertTriangle size={14} className="text-amber-600" />
          <span style={{ color: 'var(--brand-teal)' }}>Borrar movimientos y capitalización existentes antes de importar</span>
        </label>

        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" onClick={() => importDisk.mutate()} disabled={importDisk.isPending}>
            <Database size={14} />{importDisk.isPending ? "Importando…" : "Importar desde servidor"}
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload size={14} /> Subir archivo Excel
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
          <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.08)' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: 'var(--brand-teal)' }}>✓ Importación exitosa</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs" style={{ color: 'var(--brand-teal2)' }}>
              <div>Movimientos: <strong style={{ color: 'var(--brand-teal)' }}>{result.movements}</strong></div>
              <div>Aportes capital: <strong style={{ color: 'var(--brand-teal)' }}>{result.capitalContribs}</strong></div>
              <div>Préstamos: <strong style={{ color: 'var(--brand-teal)' }}>{result.loans}</strong></div>
              <div>Aportes no-banc.: <strong style={{ color: 'var(--brand-teal)' }}>{result.nonBank}</strong></div>
              <div>Proyectos: <strong style={{ color: 'var(--brand-teal)' }}>{result.projectsTouched}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* === ZONA PELIGROSA === */}
      <div className="card p-5" style={{ borderColor: 'rgba(220,38,38,0.3)', borderWidth: 2 }}>
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={18} className="text-red-600" />
          <h2 className="text-base font-bold text-red-600" style={{ fontFamily: 'Georgia, serif' }}>Zona peligrosa: Reset completo</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>
          Borra <strong>TODOS</strong> los datos del módulo financiero. <strong className="text-red-600">No se puede deshacer.</strong>
          <span className="block mt-1">🔒 Esta acción requiere una <strong>contraseña de confirmación</strong> para evitar borrados accidentales.</span>
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary text-sm"
            onClick={() => downloadFile(API.backupUrl(), `finance-pre-wipe-${new Date().toISOString().slice(0, 10)}.zip`)}
          >
            <Archive size={14} /> Descargar backup primero
          </button>
          <button
            className="btn-danger text-sm"
            onClick={() => setResetModal(true)}
          >
            <RotateCcw size={14} /> Resetear todo desde cero
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
          if (!restoreFile) return toast.error("Selecciona un archivo");
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
  const [pwd, setPwd] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const handleClose = () => { setPwd(""); setStep(1); onClose(); };
  const handleNext = () => {
    if (!pwd) return toast.error("Ingresa la contraseña");
    setStep(2);
  };
  const handleConfirm = () => {
    onConfirm(pwd);
  };

  return (
    <Modal open={open} onClose={handleClose} title="⚠ Confirmar reset total" size="md">
      {step === 1 ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <ShieldAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              Estás a punto de borrar <strong>TODOS los datos</strong> del módulo financiero:
              cuentas, movimientos, proyectos, socios, lenders, categorías, capital, préstamos, extractos.
              <strong className="block mt-1">Esta acción NO se puede deshacer.</strong>
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Lock size={12} /> Contraseña de confirmación</label>
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
              Esta contraseña fue configurada por el administrador del sistema.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
            <button className="btn-secondary" onClick={handleClose}>Cancelar</button>
            <button className="btn-danger" onClick={handleNext} disabled={!pwd}>Continuar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <ShieldAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <strong>Última confirmación:</strong> ¿Estás 100% seguro? Esta es tu última oportunidad para cancelar.
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
            <button className="btn-secondary" onClick={handleClose}>Cancelar</button>
            <button className="btn-danger" onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Borrando…" : "Sí, BORRAR TODO ahora"}
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
  const [pwd, setPwd] = useState("");
  const handleClose = () => { setPwd(""); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="Restaurar desde backup" size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(200,146,42,0.08)', border: '1px solid rgba(200,146,42,0.25)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--brand-gold)' }} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm" style={{ color: 'var(--brand-teal)' }}>
            <strong>El restore BORRA todos los datos actuales</strong> antes de cargar el backup. Se recomienda descargar un backup ZIP del estado actual primero (por si quieres deshacer).
          </div>
        </div>

        <div>
          <label className="label">Archivo de backup *</label>
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
              border: `1.5px solid ${file ? 'rgba(16,185,129,0.3)' : 'rgba(45,75,82,0.15)'}`,
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
                <span className="text-sm" style={{ color: 'var(--brand-teal2)' }}>Seleccionar archivo .json o .zip</span>
              </>
            )}
          </button>
        </div>

        <div>
          <label className="label flex items-center gap-1.5"><Lock size={12} /> Contraseña</label>
          <input
            type="password"
            className="input w-full"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => { if (e.key === "Enter" && file && pwd) onConfirm(pwd); }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
          <button className="btn-secondary" onClick={handleClose}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={() => onConfirm(pwd)}
            disabled={!file || !pwd || isPending}
          >
            <RefreshCw size={14} /> {isPending ? "Restaurando…" : "Restaurar ahora"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
