import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { drawsApi, drawParseApi, constructionBudgetApi, projectsApi, phasesApi, type DrawLineApproval, type DrawsValidation } from '../lib/api'
import { formatUSD, formatDate } from '../lib/calculations'
import type { Draw, DrawEstado, Phase } from '../lib/types'
import { Upload, FileText, CheckCircle, X, AlertTriangle, Mail, MessageCircle, Download, Trash2, Table2, TrendingDown, ChevronDown, RefreshCw, ClipboardCheck, Landmark } from 'lucide-react'
import { useConfirm } from '../components/ConfirmDialog'
import toast from 'react-hot-toast'

interface BudgetLine {
  id: string
  itemNumber: string
  description: string
  valorInicial: number
  valorEjecutado: number
}

// Botones de share (email, WhatsApp, descarga) para un documento
function ShareButtons({ url, label }: { url: string; label: string }) {
  const subject = encodeURIComponent(`Documento: ${label}`)
  const body = encodeURIComponent(`Aquí el documento "${label}":\n\n${url}`)
  const wa = encodeURIComponent(`Aquí el documento "${label}":\n${url}`)
  return (
    <div className="flex items-center gap-1.5">
      <a href={url} download target="_blank" rel="noreferrer"
        title="Descargar"
        className="text-slate-400 hover:text-[var(--brand-teal)] p-1 rounded transition-colors">
        <Download className="w-3.5 h-3.5" />
      </a>
      <a href={`mailto:?subject=${subject}&body=${body}`}
        title="Enviar por email"
        className="text-slate-400 hover:text-[var(--brand-gold)] p-1 rounded transition-colors">
        <Mail className="w-3.5 h-3.5" />
      </a>
      <a href={`https://wa.me/?text=${wa}`} target="_blank" rel="noreferrer"
        title="Compartir por WhatsApp"
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
        toast.error(`Archivo subido pero la extracción automática falló: ${extractionError}`,
          { duration: 9000, style: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' } })
      } else if (kind === 'EXCEL') {
        if (parsedDrawN && parsedDrawN !== draw.drawNumber) {
          toast(`⚠ El Excel pertenece a Draw #${parsedDrawN} pero lo subiste al Draw #${draw.drawNumber}. Verifica antes de guardar.`,
            { duration: 8000, style: { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' } })
        } else if (extractedCount > 0) {
          toast.success(`Excel subido — ${extractedCount} campo(s) extraído(s) automáticamente`)
        } else {
          toast.success('Excel subido — no se detectaron campos automáticos, complétalos manualmente')
        }
      } else if (kind === 'APPROVAL') {
        if (budget && budget.newlyApprovedItems > 0) {
          toast.success(
            `Draw aplicado: +${budget.newlyApprovedItems} item(s) nuevo(s) por ${formatUSD(budget.newlyApprovedAmount)}.\nTotal aprobado del proyecto: ${formatUSD(budget.cumulativeApproved)}`,
            { duration: 7000 }
          )
        } else if (budget && budget.matched > 0) {
          toast(`PDF subido — sin nuevos items en este draw (todo ya estaba aprobado)`, { icon: 'ℹ️' })
        } else if (budget && budget.unmatched.length > 0) {
          toast(`PDF subido — ${budget.unmatched.length} item codes no coinciden con el budget. Verifica que se haya inicializado.`,
            { duration: 7000, style: { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' } })
        } else {
          toast.success('PDF subido')
        }
      } else {
        toast.success('Archivo subido')
      }
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      if (kind === 'APPROVAL' || kind === 'EXCEL') {
        queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al subir'),
  })
  const delMut = useMutation({
    mutationFn: () => drawsApi.deleteDoc(draw.id, kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      if (kind === 'EXCEL') {
        queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        toast.success('Excel eliminado — campos extraídos limpiados y holdback recalculado')
      } else {
        toast.success('Documento eliminado')
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
              {name || 'Documento'}
            </a>
          </div>
          <div className="flex items-center justify-between">
            <ShareButtons url={url} label={`Draw #${draw.drawNumber} — ${label}`} />
            <button onClick={() => delMut.mutate()} disabled={delMut.isPending}
              className="text-[10px] text-slate-400 hover:text-red-500 disabled:opacity-40">
              Eliminar
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
          {uploadMut.isPending ? 'Subiendo...' : isExcel ? 'Subir Excel del lender' : 'Subir documento'}
        </button>
      )}
      <input ref={fileRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { uploadMut.mutate(f); e.target.value = '' } }} />
    </div>
  )
}

const ESTADOS: DrawEstado[] = ['EMPTY', 'PENDING', 'WIRED']

function estadoBadge(estado: DrawEstado) {
  if (estado === 'WIRED') return <span className="badge-done">WIRED ✓</span>
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
      title: `Eliminar Draw #${draw.drawNumber}`,
      message: `¿Seguro que quieres eliminar el Draw #${draw.drawNumber}?`,
      detail: 'Esta acción eliminará el draw y todos sus documentos asociados. No se puede deshacer.',
      destructive: true,
      confirmText: 'Sí, eliminar draw',
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
            ${draw.estado === 'WIRED' ? 'bg-emerald-500/20 text-emerald-400' : draw.estado === 'PENDING' ? 'bg-[#2E6BB4]/15 text-[var(--brand-gold)]' : 'bg-slate-200 text-slate-400'}`}>
            {draw.drawNumber}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800">Draw #{draw.drawNumber}</div>
            {newAmount > 0 && (
              <div className="text-[10px] font-mono text-emerald-600 font-semibold">
                +{formatUSD(newAmount)} nuevo{draw.elegibleTrinity > 0 ? ` · acum. ${formatUSD(draw.elegibleTrinity)}` : ''}
              </div>
            )}
            {draw.netWire > 0 && <div className="text-[10px] font-mono text-emerald-400">{formatUSD(draw.netWire)} wired</div>}
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
            title="Eliminar draw"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {open && !isEmpty && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-200/30 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto Solicitado" value={String(draw.montoSolicitado || '')} mono
              onChange={v => save('montoSolicitado', v)} type="number" />
            <Field label="Elegible Trinity" value={String(draw.elegibleTrinity || '')} mono
              onChange={v => save('elegibleTrinity', v)} type="number" />
            <Field label="Net Wire" value={String(draw.netWire || '')} mono
              onChange={v => save('netWire', v)} type="number" />
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">% Funded</div>
              <div className="text-sm font-mono text-slate-800 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                {draw.porcentajeFunded ? `${(draw.porcentajeFunded * 100).toFixed(2)}%` : '—'}
              </div>
            </div>
            <Field label="UPB Pre" value={String(draw.upbPre || '')} mono
              onChange={v => save('upbPre', v)} type="number" />
            <Field label="UPB Post" value={String(draw.upbPost || '')} mono
              onChange={v => save('upbPost', v)} type="number" />
            <div className="col-span-2">
              <Field label="Saldo Holdback" value={String(draw.saldoHoldback || '')} mono
                onChange={v => save('saldoHoldback', v)} type="number" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Fecha Solicitud" value={draw.fechaSolicitud?.slice(0, 10) ?? ''}
              onChange={v => save('fechaSolicitud', v)} type="date" />
            <Field label="Fecha Inspección" value={draw.fechaInspeccion?.slice(0, 10) ?? ''}
              onChange={v => save('fechaInspeccion', v)} type="date" />
            <Field label="Fecha Wire" value={draw.fechaWire?.slice(0, 10) ?? ''}
              onChange={v => save('fechaWire', v)} type="date" />
          </div>

          {/* Cross-reference con Construction Budget */}
          {hasBudget && elegible > 0 && (
            <div className={`text-[11px] rounded-lg px-3 py-2 border ${hasMismatch ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                {hasMismatch ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                Cruce con Construction Budget
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                <div>Budget ejecutado: <span className="font-semibold">{(expectedFromBudget * 100).toFixed(1)}%</span></div>
                <div>Lender pagó: <span className="font-semibold">{(elegiblePct * 100).toFixed(1)}%</span></div>
                <div className={hasMismatch ? 'text-amber-700' : 'text-emerald-700'}>
                  Δ: <span className="font-bold">{(variance * 100).toFixed(1)} pts</span>
                </div>
              </div>
              {hasMismatch && (
                <div className="text-[10px] mt-1 italic">
                  {variance > 0
                    ? `El lender pagó ${formatUSD((expectedFromBudget - elegiblePct) * budgetTotal)} menos de lo ejecutado en obra.`
                    : `El lender pagó ${formatUSD((elegiblePct - expectedFromBudget) * budgetTotal)} más de lo ejecutado en obra (revisar).`}
                </div>
              )}
            </div>
          )}

          {/* PDF original del draw (si existe) */}
          {draw.pdfUrl && (
            <div className="text-[11px] flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <a href={draw.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[var(--brand-teal)] hover:underline">
                <FileText className="w-3 h-3" />Ver PDF del draw original
              </a>
              <ShareButtons url={draw.pdfUrl} label={`Draw #${draw.drawNumber} — PDF`} />
            </div>
          )}

          <Field label="Notas" value={draw.notas ?? ''} onChange={v => save('notas', v)} />
        </div>
      )}

      {isEmpty && (
        <div className="px-4 pb-3 text-center">
          <button onClick={() => onUpdate(draw.id, { estado: 'PENDING' })}
            className="text-xs text-slate-400 hover:text-[var(--brand-gold)] transition-colors">
            + Activar draw
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
      setError('Error procesando el archivo. Verifica que sea un PDF, JPG, PNG o Excel válido.')
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
            `+${res.newlyApprovedItems} item(s) nuevo(s) por ${formatUSD(res.newlyApprovedAmount)}.\nTotal aprobado: ${formatUSD(res.cumulativeApproved)}`,
            { duration: 7000 }
          )
        } else if (res.matched > 0) {
          toast(`Sin nuevos items en este draw — todo ya estaba aprobado.`, { icon: 'ℹ️' })
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
            <div className="text-sm font-semibold text-slate-900">Cargar Draw</div>
            <div className="text-xs text-slate-400 mt-0.5">Sube el PDF, Excel del lender o foto (JPG/PNG) del draw — el sistema extrae los datos automáticamente de PDF y Excel</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-[#2E6BB4]/40 text-slate-700 hover:text-slate-900 text-sm rounded-xl transition-all">
                <Upload className="w-4 h-4" />
                {file ? file.name : 'Seleccionar archivo'}
              </button>
              <input ref={fileRef} type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.xlsx,.xlsm,.xls,.ods,.csv,application/pdf,image/*,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,text/csv"
                className="hidden"
                onChange={e => { setFile(e.target.files?.[0] ?? null); setParsed(null); setImageUrl(null); setIsExcelResult(false) }} />
              {file && (
                <button onClick={handleParse} disabled={loading}
                  className="px-4 py-2.5 bg-[var(--brand-gold)] btn-animated hover:bg-[#4A86CF] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                  {loading ? 'Procesando...' : isImageFile(file) ? 'Subir imagen' : isExcelFile(file) ? 'Extraer datos del Excel' : 'Extraer datos'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Formatos aceptados: <span className="font-mono">PDF · Excel (.xlsx/.xls/.csv) · JPG · PNG · WEBP · HEIC</span> — hasta 50 MB
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
              <img src={imageUrl} alt="Documento subido" className="w-full max-h-64 object-contain bg-slate-50" />
              <p className="text-[10px] text-slate-400 text-center py-2">
                Imagen guardada — completa los campos del draw manualmente abajo
              </p>
            </div>
          )}

          {parsed && (
            <>
              <div className="bg-white/60 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-700">
                    {imageUrl ? 'Imagen guardada — completa los campos manualmente'
                      : isExcelResult ? `Datos extraídos del Excel${Object.keys(parsed).length === 0 ? ' — no se detectaron campos, complétalos manualmente' : ''}`
                      : 'Datos extraídos del PDF'}
                  </span>
                </div>
                {Object.keys(parsed).length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic">
                    El archivo se guardó pero no fue posible detectar campos automáticamente. Selecciona el draw y llena los valores manualmente abajo.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(parsed).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between bg-slate-50/40 rounded-lg px-3 py-1.5">
                        <span className="text-[10px] text-slate-400 uppercase">
                          {({'drawNumber':'Draw #','montoSolicitado':'Monto Solicitado','elegibleTrinity':'Eligible Trinity',
                            'porcentajeFunded':'% Financiado','fechaSolicitud':'Fecha Solicitud','fechaInspeccion':'Fecha Inspección',
                            'fechaWire':'Fecha Wire','netWire':'Net Wire','pdfUrl':'Archivo PDF',
                            'lenderExcelUrl':'Archivo Excel','lenderExcelName':'Nombre Excel',
                            'upbPre':'UPB Pre','upbPost':'UPB Post','saldoHoldback':'Saldo Holdback'} as Record<string,string>)[k] ?? k}
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
                            ? `+${newItems.length} item(s) nuevo(s) en este draw — ${formatUSD(newTotal)}`
                            : 'Sin items nuevos en este draw'}
                        </span>
                      </div>
                      {carryover.length > 0 && (
                        <span className="text-[10px] text-slate-500">
                          ({carryover.length} previos · {formatUSD(carryTotal)} ya en budget)
                        </span>
                      )}
                    </div>
                    {newItems.length > 0 && (
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-[11px]">
                          <thead className="sticky top-0 bg-emerald-50">
                            <tr className="text-left text-slate-400 uppercase tracking-wider text-[9px]">
                              <th className="py-1 pr-2 w-12">Item</th>
                              <th className="py-1 pr-2">Descripción</th>
                              <th className="py-1 px-2 text-right w-14">% nuevo</th>
                              <th className="py-1 px-2 text-right w-20">∆ este draw</th>
                              <th className="py-1 pl-2 text-right w-24">Cumulativo</th>
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
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Aplicar al draw</div>
                <select value={targetDraw} onChange={e => setTargetDraw(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[var(--brand-gold)]">
                  <option value="">— Seleccionar draw —</option>
                  {draws.map(d => (
                    <option key={d.id} value={d.id}>Draw #{d.drawNumber} ({d.estado})</option>
                  ))}
                </select>
              </div>

              <button onClick={handleApply} disabled={!targetDraw}
                className="w-full py-2.5 bg-[var(--brand-gold)] btn-animated hover:bg-[#4A86CF] disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                Guardar datos en Draw #{draws.find(d => d.id === targetDraw)?.drawNumber ?? '—'}
              </button>
            </>
          )}

          {preview && (
            <details className="text-[10px] text-slate-400 font-mono">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-500 transition-colors">
                <FileText className="w-3 h-3 inline mr-1" />Ver texto extraído del {isExcelResult ? 'Excel' : 'PDF'}
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
        toast.error(`Excel subido, pero la lectura automática falló: ${err}`, { duration: 8000 })
      } else {
        const w = res?.data?.warnings?.length ?? 0
        const desemMsg = applied && applied > 0 ? ` · desembolso aplicado a ${applied} draw(s)` : ''
        toast.success((w > 0 ? `Excel cargado — ${w} diferencia(s) detectada(s), revísalas abajo` : 'Excel cargado y validado — los totales cuadran') + desemMsg)
      }
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al subir el Excel'),
  })

  const delMut = useMutation({
    mutationFn: () => drawsApi.deleteLenderExcel(projectId),
    onSuccess: () => {
      toast.success('Excel general eliminado')
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
    },
  })

  // Sincroniza el desembolsado (netWire) por draw desde el Excel YA cargado.
  const syncMut = useMutation({
    mutationFn: () => drawsApi.syncFromExcel(projectId),
    onSuccess: (res) => {
      const applied = (res as any)?.drawsApplied ?? 0
      toast.success(applied > 0 ? `Desembolso sincronizado en ${applied} draw(s) desde el Excel` : 'Excel leído — sin filas de desembolso nuevas')
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al sincronizar desde el Excel'),
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
      toast.success('Modo del lender actualizado')
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
            <div className="text-sm font-semibold text-slate-800">Excel general del lender</div>
            <div className="text-[11px] text-slate-500">Un solo archivo con los totales del lender. Complementa y valida los PDF de cada draw (no altera las aprobaciones).</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {file?.url && (
            <>
              <a href={file.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline flex items-center gap-1">
                <FileText className="w-3 h-3" />{file.name || 'Excel'}
              </a>
              <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
                className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-40 flex items-center gap-1"
                title="Vuelve a leer el Excel cargado y puebla el desembolsado (netWire) de cada draw">
                {syncMut.isPending ? 'Sincronizando…' : '↻ Sincronizar desembolso'}
              </button>
              <button onClick={() => delMut.mutate()} disabled={delMut.isPending} className="text-[11px] text-slate-400 hover:text-red-500 disabled:opacity-40">Eliminar</button>
            </>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploadMut.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" />{uploadMut.isPending ? 'Subiendo...' : file?.url ? 'Reemplazar Excel' : 'Cargar Excel del lender'}
          </button>
          <input ref={fileRef} type="file"
            accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { uploadMut.mutate(f); e.target.value = '' } }} />
        </div>
      </div>

      {/* Modo de reporte del lender — se adapta a cada lender/formato */}
      <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
        <span className="text-[11px] font-medium text-slate-600">Los reportes de este lender son:</span>
        <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {([['ACUMULADO', 'Acumulados'], ['INCREMENTAL', 'Solo de este draw']] as const).map(([v, l]) => (
            <button key={v} onClick={() => modeMut.mutate(v)} disabled={modeMut.isPending}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${mode === v ? 'bg-[var(--brand-teal)] text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-400">
          {mode === 'ACUMULADO' ? 'Cada draw incluye los anteriores (ej. Trinity) — el sistema resta lo previo.' : 'Cada draw trae solo su monto nuevo — el sistema lo suma directo.'}
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
              <span className="font-mono">Excel {formatUSD(c.excel)} · Sistema {formatUSD(c.sistema)} {c.difiere ? '⚠' : '✓'}</span>
            </div>
          ))}
        </div>
      )}
      {validation && warnings.length === 0 && file?.url && (
        <div className="mt-3 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5" />Los totales del sistema cuadran con el Excel del lender.
        </div>
      )}
    </div>
  )
}

/* ── PRE-DRAW CHECK ─────────────────────────────────────────────
   Protocolo de draw review automatizado. Antes de solicitar un draw:
   1. ¿El avance físico soporta lo que se va a pedir? (draws vs avance)
   2. ¿Hay gasto sin soporte documental? (facturas de actividades)
   3. ¿Hay sobrecosto vs el budget del lender? (asociaciones actividad↔budget)
   4. ¿El desglose (subactividades) tiene sus invoices?
   Si algo falla → se muestra ANTES de pedir el desembolso, no después. */
function PreDrawCheck({ phases, initialHoldback, totalWired }: {
  phases: Phase[]
  initialHoldback: number
  totalWired: number
}) {
  const [open, setOpen] = useState(true)

  const allItems = phases.flatMap(p => p.items.filter(i => !i.esNA))
  if (allItems.length === 0) return null

  // 1. Avance físico vs % del holdback ya girado
  const done = allItems.filter(i => i.completado).length
  const avancePct = allItems.length > 0 ? (done / allItems.length) * 100 : 0
  const giradoPct = initialHoldback > 0 ? (totalWired / initialHoldback) * 100 : 0
  const desfase = giradoPct - avancePct
  const avanceOk = initialHoldback === 0 || desfase <= 10

  // 2. Actividades con gasto/completadas sin factura
  const sinFactura = allItems.filter(i =>
    (i.valorEjecutado > 0 || i.completado) && !(i.documents ?? []).some(d => d.type === 'FACTURA'))

  // 3. Sobrecosto vs budget del lender (agrupado por línea asociada)
  const byLine = new Map<string, { code: string; budget: number; ejec: number }>()
  for (const i of allItems) {
    if (i.budgetLineId && i.budgetLine) {
      const cur = byLine.get(i.budgetLineId) ?? { code: i.budgetLine.itemCode, budget: i.budgetLine.valorInicial, ejec: 0 }
      cur.ejec += i.valorEjecutado
      byLine.set(i.budgetLineId, cur)
    }
  }
  const overLines = Array.from(byLine.values()).filter(l => l.budget > 0 && l.ejec > l.budget)
  const totalOver = overLines.reduce((s, l) => s + (l.ejec - l.budget), 0)

  // 4. Subactividades con gasto sin invoice
  const subsSinInvoice = allItems.flatMap(i =>
    (i.subactivities ?? []).filter(s => s.valorEjecutado > 0 && !s.invoiceUrl))

  const checks: Array<{ ok: boolean; label: string; detail: string }> = [
    {
      ok: avanceOk,
      label: 'Avance físico vs desembolsos',
      detail: initialHoldback > 0
        ? `${avancePct.toFixed(0)}% físico · ${giradoPct.toFixed(0)}% del holdback girado${!avanceOk ? ` — los draws van ${desfase.toFixed(0)} pts por DELANTE de la obra` : ''}`
        : 'sin holdback cargado — se omite',
    },
    {
      ok: sinFactura.length === 0,
      label: 'Soportes de actividades (facturas)',
      detail: sinFactura.length === 0
        ? 'todo gasto tiene factura adjunta'
        : `${sinFactura.length} actividad(es) con gasto sin factura: ${sinFactura.slice(0, 3).map(i => i.itemCode).join(', ')}${sinFactura.length > 3 ? '…' : ''}`,
    },
    {
      ok: overLines.length === 0,
      label: 'Gasto vs Construction Budget (asociado)',
      detail: byLine.size === 0
        ? 'sin asociaciones al budget aún — asócialas en Presupuesto & Ejecución'
        : overLines.length === 0
          ? `${byLine.size} línea(s) asociada(s), ninguna sobre-ejecutada`
          : `${overLines.length} línea(s) superada(s) por ${formatUSD(totalOver)}: ${overLines.slice(0, 3).map(l => l.code).join(', ')}${overLines.length > 3 ? '…' : ''}`,
    },
    {
      ok: subsSinInvoice.length === 0,
      label: 'Invoices del desglose (subactividades)',
      detail: subsSinInvoice.length === 0
        ? 'todas las subactividades con gasto tienen invoice'
        : `${subsSinInvoice.length} subactividad(es) con gasto sin invoice`,
    },
  ]
  const failing = checks.filter(c => !c.ok).length
  const ready = failing === 0

  return (
    <div className={`rounded-xl border ${ready ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/50'}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 px-4 py-3">
        <ClipboardCheck className={`w-4 h-4 flex-shrink-0 ${ready ? 'text-emerald-600' : 'text-amber-600'}`} />
        <span className="text-sm font-semibold text-slate-800 flex-1 text-left">Chequeo Pre-Draw</span>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
          ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
          {ready ? '✓ Listo para solicitar' : `${failing} punto(s) por resolver`}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {checks.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {c.ok
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />}
              <span className={`font-medium ${c.ok ? 'text-slate-600' : 'text-slate-800'}`}>{c.label}:</span>
              <span className={c.ok ? 'text-slate-400' : 'text-amber-800'}>{c.detail}</span>
            </div>
          ))}
          {!ready && (
            <p className="text-[11px] text-amber-800/80 pt-1 border-t border-amber-200/60">
              Un draw sin soporte físico o documental puede ser rechazado por el inspector del lender, y una línea sobre-ejecutada sale de tu caja — resuélvelo antes de solicitar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Draws({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showParse, setShowParse] = useState(false)
  const [showTimeline, setShowTimeline] = useState(true)

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

  // Fases + items: alimentan el Chequeo Pre-Draw (avance físico, soportes,
  // sobrecostos vs budget asociado) — misma fuente que Presupuesto & Ejecución.
  const { data: phases = [] } = useQuery<Phase[]>({
    queryKey: ['phases', projectId],
    queryFn: () => phasesApi.list(projectId),
    staleTime: 30_000,
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
      toast.success('Draw eliminado — recalculando holdback y budget')
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al eliminar draw'),
  })

  const addDrawMutation = useMutation({
    mutationFn: () => drawsApi.create(projectId),
    onSuccess: (created: any) => {
      toast.success(`Draw #${created?.drawNumber ?? ''} creado`)
      queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al crear draw'),
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
  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando draws...</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><Landmark className="w-[22px] h-[22px]" strokeWidth={2.2} /></span><span>Draw Tracker</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">Hera Holdings LLC — Historial de desembolsos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={async () => {
              const ok = await confirm({
                title: 'Resetear sección Draws',
                message: 'Esto borrará TODOS los draws de este proyecto y reseteará los campos contractuales (loanAmount, holdback, day1, interestReserve). Las KPIs volverán a $0.',
                detail: 'Después vuelve a cargar el HUD-1 y los Excel/PDF de los draws para repoblar el módulo.',
                confirmText: 'Resetear',
                destructive: true,
                typeToConfirm: 'RESETEAR',
              })
              if (!ok) return
              try {
                await projectsApi.resetDrawsSection(projectId)
                toast.success('Sección Draws reseteada — todas las KPIs y draws limpiados.')
                queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
                queryClient.invalidateQueries({ queryKey: ['project', projectId] })
                queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
              } catch (e: any) {
                toast.error(e?.response?.data?.error || 'Error al resetear')
              }
            }}
            className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium rounded-xl transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            Resetear sección
          </button>
          <button onClick={async () => {
              const ok = await confirm({
                title: 'Reparar Construction Budget',
                message: 'Recompute el valor APROBADO de cada línea desde los draws vivos. Útil si quedaron aprobaciones huérfanas tras borrar draws antiguos.',
                detail: 'Esta acción no toca tus draws — sólo reconstruye la columna APROBADO sumando aportes de los APPROVAL PDFs cargados actualmente. Re-procesa cada PDF desde Cloudinary.',
                confirmText: 'Reparar budget',
              })
              if (!ok) return
              try {
                const t = toast.loading('Re-procesando PDFs de aprobación...')
                const r = await drawParseApi.rebuildContributions(projectId)
                toast.dismiss(t)
                const errors = r.report.filter(x => x.error).length
                toast.success(
                  `Reparado: ${r.drawsProcessed} draw(s) procesados, total aprobado ${formatUSD(r.totalAprobado)}${errors > 0 ? ` · ${errors} con error` : ''}`,
                  { duration: 8000 }
                )
                queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
                queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
                queryClient.invalidateQueries({ queryKey: ['project', projectId] })
              } catch (e: any) {
                toast.error(e?.response?.data?.error || 'Error al reparar')
              }
            }}
            title="Reconstruir la columna APROBADO del budget desde los PDFs de aprobación cargados"
            className="flex items-center gap-2 px-3 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-medium rounded-xl transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Reparar budget
          </button>
          <button onClick={async () => {
              const ok = await confirm({
                title: 'Corregir valores acumulados',
                message: 'Los reportes del lender son ACUMULADOS (cada draw ya incluye los anteriores). Esto convierte el aporte de cada ítem a su valor NUEVO real (delta), corrigiendo el total aprobado inflado.',
                detail: 'Úsalo UNA sola vez si el total aprobado quedó inflado por sumar acumulados. Es seguro: recalcula desde tus contribuciones existentes, sin borrar draws.',
                confirmText: 'Corregir acumulados',
              })
              if (!ok) return
              try {
                const r = await drawsApi.repairCumulative(projectId)
                toast.success(`Corregido: ${r.contribsFixed} aporte(s) en ${r.linesFixed} línea(s). Total aprobado ahora: ${formatUSD(r.totalAprobado)}`, { duration: 9000 })
                queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
                queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
                queryClient.invalidateQueries({ queryKey: ['project', projectId] })
                queryClient.invalidateQueries({ queryKey: ['draws-validation', projectId] })
              } catch (e: any) {
                toast.error(e?.response?.data?.error || 'Error al corregir')
              }
            }}
            title="Convierte contribuciones acumuladas por ítem a deltas reales (una sola vez)"
            className="flex items-center gap-2 px-3 py-2 border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-medium rounded-xl transition-colors">
            <TrendingDown className="w-3.5 h-3.5" />
            Corregir acumulados
          </button>
          <button onClick={() => addDrawMutation.mutate()}
            disabled={addDrawMutation.isPending}
            title="Agregar un draw vacío al final de la lista"
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-xl transition-colors disabled:opacity-40">
            <span className="text-base leading-none">+</span>
            {addDrawMutation.isPending ? 'Agregando...' : 'Agregar draw'}
          </button>
          <button onClick={() => setShowParse(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-gold)] btn-animated hover:bg-[#4A86CF] text-white text-sm font-medium rounded-xl transition-colors">
            <Upload className="w-4 h-4" />
            Cargar Draw PDF
          </button>
        </div>
      </div>

      {/* Excel general del lender — carga y validación (parte superior) */}
      <LenderExcelPanel projectId={projectId} />

      {/* Chequeo Pre-Draw: protocolo de draw review automatizado */}
      <PreDrawCheck phases={phases} initialHoldback={initialHoldback} totalWired={totalWired} />

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="kpi-card">
          <div className="text-xs text-slate-400 uppercase mb-1">Holdback inicial</div>
          <div className="text-xl font-bold font-mono text-slate-800">{formatUSD(initialHoldback)}</div>
          <div className="text-[10px] text-slate-400 mt-1">Según HUD de cierre</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-slate-400 uppercase mb-1">Total aprobado</div>
          <div className={`text-xl font-bold font-mono ${aprobadoOverflow ? 'text-red-500' : 'text-slate-800'}`}>{formatUSD(totalAprobado)}</div>
          <div className={`text-[10px] mt-1 ${aprobadoOverflow ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
            {aprobadoOverflow ? '⚠ supera el budget' : `de ${formatUSD(budgetTotalV)} budget`}
          </div>
        </div>
        <div className="kpi-card kpi-card-green">
          <div className="text-xs text-slate-400 uppercase mb-1">Total desembolsado</div>
          <div className="text-xl font-bold font-mono text-emerald-500">{formatUSD(totalWired)}</div>
          <div className="text-xs text-slate-400 mt-1">{wiredDraws.length} draw(s) wired</div>
        </div>
        <div className="kpi-card kpi-card-amber">
          <div className="text-xs text-slate-400 uppercase mb-1">Saldo pendiente por girar</div>
          <div className={`text-xl font-bold font-mono ${lastSaldo < 50000 ? 'text-red-500' : lastSaldo < 100000 ? 'text-[var(--brand-gold)]' : 'text-slate-900'}`}>
            {formatUSD(lastSaldo)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {initialHoldback > 0 ? `${((totalWired / initialHoldback) * 100).toFixed(1)}% consumido` : 'holdback − desembolsado'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-slate-400 uppercase mb-1">Draws</div>
          <div className="text-xl font-bold font-mono text-slate-900">{wiredDraws.length} / {draws.filter(d => d.estado !== 'EMPTY').length}</div>
          <div className="text-[10px] text-slate-400 mt-1">{draws.filter(d => d.estado === 'EMPTY').length} disponibles</div>
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
              <span className="text-sm font-semibold text-slate-800">Secuencia de holdback draw a draw</span>
              <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{wiredDraws.length} draws wired</span>
              <span className="text-[10px] text-slate-400 hidden md:inline">· se actualiza automáticamente con cada Excel del lender</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTimeline ? '' : '-rotate-90'}`} />
          </button>
          {showTimeline && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2 text-left text-[10px] text-slate-400 uppercase tracking-wider w-16">Draw</th>
                    <th className="px-4 py-2 text-left text-[10px] text-slate-400 uppercase tracking-wider">Fecha Wire</th>
                    <th className="px-4 py-2 text-right text-[10px] text-slate-400 uppercase tracking-wider">Solicitado</th>
                    <th className="px-4 py-2 text-right text-[10px] text-emerald-600/70 uppercase tracking-wider">Aprobado (Net Wire)</th>
                    <th className="px-4 py-2 text-right text-[10px] text-[#2E6BB4]/80 uppercase tracking-wider">Saldo holdback</th>
                    <th className="px-4 py-2 text-center text-[10px] text-slate-400 uppercase tracking-wider w-20">% Cons.</th>
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
                    <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider">Total</td>
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
