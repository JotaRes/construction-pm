import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { providersApi } from '../lib/api'
import type { Provider } from '../lib/types'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'

function ProviderRow({ provider, onUpdate, onDelete }: {
  provider: Provider
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: provider.name, type: provider.type ?? '', phone: provider.phone ?? '', email: provider.email ?? '', license: provider.license ?? '', notes: provider.notes ?? '' })

  if (editing) {
    return (
      <tr className="border-b border-slate-200 bg-slate-200/20">
        <td className="px-4 py-2">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-slate-200 text-slate-800 text-sm px-2 py-1 rounded border border-slate-200 w-full focus:outline-none focus:border-amber-500" />
        </td>
        <td className="px-4 py-2">
          <input value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="bg-slate-200 text-slate-800 text-sm px-2 py-1 rounded border border-slate-200 w-full focus:outline-none focus:border-amber-500" />
        </td>
        <td className="px-4 py-2">
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-slate-200 text-slate-800 text-sm px-2 py-1 rounded border border-slate-200 w-full focus:outline-none focus:border-amber-500" />
        </td>
        <td className="px-4 py-2">
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-slate-200 text-slate-800 text-sm px-2 py-1 rounded border border-slate-200 w-full focus:outline-none focus:border-amber-500" />
        </td>
        <td className="px-4 py-2">
          <input value={form.license} onChange={e => setForm(f => ({ ...f, license: e.target.value }))} className="bg-slate-200 text-slate-800 text-sm px-2 py-1 rounded border border-slate-200 w-full focus:outline-none focus:border-amber-500" />
        </td>
        <td className="px-4 py-2 flex gap-2">
          <button onClick={() => { onUpdate(provider.id, form); setEditing(false) }} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
          <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="table-row-base">
      <td className="px-4 py-3 text-sm text-slate-800">{provider.name}</td>
      <td className="px-4 py-3">
        {provider.type && <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{provider.type}</span>}
      </td>
      <td className="px-4 py-3 text-sm font-mono text-slate-500">{provider.phone ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{provider.email ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{provider.license ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-[#C8922A] transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(provider.id)} className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  )
}

export default function Providers({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', type: '', phone: '', email: '', license: '' })

  const { data: providers = [], isLoading } = useQuery<Provider[]>({
    queryKey: ['providers', projectId],
    queryFn: () => providersApi.list(projectId),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => providersApi.patch(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => providersApi.delete(projectId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] }),
  })

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => providersApi.create(projectId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['providers', projectId] }); setShowAdd(false); setNewForm({ name: '', type: '', phone: '', email: '', license: '' }) },
  })

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando proveedores...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Directorio de Proveedores</h1>
          <p className="text-sm text-slate-500 mt-0.5">{providers.length} proveedores registrados</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#C8922A] hover:bg-[#E0AD4F] text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-blue-500/30 rounded-xl p-4">
          <div className="grid grid-cols-5 gap-3">
            {(['name', 'type', 'phone', 'email', 'license'] as const).map(f => (
              <input
                key={f}
                placeholder={{ name: 'Nombre *', type: 'Tipo', phone: 'Teléfono', email: 'Email', license: 'Licencia' }[f]}
                value={newForm[f]}
                onChange={e => setNewForm(p => ({ ...p, [f]: e.target.value }))}
                className="bg-slate-200 text-slate-800 text-sm px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-amber-500"
              />
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => createMut.mutate(newForm)} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-[#2D4B52]">Guardar</button>
            <button onClick={() => setShowAdd(false)} className="text-slate-500 text-sm px-3 py-1.5 hover:text-slate-800">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase">Nombre</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase">Tipo</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase">Teléfono</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase">Licencia</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {providers.map(p => (
              <ProviderRow
                key={p.id}
                provider={p}
                onUpdate={(id, data) => updateMut.mutate({ id, data })}
                onDelete={id => deleteMut.mutate(id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
