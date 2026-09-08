import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { techBackupApi, downloadAuthed } from '../lib/api'
import {
  Upload, Download, AlertTriangle, FileSpreadsheet,
  Archive, RotateCcw, Lock, CheckCircle2, ShieldAlert, RefreshCw, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useI18n } from '../i18n'

export default function TechImport() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [resetModal, setResetModal] = useState(false)
  const [restoreModal, setRestoreModal] = useState(false)
  const restoreFileRef = useRef<HTMLInputElement>(null)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)

  const wipeAll = useMutation({
    mutationFn: (password: string) => techBackupApi.wipeAll(password),
    onSuccess: () => {
      qc.invalidateQueries()
      toast.success(t('tech.import.moduloTecnicoBorradoCompletamente'), { duration: 5000 })
      setResetModal(false)
    },
    onError: (e: any) => toast.error(e.response?.data?.error || t('fin.import.errorAlBorrarDatos')),
  })

  const restore = useMutation({
    mutationFn: ({ file, password }: { file: File; password: string }) =>
      techBackupApi.restoreFromFile(file, password),
    onSuccess: (r: any) => {
      qc.invalidateQueries()
      const total = Object.values(r.counts || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
      toast.success(t('tech.import.restauracionCompletaV0Registros', { v0: total }), { duration: 6000 })
      setRestoreModal(false)
      setRestoreFile(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.error || t('fin.import.errorAlRestaurar')),
  })

  const downloadFile = (url: string, filename: string) => {
    downloadAuthed(url, filename).catch(() =>
      window.alert(t('tech.import.errorAlDescargarElArchivoVerifica'))
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-teal)' }}>{t('tech.import.importarBackupModuloTecnico')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>
          {t('tech.import.exportaProyectosFasesItemsDrawsProviders')}
        </p>
      </div>

      {/* EXPORTAR */}
      <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid rgba(29,29,31,0.1)', boxShadow: '0 1px 4px rgba(29,29,31,0.06)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Download size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.exportarDatos')}</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>
          {t('tech.import.descargaTodaLaInformacionDelModulo')} <strong>{t('fin.import.reImportables')}</strong>{t('fin.import.siReseteasOPierdesDatosPuedes')}
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(29,29,31,0.08)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.excelXlsx')}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  {t('tech.import.multiHojaLegibleProyectosItemsDraws')}
                </div>
              </div>
            </div>
            <button
              onClick={() => downloadFile(techBackupApi.excelExportUrl(), `tech-${new Date().toISOString().slice(0, 10)}.xlsx`)}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold2) 100%)' }}
            >
              <Download size={14} className="inline mr-1" /> {t('fin.import.descargarExcel')}
            </button>
          </div>

          <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(29,29,31,0.08)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(62,90,112,0.12)', color: 'var(--brand-gold)' }}>
                <Archive size={20} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>{t('tech.import.backupUniversalZip')}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  {t('tech.import.incluyeTechFinanceCodigoFuente')} <strong>{t('tech.import.recomendado')}</strong>
                </div>
              </div>
            </div>
            <button
              onClick={() => downloadFile(techBackupApi.downloadUrl(), `restrepoacosta-backup-${new Date().toISOString().slice(0, 10)}.zip`)}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--brand-teal)' }}
            >
              <Archive size={14} className="inline mr-1" /> {t('tech.import.descargarZipCompleto')}
            </button>
          </div>
        </div>
      </div>

      {/* RESTAURAR */}
      <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid rgba(29,29,31,0.1)', boxShadow: '0 1px 4px rgba(29,29,31,0.06)' }}>
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.restaurarDesdeBackup')}</h2>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--brand-teal2)' }}>
          {t('tech.import.cargaUnBackupZipOEl')}
          <strong className="text-red-600 ml-1">{t('tech.import.estaAccionBorraTodosLosDatos')}</strong>
        </p>
        <button
          onClick={() => setRestoreModal(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold2) 100%)' }}
        >
          <Upload size={14} className="inline mr-1" /> {t('fin.import.cargarBackupYRestaurar')}
        </button>
      </div>

      {/* ZONA PELIGROSA */}
      <div className="bg-white rounded-2xl p-5" style={{ borderColor: 'rgba(220,38,38,0.3)', borderWidth: 2 }}>
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={18} className="text-red-600" />
          <h2 className="text-base font-bold text-red-600">{t('tech.import.zonaPeligrosaResetCompletoDelModulo')}</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>
          {t('fin.import.borra')} <strong>TODOS</strong> {t('tech.import.losDatosDelModuloTecnicoProyectos')} <strong className="text-red-600">{t('fin.import.noSePuedeDeshacer')}</strong>
          <span className="block mt-1">{t('tech.import.requiere')} <strong>{t('fin.import.contrasenaDeConfirmacion')}</strong> {t('fin.import.paraEvitarBorradosAccidentales')}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadFile(techBackupApi.downloadUrl(), `tech-pre-wipe-${new Date().toISOString().slice(0, 10)}.zip`)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--brand-teal)' }}
          >
            <Archive size={14} className="inline mr-1" /> {t('fin.import.descargarBackupPrimero')}
          </button>
          <button
            onClick={() => setResetModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700"
          >
            <RotateCcw size={14} className="inline mr-1" /> {t('tech.import.resetearModuloTecnico')}
          </button>
        </div>
      </div>

      {/* MODAL RESET */}
      <ResetPasswordModal open={resetModal} onClose={() => setResetModal(false)} onConfirm={(p) => wipeAll.mutate(p)} isPending={wipeAll.isPending} />

      {/* MODAL RESTORE */}
      <RestoreModal
        open={restoreModal}
        onClose={() => { setRestoreModal(false); setRestoreFile(null) }}
        file={restoreFile}
        setFile={setRestoreFile}
        fileRef={restoreFileRef}
        onConfirm={(password) => {
          if (!restoreFile) return toast.error(t('fin.import.seleccionaUnArchivo'))
          restore.mutate({ file: restoreFile, password })
        }}
        isPending={restore.isPending}
      />
    </div>
  )
}

