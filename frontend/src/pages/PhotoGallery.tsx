import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { filesApi } from '../lib/api'
import { Image as ImageIcon, X } from 'lucide-react'

interface ProjectFile {
  id: string
  name: string
  url: string
  mimetype?: string | null
  category?: string | null
  createdAt: string
}

const SIN_CAT = 'Sin categoría'

export default function PhotoGallery({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState<string>('all')
  const [selected, setSelected] = useState<ProjectFile | null>(null)

  const { data: files = [], isLoading } = useQuery<ProjectFile[]>({
    queryKey: ['files', projectId],
    queryFn: () => filesApi.list(projectId),
  })

  const photos = useMemo(
    () => files.filter(f => f.mimetype?.startsWith('image/')),
    [files]
  )

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(photos.map(p => p.category || SIN_CAT)))],
    [photos]
  )

  const filtered = filter === 'all' ? photos : photos.filter(p => (p.category || SIN_CAT) === filter)

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando galería...</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Galería de Obra</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {photos.length} foto{photos.length === 1 ? '' : 's'} · soporte visual para draws, HOA y lender
        </p>
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition-colors
                ${filter === c ? 'bg-[var(--brand-teal)] text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
              {c === 'all' ? 'Todas' : c}
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {filtered.map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
              className="text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <img src={p.url} alt={p.name} loading="lazy"
                className="w-full h-40 object-cover block" />
              <div className="px-3 py-2">
                <div className="text-xs font-medium text-slate-700 truncate">{p.name}</div>
                <div className="text-[10px] text-slate-400">
                  {p.category && p.category !== SIN_CAT ? `${p.category} · ` : ''}
                  {new Date(p.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl text-center py-16">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-slate-400 text-sm">
            {photos.length === 0 ? 'No hay fotos cargadas. Sube imágenes desde Archivos.' : 'No hay fotos en esta categoría.'}
          </div>
        </div>
      )}

      {selected && (
        <div onClick={() => setSelected(null)}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          <button onClick={() => setSelected(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white">
            <X className="w-7 h-7" />
          </button>
          <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img src={selected.url} alt={selected.name}
              className="max-w-[90vw] max-h-[80vh] rounded-lg object-contain" />
            <div className="text-white/80 text-sm">{selected.name}</div>
          </div>
        </div>
      )}
    </div>
  )
}
