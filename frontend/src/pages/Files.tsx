import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi } from '../lib/api'
import { formatDate } from '../lib/calculations'
import type { ProjectFile } from '../lib/types'
import { Plus, ExternalLink, Trash2, Folder } from 'lucide-react'

const CATEGORIES = ['Contrato', 'Permiso', 'Plano', 'Seguro', 'Draw', 'HOA', 'Legal', 'Inspección', 'Otro']

export default function Files({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('Otro')
  const [filterCat, setFilterCat] = useState('ALL')

  const { data: files = [], isLoading } = useQuery<ProjectFile[]>({
    queryKey: ['files', projectId],
    queryFn: () => filesApi.list(projectId),
  })

  const createMut = useMutation({
    mutationFn: () => filesApi.create(projectId, { name, url, category }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['files', projectId] }); setName(''); setUrl('') },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => filesApi.delete(projectId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files', projectId] }),
  })

  const filtered = filterCat === 'ALL' ? files : files.filter(f => f.category === filterCat)

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando archivos...</div>

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Repositorio de Archivos</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <input placeholder="Nombre del documento *" value={name} onChange={e => setName(e.target.value)}
            className="bg-slate-200 text-slate-800 text-sm px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-amber-500" />
          <input placeholder="URL o path del archivo *" value={url} onChange={e => setUrl(e.target.value)}
            className="bg-slate-200 text-slate-800 text-sm px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-amber-500" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="bg-slate-200 text-slate-800 text-sm px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-amber-500">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={() => name && url && createMut.mutate()} disabled={!name || !url}
          className="flex items-center gap-2 bg-[#C8922A] hover:bg-[#E0AD4F] disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Agregar archivo
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['ALL', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${filterCat === c ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200'}`}>
            {c === 'ALL' ? 'Todos' : c}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase">Documento</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-28">Categoría</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-28">Fecha</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(file => (
              <tr key={file.id} className="table-row-base">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-800">{file.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 ml-6 mt-0.5 truncate max-w-md">{file.url}</div>
                </td>
                <td className="px-4 py-3">
                  {file.category && <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{file.category}</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{formatDate(file.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#C8922A] transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button onClick={() => deleteMut.mutate(file.id)} className="text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">Sin archivos en esta categoría.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
