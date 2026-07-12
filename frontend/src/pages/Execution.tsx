import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { phasesApi, itemsApi, itemDocumentsApi, projectsApi } from '../lib/api'
import { formatUSD } from '../lib/calculations'
import type { Phase, Item, ItemEstado, ItemDocument } from '../lib/types'
import {
  ChevronDown, ChevronRight, X, Calendar, User, FileText,
  Plus, Trash2, Paperclip, Upload, AlertTriangle,
  ExternalLink, Download, Mail, MessageCircle, Eraser, EyeOff, Eye,
  ChevronsDown, ChevronsUp,
} from 'lucide-react'
import { useConfirm } from '../components/ConfirmDialog'
import toast from 'react-hot-toast'

const ESTADOS: { value: ItemEstado; label: string; color: string; bg: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'text-slate-500',  bg: 'bg-slate-200/60 hover:bg-slate-100' },
  { value: 'EN_CURSO',  label: 'En curso',  color: 'text-[var(--brand-gold)]',  bg: 'bg-[#C8922A]/15 hover:bg-blue-500/25' },
  { value: 'DONE',      label: 'Hecho',     color: 'text-emerald-400', bg: 'bg-emerald-500/15 hover:bg-emerald-500/25' },
  { value: 'NA',        label: 'N/A',       color: 'text-slate-400',  bg: 'bg-white hover:bg-slate-100' },
]

