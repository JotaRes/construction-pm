import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { phasesApi, itemsApi, itemDocumentsApi, projectsApi, providersGlobalApi, subactivitiesApi, constructionBudgetApi, drawsApi } from '../lib/api'
import { formatUSD } from '../lib/calculations'
import type { Phase, Item, ItemEstado, ItemDocument, BudgetLineLite, SubActivity, Draw } from '../lib/types'
import { ChevronDown, ChevronRight, X, Calendar, User, FileText, Plus, Trash2, Paperclip, Upload, AlertTriangle, ExternalLink, Download, Mail, MessageCircle, Eraser, EyeOff, Eye, ChevronsDown, ChevronsUp, Link2, Landmark, Pencil, HardHat } from 'lucide-react'
import { useConfirm } from '../components/ConfirmDialog'
import MiniDonut from '../components/MiniDonut'
import toast from 'react-hot-toast'

const ESTADOS: { value: ItemEstado; label: string; color: string; bg: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'text-slate-500',  bg: 'bg-slate-200/60 hover:bg-slate-100' },
  { value: 'EN_CURSO',  label: 'En curso',  color: 'text-[var(--brand-gold)]',  bg: 'bg-[#3E5A70]/15 hover:bg-[#3E5A70]/25' },
  { value: 'DONE',      label: 'Hecho',     color: 'text-emerald-400', bg: 'bg-emerald-500/15 hover:bg-emerald-500/25' },
  { value: 'NA',        label: 'N/A',       color: 'text-slate-400',  bg: 'bg-white hover:bg-slate-100' },
]

