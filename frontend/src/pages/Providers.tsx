import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { providersApi, providerQuotesApi, providerDocumentsApi } from '../lib/api'
import { formatUSD, formatDate } from '../lib/calculations'
import type { Provider, ProviderDocumentType } from '../lib/types'
import { Plus, Trash2, X, Check, ChevronDown, FileText, Upload, ExternalLink, FolderOpen, ShieldCheck, FileSignature, Receipt, BadgeCheck, FileSpreadsheet } from 'lucide-react'

// Tipos de documentos sugeridos por proveedor con icono y descripción contextual
const PROVIDER_DOC_TYPES: { value: ProviderDocumentType; label: string; description: string }[] = [
  { value: 'SEGURO',     label: 'Seguro (Insurance)',     description: 'Certificado COI / Workers Comp / Liability' },
  { value: 'COTIZACION', label: 'Cotización recibida',    description: 'Quote/Estimate enviado por el proveedor' },
  { value: 'FACTURA',    label: 'Factura entregada',      description: 'Invoice que YO le pagué/debo al proveedor' },
  { value: 'CONTRATO',   label: 'Contrato firmado',       description: 'Service Agreement / SOW / Subcontract' },
  { value: 'LICENCIA',   label: 'Licencia profesional',   description: 'Contractor License / GC / Trade License' },
  { value: 'W9',         label: 'W-9 / Tax form',         description: 'W-9 firmado, EIN, 1099, etc.' },
  { value: 'OTRO',       label: 'Otro documento',         description: 'Permisos, planos, fotos, certificados, etc.' },
]

function docTypeIcon(t: string) {
  switch (t) {
    case 'SEGURO':     return <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
    case 'COTIZACION': return <FileText className="w-3.5 h-3.5 text-amber-600" />
    case 'FACTURA':    return <Receipt className="w-3.5 h-3.5 text-emerald-600" />
    case 'CONTRATO':   return <FileSignature className="w-3.5 h-3.5 text-indigo-600" />
    case 'LICENCIA':   return <BadgeCheck className="w-3.5 h-3.5 text-purple-600" />
    case 'W9':         return <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
    default:           return <FileText className="w-3.5 h-3.5 text-slate-400" />
  }
}

