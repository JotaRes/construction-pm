import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { drawsApi, drawParseApi, constructionBudgetApi, projectsApi, type DrawLineApproval, type DrawsValidation, type DrawsConsistency } from '../lib/api'
import { formatUSD, formatDate } from '../lib/calculations'
import type { Draw, DrawEstado } from '../lib/types'
import { Upload, FileText, CheckCircle, X, AlertTriangle, Mail, MessageCircle, Download, Trash2, Table2, TrendingDown, ChevronDown, RefreshCw, Landmark, ShieldCheck } from 'lucide-react'
import { useConfirm } from '../components/ConfirmDialog'
import toast from 'react-hot-toast'
import { useI18n, tStatic } from '../i18n'

interface BudgetLine {
  id: string
  itemNumber: string
  description: string
  valorInicial: number
  valorEjecutado: number
}

// Botones de share (email, WhatsApp, descarga) para un documento
function ShareButtons({ url, label }: { url: string; label: string }) {
  const { t } = useI18n()
  const subject = encodeURIComponent(`Documento: ${label}`)
  const body = encodeURIComponent(t('tech.draws.aquiElDocumentoV0V1', { v0: label, v1: url }))
  const wa = encodeURIComponent(t('tech.draws.aquiElDocumentoV0V12', { v0: label, v1: url }))
  return (
    <div className="flex items-center gap-1.5">
      <a href={url} download target="_blank" rel="noreferrer"
        title={t('common.descargar')}
        className="text-slate-400 hover:text-[var(--brand-teal)] p-1 rounded transition-colors">
        <Download className="w-3.5 h-3.5" />
      </a>
      <a href={`mailto:?subject=${subject}&body=${body}`}
        title={t('common.enviarPorEmail')}
        className="text-slate-400 hover:text-[var(--brand-gold)] p-1 rounded transition-colors">
        <Mail className="w-3.5 h-3.5" />
      </a>
      <a href={`https://wa.me/?text=${wa}`} target="_blank" rel="noreferrer"
        title={t('common.compartirPorWhatsapp')}
        className="text-slate-400 hover:text-green-600 p-1 rounded transition-colors">
        <MessageCircle className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}

// Slot para subir documentos del draw (invoice, approval, Excel).
// NOTA: ya no se renderiza en el recuadro del draw (los documentos por draw no se
// cargan aquí; se usa el Excel general del lender). Se conserva exportado por si
// se necesita reactivar la carga puntual de un PDF por draw.
export function DocSlot({
  draw, kind, label, icon: Icon, projectId,
}: {
  draw: Draw
  kind: 'INVOICE' | 'APPROVAL' | 'EXCEL'
  label: string
  icon: React.FC<{ className?: string }>
  projectId: string
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const url  = kind === 'INVOICE' ? draw.invoiceLenderUrl
             : kind === 'APPROVAL' ? draw.lenderApprovalUrl
             : draw.lenderExcelUrl
  const name = kind === 'INVOICE' ? draw.invoiceLenderName
             : kind === 'APPROVAL' ? draw.lenderApprovalName
             : draw.lenderExcelName

  const isExcel   = kind === 'EXCEL'
  const isRequired = kind === 'INVOICE' || kind === 'APPROVAL'
  const missing   = !url

  const accept = isExcel
    ? '.xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : '.pdf,.jpg,.jpeg,.png,.webp'

  const colors = {
    INVOICE:  { border: missing ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200', icon: 'text-amber-600' },
    APPROVAL: { border: missing ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600' },
    EXCEL:    { border: missing ? 'bg-blue-50 border-blue-200' : 'bg-blue-50 border-blue-300', icon: 'text-blue-600' },
  }

  const uploadMut = useMutation({
    mutationFn: (f: File) => drawsApi.uploadDoc(draw.id, f, kind),
    onSuccess: (result) => {
      const extractedCount = result?.extracted ? Object.keys(result.extracted).length : 0
      const parsedDrawN = result?.parsedDrawNumber
      const budget = result?.budgetUpdate
      const extractionError = (result as any)?.extractionError as string | null | undefined
      if (extractionError) {
        toast.error(t('tech.draws.archivoSubidoPeroLaExtraccionAutomatica', { v0: extractionError }),
          { duration: 9000, style: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' } })
      } else if (kind === 'EXCEL') {
        if (parsedDrawN && parsedDrawN !== draw.drawNumber) {
          toast(t('tech.draws.elExcelPerteneceADrawV0', { v0: parsedDrawN, v1: draw.drawNumber }),
            { duration: 8000, style: { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' } })
        } else if (extractedCount > 0) {
          toast.success(t('tech.draws.excelSubidoV0CampoSExtraido', { v0: extractedCount }))
        } else {
          toast.success(t('tech.draws.excelSubidoNoSeDetectaronCampos'))
        }
      } else if (kind === 'APPROVAL') {
        if (budget && budget.newlyApprovedItems > 0) {
          toast.success(
            t('tech.draws.drawAplicadoV0ItemSNuevo', { v0: budget.newlyApprovedItems, v1: formatUSD(budget.newlyApprovedAmount), v2: formatUSD(budget.cumulativeApproved) }),
            { duration: 7000 }
          )
        } else if (budget && budget.matched > 0) {
          toast(t('tech.draws.pdfSubidoSinNuevosItemsEn'), { icon: 'ℹ️' })
        } else if (budget && budget.unmatched.length > 0) {
          toast(t('tech.draws.pdfSubidoV0ItemCodesNo', { v0: budget.unmatched.length }),
            { duration: 7000, style: { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' } })
        } else {
          toast.success(t('tech.draws.pdfSubido'))
        }
      } else {
        toast.success(t('tech.draws.archivoSubido'))
      }
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      if (kind === 'APPROVAL' || kind === 'EXCEL') {
        queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t('ui.docs.errorAlSubir')),
  })
  const delMut = useMutation({
    mutationFn: () => drawsApi.deleteDoc(draw.id, kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      if (kind === 'EXCEL') {
        queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        toast.success(t('tech.draws.excelEliminadoCamposExtraidosLimpiadosY'))
      } else {
        toast.success(t('common.documentoEliminado'))
      }
    },
  })

  return (
    <div className={`rounded-lg border p-3 transition-colors ${colors[kind].border}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${colors[kind].icon}`} />
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider flex-1">{label}</div>
        {isRequired && (
          missing
            ? <span className="text-[9px] text-red-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />FALTA</span>
            : <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" />OK</span>
        )}
        {!isRequired && url && (
          <span className="text-[9px] text-blue-700 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" />OK</span>
        )}
      </div>
      {url ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            {isExcel ? <Table2 className="w-3 h-3 text-blue-400 flex-shrink-0" /> : <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />}
            <a href={url} target="_blank" rel="noreferrer" className="text-slate-700 hover:text-[var(--brand-gold)] truncate">
              {name || t('tech.draws.documento')}
            </a>
          </div>
          <div className="flex items-center justify-between">
            <ShareButtons url={url} label={`Draw #${draw.drawNumber} — ${label}`} />
            <button onClick={() => delMut.mutate()} disabled={delMut.isPending}
              className="text-[10px] text-slate-400 hover:text-red-500 disabled:opacity-40">
              {t('common.eliminar')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} disabled={uploadMut.isPending}
          className={`w-full flex items-center justify-center gap-2 text-xs border border-dashed px-3 py-2 rounded transition-colors
            ${isExcel
              ? 'text-blue-700 border-blue-300 hover:bg-blue-100'
              : 'text-red-700 border-red-300 hover:bg-red-100'}`}>
          <Upload className="w-3 h-3" />
          {uploadMut.isPending ? t('tech.draws.subiendo') : isExcel ? t('tech.draws.subirExcelDelLender') : t('tech.draws.subirDocumento')}
        </button>
      )}
      <input ref={fileRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { uploadMut.mutate(f); e.target.value = '' } }} />
    </div>
  )
}

const ESTADOS: DrawEstado[] = ['EMPTY', 'PENDING', 'WIRED']

function estadoBadge(estado: DrawEstado) {
  if (estado === 'WIRED') return <span className="badge-done">{tStatic('tech.draws.wired')}</span>
  if (estado === 'PENDING') return <span className="badge-in-progress">PENDING</span>
  return <span className="badge-pending">—</span>
}

function Field({ label, value, onChange, type = 'text', mono = false }: {
  label: string; value: string; onChange?: (v: string) => void; type?: string; mono?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] text-slate-400 uppercase mb-1">{label}</div>
      {onChange ? (
        <input type={type} defaultValue={value}
          onBlur={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className={`w-full bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:border-[var(--brand-gold)] ${mono ? 'font-mono' : ''}`} />
      ) : (
        <div className={`text-xs text-slate-700 ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
      )}
    </div>
  )
}

function DrawCard({ draw, budgetTotal, budgetExecuted, newAmount, onUpdate, onDelete }: {
  draw: Draw
  projectId: string
  budgetTotal: number
  budgetExecuted: number
  newAmount: number
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const { t } = useI18n()
  const isEmpty = draw.estado === 'EMPTY'
  const [open, setOpen] = useState(!isEmpty)
  const confirm = useConfirm()

  const save = (key: string, raw: string) => {
    const val = ['montoSolicitado','elegibleTrinity','netWire','upbPre','upbPost','saldoHoldback','porcentajeFunded'].includes(key)
      ? parseFloat(raw) || 0
      : raw || null
    onUpdate(draw.id, { [key]: val })
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('tech.draws.eliminarDrawV0', { v0: draw.drawNumber }),
      message: t('tech.draws.seguroQueQuieresEliminarElDraw', { v0: draw.drawNumber }),
      detail: t('tech.draws.estaAccionEliminaraElDrawY'),
      destructive: true,
      confirmText: t('tech.draws.siEliminarDraw'),
    })
    if (ok) onDelete(draw.id)
  }

  // Cross-reference con el construction budget
  const elegible = draw.elegibleTrinity || 0
  const expectedFromBudget = budgetTotal > 0 ? (budgetExecuted / budgetTotal) : 0
  const elegiblePct = budgetTotal > 0 ? elegible / budgetTotal : 0
  const variance = expectedFromBudget - elegiblePct  // positivo si el lender pagó menos de lo ejecutado
  const hasBudget = budgetTotal > 0
  const hasMismatch = hasBudget && elegible > 0 && Math.abs(variance) > 0.05  // > 5% diferencia

  return (
    <div className={`bg-white rounded-2xl border transition-all ${
      draw.estado === 'WIRED' ? 'border-emerald-500/30' :
      draw.estado === 'PENDING' ? 'border-amber-500/30' :
      'border-slate-200/40 opacity-50'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-3 text-left">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono
            ${draw.estado === 'WIRED' ? 'bg-emerald-500/20 text-emerald-400' : draw.estado === 'PENDING' ? 'bg-[#3E5A70]/15 text-[var(--brand-gold)]' : 'bg-slate-200 text-slate-400'}`}>
            {draw.drawNumber}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800">{t('tech.draws.draw')}{draw.drawNumber}</div>
            {newAmount > 0 && (
              <div className="text-[10px] font-mono text-emerald-600 font-semibold">
                +{formatUSD(newAmount)} {t('tech.draws.nuevo')}{draw.elegibleTrinity > 0 ? ` · acum. ${formatUSD(draw.elegibleTrinity)}` : ''}
              </div>
            )}
            {draw.netWire > 0 && <div className="text-[10px] font-mono text-emerald-400">{formatUSD(draw.netWire)} {t('tech.draws.wired2')}</div>}
            {draw.fechaWire && <div className="text-[10px] text-slate-400">{formatDate(draw.fechaWire)}</div>}
          </div>
        </button>
        <div className="flex items-center gap-2">
          {estadoBadge(draw.estado as DrawEstado)}
          <select value={draw.estado} onChange={e => onUpdate(draw.id, { estado: e.target.value })}
            className="bg-slate-200 text-xs text-slate-700 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[var(--brand-gold)]">
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <button
            onClick={handleDelete}
            title={t('tech.draws.eliminarDraw')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {open && !isEmpty && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-200/30 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('tech.draws.montoSolicitado')} value={String(draw.montoSolicitado || '')} mono
              onChange={v => save('montoSolicitado', v)} type="number" />
            <Field label={t('tech.draws.elegibleTrinity')} value={String(draw.elegibleTrinity || '')} mono
              onChange={v => save('elegibleTrinity', v)} type="number" />
            <Field label={t('tech.draws.netWire')} value={String(draw.netWire || '')} mono
              onChange={v => save('netWire', v)} type="number" />
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('tech.draws.funded')}</div>
              <div className="text-sm font-mono text-slate-800 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                {draw.porcentajeFunded ? `${(draw.porcentajeFunded * 100).toFixed(2)}%` : '—'}
              </div>
            </div>
            <Field label={t('tech.draws.upbPre')} value={String(draw.upbPre || '')} mono
              onChange={v => save('upbPre', v)} type="number" />
            <Field label={t('tech.draws.upbPost')} value={String(draw.upbPost || '')} mono
              onChange={v => save('upbPost', v)} type="number" />
            <div className="col-span-2">
              <Field label={t('tech.draws.saldoHoldback')} value={String(draw.saldoHoldback || '')} mono
                onChange={v => save('saldoHoldback', v)} type="number" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('tech.draws.fechaSolicitud')} value={draw.fechaSolicitud?.slice(0, 10) ?? ''}
              onChange={v => save('fechaSolicitud', v)} type="date" />
            <Field label={t('tech.draws.fechaInspeccion')} value={draw.fechaInspeccion?.slice(0, 10) ?? ''}
              onChange={v => save('fechaInspeccion', v)} type="date" />
            <Field label={t('tech.draws.fechaWire')} value={draw.fechaWire?.slice(0, 10) ?? ''}
              onChange={v => save('fechaWire', v)} type="date" />
          </div>

          {/* Cross-reference con Construction Budget */}
          {hasBudget && elegible > 0 && (
            <div className={`text-[11px] rounded-lg px-3 py-2 border ${hasMismatch ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                {hasMismatch ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                {t('tech.draws.cruceConConstructionBudget')}
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                <div>{t('tech.draws.budgetEjecutado')} <span className="font-semibold">{(expectedFromBudget * 100).toFixed(1)}%</span></div>
                <div>{t('tech.draws.lenderPago')} <span className="font-semibold">{(elegiblePct * 100).toFixed(1)}%</span></div>
                <div className={hasMismatch ? 'text-amber-700' : 'text-emerald-700'}>
                  Δ: <span className="font-bold">{(variance * 100).toFixed(1)} {t('tech.draws.pts')}</span>
                </div>
              </div>
              {hasMismatch && (
                <div className="text-[10px] mt-1 italic">
                  {variance > 0
                    ? t('tech.draws.elLenderPagoV0MenosDe', { v0: formatUSD((expectedFromBudget - elegiblePct) * budgetTotal) })
                    : t('tech.draws.elLenderPagoV0MasDe', { v0: formatUSD((elegiblePct - expectedFromBudget) * budgetTotal) })}
                </div>
              )}
            </div>
          )}

          {/* PDF original del draw (si existe) */}
          {draw.pdfUrl && (
            <div className="text-[11px] flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <a href={draw.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[var(--brand-teal)] hover:underline">
                <FileText className="w-3 h-3" />{t('tech.draws.verPdfDelDrawOriginal')}
              </a>
              <ShareButtons url={draw.pdfUrl} label={`Draw #${draw.drawNumber} — PDF`} />
            </div>
          )}

          <Field label={t('common.notas')} value={draw.notas ?? ''} onChange={v => save('notas', v)} />
        </div>
      )}

      {isEmpty && (
        <div className="px-4 pb-3 text-center">
          <button onClick={() => onUpdate(draw.id, { estado: 'PENDING' })}
            className="text-xs text-slate-400 hover:text-[var(--brand-gold)] transition-colors">
            {t('tech.draws.activarDraw')}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── PDF Parse Panel ─────────────────────────────── */
const EXCEL_EXT_RE = /\.(xlsx|xlsm|xls|ods|csv)$/i
const EXCEL_MIME_RE = /(spreadsheetml|ms-excel|opendocument\.spreadsheet|text\/csv)/i
function isImageFile(f: File) { return f.type.startsWith('image/') }
function isExcelFile(f: File) { return EXCEL_MIME_RE.test(f.type) || EXCEL_EXT_RE.test(f.name) }

function PdfParsePanel({ projectId, draws, onClose, onApply }: {
  projectId: string
  draws: Draw[]
  onClose: () => void
  onApply: (drawId: string, data: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)
  const [preview, setPreview] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isExcelResult, setIsExcelResult] = useState(false)
  const [approvals, setApprovals] = useState<DrawLineApproval[]>([])
  const [loading, setLoading] = useState(false)
  const [targetDraw, setTargetDraw] = useState<string>('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleParse = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const result = await drawParseApi.parsePdf(projectId, file)
      setParsed(result.parsed)
      setPreview(result.preview ?? '')
      setImageUrl(result.imageUrl ?? null)
      setIsExcelResult(!!result.isExcel)
      setApprovals(Array.isArray(result.approvals) ? result.approvals : [])
      if (result.parsed.drawNumber) {
        const match = draws.find(d => d.drawNumber === result.parsed.drawNumber)
        if (match) setTargetDraw(match.id)
      }
    } catch (e) {
      setError(t('tech.draws.errorProcesandoElArchivoVerificaQue'))
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!parsed || !targetDraw) return
    const cleanData: Record<string, unknown> = {}
    const fields = ['montoSolicitado','elegibleTrinity','netWire','porcentajeFunded',
                    'upbPre','upbPost','saldoHoldback','fechaSolicitud','fechaInspeccion','fechaWire',
                    'pdfUrl','lenderExcelUrl','lenderExcelName']
    fields.forEach(f => { if (parsed[f] !== undefined && parsed[f] !== null) cleanData[f] = parsed[f] })
    // Activate the draw (move out of EMPTY state)
    cleanData.estado = 'PENDING'
    onApply(targetDraw, cleanData)
    // If the PDF carried line-level approvals (Trinity report), update the construction budget.
    if (approvals.length > 0) {
      try {
        const res = await drawParseApi.applyApprovals(projectId, targetDraw, approvals)
        if (res.newlyApprovedItems > 0) {
          toast.success(
            t('tech.draws.v0ItemSNuevoSPor', { v0: res.newlyApprovedItems, v1: formatUSD(res.newlyApprovedAmount), v2: formatUSD(res.cumulativeApproved) }),
            { duration: 7000 }
          )
        } else if (res.matched > 0) {
          toast(t('tech.draws.sinNuevosItemsEnEsteDraw'), { icon: 'ℹ️' })
        }
        queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
      } catch (e) {
        console.warn('Budget approvals apply failed', e)
      }
    }
    onClose()
  }

  const fmtParsed = (k: string, v: unknown) => {
    if (k === 'porcentajeFunded') return `${((v as number) * 100).toFixed(2)}%`
    if (k === 'pdfUrl' || k === 'lenderExcelUrl') return '✓ archivo guardado'
    if (k === 'lenderExcelName') return String(v)
    if (typeof v === 'number') return formatUSD(v as number)
    if (typeof v === 'string' && (v.includes('T00:') || v.includes('Z'))) return formatDate(v)
    return String(v)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/40">
          <div>
            <div className="text-sm font-semibold text-slate-900">{t('tech.draws.cargarDraw')}</div>
            <div className="text-xs text-slate-400 mt-0.5">{t('tech.draws.subeElPdfExcelDelLender')}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-[#3E5A70]/40 text-slate-700 hover:text-slate-900 text-sm rounded-xl transition-all">
                <Upload className="w-4 h-4" />
                {file ? file.name : t('common.seleccionarArchivo')}
              </button>
              <input ref={fileRef} type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.xlsx,.xlsm,.xls,.ods,.csv,application/pdf,image/*,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,text/csv"
                className="hidden"
                onChange={e => { setFile(e.target.files?.[0] ?? null); setParsed(null); setImageUrl(null); setIsExcelResult(false) }} />
              {file && (
                <button onClick={handleParse} disabled={loading}
                  className="px-4 py-2.5 bg-[var(--brand-gold)] btn-animated hover:bg-[#4A6880] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                  {loading ? t('common.procesando') : isImageFile(file) ? t('tech.draws.subirImagen') : isExcelFile(file) ? t('tech.draws.extraerDatosDelExcel') : t('tech.draws.extraerDatos')}
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              {t('tech.draws.formatosAceptados')} <span className="font-mono">{t('tech.draws.pdfExcelXlsxXlsCsvJpg')}</span> {t('tech.draws.hasta50Mb')}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          )}

          {imageUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <img src={imageUrl} alt={t('fin.projDet.documentoSubido')} className="w-full max-h-64 object-contain bg-slate-50" />
              <p className="text-[10px] text-slate-400 text-center py-2">
                {t('tech.draws.imagenGuardadaCompletaLosCamposDel')}
              </p>
            </div>
          )}

          {parsed && (
            <>
              <div className="bg-white/60 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-700">
                    {imageUrl ? t('tech.draws.imagenGuardadaCompletaLosCamposManualmente')
                      : isExcelResult ? t('tech.draws.datosExtraidosDelExcelV0', { v0: Object.keys(parsed).length === 0 ? ' — no se detectaron campos, complétalos manualmente' : '' })
                      : t('tech.draws.datosExtraidosDelPdf')}
                  </span>
                </div>
                {Object.keys(parsed).length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic">
                    {t('tech.draws.elArchivoSeGuardoPeroNo')}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(parsed).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between bg-slate-50/40 rounded-lg px-3 py-1.5">
                        <span className="text-[10px] text-slate-400 uppercase">
                          {({'drawNumber':'Draw #','montoSolicitado':t('tech.draws.montoSolicitado'),'elegibleTrinity':'Eligible Trinity',
                            'porcentajeFunded':'% Financiado','fechaSolicitud':t('tech.draws.fechaSolicitud'),'fechaInspeccion':t('tech.draws.fechaInspeccion'),
                            'fechaWire':t('tech.draws.fechaWire'),'netWire':'Net Wire','pdfUrl':'Archivo PDF',
                            'lenderExcelUrl':'Archivo Excel','lenderExcelName':t('tech.draws.nombreExcel'),
                            'upbPre':'UPB Pre','upbPost':'UPB Post','saldoHoldback':t('dash.holdbackBalance')} as Record<string,string>)[k] ?? k}
                        </span>
                        <span className="text-xs font-mono text-[var(--brand-teal)]">{fmtParsed(k, v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Line-level approvals preview — only present when parsing a Trinity draw PDF.
                  Per the lender's methodology, every draw report reprints the full item list
                  with the cumulative state. We split into "this draw" (newly approved here)
                  vs "carryover" (already approved in previous draws) so the user can see
                  exactly what this draw added without re-counting old work. */}
              {(() => {
                const newItems = approvals.filter(a => a.deltaThisDraw > 0)
                const carryover = approvals.filter(a => a.deltaThisDraw <= 0 && a.currentAmountAvailable > 0)
                const newTotal = newItems.reduce((s, a) => s + a.deltaThisDraw, 0)
                const carryTotal = carryover.reduce((s, a) => s + a.currentAmountAvailable, 0)
                if (approvals.length === 0) return null
                return (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-semibold text-slate-700">
                          {newItems.length > 0
                            ? t('tech.draws.v0ItemSNuevoSEn', { v0: newItems.length, v1: formatUSD(newTotal) })
                            : t('tech.draws.sinItemsNuevosEnEsteDraw')}
                        </span>
                      </div>
                      {carryover.length > 0 && (
                        <span className="text-[10px] text-slate-500">
                          ({carryover.length} {t('tech.draws.previos')} {formatUSD(carryTotal)} {t('tech.draws.yaEnBudget')}
                        </span>
                      )}
                    </div>
                    {newItems.length > 0 && (
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-[11px]">
                          <thead className="sticky top-0 bg-emerald-50">
                            <tr className="text-left text-slate-400 uppercase tracking-wider text-[9px]">
                              <th className="py-1 pr-2 w-12">{t('tech.draws.item')}</th>
                              <th className="py-1 pr-2">{t('common.descripcion')}</th>
                              <th className="py-1 px-2 text-right w-14">{t('tech.draws.nuevo2')}</th>
                              <th className="py-1 px-2 text-right w-20">{t('tech.draws.esteDraw')}</th>
                              <th className="py-1 pl-2 text-right w-24">{t('tech.draws.cumulativo')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {newItems.map((a) => (
                              <tr key={a.itemCode} className="border-t border-emerald-100">
                                <td className="py-1 pr-2 font-mono text-slate-600">{a.itemCode}</td>
                                <td className="py-1 pr-2 text-slate-700 truncate max-w-[160px]">{a.description}</td>
                                <td className="py-1 px-2 text-right font-mono text-slate-500">{a.thisInspectionPct.toFixed(0)}%</td>
                                <td className="py-1 px-2 text-right font-mono text-emerald-700 font-bold">+{formatUSD(a.deltaThisDraw)}</td>
                                <td className="py-1 pl-2 text-right font-mono text-slate-500">{formatUSD(a.currentAmountAvailable)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">{t('tech.draws.aplicarAlDraw')}</div>
                <select value={targetDraw} onChange={e => setTargetDraw(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[var(--brand-gold)]">
                  <option value="">{t('tech.draws.seleccionarDraw')}</option>
                  {draws.map(d => (
                    <option key={d.id} value={d.id}>{t('tech.draws.draw')}{d.drawNumber} ({d.estado})</option>
                  ))}
                </select>
              </div>

              <button onClick={handleApply} disabled={!targetDraw}
                className="w-full py-2.5 bg-[var(--brand-gold)] btn-animated hover:bg-[#4A6880] disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                {t('tech.draws.guardarDatosEnDraw')}{draws.find(d => d.id === targetDraw)?.drawNumber ?? '—'}
              </button>
            </>
          )}

          {preview && (
            <details className="text-[10px] text-slate-400 font-mono">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-500 transition-colors">
                <FileText className="w-3 h-3 inline mr-1" />{t('tech.draws.verTextoExtraidoDel')} {isExcelResult ? t('tech.draws.excel') : 'PDF'}
              </summary>
              <pre className="mt-2 bg-slate-100 rounded-lg p-3 overflow-x-auto max-h-40 text-slate-600 whitespace-pre-wrap">{preview}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

// Excel general del lender (nivel proyecto): complementa y valida los PDF por draw.
function LenderExcelPanel({ projectId }: { projectId: string }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: validation } = useQuery<DrawsValidation>({
    queryKey: ['draws-validation', projectId],
    queryFn: () => drawsApi.validation(projectId),
  })

  const uploadMut = useMutation({
    mutationFn: (f: File) => drawsApi.uploadLenderExcel(projectId, f),
    onSuccess: (res) => {
      const err = (res as any)?.extractionError as string | null | undefined
      const applied = (res as any)?.drawsApplied as number | undefined
      if (err) {
        toast.error(t('tech.draws.excelSubidoPeroLaLecturaAutomatica', { v0: err }), { duration: 8000 })
      } else {
        const w = res?.data?.warnings?.length ?? 0
        const desemMsg = applied && applied > 0 ? t('tech.draws.desembolsoAplicadoAV0DrawS', { v0: applied }) : ''
        toast.success((w > 0 ? t('tech.draws.excelCargadoV0DiferenciaSDetectada', { v0: w }) : t('tech.draws.excelCargadoYValidadoLosTotales')) + desemMsg)
      }
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t('tech.draws.errorAlSubirElExcel')),
  })

  const delMut = useMutation({
    mutationFn: () => drawsApi.deleteLenderExcel(projectId),
    onSuccess: () => {
      toast.success(t('tech.draws.excelGeneralEliminado'))
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
    },
  })

  // Sincroniza el desembolsado (netWire) por draw desde el Excel YA cargado.
  const syncMut = useMutation({
    mutationFn: () => drawsApi.syncFromExcel(projectId),
    onSuccess: (res) => {
      const applied = (res as any)?.drawsApplied ?? 0
      toast.success(applied > 0 ? t('tech.draws.desembolsoSincronizadoEnV0DrawS', { v0: applied }) : t('tech.draws.excelLeidoSinFilasDeDesembolso'))
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t('tech.draws.errorAlSincronizarDesdeElExcel')),
  })

  // Auto-sincronización: si hay Excel cargado pero el desembolsado total está en 0,
  // se dispara una sola vez para poblar el netWire sin que el usuario resuba nada.
  const autoSyncedRef = useRef(false)
  const hasExcel = !!validation?.file?.url
  const totalWiredNow = validation?.system?.totalWired ?? 0
  useEffect(() => {
    if (hasExcel && totalWiredNow === 0 && !autoSyncedRef.current && !syncMut.isPending) {
      autoSyncedRef.current = true
      syncMut.mutate()
    }
  }, [hasExcel, totalWiredNow]) // eslint-disable-line react-hooks/exhaustive-deps

  const modeMut = useMutation({
    mutationFn: (m: 'ACUMULADO' | 'INCREMENTAL') => projectsApi.patch(projectId, { drawValuesMode: m }),
    onSuccess: () => {
      toast.success(t('tech.draws.modoDelLenderActualizado'))
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  const mode = validation?.mode ?? 'ACUMULADO'
  const file = validation?.file
  const warnings = validation?.warnings ?? []
  const comparison = validation?.comparison ?? {}

  return (
    <div className="section-card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-blue-600" />
          <div>
            <div className="text-sm font-semibold text-slate-800">{t('tech.draws.excelGeneralDelLender')}</div>
            <div className="text-[11px] text-slate-500">{t('tech.draws.unSoloArchivoConLosTotales')}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {file?.url && (
            <>
              <a href={file.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline flex items-center gap-1">
                <FileText className="w-3 h-3" />{file.name || t('tech.draws.excel')}
              </a>
              <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
                className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-40 flex items-center gap-1"
                title={t('tech.draws.vuelveALeerElExcelCargado')}>
                {syncMut.isPending ? t('tech.draws.sincronizando') : t('tech.draws.sincronizarDesembolso')}
              </button>
              <button onClick={() => delMut.mutate()} disabled={delMut.isPending} className="text-[11px] text-slate-400 hover:text-red-500 disabled:opacity-40">{t('common.eliminar')}</button>
            </>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploadMut.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" />{uploadMut.isPending ? t('tech.draws.subiendo') : file?.url ? t('tech.draws.reemplazarExcel') : t('tech.draws.cargarExcelDelLender')}
          </button>
          <input ref={fileRef} type="file"
            accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { uploadMut.mutate(f); e.target.value = '' } }} />
        </div>
      </div>

      {/* Modo de reporte del lender — se adapta a cada lender/formato */}
      <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
        <span className="text-[11px] font-medium text-slate-600">{t('tech.draws.losReportesDeEsteLenderSon')}</span>
        <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {([['ACUMULADO', 'Acumulados'], ['INCREMENTAL', t('tech.draws.soloDeEsteDraw')]] as const).map(([v, l]) => (
            <button key={v} onClick={() => modeMut.mutate(v)} disabled={modeMut.isPending}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${mode === v ? 'bg-[var(--brand-teal)] text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-400">
          {mode === 'ACUMULADO' ? t('tech.draws.cadaDrawIncluyeLosAnterioresEj') : t('tech.draws.cadaDrawTraeSoloSuMonto')}
        </span>
      </div>

      {validation && (warnings.length > 0 || Object.keys(comparison).length > 0) && (
        <div className="mt-3 space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{w}
            </div>
          ))}
          {Object.entries(comparison).map(([k, c]) => (
            <div key={k} className={`text-[11px] rounded-lg px-3 py-2 border flex items-center justify-between ${c.difiere ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              <span className="font-semibold uppercase">{k}</span>
              <span className="font-mono">{t('tech.draws.excel')} {formatUSD(c.excel)} {t('tech.draws.sistema')} {formatUSD(c.sistema)} {c.difiere ? '⚠' : '✓'}</span>
            </div>
          ))}
        </div>
      )}
      {validation && warnings.length === 0 && file?.url && (
        <div className="mt-3 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5" />{t('tech.draws.losTotalesDelSistemaCuadranCon')}
        </div>
      )}
    </div>
  )
}

export default function Draws({ projectId }: { projectId: string }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showParse, setShowParse] = useState(false)
  const [showTimeline, setShowTimeline] = useState(true)
  // Chequeo de consistencia Draw ↔ Budget (testeo integral bajo demanda)
  const [consistency, setConsistency] = useState<DrawsConsistency | null>(null)
  const [checking, setChecking] = useState(false)

  const runConsistency = async () => {
    setChecking(true)
    try {
      const r = await drawsApi.consistency(projectId)
      setConsistency(r)
      if (r.ok) toast.success(t('tech.draws.sincronizacionVerificadaDrawsYConstruction'))
      else toast.error(t('tech.draws.seDetectaronV0ProblemaSDe', { v0: r.issues.length }), { duration: 6000 })
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('tech.draws.errorAlVerificar'))
    } finally {
      setChecking(false)
    }
  }

  const { data: draws = [], isLoading } = useQuery<Draw[]>({
    queryKey: ['draws', projectId],
    queryFn: () => drawsApi.list(projectId),
  })

  const { data: project } = useQuery<any>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  })

  const { data: budgetLines = [] } = useQuery<BudgetLine[]>({
    queryKey: ['construction-budget', projectId],
    queryFn: () => constructionBudgetApi.list(projectId),
  })

  const budgetTotal = budgetLines.reduce((s, b) => s + (b.valorInicial || 0), 0)
  const budgetExecuted = budgetLines.reduce((s, b) => s + (b.valorEjecutado || 0), 0)
  const initialHoldback: number = project?.holdback ?? 0

  const { data: validation } = useQuery<DrawsValidation>({
    queryKey: ['draws-validation', projectId],
    queryFn: () => drawsApi.validation(projectId),
  })
  const totalAprobado = validation?.system.totalApproved ?? 0
  const budgetTotalV = validation?.system.budgetTotal || budgetTotal
  const aprobadoOverflow = budgetTotalV > 0 && totalAprobado > budgetTotalV + 1

  // Monto NUEVO de cada draw — calculado por el backend según el modo del lender
  // (ACUMULADO: resta el draw anterior · INCREMENTAL: ya es lo de este draw).
  const newAmountByDraw = validation?.perDraw ?? {}

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => drawsApi.patch(id, data),
    onSuccess: () => {
      // PATCH on any draw triggers recalcHoldback on the backend (saldo + UPB chain),
      // which touches multiple draws and the project's snapshot — refresh all of them
      // so the Financial dashboard and Construction Budget reflect the new state.
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => drawsApi.deleteDraw(id),
    onSuccess: () => {
      toast.success(t('tech.draws.drawEliminadoRecalculandoHoldbackYBudget'))
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t('tech.draws.errorAlEliminarDraw')),
  })

  const addDrawMutation = useMutation({
    mutationFn: () => drawsApi.create(projectId),
    onSuccess: (created: any) => {
      toast.success(t('tech.draws.drawV0Creado', { v0: created?.drawNumber ?? '' }))
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t('tech.draws.errorAlCrearDraw')),
  })

  // Saldo holdback: usar netWire (la realidad financiera), NO estado === 'WIRED'.
  // Antes el KPI se quedaba en $395,350 cuando el draw tenía netWire pero su
  // estado seguía en PENDING/EMPTY — usuario reportó este bug con LOTE 87.
  // Misma regla que backend/recalcHoldback (acumula netWire de TODOS los draws).
  const drawsConWire = draws.filter(d => d.netWire > 0)
  const totalWired = drawsConWire.reduce((s, d) => s + d.netWire, 0)
  const wiredDraws = drawsConWire // backward-compat para vistas que lo usan abajo
  const lastSaldo = Math.max(0, initialHoldback - totalWired)

  // Auditoría: solo la APROBACIÓN del lender es requerida — es la que alimenta
  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">{t('tech.draws.cargandoDraws')}</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><Landmark className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('tech.draws.drawTracker')}</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('tech.draws.heraHoldingsLlcHistorialDeDesembolsos')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={async () => {
              const ok = await confirm({
                title: t('tech.draws.resetearSeccionDraws'),
                message: t('tech.draws.estoBorraraTodosLosDrawsDe'),
                detail: t('tech.draws.despuesVuelveACargarElHud'),
                confirmText: 'Resetear',
                destructive: true,
                typeToConfirm: 'RESETEAR',
              })
              if (!ok) return
              try {
                await projectsApi.resetDrawsSection(projectId)
                toast.success(t('tech.draws.seccionDrawsReseteadaTodasLasKpis'))
                queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
                queryClient.invalidateQueries({ queryKey: ['project', projectId] })
                queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
              } catch (e: any) {
                toast.error(e?.response?.data?.error || t('tech.draws.errorAlResetear'))
              }
            }}
            className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium rounded-xl transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            {t('tech.draws.resetearSeccion')}
          </button>
          <button onClick={runConsistency}
            disabled={checking}
            title={t('tech.draws.testeoIntegralVerificaQueCadaPdf')}
            className="flex items-center gap-2 px-3 py-2 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-medium rounded-xl transition-colors disabled:opacity-40">
            <ShieldCheck className="w-3.5 h-3.5" />
            {checking ? t('tech.draws.verificando') : t('tech.draws.verificarSincronizacion')}
          </button>
          <button onClick={async () => {
              const ok = await confirm({
                title: t('tech.draws.repararConstructionBudget'),
                message: t('tech.draws.recomputeElValorAprobadoDeCada'),
                detail: t('tech.draws.estaAccionNoTocaTusDraws'),
                confirmText: 'Reparar budget',
              })
              if (!ok) return
              try {
                const toastId = toast.loading(t('tech.draws.reProcesandoPdfsDeAprobacion'))
                const r = await drawParseApi.rebuildContributions(projectId)
                toast.dismiss(toastId)
                const errors = r.report.filter(x => x.error).length
                toast.success(
                  t('tech.draws.reparadoV0DrawSProcesadosTotal', { v0: r.drawsProcessed, v1: formatUSD(r.totalAprobado), v2: errors > 0 ? ` · ${errors} con error` : '' }),
                  { duration: 8000 }
                )
                queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
                queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
                queryClient.invalidateQueries({ queryKey: ['project', projectId] })
              } catch (e: any) {
                toast.error(e?.response?.data?.error || t('tech.draws.errorAlReparar'))
              }
            }}
            title={t('tech.draws.reconstruirLaColumnaAprobadoDelBudget')}
            className="flex items-center gap-2 px-3 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-medium rounded-xl transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            {t('tech.draws.repararBudget')}
          </button>
          <button onClick={async () => {
              const ok = await confirm({
                title: t('tech.draws.corregirValoresAcumulados'),
                message: t('tech.draws.losReportesDelLenderSonAcumulados'),
                detail: t('tech.draws.usaloUnaSolaVezSiEl'),
                confirmText: 'Corregir acumulados',
              })
              if (!ok) return
              try {
                const r = await drawsApi.repairCumulative(projectId)
                toast.success(t('tech.draws.corregidoV0AporteSEnV1', { v0: r.contribsFixed, v1: r.linesFixed, v2: formatUSD(r.totalAprobado) }), { duration: 9000 })
                queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
                queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
                queryClient.invalidateQueries({ queryKey: ['project', projectId] })
                queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
              } catch (e: any) {
                toast.error(e?.response?.data?.error || t('tech.draws.errorAlCorregir'))
              }
            }}
            title={t('tech.draws.convierteContribucionesAcumuladasPorItemA')}
            className="flex items-center gap-2 px-3 py-2 border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-medium rounded-xl transition-colors">
            <TrendingDown className="w-3.5 h-3.5" />
            {t('tech.draws.corregirAcumulados')}
          </button>
          <button onClick={() => addDrawMutation.mutate()}
            disabled={addDrawMutation.isPending}
            title={t('tech.draws.agregarUnDrawVacioAlFinal')}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-xl transition-colors disabled:opacity-40">
            <span className="text-base leading-none">+</span>
            {addDrawMutation.isPending ? t('tech.draws.agregando') : t('tech.draws.agregarDraw')}
          </button>
          <button onClick={() => setShowParse(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-gold)] btn-animated hover:bg-[#4A6880] text-white text-sm font-medium rounded-xl transition-colors">
            <Upload className="w-4 h-4" />
            {t('tech.draws.cargarDrawPdf')}
          </button>
        </div>
      </div>

      {/* ── PANEL DE VERIFICACIÓN Draw ↔ Construction Budget ── */}
      {consistency && (
        <div className={`rounded-2xl border p-4 ${consistency.ok ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/40'}`}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${consistency.ok ? 'text-emerald-600' : 'text-red-600'}`} />
              <span className="text-sm font-bold text-slate-800">
                {consistency.ok
                  ? t('tech.draws.sincronizacionVerificadaTodoCoherente')
                  : t('tech.draws.v0ProblemaSDeSincronizacionDetectado', { v0: consistency.issues.length })}
              </span>
            </div>
            <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setConsistency(null)}><X className="w-4 h-4" /></button>
          </div>

          {/* Totales cruzados */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
            {[
              { label: t('tech.draws.budgetInicial'), v: consistency.totals.budgetInicial },
              { label: t('tech.draws.aprobadoBudget'), v: consistency.totals.budgetAprobado },
              { label: t('tech.draws.contribuciones'), v: consistency.totals.contribuciones },
              { label: t('tech.draws.elegibleDraws'), v: consistency.totals.elegibleDraws },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{k.label}</div>
                <div className="font-mono font-semibold text-slate-700">{formatUSD(k.v)}</div>
              </div>
            ))}
          </div>

          {/* Problemas encontrados */}
          {consistency.issues.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {consistency.issues.map((iss, i) => (
                <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${iss.level === 'critical' ? 'bg-red-100/70 text-red-800' : 'bg-amber-100/70 text-amber-800'}`}>
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">{iss.title}</div>
                    <div className="opacity-90">{iss.detail}</div>
                  </div>
                </div>
              ))}
              <div className="text-[11px] text-slate-600 px-1">
                {t('tech.draws.paraCorregirUsa')} <b>{t('tech.draws.repararBudget')}</b> {t('tech.draws.reProcesaTodosLosPdfsCon')}
              </div>
            </div>
          )}

          {/* Estado por draw */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <th className="text-left py-1.5 pr-3">{t('tech.draws.draw2')}</th>
                  <th className="text-left py-1.5 pr-3">{t('tech.draws.pdfAprobacion')}</th>
                  <th className="text-right py-1.5 pr-3">{t('tech.draws.elegible')}</th>
                  <th className="text-right py-1.5 pr-3">{t('tech.draws.lineasAlBudget')}</th>
                  <th className="text-right py-1.5 pr-3">{t('tech.draws.aportado')}</th>
                  <th className="text-left py-1.5">{t('tech.draws.sinMatchear')}</th>
                </tr>
              </thead>
              <tbody>
                {consistency.draws.map(d => {
                  const bad = (d.hasApprovalPdf && d.contribLines === 0) || (!d.hasApprovalPdf && (d.elegibleTrinity || 0) > 0)
                  const un = d.sync?.unmatched?.length ?? 0
                  return (
                    <tr key={d.id} className={`border-b border-slate-100 ${bad ? 'bg-red-50' : ''}`}>
                      <td className="py-1.5 pr-3 font-semibold text-slate-700">#{d.drawNumber}</td>
                      <td className="py-1.5 pr-3">{d.hasApprovalPdf
                        ? <span className="text-emerald-700">{t('fin.cat.si')}</span>
                        : (d.elegibleTrinity || 0) > 0
                          ? <span className="text-red-600 font-bold">FALTA</span>
                          : <span className="text-slate-400">—</span>}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-slate-700">{formatUSD(d.elegibleTrinity || 0)}</td>
                      <td className={`py-1.5 pr-3 text-right font-mono ${bad ? 'text-red-600 font-bold' : 'text-slate-700'}`}>{d.contribLines}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-slate-700">{formatUSD(d.contribTotal)}</td>
                      <td className="py-1.5">
                        {un > 0
                          ? <span className="text-amber-700 font-semibold">{un}: {d.sync!.unmatched.slice(0, 3).join(' · ')}{un > 3 ? '…' : ''}</span>
                          : d.hasApprovalPdf ? <span className="text-emerald-700">0</span> : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Excel general del lender — carga y validación (parte superior) */}
      <LenderExcelPanel projectId={projectId} />

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="kpi-card">
          <div className="text-xs text-slate-400 uppercase mb-1">{t('tech.draws.holdbackInicial')}</div>
          <div className="text-xl font-bold font-mono text-slate-800">{formatUSD(initialHoldback)}</div>
          <div className="text-[10px] text-slate-400 mt-1">{t('tech.draws.segunHudDeCierre')}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-slate-400 uppercase mb-1">{t('tech.draws.totalAprobado')}</div>
          <div className={`text-xl font-bold font-mono ${aprobadoOverflow ? 'text-red-500' : 'text-slate-800'}`}>{formatUSD(totalAprobado)}</div>
          <div className={`text-[10px] mt-1 ${aprobadoOverflow ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
            {aprobadoOverflow ? t('tech.draws.superaElBudget') : t('tech.draws.deV0Budget', { v0: formatUSD(budgetTotalV) })}
          </div>
        </div>
        <div className="kpi-card kpi-card-green">
          <div className="text-xs text-slate-400 uppercase mb-1">{t('tech.draws.totalDesembolsado')}</div>
          <div className="text-xl font-bold font-mono text-emerald-500">{formatUSD(totalWired)}</div>
          <div className="text-xs text-slate-400 mt-1">{wiredDraws.length} {t('tech.draws.drawSWired')}</div>
        </div>
        <div className="kpi-card kpi-card-amber">
          <div className="text-xs text-slate-400 uppercase mb-1">{t('tech.draws.saldoPendientePorGirar')}</div>
          <div className={`text-xl font-bold font-mono ${lastSaldo < 50000 ? 'text-red-500' : lastSaldo < 100000 ? 'text-[var(--brand-gold)]' : 'text-slate-900'}`}>
            {formatUSD(lastSaldo)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {initialHoldback > 0 ? `${((totalWired / initialHoldback) * 100).toFixed(1)}% consumido` : t('tech.draws.holdbackDesembolsado')}
          </div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-slate-400 uppercase mb-1">{t('tech.draws.draws')}</div>
          <div className="text-xl font-bold font-mono text-slate-900">{wiredDraws.length} / {draws.filter(d => d.estado !== 'EMPTY').length}</div>
          <div className="text-[10px] text-slate-400 mt-1">{draws.filter(d => d.estado === 'EMPTY').length} {t('tech.draws.disponibles')}</div>
        </div>
      </div>

      {/* ── Holdback sequence timeline ── */}
      {wiredDraws.length > 0 && (
        <div className="section-card overflow-hidden">
          <button
            onClick={() => setShowTimeline(t => !t)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[var(--brand-teal)]" />
              <span className="text-sm font-semibold text-slate-800">{t('tech.draws.secuenciaDeHoldbackDrawADraw')}</span>
              <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{wiredDraws.length} {t('tech.draws.drawsWired')}</span>
              <span className="text-[10px] text-slate-400 hidden md:inline">{t('tech.draws.seActualizaAutomaticamenteConCadaExcel')}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTimeline ? '' : '-rotate-90'}`} />
          </button>
          {showTimeline && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2 text-left text-[10px] text-slate-400 uppercase tracking-wider w-16">{t('tech.draws.draw2')}</th>
                    <th className="px-4 py-2 text-left text-[10px] text-slate-400 uppercase tracking-wider">{t('tech.draws.fechaWire')}</th>
                    <th className="px-4 py-2 text-right text-[10px] text-slate-400 uppercase tracking-wider">{t('tech.draws.solicitado')}</th>
                    <th className="px-4 py-2 text-right text-[10px] text-emerald-600/70 uppercase tracking-wider">{t('tech.draws.aprobadoNetWire')}</th>
                    <th className="px-4 py-2 text-right text-[10px] text-[#3E5A70]/80 uppercase tracking-wider">{t('tech.draws.saldoHoldback2')}</th>
                    <th className="px-4 py-2 text-center text-[10px] text-slate-400 uppercase tracking-wider w-20">{t('tech.draws.cons')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let cumulative = 0
                    return wiredDraws.map((d) => {
                      cumulative += d.netWire
                      const saldo = Math.max(0, initialHoldback - cumulative)
                      const pct = initialHoldback > 0 ? (cumulative / initialHoldback) * 100 : 0
                      return (
                        <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <span className="w-6 h-6 rounded bg-emerald-500/15 text-emerald-600 text-[10px] font-bold flex items-center justify-center">{d.drawNumber}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">{d.fechaWire ? formatDate(d.fechaWire) : '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-600">{d.montoSolicitado > 0 ? formatUSD(d.montoSolicitado) : '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-600">{formatUSD(d.netWire)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold">
                            <span className={saldo < 50000 ? 'text-red-500' : saldo < 100000 ? 'text-[var(--brand-gold)]' : 'text-slate-800'}>
                              {formatUSD(saldo)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 justify-center">
                              <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-mono font-semibold text-emerald-600">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider">{t('common.total')}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-600">{formatUSD(totalWired)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold">
                      <span className={lastSaldo < 50000 ? 'text-red-500' : 'text-[var(--brand-gold)]'}>{formatUSD(lastSaldo)}</span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {draws.map(draw => (
          <DrawCard key={draw.id} draw={draw} projectId={projectId}
            budgetTotal={budgetTotal} budgetExecuted={budgetExecuted}
            newAmount={newAmountByDraw[draw.id] ?? 0}
            onUpdate={(id, data) => mutation.mutate({ id, data })}
            onDelete={(id) => deleteMutation.mutate(id)} />
        ))}
      </div>

      {showParse && (
        <PdfParsePanel
          projectId={projectId}
          draws={draws}
          onClose={() => setShowParse(false)}
          onApply={(drawId, data) => mutation.mutate({ id: drawId, data })}
        />
      )}
    </div>
  )
}
