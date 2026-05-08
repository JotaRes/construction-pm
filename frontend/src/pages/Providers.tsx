import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { providersApi, providerQuotesApi } from '../lib/api'
import { formatUSD, formatDate } from '../lib/calculations'
import type { Provider } from '../lib/types'
import { Plus, Trash2, X, Check, ChevronDown, FileText, Upload, ExternalLink } from 'lucide-react'

const CATEGORIES = ['GC', 'Subcontratista', 'Lender', 'Inspector', 'Title Company', 'Utility', 'Authority', 'Realtor', 'Otro']

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
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A] placeholder-slate-400" />
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto ($)"
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A] placeholder-slate-400" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]" />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales..." rows={2}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A] resize-none placeholder-slate-400" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#C8922A] border border-slate-200 hover:border-[#C8922A]/40 px-3 py-1.5 rounded-lg transition-colors">
              <Upload className="w-3.5 h-3.5" />{file ? file.name : 'Adjuntar PDF/imagen'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => addMut.mutate()} disabled={addMut.isPending}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#C8922A] hover:bg-[#E0AD4F] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
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
                    className="flex items-center gap-1 text-[10px] text-[#2D4B52] hover:underline">
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

function ProviderCard({ provider, projectId, onUpdate, onDelete }: {
  provider: Provider
  projectId: string
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [showQuotes, setShowQuotes] = useState(false)
  const [form, setForm] = useState({
    name: provider.name,
    type: provider.type ?? '',
    phone: provider.phone ?? '',
    email: provider.email ?? '',
    license: provider.license ?? '',
    notes: provider.notes ?? '',
  })

  const providerQuotes = provider.quotes ?? []
  const totalQuotes = providerQuotes.reduce((s, q) => s + q.amount, 0)

  if (editing) {
    return (
      <div className="bg-white border border-[#C8922A]/40 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre *"
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]" />
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]">
            <option value="">Categoría</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={form.license} onChange={e => setForm(f => ({ ...f, license: e.target.value }))} placeholder="Licencia"
            className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]" />
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Teléfono"
            className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]" />
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email"
            className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]" />
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas" rows={2}
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A] resize-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { onUpdate(provider.id, form); setEditing(false) }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#2D4B52] text-white text-xs rounded-lg hover:bg-[#3A5F68]">
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
                <span className="text-[10px] bg-[#2D4B52]/10 text-[#2D4B52] px-2 py-0.5 rounded-full font-medium">{provider.type}</span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {provider.phone && <span>📞 {provider.phone}</span>}
              {provider.email && <a href={`mailto:${provider.email}`} className="hover:text-[#C8922A] flex items-center gap-1">✉ {provider.email}<ExternalLink className="w-2.5 h-2.5" /></a>}
              {provider.license && <span className="text-slate-400">Lic: {provider.license}</span>}
            </div>
            {provider.notes && <div className="text-[11px] text-slate-400 mt-1">{provider.notes}</div>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowQuotes(true)}
              className="flex items-center gap-1.5 text-[10px] text-[#2D4B52] border border-[#2D4B52]/30 px-2.5 py-1.5 rounded-lg hover:bg-[#2D4B52]/5 transition-colors">
              <FileText className="w-3 h-3" />
              Cotizaciones
              {providerQuotes.length > 0 && <span className="bg-[#2D4B52] text-white text-[9px] px-1.5 py-0.5 rounded-full">{providerQuotes.length}</span>}
            </button>
            <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-[#C8922A] p-1 transition-colors">
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
    </>
  )
}

export default function Providers({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', type: '', phone: '', email: '', license: '', notes: '' })

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
      setNewForm({ name: '', type: '', phone: '', email: '', license: '', notes: '' })
    },
  })

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
          className="flex items-center gap-2 bg-[#C8922A] hover:bg-[#E0AD4F] text-white text-sm px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" />Agregar
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-[#C8922A]/40 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nuevo proveedor</div>
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Nombre *" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              className="col-span-3 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]" />
            <select value={newForm.type} onChange={e => setNewForm(f => ({ ...f, type: e.target.value }))}
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]">
              <option value="">Categoría</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Teléfono" value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))}
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]" />
            <input placeholder="Email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]" />
            <input placeholder="Licencia" value={newForm.license} onChange={e => setNewForm(f => ({ ...f, license: e.target.value }))}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]" />
            <textarea placeholder="Notas" value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="col-span-3 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A] resize-none" />
          </div>
          {createMut.isError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Error al guardar: {(createMut.error as Error)?.message ?? 'Error desconocido'}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate(newForm)} disabled={!newForm.name || createMut.isPending}
              className="px-4 py-1.5 bg-[#2D4B52] text-white text-xs rounded-lg hover:bg-[#3A5F68] disabled:opacity-40">
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
