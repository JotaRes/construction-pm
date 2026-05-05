import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { drawsApi, drawParseApi } from '../lib/api'
import { formatUSD, formatDate } from '../lib/calculations'
import type { Draw, DrawEstado } from '../lib/types'
import { Upload, FileText, CheckCircle, X, AlertTriangle } from 'lucide-react'

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
          className={`w-full bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:border-[#C8922A] ${mono ? 'font-mono' : ''}`} />
      ) : (
        <div className={`text-xs text-slate-700 ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
      )}
    </div>
  )
}

function DrawCard({ draw, onUpdate }: { draw: Draw; onUpdate: (id: string, data: Record<string, unknown>) => void }) {
  const isEmpty = draw.estado === 'EMPTY'
  const [open, setOpen] = useState(!isEmpty)

  const save = (key: string, raw: string) => {
    const val = ['montoSolicitado','elegibleTrinity','netWire','upbPre','upbPost','saldoHoldback','porcentajeFunded'].includes(key)
      ? parseFloat(raw) || 0
      : raw || null
    onUpdate(draw.id, { [key]: val })
  }

  return (
    <div className={`bg-white rounded-2xl border transition-all ${
      draw.estado === 'WIRED' ? 'border-emerald-500/30' :
      draw.estado === 'PENDING' ? 'border-amber-500/30' :
      'border-slate-200/40 opacity-50'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-3 text-left">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono
            ${draw.estado === 'WIRED' ? 'bg-emerald-500/20 text-emerald-400' : draw.estado === 'PENDING' ? 'bg-[#C8922A]/15 text-[#C8922A]' : 'bg-slate-200 text-slate-400'}`}>
            {draw.drawNumber}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800">Draw #{draw.drawNumber}</div>
            {draw.netWire > 0 && <div className="text-[10px] font-mono text-emerald-400">{formatUSD(draw.netWire)} wired</div>}
            {draw.fechaWire && <div className="text-[10px] text-slate-400">{formatDate(draw.fechaWire)}</div>}
          </div>
        </button>
        <div className="flex items-center gap-2">
          {estadoBadge(draw.estado as DrawEstado)}
          <select value={draw.estado} onChange={e => onUpdate(draw.id, { estado: e.target.value })}
            className="bg-slate-200 text-xs text-slate-700 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#C8922A]">
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
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
            <Field label="% Funded" value={String(draw.porcentajeFunded || '')} mono
              onChange={v => save('porcentajeFunded', v)} type="number" />
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
          <Field label="Notas" value={draw.notas ?? ''} onChange={v => save('notas', v)} />
        </div>
      )}

      {isEmpty && (
        <div className="px-4 pb-3 text-center">
          <button onClick={() => onUpdate(draw.id, { estado: 'PENDING' })}
            className="text-xs text-slate-400 hover:text-[#C8922A] transition-colors">
            + Activar draw
          </button>
        </div>
      )}
    </div>
  )
}

/* ── PDF Parse Panel ─────────────────────────────── */
function PdfParsePanel({ projectId, draws, onClose, onApply }: {
  projectId: string
  draws: Draw[]
  onClose: () => void
  onApply: (drawId: string, data: Record<string, unknown>) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)
  const [preview, setPreview] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [targetDraw, setTargetDraw] = useState<string>('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const isImageFile = (f: File) => f.type.startsWith('image/')

  const handleParse = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const result = await drawParseApi.parsePdf(projectId, file)
      setParsed(result.parsed)
      setPreview(result.preview ?? '')
      setImageUrl(result.imageUrl ?? null)
      if (result.parsed.drawNumber) {
        const match = draws.find(d => d.drawNumber === result.parsed.drawNumber)
        if (match) setTargetDraw(match.id)
      }
    } catch (e) {
      setError('Error procesando el archivo. Verifica que sea un PDF, JPG o PNG válido.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!parsed || !targetDraw) return
    const cleanData: Record<string, unknown> = {}
    const fields = ['montoSolicitado','elegibleTrinity','netWire','porcentajeFunded',
                    'upbPre','upbPost','saldoHoldback','fechaSolicitud','fechaInspeccion','fechaWire','pdfUrl']
    fields.forEach(f => { if (parsed[f] !== undefined && parsed[f] !== null) cleanData[f] = parsed[f] })
    // Activate the draw (move out of EMPTY state)
    cleanData.estado = 'PENDING'
    onApply(targetDraw, cleanData)
    onClose()
  }

  const fmtParsed = (k: string, v: unknown) => {
    if (k === 'porcentajeFunded') return `${((v as number) * 100).toFixed(2)}%`
    if (k === 'pdfUrl') return '✓ archivo guardado'
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
            <div className="text-xs text-slate-400 mt-0.5">Sube el PDF o foto (JPG/PNG) del draw — el sistema extrae los datos automáticamente del PDF</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-[#C8922A]/40 text-slate-700 hover:text-slate-900 text-sm rounded-xl transition-all">
                <Upload className="w-4 h-4" />
                {file ? file.name : 'Seleccionar archivo'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                className="hidden"
                onChange={e => { setFile(e.target.files?.[0] ?? null); setParsed(null); setImageUrl(null) }} />
              {file && (
                <button onClick={handleParse} disabled={loading}
                  className="px-4 py-2.5 bg-[#C8922A] btn-animated hover:bg-[#E0AD4F] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                  {loading ? 'Procesando...' : isImageFile(file) ? 'Subir imagen' : 'Extraer datos'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Formatos aceptados: <span className="font-mono">PDF · JPG · PNG · WEBP · HEIC</span> — hasta 50 MB
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
                    {imageUrl ? 'Imagen guardada — completa los campos manualmente' : 'Datos extraídos del PDF'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(parsed).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between bg-slate-50/40 rounded-lg px-3 py-1.5">
                      <span className="text-[10px] text-slate-400 uppercase">
                        {({'drawNumber':'Draw #','montoSolicitado':'Monto Solicitado','elegibleTrinity':'Eligible Trinity',
                          'porcentajeFunded':'% Financiado','fechaSolicitud':'Fecha Solicitud','fechaInspeccion':'Fecha Inspección',
                          'fechaWire':'Fecha Wire','netWire':'Net Wire','pdfUrl':'Archivo PDF',
                          'upbPre':'UPB Pre','upbPost':'UPB Post','saldoHoldback':'Saldo Holdback'} as Record<string,string>)[k] ?? k}
                      </span>
                      <span className="text-xs font-mono text-[#2D4B52]">{fmtParsed(k, v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Aplicar al draw</div>
                <select value={targetDraw} onChange={e => setTargetDraw(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#C8922A]">
                  <option value="">— Seleccionar draw —</option>
                  {draws.map(d => (
                    <option key={d.id} value={d.id}>Draw #{d.drawNumber} ({d.estado})</option>
                  ))}
                </select>
              </div>

              <button onClick={handleApply} disabled={!targetDraw}
                className="w-full py-2.5 bg-[#C8922A] btn-animated hover:bg-[#E0AD4F] disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                Guardar datos en Draw #{draws.find(d => d.id === targetDraw)?.drawNumber ?? '—'}
              </button>
            </>
          )}

          {preview && (
            <details className="text-[10px] text-slate-400 font-mono">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-500 transition-colors">
                <FileText className="w-3 h-3 inline mr-1" />Ver texto extraído del PDF
              </summary>
              <pre className="mt-2 bg-slate-100 rounded-lg p-3 overflow-x-auto max-h-40 text-slate-600 whitespace-pre-wrap">{preview}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Draws({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showParse, setShowParse] = useState(false)

  const { data: draws = [], isLoading } = useQuery<Draw[]>({
    queryKey: ['draws', projectId],
    queryFn: () => drawsApi.list(projectId),
  })

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => drawsApi.patch(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['draws', projectId] }),
  })

  const wiredDraws = draws.filter(d => d.estado === 'WIRED')
  const totalWired = wiredDraws.reduce((s, d) => s + d.netWire, 0)
  const lastSaldo = wiredDraws.length > 0 ? wiredDraws[wiredDraws.length - 1].saldoHoldback : 0

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando draws...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Draw Tracker</h1>
          <p className="text-sm text-slate-500 mt-0.5">Hera Holdings LLC — Historial de desembolsos</p>
        </div>
        <button onClick={() => setShowParse(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#C8922A] btn-animated hover:bg-[#E0AD4F] text-white text-sm font-medium rounded-xl transition-colors">
          <Upload className="w-4 h-4" />
          Cargar Draw PDF
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="kpi-card kpi-card-green">
          <div className="text-xs text-slate-400 uppercase mb-1">Total Desembolsado</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{formatUSD(totalWired)}</div>
          <div className="text-xs text-slate-400 mt-1">{wiredDraws.length} draw(s) wired</div>
        </div>
        <div className="kpi-card kpi-card-amber">
          <div className="text-xs text-slate-400 uppercase mb-1">Saldo Holdback</div>
          <div className={`text-2xl font-bold font-mono ${lastSaldo < 50000 ? 'text-red-400' : lastSaldo < 100000 ? 'text-[#C8922A]' : 'text-slate-900'}`}>
            {formatUSD(lastSaldo)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-slate-400 uppercase mb-1">Draws Ejecutados</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{wiredDraws.length} / {draws.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {draws.map(draw => (
          <DrawCard key={draw.id} draw={draw} onUpdate={(id, data) => mutation.mutate({ id, data })} />
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