function ResetPasswordModal({ open, onClose, onConfirm, isPending }: { open: boolean; onClose: () => void; onConfirm: (p: string) => void; isPending: boolean }) {
  const { t } = useI18n()
  const [pwd, setPwd] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  if (!open) return null
  const handleClose = () => { setPwd(''); setStep(1); onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(29,29,31,0.1)', background: 'var(--brand-cream2)' }}>
          <h3 className="text-base font-bold text-red-600">{t('tech.import.confirmarResetTecnico')}</h3>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {step === 1 ? (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <ShieldAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  {t('tech.import.vasABorrar')} <strong>{t('tech.import.todosLosDatosDelModuloTecnico')}</strong>{t('tech.import.proyectosFasesItemsDrawsProvidersNotas')}
                  <strong className="block mt-1">{t('fin.import.estaAccionNoSePuedeDeshacer')}</strong>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--brand-teal)' }}><Lock size={12} /> {t('tech.import.contrasenaDeReseteo')}</label>
                <p className="text-[11px] mb-1.5" style={{ color: 'var(--brand-teal2)' }}>
                  {t('tech.import.noEsLaClaveDeAcceso')}
                </p>
                <input
                  type="password" autoFocus
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ borderColor: 'rgba(29,29,31,0.2)' }}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && pwd) setStep(2) }}
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.1)' }}>
                <button onClick={handleClose} className="px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: 'rgba(29,29,31,0.2)' }}>{t('common.cancelar')}</button>
                <button onClick={() => setStep(2)} disabled={!pwd} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-red-600 disabled:opacity-50">{t('fin.import.continuar')}</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <ShieldAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <strong>{t('fin.import.ultimaConfirmacion')}</strong> {t('fin.import.estas100SeguroEstaEsTu')}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.1)' }}>
                <button onClick={handleClose} className="px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: 'rgba(29,29,31,0.2)' }}>{t('common.cancelar')}</button>
                <button onClick={() => onConfirm(pwd)} disabled={isPending} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-red-600">
                  {isPending ? t('common.borrando') : t('fin.import.siBorrarTodoAhora')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RestoreModal({ open, onClose, file, setFile, fileRef, onConfirm, isPending }: {
  open: boolean; onClose: () => void; file: File | null; setFile: (f: File | null) => void;
  fileRef: React.RefObject<HTMLInputElement>; onConfirm: (p: string) => void; isPending: boolean;
}) {
  const { t } = useI18n()
  const [pwd, setPwd] = useState('')
  if (!open) return null
  const handleClose = () => { setPwd(''); onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(29,29,31,0.1)', background: 'var(--brand-cream2)' }}>
          <h3 className="text-base font-bold" style={{ color: 'var(--brand-teal)' }}>{t('tech.import.restaurarModuloTecnico')}</h3>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(62,90,112,0.08)', border: '1px solid rgba(62,90,112,0.25)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--brand-gold)' }} className="flex-shrink-0 mt-0.5" />
            <div className="text-sm" style={{ color: 'var(--brand-teal)' }}>
              <strong>{t('tech.import.elRestoreBorraTodosLosDatos')}</strong> {t('tech.import.antesDeCargarElBackupDescarga')}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--brand-teal)' }}>{t('fin.import.archivoDeBackup')}</label>
            <input ref={fileRef} type="file" accept=".json,.zip,.xlsx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full px-3 py-3 rounded-lg flex items-center gap-2 transition-all"
              style={{ background: file ? 'rgba(16,185,129,0.08)' : 'var(--brand-cream2)', border: `1.5px solid ${file ? 'rgba(16,185,129,0.3)' : 'rgba(29,29,31,0.15)'}` }}>
              {file ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span className="text-sm font-medium" style={{ color: 'var(--brand-teal)' }}>{file.name}</span>
                  <span className="text-[11px] ml-auto" style={{ color: 'var(--brand-teal2)' }}>{(file.size / 1024).toFixed(1)} KB</span>
                </>
              ) : (
                <>
                  <Upload size={16} style={{ color: 'var(--brand-gold)' }} />
                  <span className="text-sm" style={{ color: 'var(--brand-teal2)' }}>{t('tech.import.seleccionarArchivoXlsxJsonOZip')}</span>
                </>
              )}
            </button>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--brand-teal)' }}><Lock size={12} /> {t('fin.import.contrasena')}</label>
            <input type="password" className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'rgba(29,29,31,0.2)' }}
              value={pwd} onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && file && pwd) onConfirm(pwd) }}
              placeholder="••••••••" />
          </div>

          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.1)' }}>
            <button onClick={handleClose} className="px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: 'rgba(29,29,31,0.2)' }}>{t('common.cancelar')}</button>
            <button onClick={() => onConfirm(pwd)} disabled={!file || !pwd || isPending}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold2) 100%)' }}>
              <RefreshCw size={14} className="inline mr-1" /> {isPending ? t('fin.import.restaurando') : t('fin.import.restaurarAhora')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