function ProviderDocumentsModal({ provider, projectId, onClose }: { provider: Provider; projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<ProviderDocumentType>('SEGURO')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const addMut = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('type', type)
      fd.append('name', name || (file?.name ?? 'Documento'))
      if (amount) fd.append('amount', amount)
      if (notes) fd.append('notes', notes)
      if (file) fd.append('file', file)
      return providerDocumentsApi.create(projectId, provider.id, fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers', projectId] })
      setName(''); setAmount(''); setNotes(''); setFile(null)
    },
  })

  const delMut = useMutation({
    mutationFn: (docId: string) => providerDocumentsApi.delete(projectId, provider.id, docId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] }),
  })

  const docs = provider.documents ?? []
  const selectedType = PROVIDER_DOC_TYPES.find(t => t.value === type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[var(--brand-gold)]" />
              Repositorio de {provider.name}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{docs.length} documento(s) almacenado(s)</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        {/* Form */}
        <div className="p-6 border-b border-slate-100 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subir nuevo documento</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <select value={type} onChange={e => setType(e.target.value as ProviderDocumentType)}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
                {PROVIDER_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {selectedType && (
                <div className="text-[10px] text-slate-400 mt-1 pl-1">💡 {selectedType.description}</div>
              )}
            </div>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre / referencia del documento"
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
            {(type === 'COTIZACION' || type === 'FACTURA') && (
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto ($) — opcional"
                className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notas (vigencia, condiciones, observaciones...)"
              rows={2}
              className={`${type === 'COTIZACION' || type === 'FACTURA' ? '' : 'col-span-2'} bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none placeholder-slate-400`} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-[var(--brand-gold)] border border-slate-200 hover:border-[#C8922A]/40 px-3 py-1.5 rounded-lg transition-colors">
              <Upload className="w-3.5 h-3.5" />{file ? file.name : 'Adjuntar PDF/imagen'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => addMut.mutate()} disabled={addMut.isPending || !file}
              className="flex items-center gap-2 px-4 py-1.5 bg-[var(--brand-gold)] hover:bg-[#E0AD4F] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" />{addMut.isPending ? 'Subiendo...' : 'Guardar documento'}
            </button>
          </div>
          {addMut.isError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Error: {(addMut.error as Error)?.message ?? 'Error subiendo documento'}
            </div>
          )}
        </div>

        {/* List grouped by type */}
        <div className="divide-y divide-slate-100">
          {docs.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Sin documentos almacenados.<br />
              <span className="text-[10px] text-slate-300">Sube el seguro, contrato, W-9, licencia, etc. del proveedor.</span>
            </div>
          )}
          {PROVIDER_DOC_TYPES.map(t => {
            const group = docs.filter(d => d.type === t.value)
            if (group.length === 0) return null
            return (
              <div key={t.value} className="px-6 py-3">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  {docTypeIcon(t.value)}{t.label} <span className="text-slate-300">({group.length})</span>
                </div>
                <div className="space-y-1.5">
                  {group.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{d.name}</div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                          {d.amount != null && <span className="font-mono font-semibold text-emerald-600">{formatUSD(d.amount)}</span>}
                          <span>{formatDate(d.createdAt)}</span>
                          {d.notes && <span className="truncate">{d.notes}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {d.fileUrl && (
                          <a href={d.fileUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] text-[var(--brand-teal)] hover:underline">
                            <FileText className="w-3 h-3" />Ver
                          </a>
                        )}
                        <button onClick={() => delMut.mutate(d.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const CATEGORIES = ['GC', 'Subcontratista', 'Lender', 'Inspector', 'Title Company', 'Utility', 'Authority', 'Realtor', 'Architect', 'Engineer', 'Surveyor', 'Otro']

// Códigos de país más comunes en USA real estate
const COUNTRY_CODES = [
  { code: '+1',  flag: '🇺🇸', country: 'USA / Canadá' },
  { code: '+57', flag: '🇨🇴', country: 'Colombia' },
  { code: '+52', flag: '🇲🇽', country: 'México' },
  { code: '+34', flag: '🇪🇸', country: 'España' },
  { code: '+54', flag: '🇦🇷', country: 'Argentina' },
  { code: '+58', flag: '🇻🇪', country: 'Venezuela' },
  { code: '+51', flag: '🇵🇪', country: 'Perú' },
  { code: '+56', flag: '🇨🇱', country: 'Chile' },
  { code: '+55', flag: '🇧🇷', country: 'Brasil' },
  { code: '+44', flag: '🇬🇧', country: 'Reino Unido' },
  { code: '+593',flag: '🇪🇨', country: 'Ecuador' },
  { code: '+507',flag: '🇵🇦', country: 'Panamá' },
  { code: '+503',flag: '🇸🇻', country: 'El Salvador' },
  { code: '+504',flag: '🇭🇳', country: 'Honduras' },
  { code: '+506',flag: '🇨🇷', country: 'Costa Rica' },
]

function QuoteModal({ provider, projectId, onClose }: { provider: Provider; projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const addMut = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('description', desc || 'Cotización')
      fd.append('amount', amount)
      fd.append('date', date)
      fd.append('notes', notes)
      if (file) fd.append('file', file)
      return providerQuotesApi.create(projectId, provider.id, fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers', projectId] })
      setDesc(''); setAmount(''); setDate(''); setNotes(''); setFile(null)
    },
  })

  const delMut = useMutation({
    mutationFn: (quoteId: string) => providerQuotesApi.delete(projectId, provider.id, quoteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] }),
  })

  const quotes = provider.quotes ?? []
  const totalQuotes = quotes.reduce((s, q) => s + q.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-900">{provider.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">{quotes.length} cotizacion(es) · Total: {formatUSD(totalQuotes)}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        {/* Add quote form */}
        <div className="p-6 border-b border-slate-100 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nueva cotización</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción del trabajo *"
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto ($)"
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales..." rows={2}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none placeholder-slate-400" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-[var(--brand-gold)] border border-slate-200 hover:border-[#C8922A]/40 px-3 py-1.5 rounded-lg transition-colors">
              <Upload className="w-3.5 h-3.5" />{file ? file.name : 'Adjuntar PDF/imagen'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => addMut.mutate()} disabled={addMut.isPending}
              className="flex items-center gap-2 px-4 py-1.5 bg-[var(--brand-gold)] hover:bg-[#E0AD4F] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" />Guardar cotización
            </button>
          </div>
        </div>

        {/* Quote list */}
        <div className="divide-y divide-slate-100">
          {quotes.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">Sin cotizaciones registradas</div>
          )}
          {quotes.map(q => (
            <div key={q.id} className="px-6 py-3 flex items-start justify-between gap-4 hover:bg-slate-50/60">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{q.description}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-mono font-semibold text-emerald-600">{formatUSD(q.amount)}</span>
                  {q.date && <span className="text-[10px] text-slate-400">{formatDate(q.date)}</span>}
                  {q.notes && <span className="text-[10px] text-slate-400">{q.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {q.fileUrl && (
                  <a href={q.fileUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] text-[var(--brand-teal)] hover:underline">
                    <FileText className="w-3 h-3" />Ver doc
                  </a>
                )}
                <button onClick={() => delMut.mutate(q.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// COI (Lote A): estado del seguro del proveedor con semáforo de vencimiento.
// Un sub con COI vencido trabajando en el lote es riesgo directo del holding.
function CoiRow({ provider, projectId }: { provider: Provider; projectId: string }) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] })

  const uploadCoiMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return providersApi.uploadCoi(projectId, provider.id, fd)
    },
    onSuccess: invalidate,
  })
  const removeCoiMut = useMutation({
    mutationFn: () => providersApi.removeCoi(projectId, provider.id),
    onSuccess: invalidate,
  })
  const dateMut = useMutation({
    mutationFn: (coiExpiresAt: string | null) => providersApi.patch(projectId, provider.id, { coiExpiresAt }),
    onSuccess: invalidate,
  })

  const days = provider.coiExpiresAt
    ? Math.ceil((new Date(provider.coiExpiresAt).getTime() - Date.now()) / 86400000)
    : null

  const badge = days === null
    ? { cls: 'bg-slate-100 text-slate-500', label: 'COI sin registrar' }
    : days < 0
      ? { cls: 'bg-red-500/10 text-red-500', label: `COI VENCIDO hace ${Math.abs(days)}d` }
      : days < 30
        ? { cls: 'bg-amber-500/10 text-amber-600', label: `COI vence en ${days}d` }
        : { cls: 'bg-emerald-500/10 text-emerald-600', label: `COI vigente · ${days}d` }

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
        <ShieldCheck className="w-3 h-3" /> {badge.label}
      </span>
      <input type="date"
        value={provider.coiExpiresAt ? provider.coiExpiresAt.slice(0, 10) : ''}
        onChange={e => dateMut.mutate(e.target.value || null)}
        title="Fecha de vencimiento del COI"
        className="bg-slate-50 border border-slate-200 text-[10px] px-1.5 py-0.5 rounded-md focus:outline-none focus:border-[var(--brand-gold)] text-slate-500" />
      {provider.coiUrl ? (
        <>
          <a href={provider.coiUrl} target="_blank" rel="noreferrer"
            className="text-[10px] font-semibold text-[var(--brand-teal)] hover:underline">ver certificado</a>
          <button onClick={() => removeCoiMut.mutate()} className="text-[10px] text-slate-400 hover:text-red-400 hover:underline">quitar</button>
        </>
      ) : (
        <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--brand-teal)] hover:underline cursor-pointer">
          <Upload className="w-3 h-3" /> {uploadCoiMut.isPending ? 'Subiendo…' : 'Subir COI'}
          <input type="file" className="hidden" accept=".pdf,image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadCoiMut.mutate(f) }} />
        </label>
      )}
    </div>
  )
}

function ProviderCard({ provider, projectId, onUpdate, onDelete }: {
  provider: Provider
  projectId: string
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [showQuotes, setShowQuotes] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  // Detectar si el type viene como "Otro: XYZ" para mostrar el input custom
  const initialType = provider.type ?? ''
  const isCustomType = initialType && !CATEGORIES.includes(initialType)
  const [form, setForm] = useState({
    name: provider.name,
    type: isCustomType ? 'Otro' : (initialType || ''),
    customType: isCustomType ? initialType : '',
    phoneCountry: (provider as any).phoneCountry ?? '+1',
    phone: provider.phone ?? '',
    email: provider.email ?? '',
    license: provider.license ?? '',
    address: (provider as any).address ?? '',
    notes: provider.notes ?? '',
  })

  const providerQuotes = provider.quotes ?? []
  const totalQuotes = providerQuotes.reduce((s, q) => s + q.amount, 0)

  if (editing) {
    return (
      <div className="bg-white border border-[#C8922A]/40 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre *"
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          <div className={form.type === 'Otro' ? '' : 'col-span-2 md:col-span-1'}>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, customType: e.target.value === 'Otro' ? f.customType : '' }))}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
              <option value="">— Categoría —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {form.type === 'Otro' && (
            <input value={form.customType} onChange={e => setForm(f => ({ ...f, customType: e.target.value }))}
              placeholder="Especificar categoría *"
              className="bg-amber-50 border border-amber-300 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          )}
          {form.type !== 'Otro' && (
            <input value={form.license} onChange={e => setForm(f => ({ ...f, license: e.target.value }))} placeholder="Licencia"
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          )}
          {form.type === 'Otro' && (
            <input value={form.license} onChange={e => setForm(f => ({ ...f, license: e.target.value }))} placeholder="Licencia"
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          )}
          {/* Teléfono con código país */}
          <div className="col-span-2 flex gap-2">
            <select value={form.phoneCountry} onChange={e => setForm(f => ({ ...f, phoneCountry: e.target.value }))}
              className="w-28 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-2 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] flex-shrink-0">
              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Teléfono (sin código país)"
              className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          </div>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email"
            type="email"
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Dirección"
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas (especialidad, días/horarios disponibles, condiciones de pago, etc.)" rows={3}
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            const finalType = form.type === 'Otro' && form.customType ? form.customType : form.type
            onUpdate(provider.id, {
              name: form.name,
              type: finalType,
              phoneCountry: form.phoneCountry,
              phone: form.phone,
              email: form.email,
              license: form.license,
              address: form.address,
              notes: form.notes,
            })
            setEditing(false)
          }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--brand-teal)] text-white text-xs rounded-lg hover:bg-[#3A5F68]">
            <Check className="w-3.5 h-3.5" />Guardar
          </button>
          <button onClick={() => setEditing(false)} className="text-slate-400 text-xs px-3 py-1.5 hover:text-slate-700">Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{provider.name}</span>
              {provider.type && (
                <span className="text-[10px] bg-[#2D4B52]/10 text-[var(--brand-teal)] px-2 py-0.5 rounded-full font-medium">{provider.type}</span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {provider.phone && (
                <a href={`tel:${(provider.phoneCountry ?? '')}${provider.phone}`} className="hover:text-[var(--brand-gold)]">
                  📞 {provider.phoneCountry ?? ''} {provider.phone}
                </a>
              )}
              {provider.email && <a href={`mailto:${provider.email}`} className="hover:text-[var(--brand-gold)] flex items-center gap-1">✉ {provider.email}<ExternalLink className="w-2.5 h-2.5" /></a>}
              {provider.license && <span className="text-slate-400">Lic: {provider.license}</span>}
              {provider.address && <span className="text-slate-400">📍 {provider.address}</span>}
            </div>
            {provider.notes && <div className="text-[11px] text-slate-400 mt-1">{provider.notes}</div>}

            {/* COI — Certificate of Insurance (Lote A) */}
            <CoiRow provider={provider} projectId={projectId} />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowQuotes(true)}
              className="flex items-center gap-1.5 text-[10px] text-[var(--brand-teal)] border border-[#2D4B52]/30 px-2.5 py-1.5 rounded-lg hover:bg-[#2D4B52]/5 transition-colors">
              <FileText className="w-3 h-3" />
              Cotizaciones
              {providerQuotes.length > 0 && <span className="bg-[var(--brand-teal)] text-white text-[9px] px-1.5 py-0.5 rounded-full">{providerQuotes.length}</span>}
            </button>
            <button onClick={() => setShowDocs(true)}
              className="flex items-center gap-1.5 text-[10px] text-[var(--brand-gold)] border border-[#C8922A]/40 px-2.5 py-1.5 rounded-lg hover:bg-[#C8922A]/5 transition-colors">
              <FolderOpen className="w-3 h-3" />
              Docs
              {(provider.documents?.length ?? 0) > 0 && <span className="bg-[var(--brand-gold)] text-white text-[9px] px-1.5 py-0.5 rounded-full">{provider.documents?.length}</span>}
            </button>
            <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-[var(--brand-gold)] p-1 transition-colors">
              <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg]" />
            </button>
            <button onClick={() => onDelete(provider.id)} className="text-slate-300 hover:text-red-400 p-1 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {providerQuotes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">{providerQuotes.length} cotización(es)</span>
            <span className="font-mono font-semibold text-emerald-600">{formatUSD(totalQuotes)} total</span>
          </div>
        )}
      </div>

      {showQuotes && <QuoteModal provider={provider} projectId={projectId} onClose={() => setShowQuotes(false)} />}
      {showDocs && <ProviderDocumentsModal provider={provider} projectId={projectId} onClose={() => setShowDocs(false)} />}
    </>
  )
}

export default function Providers({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({
    name: '', type: '', customType: '',
    phoneCountry: '+1', phone: '', email: '', license: '', address: '', notes: '',
  })

  const { data: providers = [], isLoading } = useQuery<Provider[]>({
    queryKey: ['providers', projectId],
    queryFn: () => providersApi.list(projectId),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => providersApi.patch(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] }),
    onError: (e) => console.error('Provider update failed:', e),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => providersApi.delete(projectId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] }),
    onError: (e) => console.error('Provider delete failed:', e),
  })
  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => providersApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers', projectId] })
      setShowAdd(false)
      setNewForm({ name: '', type: '', customType: '', phoneCountry: '+1', phone: '', email: '', license: '', address: '', notes: '' })
    },
  })

  const handleCreate = () => {
    if (!newForm.name.trim()) return
    const finalType = newForm.type === 'Otro' && newForm.customType ? newForm.customType : newForm.type
    createMut.mutate({
      name: newForm.name,
      type: finalType || null,
      phoneCountry: newForm.phoneCountry,
      phone: newForm.phone || null,
      email: newForm.email || null,
      license: newForm.license || null,
      address: newForm.address || null,
      notes: newForm.notes || null,
    })
  }

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando proveedores...</div>

  const byCategory = providers.reduce((acc, p) => {
    const cat = p.type || 'Otro'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {} as Record<string, Provider[]>)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Directorio de Proveedores</h1>
          <p className="text-sm text-slate-500 mt-0.5">{providers.length} proveedores · Haz clic en "Cotizaciones" para ver historial y adjuntar documentos</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[var(--brand-gold)] hover:bg-[#E0AD4F] text-white text-sm px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" />Agregar
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-[#C8922A]/40 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nuevo proveedor</div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Nombre *" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            <select value={newForm.type}
              onChange={e => setNewForm(f => ({ ...f, type: e.target.value, customType: e.target.value === 'Otro' ? f.customType : '' }))}
              className={(newForm.type === 'Otro' ? '' : 'col-span-2 md:col-span-1 ') + 'bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]'}>
              <option value="">— Categoría —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {newForm.type === 'Otro' && (
              <input placeholder="Especificar categoría *" value={newForm.customType}
                onChange={e => setNewForm(f => ({ ...f, customType: e.target.value }))}
                className="bg-amber-50 border border-amber-300 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            )}
            {newForm.type !== 'Otro' && (
              <input placeholder="Licencia" value={newForm.license} onChange={e => setNewForm(f => ({ ...f, license: e.target.value }))}
                className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            )}
            {newForm.type === 'Otro' && (
              <input placeholder="Licencia" value={newForm.license} onChange={e => setNewForm(f => ({ ...f, license: e.target.value }))}
                className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            )}
            {/* Teléfono con código país */}
            <div className="col-span-2 flex gap-2">
              <select value={newForm.phoneCountry} onChange={e => setNewForm(f => ({ ...f, phoneCountry: e.target.value }))}
                className="w-28 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-2 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] flex-shrink-0">
                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
              <input placeholder="Teléfono (sin código país)" value={newForm.phone}
                onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))}
                className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
            <input placeholder="Email" type="email" value={newForm.email}
              onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            <input placeholder="Dirección" value={newForm.address}
              onChange={e => setNewForm(f => ({ ...f, address: e.target.value }))}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            <textarea placeholder="Notas (especialidad, días/horarios disponibles, condiciones de pago, etc.)"
              value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none" />
          </div>
          {createMut.isError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Error al guardar: {(createMut.error as Error)?.message ?? 'Error desconocido'}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleCreate}
              disabled={!newForm.name || (newForm.type === 'Otro' && !newForm.customType) || createMut.isPending}
              className="px-4 py-1.5 bg-[var(--brand-teal)] text-white text-xs rounded-lg hover:bg-[#3A5F68] disabled:opacity-40">
              {createMut.isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => { setShowAdd(false); createMut.reset() }} className="text-slate-400 text-xs px-3 py-1.5 hover:text-slate-700">Cancelar</button>
          </div>
        </div>
      )}

      {Object.entries(byCategory).map(([cat, list]) => (
        <div key={cat}>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{cat}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {list.map(p => (
              <ProviderCard key={p.id} provider={p} projectId={projectId}
                onUpdate={(id, data) => updateMut.mutate({ id, data })}
                onDelete={id => deleteMut.mutate(id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