const DOC_TYPES = [
  { value: 'COTIZACION', label: 'Cotización', color: 'text-sky-300 bg-sky-500/20 border-sky-500/40' },
  { value: 'FACTURA',    label: 'Factura',    color: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40' },
  { value: 'OTRO',       label: 'Otro',       color: 'text-slate-700 bg-slate-200 border-slate-300/40' },
]

function docTypeStyle(type: string) {
  return DOC_TYPES.find(d => d.value === type) ?? DOC_TYPES[2]
}

function DocumentSection({ item }: { item: Item }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [docType, setDocType] = useState<'COTIZACION' | 'FACTURA' | 'OTRO'>('COTIZACION')
  // R2: proveedor del catálogo global, u 'OTRO' para escribir libre
  const [providerId, setProviderId] = useState('')
  const [vendor, setVendor] = useState('')
  const { data: allProviders = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['providers-global'],
    queryFn: providersGlobalApi.listAll,
    staleTime: 60_000,
  })
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: docs = [] } = useQuery<ItemDocument[]>({
    queryKey: ['item-docs', item.id],
    queryFn: () => itemDocumentsApi.list(item.id),
  })

  const createDoc = useMutation({
    mutationFn: (fd: FormData) => itemDocumentsApi.create(item.id, fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-docs', item.id] })
      queryClient.invalidateQueries({ queryKey: ['phases'] })
      setShowForm(false)
      setVendor(''); setProviderId(''); setAmount(''); setNotes(''); setFile(null)
    },
  })

  const deleteDoc = useMutation({
    mutationFn: (docId: string) => itemDocumentsApi.delete(item.id, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-docs', item.id] })
      queryClient.invalidateQueries({ queryKey: ['phases'] })
    },
  })

  const hasFactura = docs.some(d => d.type === 'FACTURA')
  // Alerta crítica: tiene valor ejecutado o está completado, pero NO tiene factura
  const warnNoFactura = (item.valorEjecutado > 0 || item.completado) && !hasFactura
  const buildDownloadUrl = (url: string, name?: string) => {
    const params = new URLSearchParams({ url })
    if (name) params.set('name', name)
    return `${window.location.origin}/api/download?${params.toString()}`
  }

  const shareViaEmail = (doc: ItemDocument) => {
    const subject = encodeURIComponent(`Documento del ítem ${item.itemCode}: ${doc.vendor || doc.name}`)
    const body = encodeURIComponent(
      `Hola,\n\nComparto el siguiente documento del ítem de construcción:\n\n` +
      `Ítem: ${item.itemCode} — ${item.activity}\n` +
      `Tipo: ${doc.type}\n` +
      `Proveedor: ${doc.vendor || '—'}\n` +
      (doc.amount ? `Monto: ${formatUSD(doc.amount)}\n` : '') +
      (doc.fileUrl ? `Descargar: ${buildDownloadUrl(doc.fileUrl, doc.name)}\n` : '') +
      (doc.notes ? `\nNotas: ${doc.notes}\n` : '') +
      `\nSaludos.`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  // Web Share API nativa para enviar el PDF binario real a WhatsApp/Telegram/email móvil.
  // Fallback inteligente: wa.me con link de descarga proxy (Content-Disposition correcto).
  const shareViaWhatsApp = async (doc: ItemDocument) => {
    if (!doc.fileUrl) {
      window.alert('Este documento no tiene archivo adjunto.')
      return
    }
    const downloadUrl = buildDownloadUrl(doc.fileUrl, doc.name)
    const captionText =
      `📄 *${doc.type}*\n\n` +
      `*Ítem:* ${item.itemCode} — ${item.activity}\n` +
      `*Proveedor:* ${doc.vendor || '—'}\n` +
      (doc.amount ? `*Monto:* ${formatUSD(doc.amount)}` : '')

    if (typeof navigator !== 'undefined' && (navigator as any).canShare && (navigator as any).share) {
      try {
        const response = await fetch(downloadUrl)
        if (response.ok) {
          const blob = await response.blob()
          const sharedFile = new File([blob], doc.name || `${doc.type}.pdf`, { type: blob.type || 'application/pdf' })
          if ((navigator as any).canShare({ files: [sharedFile] })) {
            await (navigator as any).share({ files: [sharedFile], title: doc.name, text: captionText })
            return
          }
        }
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return
        console.warn('Web Share API falló:', err)
      }
    }

    const text = encodeURIComponent(`${captionText}\n\n🔗 ${downloadUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleSubmit = () => {
    const fd = new FormData()
    fd.append('type', docType)
    if (providerId && providerId !== 'OTRO') fd.append('providerId', providerId)
    fd.append('vendor', vendor)
    fd.append('amount', amount)
    fd.append('notes', notes)
    fd.append('name', file?.name ?? `${docType.toLowerCase()}-${item.itemCode}`)
    if (file) fd.append('file', file)
    createDoc.mutate(fd)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider">
          <Paperclip className="w-3 h-3" />
          Documentos
          {docs.length > 0 && (
            <span className="ml-1 bg-slate-200/60 text-slate-500 rounded-full px-1.5 py-0.5 text-[9px] font-mono">
              {docs.length}
            </span>
          )}
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="text-[10px] text-[#3E5A70]/70 hover:text-[var(--brand-gold)] transition-colors flex items-center gap-1">
          <Plus className="w-3 h-3" /> Adjuntar
        </button>
      </div>

      {warnNoFactura && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-red-700">
            <strong>⚠ FALTA FACTURA:</strong> Este ítem tiene valor ejecutado de <strong>{formatUSD(item.valorEjecutado || 0)}</strong>
            {item.completado && ' y está marcado como HECHO'} pero NO tiene factura adjunta.
            Adjunta el soporte usando el botón "+ Adjuntar" arriba.
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-slate-50 border border-slate-200/40 rounded-xl p-3 mb-3 space-y-2.5">
          <div className="flex gap-1.5">
            {DOC_TYPES.map(dt => (
              <button key={dt.value}
                onClick={() => setDocType(dt.value as 'COTIZACION' | 'FACTURA' | 'OTRO')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all
                  ${docType === dt.value ? dt.color : 'text-slate-400 bg-white border-slate-200/40'}`}>
                {dt.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* R2: elegir proveedor del catálogo global o escribir uno puntual */}
            <select value={providerId}
              onChange={e => { setProviderId(e.target.value); if (e.target.value !== 'OTRO') setVendor('') }}
              className="col-span-2 bg-white border border-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#3E5A70]/60">
              <option value="">Proveedor (elige del catálogo)…</option>
              {allProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="OTRO">Otro (escribir manualmente)</option>
            </select>
            {providerId === 'OTRO' && (
              <input type="text" placeholder="Nombre del proveedor / contratista" value={vendor}
                onChange={e => setVendor(e.target.value)}
                className="col-span-2 bg-white border border-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#3E5A70]/60 placeholder-slate-400" />
            )}
            <input type="number" placeholder="Monto ($)" value={amount}
              onChange={e => setAmount(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#3E5A70]/60 placeholder-slate-400 font-mono" />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg transition-colors">
              <Upload className="w-3 h-3" />
              {file ? <span className="truncate text-emerald-400 text-[11px]">{file.name}</span> : <span>Subir PDF / imagen</span>}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <textarea placeholder="Notas..." value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#3E5A70]/60 placeholder-slate-400 resize-none" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Cancelar</button>
            <button onClick={handleSubmit} disabled={createDoc.isPending}
              className="px-3 py-1 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-white text-xs rounded-lg transition-colors disabled:opacity-50">
              {createDoc.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 && !showForm && (
        <p className="text-[10px] text-slate-500 italic">Sin documentos adjuntos.</p>
      )}

      <div className="space-y-1.5">
        {docs.map(doc => {
          const st = docTypeStyle(doc.type)
          return (
            <div key={doc.id} className="flex items-center gap-2 bg-white/40 rounded-lg px-3 py-2 group">
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${st.color}`}>{st.label}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-700 truncate">{doc.vendor || doc.name}</div>
                {doc.amount && <div className="text-[10px] font-mono text-[#3E5A70]/80">{formatUSD(doc.amount)}</div>}
              </div>
              {doc.fileUrl && (
                <>
                  <a href={`/api/download?url=${encodeURIComponent(doc.fileUrl)}&name=${encodeURIComponent(doc.name)}&inline=1`} target="_blank" rel="noreferrer"
                    title="Ver"
                    className="text-slate-400 hover:text-[var(--brand-gold)] transition-colors flex-shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a href={`/api/download?url=${encodeURIComponent(doc.fileUrl)}&name=${encodeURIComponent(doc.name)}`} download={doc.name}
                    title="Descargar"
                    className="text-slate-400 hover:text-[var(--brand-teal)] transition-colors flex-shrink-0">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => shareViaEmail(doc)} title="Enviar por correo"
                    className="text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0">
                    <Mail className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => shareViaWhatsApp(doc)} title="Enviar por WhatsApp"
                    className="text-slate-400 hover:text-green-500 transition-colors flex-shrink-0">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button onClick={() => deleteDoc.mutate(doc.id)}
                title="Eliminar"
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all flex-shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ItemPanel({ item, budgetLines = [], onUpdate, onClose }: {
  item: Item
  budgetLines?: BudgetLineLite[]
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [obsText, setObsText] = useState(item.observaciones ?? '')
  // R2: proveedor asignado a la actividad (catálogo global del holding)
  const { data: panelProviders = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['providers-global'],
    queryFn: providersGlobalApi.listAll,
    staleTime: 60_000,
  })
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md sm:w-96 h-full bg-slate-50 border-l border-slate-200 flex flex-col shadow-2xl overflow-y-auto">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/95 sticky top-0 z-10">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono text-slate-400 mb-0.5">{item.itemCode}</div>
            <div className="text-sm font-semibold text-slate-900 leading-tight">{item.activity}</div>
            {item.responsable && (
              <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400">
                <User className="w-3 h-3" />{item.responsable}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500 transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 px-5 py-4 space-y-5">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Estado</div>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map(e => (
                <button key={e.value}
                  onClick={() => {
                    const updates: Record<string, unknown> = { estado: e.value }
                    if (e.value === 'DONE') updates.completado = true
                    if (e.value === 'PENDIENTE') updates.completado = false
                    if (e.value === 'NA') { updates.esNA = true; updates.completado = false }
                    else updates.esNA = false
                    onUpdate(item.id, updates)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${e.color} ${e.bg} ${item.estado === e.value ? 'ring-1 ring-current' : ''}`}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          {/* R2: PROVEEDOR DE LA ACTIVIDAD — quién ejecuta/ejecutó este ítem */}
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Proveedor de la actividad</div>
            <select
              value={item.providerId ?? ''}
              onChange={e => onUpdate(item.id, { providerId: e.target.value || null })}
              className="w-full bg-white border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] text-slate-700">
              <option value="">Sin proveedor asignado</option>
              {panelProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Del catálogo general. Las facturas que adjuntes abajo pueden usar este u otro proveedor.</p>
          </div>

          {/* Asociación al Construction Budget — también editable desde el panel */}
          {budgetLines.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider mb-2">
                <Link2 className="w-3 h-3" />Asociación al Construction Budget
              </div>
              <select
                value={item.budgetLineId ?? ''}
                onChange={e => onUpdate(item.id, { budgetLineId: e.target.value || null })}
                className="w-full bg-white border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] text-slate-700">
                <option value="">Sin asociar (se controla con el presupuesto manual)</option>
                {budgetLines.map(bl => (
                  <option key={bl.id} value={bl.id}>
                    {bl.divCode} · {bl.itemCode} — {bl.description.slice(0, 45)} · {formatUSD(bl.valorInicial)}
                  </option>
                ))}
              </select>
              {item.budgetLine && (
                <p className="text-[10px] text-slate-400 mt-1">
                  La desviación de esta actividad se mide contra <b className="font-mono">{formatUSD(item.budgetLine.valorInicial)}</b> del budget del lender.
                </p>
              )}
            </div>
          )}

          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Valores</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3">
                <div className="text-[10px] text-slate-400 mb-1">Presupuestado</div>
                <div className="text-sm font-mono text-slate-700">{formatUSD(item.valorPresupuestado)}</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-[10px] text-slate-400 mb-1">Ejecutado (base)</div>
                <input type="number" defaultValue={Math.max(0, item.valorEjecutado - (item.subactivities ?? []).reduce((s, x) => s + (x.valorEjecutado || 0), 0)) || ''}
                  onBlur={e => onUpdate(item.id, { valorEjecutadoBase: parseFloat(e.target.value) || 0 })}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder="0"
                  className="w-full bg-transparent text-sm font-mono text-[var(--brand-teal)] focus:outline-none placeholder-slate-400" />
                {(item.subactivities?.length ?? 0) > 0 && (
                  <div className="text-[10px] text-slate-400 mt-1">Total con subactividades: <span className="font-mono text-[var(--brand-teal)]">{formatUSD(item.valorEjecutado)}</span></div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Las subactividades (desglose) se agregan desde la tabla de Ejecución con el botón verde ＋ junto al nombre de la actividad.</p>
            {item.valorPresupuestado > 0 && item.valorEjecutado > 0 && (
              <div className={`mt-2 text-xs font-mono px-2 py-1 rounded ${item.valorEjecutado > item.valorPresupuestado ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                {item.valorEjecutado > item.valorPresupuestado ? '▲ Sobreejecutado' : '▼ Bajo presupuesto'}{' '}
                {formatUSD(Math.abs(item.valorEjecutado - item.valorPresupuestado))}
              </div>
            )}
            {/* Unidad + cantidad → alimentan Precios de Referencia por unidad ($/pie², $/yarda³...) */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-white rounded-lg p-3">
                <div className="text-[10px] text-slate-400 mb-1">Unidad</div>
                <input type="text" defaultValue={item.unit ?? ''}
                  onBlur={e => onUpdate(item.id, { unit: e.target.value || null })}
                  placeholder="SF / LF / CY / EA"
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-800 px-2 py-1 rounded focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-[10px] text-slate-400 mb-1">Cantidad</div>
                <input type="number" defaultValue={item.quantity ?? ''}
                  onBlur={e => onUpdate(item.id, { quantity: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 text-sm font-mono text-slate-800 px-2 py-1 rounded focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider mb-2">
              <Calendar className="w-3 h-3" />Cronograma
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-slate-400 mb-1">Inicio real</div>
                <input type="date" defaultValue={item.fechaInicioReal?.slice(0, 10) ?? ''}
                  onChange={e => onUpdate(item.id, { fechaInicioReal: e.target.value || null })}
                  className="w-full bg-white border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-[var(--brand-gold)]" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 mb-1">Fin real</div>
                <input type="date" defaultValue={item.fechaFinReal?.slice(0, 10) ?? ''}
                  onChange={e => onUpdate(item.id, { fechaFinReal: e.target.value || null })}
                  className="w-full bg-white border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-[var(--brand-gold)]" />
              </div>
            </div>
          </div>
          {item.description && (
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Descripción técnica</div>
              <div className="text-xs text-slate-500 leading-relaxed bg-white/60 rounded-lg px-3 py-2.5">{item.description}</div>
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider mb-2">
              <FileText className="w-3 h-3" />Observaciones
            </div>
            <textarea value={obsText} onChange={e => setObsText(e.target.value)}
              onBlur={() => onUpdate(item.id, { observaciones: obsText })}
              placeholder="Agregar notas, incidencias, detalles..." rows={3}
              className="w-full bg-white border border-slate-200 text-slate-700 px-3 py-2.5 rounded-lg text-xs resize-none focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
          </div>
          <div className="border-t border-slate-200" />
          <DocumentSection item={item} />
        </div>
      </div>
    </div>
  )
}

/* ── Celda: asociación actividad ↔ línea del Construction Budget ─────────
   Permite amarrar el gasto real de una actividad a lo presupuestado en el
   budget del lender, aunque los nombres no coincidan. Fases que no existen
   en el budget (adquisición, financiamiento, seguros…) simplemente no se
   asocian y se controlan con el presupuesto manual. */
function BudgetLinkCell({ item, budgetLines, onUpdate }: {
  item: Item
  budgetLines: BudgetLineLite[]
  onUpdate: (id: string, data: Record<string, unknown>) => void
}) {
  const [editing, setEditing] = useState(false)
  const linked = item.budgetLine ?? null

  if (editing) {
    // Agrupar líneas por división para un selector legible
    const byDiv = new Map<string, BudgetLineLite[]>()
    for (const bl of budgetLines) {
      const key = `${bl.divCode} — ${bl.divName}`
      if (!byDiv.has(key)) byDiv.set(key, [])
      byDiv.get(key)!.push(bl)
    }
    return (
      <select
        autoFocus
        defaultValue={item.budgetLineId ?? ''}
        onBlur={() => setEditing(false)}
        onChange={e => { onUpdate(item.id, { budgetLineId: e.target.value || null }); setEditing(false) }}
        className="w-full max-w-[220px] bg-white border border-[var(--brand-gold)] text-[10px] text-slate-700 rounded px-1 py-1 focus:outline-none">
        <option value="">Sin asociar al budget</option>
        {Array.from(byDiv.entries()).map(([div, lines]) => (
          <optgroup key={div} label={div}>
            {lines.map(bl => (
              <option key={bl.id} value={bl.id}>
                {bl.itemCode} · {bl.description.slice(0, 40)} · {formatUSD(bl.valorInicial)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title={linked
        ? `Asociado al budget: ${linked.itemCode} — ${linked.description} (${formatUSD(linked.valorInicial)}). Clic para cambiar o quitar.`
        : 'Asociar esta actividad a una línea del Construction Budget'}
      className={`w-full flex items-center justify-end gap-1 text-[11px] font-mono transition-colors ${
        linked ? 'text-indigo-600 hover:text-indigo-800' : 'text-slate-300 hover:text-[var(--brand-gold)]'
      }`}>
      <Link2 className="w-3 h-3 flex-shrink-0" />
      {linked ? formatUSD(linked.valorInicial) : '—'}
    </button>
  )
}

/* ── Fila de subactividad: valor + fecha + responsable + invoice + obs ── */
function SubActivityRow({ sub, code, onUpdate, onDelete }: {
  sub: SubActivity
  code: string
  onUpdate: (data: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  // Catálogo global de proveedores (mismo del resto del sistema, cacheado)
  const { data: subProviders = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['providers-global'],
    queryFn: providersGlobalApi.listAll,
    staleTime: 60_000,
  })
  // Señal de control: hay gasto registrado pero NO hay soporte documental
  const warnInvoice = (sub.valorEjecutado || 0) > 0 && !sub.invoiceUrl
  const invalidate = () => qc.invalidateQueries({ queryKey: ['phases'] })
  const uploadInvoice = useMutation({
    mutationFn: (file: File) => subactivitiesApi.uploadInvoice(sub.id, file),
    onSuccess: () => { invalidate(); toast.success('Invoice adjuntado') },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al subir el invoice'),
  })
  const removeInvoice = useMutation({
    mutationFn: () => subactivitiesApi.deleteInvoice(sub.id),
    onSuccess: invalidate,
  })

  return (
    <div className="border-b border-slate-50 last:border-0">
      {/* Línea 1: código · descripción · valor · eliminar */}
      <div className="px-3 pt-1.5 flex items-center gap-2">
        <span className="text-[10px] font-mono text-[var(--brand-gold)] w-20 flex-shrink-0">{code}</span>
        <input defaultValue={sub.description}
          onBlur={e => { const v = e.target.value.trim(); if (v && v !== sub.description) onUpdate({ description: v }) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="flex-1 min-w-0 bg-transparent text-[11px] text-slate-700 focus:outline-none border-b border-transparent focus:border-slate-200" />
        <input type="number" min="0" defaultValue={sub.valorEjecutado || ''}
          onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== sub.valorEjecutado) onUpdate({ valorEjecutado: v }) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="0"
          className="w-28 bg-slate-50 border border-slate-200 text-[11px] font-mono text-right text-slate-800 rounded px-1.5 py-1 focus:outline-none focus:border-[var(--brand-gold)]" />
        <button onClick={onDelete} title="Eliminar subactividad"
          className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {/* Línea 2: fecha · proveedor · responsable · invoice · observaciones */}
      <div className="px-3 pb-1.5 pt-1 flex items-center gap-2 flex-wrap ml-20">
        <input type="date" defaultValue={sub.fecha?.slice(0, 10) ?? ''}
          title="Fecha en que se hizo / pagó"
          onChange={e => onUpdate({ fecha: e.target.value || null })}
          className="bg-white border border-slate-200 text-[10px] text-slate-600 rounded px-1.5 py-0.5 focus:outline-none focus:border-[var(--brand-gold)]" />
        {/* Proveedor del catálogo global — alimenta el récord en Proveedores */}
        <select
          value={sub.providerId ?? ''}
          onChange={e => onUpdate({ providerId: e.target.value || null })}
          title="Proveedor / contratista del catálogo — este servicio queda en su récord"
          className={`max-w-[150px] bg-white border text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-[var(--brand-gold)] ${sub.providerId ? 'border-slate-200 text-slate-700' : 'border-slate-200 text-slate-400'}`}>
          <option value="">Proveedor…</option>
          {subProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input defaultValue={sub.responsable ?? ''} placeholder="Quién lo hizo"
          title="Responsable / persona que ejecutó (si no es un proveedor del catálogo)"
          onBlur={e => { const v = e.target.value.trim(); if (v !== (sub.responsable ?? '')) onUpdate({ responsable: v || null }) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="w-28 bg-white border border-slate-200 text-[10px] text-slate-600 rounded px-1.5 py-0.5 focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-300" />
        {sub.invoiceUrl ? (
          <span className="flex items-center gap-1">
            <a href={`/api/download?url=${encodeURIComponent(sub.invoiceUrl)}&name=${encodeURIComponent(sub.invoiceName ?? 'invoice')}&inline=1`}
              target="_blank" rel="noreferrer" title={`Ver invoice: ${sub.invoiceName ?? ''}`}
              className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
              <Paperclip className="w-3 h-3" />
              <span className="max-w-[110px] truncate">{sub.invoiceName ?? 'Invoice'}</span>
            </a>
            <button onClick={() => removeInvoice.mutate()} title="Quitar invoice"
              className="text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
          </span>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploadInvoice.isPending}
            title={warnInvoice
              ? '⚠ CONTROL: esta subactividad tiene gasto registrado SIN soporte documental — adjunta el invoice'
              : 'Adjuntar invoice o documento equivalente (PDF/JPG/PNG)'}
            className={`flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 transition-colors disabled:opacity-50 border ${
              warnInvoice
                ? 'text-red-600 bg-red-50 border-red-300 hover:bg-red-100 font-semibold animate-pulse'
                : 'text-slate-400 hover:text-[var(--brand-gold)] border-dashed border-slate-300 hover:border-[var(--brand-gold)]'}`}>
            {warnInvoice ? <AlertTriangle className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
            {uploadInvoice.isPending ? 'Subiendo…' : warnInvoice ? 'Falta invoice' : 'Invoice'}
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadInvoice.mutate(f); e.target.value = '' }} />
        <input defaultValue={sub.observaciones ?? ''} placeholder="Observaciones…"
          onBlur={e => { const v = e.target.value.trim(); if (v !== (sub.observaciones ?? '')) onUpdate({ observaciones: v || null }) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="flex-1 min-w-[120px] bg-white border border-slate-200 text-[10px] text-slate-600 rounded px-1.5 py-0.5 focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-300" />
      </div>
    </div>
  )
}

function ItemRow({ item, budgetLines, onUpdate, onOpenPanel, onDelete }: {
  item: Item
  budgetLines: BudgetLineLite[]
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onOpenPanel: (item: Item) => void
  onDelete?: (item: Item) => void
}) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [newSubDesc, setNewSubDesc] = useState('')
  const [newSubVal, setNewSubVal] = useState('')
  const invalidate = () => qc.invalidateQueries({ queryKey: ['phases'] })
  const createSub = useMutation({
    mutationFn: (d: Record<string, unknown>) => subactivitiesApi.create(item.id, d),
    onSuccess: (_r, vars: any) => {
      setNewSubDesc(''); setNewSubVal(''); invalidate()
      // Señal de control inmediata: se registró gasto sin soporte documental
      if ((Number(vars?.valorEjecutado) || 0) > 0) {
        toast('⚠ Subactividad registrada SIN invoice — adjunta el soporte para mantener la trazabilidad', {
          icon: '📎', duration: 6000,
          style: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' },
        })
      }
    },
  })
  const updateSub = useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => subactivitiesApi.update(id, data), onSuccess: invalidate })
  const deleteSub = useMutation({ mutationFn: (id: string) => subactivitiesApi.delete(id), onSuccess: invalidate })

  const isSlot = item.itemCode.includes('X') && !item.itemCode.includes('.A')
  if (isSlot && !item.completado && !item.valorEjecutado) {
    return (
      <tr className="slot-row border-b border-slate-100">
        <td colSpan={10} className="px-4 font-mono" title="Espacio reservado para actividades futuras de esta fase">{item.itemCode} · reservado</td>
      </tr>
    )
  }
  const subs = item.subactivities ?? []
  const hasSubs = subs.length > 0
  const totalEjec = item.valorEjecutado            // backend roll-up = base + Σ subs (total real)
  const sumSubs = subs.reduce((s, x) => s + (x.valorEjecutado || 0), 0)
  // Base = valor propio de la actividad, DERIVADO del total real (robusto: no
  // depende de que valorEjecutadoBase esté bien poblado en la BD).
  const base = Math.max(0, totalEjec - sumSubs)
  // Baseline de control: si la actividad está asociada al Construction Budget,
  // la desviación se mide contra el budget del lender; si no, contra el
  // presupuesto manual de planeación.
  const baseline = item.budgetLine ? item.budgetLine.valorInicial : item.valorPresupuestado
  const desviacion = totalEjec - baseline
  const overBaseline = baseline > 0 && totalEjec > baseline
  const docCount = item.documents?.length ?? 0
  const hasFactura = item.documents?.some(d => d.type === 'FACTURA') ?? false
  const warnDoc = (totalEjec > 0 || item.completado) && !hasFactura
  const phaseCode = item.itemCode.split('.')[0]
  const addSub = () => { if (!newSubDesc.trim()) return; createSub.mutate({ description: newSubDesc.trim(), valorEjecutado: parseFloat(newSubVal) || 0 }) }
  let rowBg = 'border-b border-slate-100 hover:bg-white/40 transition-colors group'
  if (item.completado) rowBg = 'border-b border-slate-200/20 bg-emerald-50/40 hover:bg-emerald-50/60 transition-colors group'
  else if (item.estado === 'EN_CURSO') rowBg = 'border-b border-slate-200/30 bg-amber-50/60 hover:bg-amber-50/40 transition-colors group'
  return (
    <>
      <tr className={`${rowBg} ${item.esNA ? 'opacity-40' : ''}`}>
        {/* St. — N/A toggle */}
        <td className="pl-3 pr-1 py-2.5 w-16">
          <button
            onClick={() => onUpdate(item.id, { esNA: !item.esNA })}
            title={item.esNA ? 'Re-habilitar ítem (sí aplica)' : 'Marcar como NO APLICA'}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${item.esNA ? 'bg-slate-300 text-slate-600 hover:bg-slate-400' : 'bg-white border border-slate-200 text-slate-300 hover:border-slate-400 hover:text-slate-500'}`}>
            {item.esNA ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </td>
        {/* Cód. — abre el panel de detalle */}
        <td className="px-2 py-2.5 w-16 cursor-pointer" onClick={() => onOpenPanel(item)} title="Ver detalle de la actividad">
          <span className="text-[10px] font-mono text-slate-400 hover:text-[var(--brand-gold)]">{item.itemCode}</span>
        </td>
        {/* Actividad — nombre editable + toggle de subactividades */}
        <td className="px-2 py-2.5">
          <div className="flex items-center gap-1">
            {/* Botón + SIEMPRE visible: abre el desglose de subactividades */}
            <button
              onClick={() => setExpanded(e => !e)}
              title={expanded ? 'Cerrar subactividades' : 'Agregar / ver subactividades (desglose)'}
              className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border transition-all
                ${expanded
                  ? 'bg-emerald-500 border-emerald-500 text-white rotate-45'
                  : hasSubs
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                    : 'bg-white border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-600'}`}>
              <Plus className="w-3 h-3" />
            </button>
            <input
              defaultValue={item.activity}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== item.activity) onUpdate(item.id, { activity: v }) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className={`w-full bg-transparent text-xs font-medium leading-tight rounded px-1 py-0.5 border border-transparent hover:border-slate-200 focus:bg-white focus:border-[var(--brand-gold)] focus:outline-none transition-colors ${item.completado ? 'line-through text-slate-400' : 'text-slate-800'}`}
              title="Clic para editar el nombre de la actividad" />
            {hasSubs && <span className="text-[8px] px-1 rounded bg-emerald-100 text-emerald-700 font-mono flex-shrink-0" title={`${subs.length} subactividad(es)`}>Σ{subs.length}</span>}
          </div>
          {(item.responsable || item.provider) && (
            <div className="text-[10px] text-slate-400 mt-0.5 px-1 ml-4">{item.provider ? `⚒ ${item.provider.name}` : item.responsable}</div>
          )}
        </td>
        {/* Estado — botones de estado */}
        <td className="px-2 py-2.5 w-24">
          <div className="flex gap-0.5">
            {ESTADOS.filter(e => e.value !== 'NA').map(e => {
              const active = item.estado === e.value
              const colors = e.value === 'DONE'
                ? active ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                : e.value === 'EN_CURSO'
                  ? active ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                  : active ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              return (
                <button key={e.value} title={e.label} disabled={item.esNA}
                  onClick={() => { const u: Record<string, unknown> = { estado: e.value }; if (e.value === 'DONE') u.completado = true; if (e.value === 'PENDIENTE') u.completado = false; onUpdate(item.id, u) }}
                  className={`flex-1 px-1.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed ${colors}`}>
                  {e.value === 'DONE' ? '✓' : e.value === 'EN_CURSO' ? '⋯' : '—'}
                </button>
              )
            })}
          </div>
        </td>
        {/* Presupuesto (planeación) — EDITABLE inline: aquí se hace la fase de
            planeación sin salir de Ejecución (sección unificada) */}
        <td className="px-2 py-2.5 w-24 text-right border-l border-slate-100">
          <input type="number" min="0" defaultValue={item.valorPresupuestado || ''}
            onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== item.valorPresupuestado) onUpdate(item.id, { valorPresupuestado: v }) }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder="—"
            title="Presupuesto de planeación (editable)"
            className="w-full bg-transparent border border-transparent hover:border-slate-200 text-[11px] font-mono text-right text-slate-600 rounded px-1.5 py-1 focus:outline-none focus:bg-white focus:border-[var(--brand-gold)] placeholder-slate-300 transition-colors" />
        </td>
        {/* Presup. según Construction Budget (cuando la actividad está asociada) */}
        <td className="px-2 py-2.5 w-24 text-right border-l border-slate-100">
          <BudgetLinkCell item={item} budgetLines={budgetLines} onUpdate={onUpdate} />
        </td>
        {/* Ejecutado — total (base + subactividades) */}
        <td className="px-2 py-2.5 w-24 text-right border-l border-slate-100">
          {hasSubs ? (
            <button onClick={() => setExpanded(true)} title={`Base ${formatUSD(base)} + ${subs.length} subactividad(es)`}
              className="w-full flex items-center justify-end gap-1 text-[11px] font-mono font-semibold text-[var(--brand-teal)]">
              <span className="text-[8px] px-1 rounded bg-teal-100 text-teal-700">Σ</span>{formatUSD(totalEjec)}
            </button>
          ) : (
            <input type="number" min="0" defaultValue={base || ''}
              onBlur={e => onUpdate(item.id, { valorEjecutadoBase: parseFloat(e.target.value) || 0 })}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              placeholder="—"
              className="w-full bg-white border border-slate-200 text-[11px] font-mono font-semibold text-right text-slate-900 rounded px-1.5 py-1 focus:outline-none focus:border-[var(--brand-gold)] focus:ring-2 focus:ring-[var(--brand-gold)]/20 placeholder-slate-300" />
          )}
        </td>
        {/* Desv. — SOLO la desviación (positiva roja = gastado de más; negativa
            verde = ahorro). Se mide contra el budget del lender si hay
            asociación 🔗; si no, contra el presupuesto manual. */}
        <td className="px-2 py-2.5 w-20 text-right border-l border-slate-100">
          <div className="flex items-center justify-end gap-1">
            {baseline > 0 && totalEjec > 0 ? (
              <span
                title={item.budgetLine
                  ? `Gastado ${formatUSD(totalEjec)} vs ${formatUSD(baseline)} del Construction Budget${overBaseline ? ' — SOBRE lo presupuestado por el lender' : ''}`
                  : `Gastado ${formatUSD(totalEjec)} vs ${formatUSD(baseline)} del presupuesto manual`}
                className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${desviacion > 0 ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
                {desviacion > 0 ? '▲ +' : '▼ '}{formatUSD(Math.abs(desviacion))}
              </span>
            ) : (
              <span className="text-[10px] text-slate-300" title="Sin presupuesto o sin gasto aún — no hay desviación que medir">—</span>
            )}
            {overBaseline && item.budgetLine && (
              <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
            )}
          </div>
        </td>
        {/* Doc */}
        <td className="px-1 py-2.5 w-12 text-center border-l border-slate-100">
          <button onClick={() => onOpenPanel(item)}
            className={`inline-flex items-center justify-center gap-0.5 text-[10px] font-mono font-semibold transition-colors ${warnDoc ? 'text-red-500' : docCount > 0 ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
            title={warnDoc ? '⚠ Sin factura adjunta — súbela en el panel del ítem' : docCount > 0 ? `${docCount} documento(s) adjunto(s)` : 'Adjuntar documento / factura'}>
            {warnDoc ? <AlertTriangle className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
            {docCount > 0 && <span>{docCount}</span>}
          </button>
        </td>
        {/* Eliminar — columna PROPIA, siempre visible */}
        <td className="pr-3 pl-1 py-2.5 w-10 text-center border-l border-slate-100">
          {onDelete && (
            <button onClick={() => onDelete(item)} title="Eliminar esta actividad (pide confirmación)"
              className="w-6 h-6 inline-flex items-center justify-center rounded-md text-slate-400 bg-slate-50 border border-slate-200 hover:text-white hover:bg-red-500 hover:border-red-500 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </td>
      </tr>

      {/* Desglose — subactividades (SUMAN al valor base de la actividad) */}
      {expanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={10} className="p-0">
            <div className="reveal ml-10 mr-4 my-2 rounded-lg border border-slate-200 bg-white">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Desglose · Fase {phaseCode} · Actividad {item.itemCode}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  Base {formatUSD(base)} + Sub {formatUSD(Math.max(0, totalEjec - base))} = <span className="font-bold text-[var(--brand-teal)]">{formatUSD(totalEjec)}</span>
                </div>
              </div>
              {/* Valor base de la actividad (se respeta y las subactividades se suman) */}
              <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-100">
                <span className="text-[11px] text-slate-500 flex-1">Valor de la actividad (base)</span>
                <input type="number" min="0" defaultValue={base || ''}
                  onBlur={e => onUpdate(item.id, { valorEjecutadoBase: parseFloat(e.target.value) || 0 })}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder="0"
                  className="w-28 bg-slate-50 border border-slate-200 text-[11px] font-mono text-right text-slate-800 rounded px-1.5 py-1 focus:outline-none focus:border-[var(--brand-gold)]" />
              </div>
              {/* Subactividades existentes — con fecha, responsable, invoice y observaciones */}
              {subs.map((sub, idx) => (
                <SubActivityRow
                  key={sub.id}
                  sub={sub}
                  code={`${item.itemCode}.${String(idx + 1).padStart(3, '0')}`}
                  onUpdate={data => updateSub.mutate({ id: sub.id, data })}
                  onDelete={() => deleteSub.mutate(sub.id)}
                />
              ))}
              {/* Agregar subactividad */}
              <div className="px-3 py-2 flex items-center gap-2 bg-slate-50/50">
                <span className="text-[10px] font-mono text-slate-300 w-20 flex-shrink-0">{item.itemCode}.{String(subs.length + 1).padStart(3, '0')}</span>
                <input value={newSubDesc} onChange={e => setNewSubDesc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSub() }}
                  placeholder="Nueva subactividad…" className="flex-1 min-w-0 bg-white border border-slate-200 text-[11px] text-slate-700 rounded px-2 py-1 focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
                <input type="number" min="0" value={newSubVal} onChange={e => setNewSubVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSub() }}
                  placeholder="Valor" className="w-28 bg-white border border-slate-200 text-[11px] font-mono text-right text-slate-700 rounded px-1.5 py-1 focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
                <button onClick={addSub} disabled={!newSubDesc.trim() || createSub.isPending} title="Agregar subactividad" className="flex items-center px-1.5 py-1 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-white rounded disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function PhaseSection({ phase, budgetLines, budgetDivisions, defaultOpen = false, onUpdate, onOpenPanel, onCreate, onDelete, onRenamePhase, onSetPhaseBudgetLink }: {
  defaultOpen?: boolean
  phase: Phase
  budgetLines: BudgetLineLite[]
  budgetDivisions: Array<{ divCode: string; divName: string; total: number }>
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onOpenPanel: (item: Item) => void
  onCreate: (phaseId: string, activity?: string) => void
  onDelete: (item: Item) => void
  onRenamePhase: (phaseId: string, name: string) => void
  onSetPhaseBudgetLink: (phaseId: string, budgetDivCode: string | null) => void
}) {
  // FASE 1: colapsadas por defecto para una vista más limpia y amigable
  const [open, setOpen] = useState(defaultOpen)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [showDivPicker, setShowDivPicker] = useState(false)

  // Enlace FASE ↔ divisiones del Construction Budget (para fases completas,
  // p.ej. Foundation ↔ DIV 03; las fases sin budget — adquisición, seguros,
  // financiamiento — simplemente no se asocian).
  const linkedDivCodes = (phase.budgetDivCode ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const linkedDivs = budgetDivisions.filter(d => linkedDivCodes.includes(d.divCode))
  const phaseLenderBudget = linkedDivs.reduce((s, d) => s + d.total, 0)
  const toggleDiv = (divCode: string) => {
    const next = linkedDivCodes.includes(divCode)
      ? linkedDivCodes.filter(c => c !== divCode)
      : [...linkedDivCodes, divCode]
    onSetPhaseBudgetLink(phase.id, next.length ? next.join(',') : null)
  }
  const activeItems = phase.items.filter(i => !i.esNA)
  const doneItems = activeItems.filter(i => i.completado)
  const pct = activeItems.length === 0 ? 0 : (doneItems.length / activeItems.length) * 100
  const budget = phase.items.reduce((s, i) => s + i.valorPresupuestado, 0)
  const ejecutado = phase.items.reduce((s, i) => s + i.valorEjecutado, 0)
  // Alerta por fase: ejecución real supera el presupuesto de obra de la MISMA fase
  // (misma fuente de datos — comparación exacta ítem a ítem)
  const phaseOver = budget > 0 && ejecutado > budget
  const borderColor = phaseOver ? 'border-l-2 border-red-500/70' : pct === 100 ? 'border-l-2 border-emerald-500/50' : pct > 0 ? 'border-l-2 border-amber-500/50' : ''
  const phaseClass = `w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 bg-white/90 rounded-xl border ${borderColor} border-slate-200/40 hover:border-slate-200 transition-colors`
  return (
    <div className="mb-2.5">
      <div onClick={() => setOpen(o => !o)} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' && !editingName) setOpen(o => !o) }}
        className={`${phaseClass} cursor-pointer`}>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
        <span className="text-[10px] font-mono text-[var(--brand-gold)] w-7 flex-shrink-0">{phase.code}</span>
        {/* Nombre de fase EDITABLE: alinéalo con tu Construction Budget en cada
            nuevo proyecto sin tocar código ni estructura */}
        {editingName ? (
          <input
            autoFocus
            defaultValue={phase.name}
            onClick={e => e.stopPropagation()}
            onBlur={e => {
              const v = e.target.value.trim()
              if (v && v !== phase.name) onRenamePhase(phase.id, v)
              setEditingName(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditingName(false)
            }}
            className="flex-1 min-w-0 bg-white border border-[var(--brand-gold)] text-sm font-semibold text-slate-800 rounded px-2 py-0.5 focus:outline-none" />
        ) : (
          <span className="flex items-center gap-1.5 flex-1 min-w-0 text-left group/name">
            <span className="text-sm font-semibold text-slate-800 leading-tight truncate">{phase.name}</span>
            <button
              onClick={e => { e.stopPropagation(); setEditingName(true) }}
              title="Renombrar fase (para alinearla con tu Construction Budget)"
              className="opacity-0 group-hover/name:opacity-100 text-slate-300 hover:text-[var(--brand-gold)] transition-all flex-shrink-0">
              <Pencil className="w-3 h-3" />
            </button>
          </span>
        )}
        {phaseOver && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 flex-shrink-0"
            title={`Ejecutado ${formatUSD(ejecutado)} supera el presupuesto de la fase ${formatUSD(budget)}`}>
            <AlertTriangle className="w-3 h-3" />
            <span className="hidden sm:inline">SOBRE PRESUPUESTO</span>
          </span>
        )}
        <div className="flex items-center gap-2 sm:gap-4 text-xs shrink-0">
          <span className="text-slate-400 font-mono hidden sm:block">{doneItems.length}/{activeItems.length}</span>
          <span className="text-slate-400 font-mono hidden lg:block">{budget > 0 ? formatUSD(budget) : '—'}</span>
          {ejecutado > 0 && (
            <span className={`font-mono text-[11px] hidden lg:block ${phaseOver ? 'text-red-500' : 'text-[var(--brand-teal)]'}`}>{formatUSD(ejecutado)}</span>
          )}
          <span className={`font-mono font-semibold w-9 text-right ${pct > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{pct.toFixed(0)}%</span>
          <div className="w-10 sm:w-14 h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
            <div className={`h-full rounded-full bar-fill ${pct > 0 ? 'bg-emerald-500' : 'bg-slate-200'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      {open && (
        <div className="reveal mt-0.5 bg-slate-50/60 rounded-b-xl border border-slate-200/30 border-t-0 overflow-hidden">
          {/* Enlace FASE ↔ divisiones del Construction Budget (opcional) */}
          {budgetDivisions.length > 0 && (
            <div className="px-4 py-2 border-b border-slate-200/60 bg-white/60">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
                  <Link2 className="w-3 h-3" />Budget de la fase
                </span>
                {linkedDivs.length > 0 ? (
                  <>
                    {linkedDivs.map(d => (
                      <span key={d.divCode} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono">
                        {d.divCode} · {formatUSD(d.total)}
                      </span>
                    ))}
                    <span className={`text-[11px] font-mono font-semibold ${ejecutado > phaseLenderBudget ? 'text-red-600' : 'text-slate-600'}`}
                      title="Total presupuestado por el lender para las divisiones asociadas a esta fase, vs lo ejecutado">
                      = {formatUSD(phaseLenderBudget)} · ejec. {formatUSD(ejecutado)}
                      {phaseLenderBudget > 0 && (
                        <> · Δ {ejecutado - phaseLenderBudget > 0 ? '+' : ''}{formatUSD(ejecutado - phaseLenderBudget)}</>
                      )}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">sin asociar — esta fase se controla con el presupuesto manual</span>
                )}
                <button onClick={() => setShowDivPicker(v => !v)}
                  className="ml-auto text-[10px] text-slate-400 hover:text-[var(--brand-gold)] underline decoration-dotted">
                  {showDivPicker ? 'cerrar' : linkedDivs.length > 0 ? 'editar asociación' : 'asociar divisiones del budget'}
                </button>
              </div>
              {showDivPicker && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {budgetDivisions.map(d => {
                    const active = linkedDivCodes.includes(d.divCode)
                    return (
                      <button key={d.divCode} onClick={() => toggleDiv(d.divCode)}
                        title={`${d.divName} — ${formatUSD(d.total)}`}
                        className={`text-[10px] px-2 py-1 rounded-lg border font-mono transition-all ${
                          active
                            ? 'bg-indigo-500 border-indigo-500 text-white'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}>
                        {d.divCode} · {d.divName.slice(0, 18)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {/* Alerta: la fase supera el budget del LENDER asociado */}
          {phaseLenderBudget > 0 && ejecutado > phaseLenderBudget && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-[11px] text-red-700 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Esta fase ({formatUSD(ejecutado)}) supera el budget del lender asociado ({formatUSD(phaseLenderBudget)}) por <b className="font-mono">{formatUSD(ejecutado - phaseLenderBudget)}</b> — la diferencia sale de caja propia.
            </div>
          )}
          {/* Alerta de sobrecosto de la fase — presupuesto de obra vs ejecutado (misma fuente, ítem a ítem) */}
          {phaseOver && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-[11px] text-red-700 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              La ejecución de esta fase ({formatUSD(ejecutado)}) supera su presupuesto de obra ({formatUSD(budget)}) por <b className="font-mono">{formatUSD(ejecutado - budget)}</b>.
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100">
                <th className="pl-4 pr-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-16">St.</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-16">Cód.</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Actividad</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-24">Estado</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-24" title="Presupuesto de planeación (editable)">Presup. ✏</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold text-indigo-500 uppercase tracking-wider w-24" title="Presupuesto según Construction Budget (cuando la actividad está asociada)">Budget 🔗</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold text-[var(--brand-gold)] uppercase tracking-wider w-24">Ejecutado</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-20" title="Desviación del gasto: ▲ rojo = gastado de más · ▼ verde = por debajo. Se mide contra el budget asociado 🔗 si existe; si no, contra Presup. ✏">Desv.</th>
                <th className="px-1 py-2 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-12">Doc</th>
                <th className="pr-3 pl-1 py-2 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-10" title="Eliminar actividad">
                  <Trash2 className="w-3 h-3 inline-block" />
                </th>
              </tr>
            </thead>
            <tbody>
              {phase.items.map(item => (
                <ItemRow key={item.id} item={item} budgetLines={budgetLines} onUpdate={onUpdate} onOpenPanel={onOpenPanel}
                  onDelete={onDelete} />
              ))}
            </tbody>
          </table>
          </div>
          {/* Crear actividad CON nombre propio (ya no queda como "Nueva actividad") */}
          {showNewForm ? (
            <form onSubmit={e => { e.preventDefault(); const v = newName.trim(); if (v) { onCreate(phase.id, v); setNewName(''); setShowNewForm(false) } }}
              className="flex items-center gap-2 px-4 py-2 w-full border-t border-slate-100 bg-white">
              <Plus className="w-3.5 h-3.5 text-[var(--brand-gold)] flex-shrink-0" />
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                placeholder={`Nombre de la nueva actividad en ${phase.code}…`}
                className="flex-1 bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
              <button type="submit" disabled={!newName.trim()}
                className="px-3 py-1.5 bg-[var(--brand-gold)] text-white text-xs font-semibold rounded-lg disabled:opacity-40">Crear</button>
              <button type="button" onClick={() => { setShowNewForm(false); setNewName('') }}
                className="text-xs text-slate-400 hover:underline">Cancelar</button>
            </form>
          ) : (
            <button onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 hover:text-[var(--brand-gold)] hover:bg-[#3E5A70]/5 transition-colors w-full border-t border-slate-100">
              <Plus className="w-3.5 h-3.5" />Agregar actividad a {phase.code}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Execution({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [filter, setFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [panelItem, setPanelItem] = useState<Item | null>(null)
  const [expandAll, setExpandAll] = useState(false)  // por defecto colapsado
  const [expandTrigger, setExpandTrigger] = useState(0)  // fuerza re-mount al cambiar

  const { data: phases = [], isLoading } = useQuery<Phase[]>({
    queryKey: ['phases', projectId],
    queryFn: () => phasesApi.list(projectId),
  })

  // Datos financieros del proyecto: para "saldo pendiente por girar del lender"
  const { data: project } = useQuery<any>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    staleTime: 60_000,
  })
  const { data: draws = [] } = useQuery<Draw[]>({
    queryKey: ['draws', projectId],
    queryFn: () => drawsApi.list(projectId),
    staleTime: 60_000,
  })
  // Líneas del Construction Budget: para la asociación actividad ↔ budget
  const { data: budgetLinesRaw = [] } = useQuery<any[]>({
    queryKey: ['construction-budget', projectId],
    queryFn: () => constructionBudgetApi.list(projectId),
    staleTime: 60_000,
  })
  const budgetLines: BudgetLineLite[] = budgetLinesRaw.map((b: any) => ({
    id: b.id, divCode: b.divCode, divName: b.divName, itemCode: b.itemCode,
    description: b.description, valorInicial: b.valorInicial, valorAprobado: b.valorAprobado,
  }))

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => itemsApi.patch(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phases', projectId] }),
  })

  const createMutation = useMutation({
    mutationFn: ({ phaseId, activity }: { phaseId: string; activity?: string }) =>
      itemsApi.create({ phaseId, ...(activity ? { activity } : {}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phases', projectId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['phases', projectId] }); setPanelItem(null); toast.success('Actividad eliminada') },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al eliminar la actividad'),
  })

  // Renombrar fase (alineación con el Construction Budget de cada proyecto)
  const renamePhaseMutation = useMutation({
    mutationFn: ({ phaseId, name }: { phaseId: string; name: string }) => phasesApi.rename(projectId, phaseId, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['phases', projectId] }); toast.success('Fase renombrada') },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al renombrar la fase'),
  })

  // Eliminar CUALQUIER actividad (nueva o precargada) con confirmación explícita.
  // Las precargadas advierten más fuerte: son parte de la plantilla de control.
  const handleDeleteItem = async (item: Item) => {
    const esPlantilla = !item.itemCode.includes('.A')
    const ok = await confirm({
      title: 'Eliminar actividad',
      message: `¿Eliminar "${item.itemCode} — ${item.activity}"?`,
      detail: esPlantilla
        ? 'Esta actividad es de la plantilla base de control. Si la eliminas, desaparece de la ejecución, el presupuesto y el avance de la fase. Esta acción no se puede deshacer.'
        : 'Se eliminará junto con su valor ejecutado y documentos adjuntos. Esta acción no se puede deshacer.',
      destructive: true,
      confirmText: 'Sí, eliminar',
    })
    if (ok) deleteMutation.mutate(item.id)
  }

  // Divisiones del Construction Budget (para el enlace por FASE)
  const { data: budgetDivisions = [] } = useQuery<Array<{ divCode: string; divName: string; total: number }>>({
    queryKey: ['budget-divisions', projectId],
    queryFn: () => phasesApi.budgetDivisions(projectId),
    staleTime: 60_000,
  })

  // Enlace fase ↔ divisiones del budget
  const setPhaseBudgetLink = useMutation({
    mutationFn: ({ phaseId, budgetDivCode }: { phaseId: string; budgetDivCode: string | null }) =>
      phasesApi.setBudgetLink(projectId, phaseId, budgetDivCode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phases', projectId] }),
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al asociar el budget'),
  })

  // Borrar SOLO los valores presupuestados (paridad con la antigua página Presupuesto)
  const resetBudget = useMutation({
    mutationFn: () => projectsApi.resetBudget(projectId),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['phases', projectId] })
      toast.success(r?.message || 'Presupuesto reseteado — la ejecución no se tocó')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error'),
  })
  const handleClearBudget = async () => {
    const ok = await confirm({
      title: 'Borrar todos los valores presupuestados',
      message: '¿Seguro que quieres borrar TODOS los valores presupuestados?',
      detail: 'Esta acción resetea el presupuesto manual (Presup. ✏) de TODOS los items a 0. La ejecución, las asociaciones al budget y la estructura NO se tocan. Esta acción no se puede deshacer.',
      destructive: true,
      confirmText: 'Sí, borrar presupuesto',
      typeToConfirm: 'BORRAR PRESUPUESTO',
    })
    if (ok) resetBudget.mutate()
  }

  // Borrar TODOS los datos de ejecución vía endpoint backend (batch atómico)
  const clearAllExecution = useMutation({
    mutationFn: () => projectsApi.resetExecution(projectId),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['phases', projectId] })
      toast.success(r?.message || 'Datos de ejecución borrados — estructura mantenida')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al borrar datos'),
  })

  const handleClearAll = async () => {
    const ok = await confirm({
      title: 'Borrar todos los datos de ejecución',
      message: '¿Seguro que quieres borrar TODOS los datos de ejecución?',
      detail: 'Esta acción resetea: valor ejecutado, estado, fechas reales, observaciones y marcas de N/A de TODOS los items en TODAS las fases. La estructura de fases e items se conserva. Esta acción no se puede deshacer.',
      destructive: true,
      confirmText: 'Sí, borrar todos los datos',
      typeToConfirm: 'BORRAR EJECUCIÓN',
    })
    if (ok) clearAllExecution.mutate()
  }

  const handleUpdate = (id: string, data: Record<string, unknown>) => {
    updateMutation.mutate({ id, data })
    if (panelItem?.id === id) {
      // Mantener coherente el objeto budgetLine del panel al cambiar la asociación
      const extra: Record<string, unknown> = {}
      if ('budgetLineId' in data) {
        extra.budgetLine = data.budgetLineId ? (budgetLines.find(b => b.id === data.budgetLineId) ?? null) : null
      }
      setPanelItem(prev => prev ? { ...prev, ...data, ...extra } as Item : null)
    }
  }

  const filteredPhases = phases.map(phase => ({
    ...phase,
    items: phase.items.filter(item => {
      if (search && !item.activity.toLowerCase().includes(search.toLowerCase())) return false
      if (filter === 'DONE') return item.completado
      if (filter === 'PENDIENTE') return !item.completado && !item.esNA
      if (filter === 'EN_CURSO') return item.estado === 'EN_CURSO'
      return true
    }),
  })).filter(p => p.items.length > 0)

  const totalItems = phases.flatMap(p => p.items.filter(i => !i.esNA))
  const doneTotal = totalItems.filter(i => i.completado)
  const pctGeneral = totalItems.length === 0 ? 0 : (doneTotal.length / totalItems.length) * 100

  // Totales de ejecución (sumatoria de todas las fases) — fuente única: los ítems de obra
  const grandPresupuestado = phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorPresupuestado, 0), 0)
  const grandEjecutado = phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorEjecutado, 0), 0)
  const overBudget = grandPresupuestado > 0 && grandEjecutado > grandPresupuestado
  const deltaVsBudget = grandEjecutado - grandPresupuestado

  // Desviación SOLO de las actividades asociadas al Construction Budget.
  // Agrupado por línea del budget: el presupuesto de cada línea cuenta UNA vez
  // aunque varias actividades apunten a la misma línea.
  const linkedByLine = new Map<string, { budget: number; ejec: number }>()
  for (const p of phases) {
    for (const i of p.items) {
      if (i.budgetLineId && i.budgetLine) {
        const cur = linkedByLine.get(i.budgetLineId) ?? { budget: i.budgetLine.valorInicial, ejec: 0 }
        cur.ejec += i.valorEjecutado
        linkedByLine.set(i.budgetLineId, cur)
      }
    }
  }
  const linkedBudgetTotal = Array.from(linkedByLine.values()).reduce((s, x) => s + x.budget, 0)
  const linkedEjecTotal = Array.from(linkedByLine.values()).reduce((s, x) => s + x.ejec, 0)
  const linkedDelta = linkedEjecTotal - linkedBudgetTotal
  const linkedCount = phases.reduce((s, p) => s + p.items.filter(i => i.budgetLineId).length, 0)
  const linkedOver = linkedByLine.size > 0 && linkedDelta > 0

  // Saldo pendiente por girar del LENDER = holdback de construcción − Σ draws
  // wired (netWire). Si el proyecto no maneja holdback, cae al loan amount.
  const wiredTotal = draws.filter(d => d.estado === 'WIRED').reduce((s, d) => s + (d.netWire || 0), 0)
  const lenderBase = project ? (project.holdback > 0 ? project.holdback : (project.loanAmount || 0)) : 0
  const saldoLender = lenderBase > 0 ? lenderBase - wiredTotal : null

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando ejecución...</div>

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><HardHat className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>Presupuesto & Ejecución</span></h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-slate-500">{doneTotal.length}/{totalItems.length} ítems</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all bar-fill" style={{ width: `${pctGeneral}%` }} />
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-600">{pctGeneral.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="text" placeholder="Buscar actividad..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-white border border-slate-200 text-xs text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] w-full sm:w-44 placeholder-slate-400" />
            <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
              {[{ v: 'ALL', l: 'Todos' }, { v: 'PENDIENTE', l: 'Pendiente' }, { v: 'EN_CURSO', l: 'En curso' }, { v: 'DONE', l: 'Hecho' }].map(f => (
                <button key={f.v} onClick={() => setFilter(f.v)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f.v ? 'bg-[var(--brand-teal)] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {f.l}
                </button>
              ))}
            </div>
            {/* Expandir/Colapsar todas las fases */}
            <button
              onClick={() => { setExpandAll(!expandAll); setExpandTrigger(t => t + 1) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-[var(--brand-gold)] text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              title={expandAll ? 'Colapsar todas las fases' : 'Expandir todas las fases'}
            >
              {expandAll ? <ChevronsUp className="w-3.5 h-3.5" /> : <ChevronsDown className="w-3.5 h-3.5" />}
              {expandAll ? 'Colapsar' : 'Expandir'} todo
            </button>
            {/* Borrar SOLO el presupuesto manual (paridad con la antigua página Presupuesto) */}
            <button
              onClick={handleClearBudget}
              disabled={resetBudget.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              title="Borrar todos los valores presupuestados (la ejecución no se toca)"
            >
              <Eraser className="w-3.5 h-3.5" />
              {resetBudget.isPending ? 'Borrando…' : 'Borrar presupuesto'}
            </button>
            {/* Borrar todos los datos de ejecución */}
            <button
              onClick={handleClearAll}
              disabled={clearAllExecution.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              title="Borrar todos los datos de ejecución (mantiene la estructura)"
            >
              <Eraser className="w-3.5 h-3.5" />
              {clearAllExecution.isPending ? 'Borrando…' : 'Borrar datos'}
            </button>
          </div>
        </div>

        {/* ── Panel gerencial: 6 indicadores clave del proyecto ──
            Presupuesto · Ejecutado · Saldo por girar (lender) · Desv. total ·
            Desv. asociados al budget · Avance físico */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="kpi-card">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Presupuesto total</div>
            <div className="text-lg font-bold font-mono text-slate-800">{formatUSD(grandPresupuestado)}</div>
            <div className="text-[10px] text-slate-400 mt-1">Σ planeación de todas las fases</div>
          </div>
          <div className="kpi-card">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Total ejecutado</div>
            <div className="text-lg font-bold font-mono text-[var(--brand-teal)]">{formatUSD(grandEjecutado)}</div>
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full bar-fill" style={{ width: `${grandPresupuestado > 0 ? Math.min(100, (grandEjecutado / grandPresupuestado) * 100) : 0}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{grandPresupuestado > 0 ? `${((grandEjecutado / grandPresupuestado) * 100).toFixed(1)}% del presupuesto` : '—'}</div>
          </div>
          <div className={`kpi-card ${saldoLender !== null && saldoLender < 0 ? 'kpi-card-red border-red-300 bg-red-50/60' : ''}`}>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              <Landmark className="w-3 h-3" />Saldo por girar (lender)
            </div>
            <div className={`text-lg font-bold font-mono ${saldoLender !== null && saldoLender < 0 ? 'text-red-600' : 'text-indigo-600'}`}>
              {saldoLender !== null ? formatUSD(saldoLender) : '—'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1" title="Holdback de construcción menos draws desembolsados (wired)">
              {saldoLender !== null ? `${formatUSD(lenderBase)} − ${formatUSD(wiredTotal)} wired` : 'sin datos del lender'}
            </div>
          </div>
          <div className={`kpi-card ${overBudget ? 'kpi-card-red border-red-300 bg-red-50/60' : 'kpi-card-green'}`}>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Desv. total</div>
            <div className={`text-lg font-bold font-mono ${overBudget ? 'text-red-600' : 'text-emerald-600'}`}>
              {grandPresupuestado > 0 ? `${deltaVsBudget > 0 ? '+' : ''}${formatUSD(deltaVsBudget)}` : '—'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{overBudget ? 'sobre presupuesto de obra' : 'bajo presupuesto de obra'}</div>
          </div>
          <div className={`kpi-card ${linkedOver ? 'kpi-card-red border-red-300 bg-red-50/60' : ''}`}>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              <Link2 className="w-3 h-3" />Desv. vs budget
            </div>
            <div className={`text-lg font-bold font-mono ${linkedOver ? 'text-red-600' : linkedByLine.size > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {linkedByLine.size > 0 ? `${linkedDelta > 0 ? '+' : ''}${formatUSD(linkedDelta)}` : '—'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1" title="Solo actividades asociadas a líneas del Construction Budget">
              {linkedCount > 0 ? `${linkedCount} actividad(es) asociada(s)` : 'asocia actividades con 🔗'}
            </div>
          </div>
          <div className="kpi-card flex items-center gap-3">
            <MiniDonut pct={pctGeneral} size={56} />
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Avance físico</div>
              <div className="text-xs text-slate-500 mt-0.5">{doneTotal.length}/{totalItems.length} ítems</div>
            </div>
          </div>
        </div>
        {/* Alerta gerencial: actividades asociadas al budget del lender por encima de lo presupuestado */}
        {linkedOver && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-600 font-medium">
              Las actividades asociadas al Construction Budget ({formatUSD(linkedEjecTotal)}) superan lo presupuestado por el lender ({formatUSD(linkedBudgetTotal)}) por {formatUSD(linkedDelta)}. Revisa antes del próximo draw.
            </span>
          </div>
        )}
        {overBudget && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-600 font-medium">
              La ejecución ({formatUSD(grandEjecutado)}) supera el presupuesto de obra ({formatUSD(grandPresupuestado)}) por {formatUSD(deltaVsBudget)}.
            </span>
          </div>
        )}

        {filteredPhases.map(phase => (
          <PhaseSection
            key={`${phase.id}-${expandTrigger}`}
            phase={phase}
            budgetLines={budgetLines}
            budgetDivisions={budgetDivisions}
            defaultOpen={expandAll}
            onUpdate={handleUpdate}
            onOpenPanel={setPanelItem}
            onCreate={(phaseId, activity) => createMutation.mutate({ phaseId, activity })}
            onDelete={item => handleDeleteItem(item)}
            onRenamePhase={(phaseId, name) => renamePhaseMutation.mutate({ phaseId, name })}
            onSetPhaseBudgetLink={(phaseId, budgetDivCode) => setPhaseBudgetLink.mutate({ phaseId, budgetDivCode })}
          />
        ))}
        {filteredPhases.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">No hay ítems con el filtro seleccionado.</div>
        )}

        {/* Total general de ejecución (sumatoria de todas las fases) */}
        {filteredPhases.length > 0 && (
          <div className="flex items-center flex-wrap gap-x-6 gap-y-1 px-4 py-3 bg-white rounded-xl border border-slate-200 text-sm">
            <span className="font-bold text-slate-800 uppercase tracking-wider">Total Ejecución</span>
            <span className="text-slate-500">Presupuesto obra: <b className="font-mono text-slate-800">{formatUSD(grandPresupuestado)}</b></span>
            <span className="text-slate-500">Ejecutado: <b className="font-mono text-[var(--brand-teal)]">{formatUSD(grandEjecutado)}</b></span>
            {grandPresupuestado > 0 && (
              <span className={`ml-auto font-mono font-semibold ${overBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                Δ {deltaVsBudget > 0 ? '+' : ''}{formatUSD(deltaVsBudget)} {overBudget ? '(sobre presupuesto)' : '(bajo presupuesto)'}
              </span>
            )}
          </div>
        )}
      </div>
      {panelItem && <ItemPanel item={panelItem} budgetLines={budgetLines} onUpdate={handleUpdate} onClose={() => setPanelItem(null)} />}
    </>
  )
}