function estadoStyle(estado: ItemEstado) {
  return ESTADOS.find(e => e.value === estado) ?? ESTADOS[0]
}

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
  const [vendor, setVendor] = useState('')
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
      setVendor(''); setAmount(''); setNotes(''); setFile(null)
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
          className="text-[10px] text-[#C8922A]/70 hover:text-[var(--brand-gold)] transition-colors flex items-center gap-1">
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
            <input type="text" placeholder="Proveedor / contratista" value={vendor}
              onChange={e => setVendor(e.target.value)}
              className="col-span-2 bg-white border border-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#C8922A]/60 placeholder-slate-400" />
            <input type="number" placeholder="Monto ($)" value={amount}
              onChange={e => setAmount(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#C8922A]/60 placeholder-slate-400 font-mono" />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg transition-colors">
              <Upload className="w-3 h-3" />
              {file ? <span className="truncate text-emerald-400 text-[11px]">{file.name}</span> : <span>Subir PDF / imagen</span>}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <textarea placeholder="Notas..." value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#C8922A]/60 placeholder-slate-400 resize-none" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Cancelar</button>
            <button onClick={handleSubmit} disabled={createDoc.isPending}
              className="px-3 py-1 bg-[var(--brand-gold)] hover:bg-[#E0AD4F] text-white text-xs rounded-lg transition-colors disabled:opacity-50">
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
                {doc.amount && <div className="text-[10px] font-mono text-[#C8922A]/80">{formatUSD(doc.amount)}</div>}
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

function ItemPanel({ item, onUpdate, onClose }: {
  item: Item
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [obsText, setObsText] = useState(item.observaciones ?? '')
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-96 h-full bg-slate-50 border-l border-slate-200 flex flex-col shadow-2xl overflow-y-auto">
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
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Valores</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3">
                <div className="text-[10px] text-slate-400 mb-1">Presupuestado</div>
                <div className="text-sm font-mono text-slate-700">{formatUSD(item.valorPresupuestado)}</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-[10px] text-slate-400 mb-1">Ejecutado</div>
                <input type="number" defaultValue={item.valorEjecutado || ''}
                  onBlur={e => onUpdate(item.id, { valorEjecutado: parseFloat(e.target.value) || 0 })}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder="0"
                  className="w-full bg-transparent text-sm font-mono text-[var(--brand-teal)] focus:outline-none placeholder-slate-400" />
              </div>
            </div>
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

function ItemRow({ item, onUpdate, onOpenPanel, onDelete }: {
  item: Item
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onOpenPanel: (item: Item) => void
  onDelete?: (id: string) => void
}) {
  const isSlot = item.itemCode.includes('X') && !item.itemCode.includes('.A')
  if (isSlot && !item.completado && !item.valorEjecutado) {
    return (
      <tr className="border-b border-slate-200">
        <td colSpan={8} className="px-4 py-1 text-[10px] text-slate-800 font-mono">{item.itemCode}</td>
      </tr>
    )
  }
  const st = estadoStyle(item.estado)
  const desviacion = item.valorEjecutado - item.valorPresupuestado
  const docCount = item.documents?.length ?? 0
  const hasFactura = item.documents?.some(d => d.type === 'FACTURA') ?? false
  // Alerta: el ítem tiene valor ejecutado o está completado pero NO tiene factura
  const warnDoc = (item.valorEjecutado > 0 || item.completado) && !hasFactura
  let rowBg = 'border-b border-slate-100 hover:bg-white/40 transition-colors group cursor-pointer'
  if (item.completado) rowBg = 'border-b border-slate-200/20 bg-emerald-50/40 hover:bg-emerald-950/30 transition-colors group cursor-pointer'
  else if (item.estado === 'EN_CURSO') rowBg = 'border-b border-slate-200/30 bg-amber-50/60 hover:bg-amber-50/40 transition-colors group cursor-pointer'
  return (
    <tr className={`${rowBg} ${item.esNA ? 'opacity-40' : ''}`} onClick={() => onOpenPanel(item)}>
      {/* N/A toggle al inicio — un solo click para inhabilitar el ítem que no aplica */}
      <td className="pl-3 pr-1 py-2.5 w-10" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onUpdate(item.id, { esNA: !item.esNA })}
          title={item.esNA ? 'Re-habilitar ítem (sí aplica)' : 'Marcar como NO APLICA'}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
            item.esNA
              ? 'bg-slate-300 text-slate-600 hover:bg-slate-400'
              : 'bg-white border border-slate-200 text-slate-300 hover:border-slate-400 hover:text-slate-500'
          }`}
        >
          {item.esNA ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </td>
      {/* Estados — botones grandes con label, fáciles de presionar */}
      <td className="pl-2 pr-2 py-2.5 w-32" onClick={e => e.stopPropagation()}>
        <div className="flex gap-0.5">
          {ESTADOS.filter(e => e.value !== 'NA').map(e => {
            const active = item.estado === e.value
            const colors = e.value === 'DONE'
              ? active ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              : e.value === 'EN_CURSO'
                ? active ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                : active ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            return (
              <button
                key={e.value}
                title={e.label}
                onClick={() => {
                  const updates: Record<string, unknown> = { estado: e.value }
                  if (e.value === 'DONE') updates.completado = true
                  if (e.value === 'PENDIENTE') updates.completado = false
                  onUpdate(item.id, updates)
                }}
                disabled={item.esNA}
                className={`flex-1 px-1.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed ${colors}`}
              >
                {e.value === 'DONE' ? '✓' : e.value === 'EN_CURSO' ? '⋯' : '—'}
              </button>
            )
          })}
        </div>
      </td>
      <td className="px-2 py-2.5 w-16"><span className="text-[10px] font-mono text-slate-400">{item.itemCode}</span></td>
      <td className="px-2 py-2.5">
        <div className={`text-xs font-medium leading-tight ${item.completado ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.activity}</div>
        {item.responsable && <div className="text-[10px] text-slate-400 mt-0.5">{item.responsable}</div>}
      </td>
      <td className="px-2 py-2.5 w-24" onClick={e => e.stopPropagation()}>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${st.color} ${st.bg}`}>{st.label}</span>
      </td>
      <td className="px-2 py-2.5 w-24 text-right border-l border-slate-100">
        <span className="text-[11px] font-mono text-slate-600">{formatUSD(item.valorPresupuestado)}</span>
      </td>
      <td className="px-2 py-2.5 w-24 text-right border-l border-slate-100" onClick={e => e.stopPropagation()}>
        <input type="number" defaultValue={item.valorEjecutado || ''}
          onBlur={e => onUpdate(item.id, { valorEjecutado: parseFloat(e.target.value) || 0 })}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="—"
          className="w-full bg-white border border-slate-200 text-[11px] font-mono font-semibold text-right text-slate-900 rounded px-1.5 py-1 focus:outline-none focus:border-[var(--brand-gold)] focus:ring-2 focus:ring-[var(--brand-gold)]/20 placeholder-slate-300" />
      </td>
      <td className="px-2 py-2.5 w-20 text-right border-l border-slate-100" onClick={e => e.stopPropagation()}>
        {item.valorPresupuestado > 0 && item.valorEjecutado > 0 ? (
          <span className={`text-[10px] font-mono font-semibold ${desviacion > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {desviacion > 0 ? '+' : ''}{formatUSD(desviacion)}
          </span>
        ) : onDelete ? (
          <button onClick={() => onDelete(item.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 ml-auto block">
            <Trash2 className="w-3 h-3" />
          </button>
        ) : null}
      </td>
      <td className="pr-3 pl-1 py-2.5 w-12 text-center border-l border-slate-100" onClick={e => e.stopPropagation()}>
        <button onClick={() => onOpenPanel(item)}
          className={`inline-flex items-center justify-center gap-0.5 text-[10px] font-mono font-semibold transition-colors ${warnDoc ? 'text-[var(--brand-gold)]' : docCount > 0 ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          title={warnDoc ? '⚠ Sin factura adjunta — súbela en el panel del ítem' : docCount > 0 ? `${docCount} documento(s) adjunto(s)` : 'Adjuntar documento / factura'}>
          {warnDoc ? <AlertTriangle className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
          {docCount > 0 && <span>{docCount}</span>}
        </button>
      </td>
    </tr>
  )
}

function PhaseSection({ phase, defaultOpen = false, onUpdate, onOpenPanel, onCreate, onDelete }: {
  defaultOpen?: boolean
  phase: Phase
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onOpenPanel: (item: Item) => void
  onCreate: (phaseId: string) => void
  onDelete: (id: string) => void
}) {
  // FASE 1: colapsadas por defecto para una vista más limpia y amigable
  const [open, setOpen] = useState(defaultOpen)
  const activeItems = phase.items.filter(i => !i.esNA)
  const doneItems = activeItems.filter(i => i.completado)
  const pct = activeItems.length === 0 ? 0 : (doneItems.length / activeItems.length) * 100
  const budget = phase.items.reduce((s, i) => s + i.valorPresupuestado, 0)
  const ejecutado = phase.items.reduce((s, i) => s + i.valorEjecutado, 0)
  const borderColor = pct === 100 ? 'border-l-2 border-emerald-500/50' : pct > 0 ? 'border-l-2 border-amber-500/50' : ''
  const phaseClass = `w-full flex items-center gap-3 px-4 py-3 bg-white/90 rounded-xl border ${borderColor} border-slate-200/40 hover:border-slate-200 transition-colors`
  return (
    <div className="mb-2.5">
      <button onClick={() => setOpen(o => !o)} className={phaseClass}>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-[10px] font-mono text-[var(--brand-gold)] w-7">{phase.code}</span>
        <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{phase.name}</span>
        <div className="flex items-center gap-4 text-xs shrink-0">
          <span className="text-slate-400 font-mono">{doneItems.length}/{activeItems.length}</span>
          <span className="text-slate-400 font-mono hidden lg:block">{budget > 0 ? formatUSD(budget) : '—'}</span>
          {ejecutado > 0 && (
            <span className={`font-mono text-[11px] hidden lg:block ${ejecutado > budget && budget > 0 ? 'text-red-400' : 'text-[var(--brand-teal)]'}`}>{formatUSD(ejecutado)}</span>
          )}
          <span className={`font-mono font-semibold w-9 text-right ${pct === 100 ? 'text-emerald-400' : pct > 0 ? 'text-[var(--brand-gold)]' : 'text-slate-400'}`}>{pct.toFixed(0)}%</span>
          <div className="w-14 h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-[var(--brand-teal)]' : 'bg-slate-200'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-0.5 bg-slate-50/60 rounded-b-xl border border-slate-200/30 border-t-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100">
                <th className="pl-4 pr-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-16">St.</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-16">Cód.</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Actividad</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-24">Estado</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-24">Budget</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold text-[var(--brand-gold)] uppercase tracking-wider w-24">Ejecutado</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-20">Desv.</th>
                <th className="pr-3 pl-1 py-2 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-12">Doc</th>
              </tr>
            </thead>
            <tbody>
              {phase.items.map(item => (
                <ItemRow key={item.id} item={item} onUpdate={onUpdate} onOpenPanel={onOpenPanel}
                  onDelete={item.itemCode.includes('.A') ? onDelete : undefined} />
              ))}
            </tbody>
          </table>
          <button onClick={() => onCreate(phase.id)}
            className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 hover:text-[var(--brand-gold)] hover:bg-[#C8922A]/5 transition-colors w-full border-t border-slate-100">
            <Plus className="w-3.5 h-3.5" />Agregar actividad imprevista a {phase.code}
          </button>
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => itemsApi.patch(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phases', projectId] }),
  })

  const createMutation = useMutation({
    mutationFn: (phaseId: string) => itemsApi.create({ phaseId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phases', projectId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['phases', projectId] }); setPanelItem(null) },
  })

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
    if (panelItem?.id === id) setPanelItem(prev => prev ? { ...prev, ...data } as Item : null)
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

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando ejecución...</div>

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Control de Ejecución</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-slate-500">{doneTotal.length}/{totalItems.length} ítems</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctGeneral}%` }} />
                </div>
                <span className="text-xs font-mono text-slate-500">{pctGeneral.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="text" placeholder="Buscar actividad..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-white border border-slate-200 text-xs text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] w-44 placeholder-slate-400" />
            <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
              {[{ v: 'ALL', l: 'Todos' }, { v: 'PENDIENTE', l: 'Pendiente' }, { v: 'EN_CURSO', l: 'En curso' }, { v: 'DONE', l: 'Hecho' }].map(f => (
                <button key={f.v} onClick={() => setFilter(f.v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f.v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
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
        {filteredPhases.map(phase => (
          <PhaseSection
            key={`${phase.id}-${expandTrigger}`}
            phase={phase}
            defaultOpen={expandAll}
            onUpdate={handleUpdate}
            onOpenPanel={setPanelItem}
            onCreate={phaseId => createMutation.mutate(phaseId)}
            onDelete={id => deleteMutation.mutate(id)}
          />
        ))}
        {filteredPhases.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">No hay ítems con el filtro seleccionado.</div>
        )}
      </div>
      {panelItem && <ItemPanel item={panelItem} onUpdate={handleUpdate} onClose={() => setPanelItem(null)} />}
    </>
  )
}
