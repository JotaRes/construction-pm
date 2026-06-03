import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi } from '../lib/api'
import { formatDate } from '../lib/calculations'
import type { Note } from '../lib/types'
import { Plus, Trash2 } from 'lucide-react'

export default function Notes({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['notes', projectId],
    queryFn: () => notesApi.list(projectId),
  })

  const createMut = useMutation({
    mutationFn: () => notesApi.create(projectId, { title, content }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes', projectId] }); setTitle(''); setContent('') },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => notesApi.delete(projectId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes', projectId] }),
  })

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando notas...</div>

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Notas del Proyecto</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <input
          placeholder="Título (opcional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-slate-200 text-slate-800 text-sm px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-amber-500"
        />
        <textarea
          placeholder="Escribe tu nota aquí..."
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          className="w-full bg-slate-200 text-slate-800 text-sm px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-amber-500 resize-none"
        />
        <button
          onClick={() => content && createMut.mutate()}
          disabled={!content}
          className="flex items-center gap-2 bg-[var(--brand-gold)] hover:bg-[#E0AD4F] disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Guardar nota
        </button>
      </div>

      <div className="space-y-3">
        {notes.map(note => (
          <div key={note.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {note.title && <div className="text-sm font-semibold text-slate-800 mb-1">{note.title}</div>}
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                <div className="text-[10px] text-slate-400 mt-2 font-mono">{formatDate(note.createdAt)}</div>
              </div>
              <button onClick={() => deleteMut.mutate(note.id)} className="text-slate-400 hover:text-red-400 transition-colors ml-3">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">Sin notas aún. Agrega la primera arriba.</div>
        )}
      </div>
    </div>
  )
}
