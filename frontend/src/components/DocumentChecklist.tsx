import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi } from '../lib/api'
import {
  CheckCircle2, AlertCircle, Upload, FileText, Trash2, ExternalLink, Download,
  Mail, MessageCircle, ChevronDown, ChevronRight, FolderOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface DocItem {
  key: string
  label: string
  description: string
  required: boolean
  group: string
  files: any[]
  count: number
  status: 'complete' | 'missing' | 'optional'
}

interface ChecklistData {
  items: DocItem[]
  groups: Array<{ key: string; label: string; items: DocItem[] }>
  summary: {
    totalRequired: number
    completed: number
    missing: number
    missingKeys: string[]
    completePct: number
    unclassifiedCount: number
  }
  unclassified: any[]
}

export default function DocumentChecklist({ projectId, projectName, projectAddress }: {
  projectId: string
  projectName?: string
  projectAddress?: string
}) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeKind, setActiveKind] = useState<string | null>(null)
  const [openGroup, setOpenGroup] = useState<Record<string, boolean>>({
    diseno: true, lote: true, financiamiento: true, construccion: true, seguros: true, otros: true,
  })

  const { data: checklist } = useQuery<ChecklistData>({
    queryKey: ['document-checklist', projectId],
    queryFn: () => filesApi.getChecklist(projectId),
    enabled: !!projectId,
  })

  const uploadMut = useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: string }) => filesApi.upload(projectId, file, kind),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-checklist', projectId] })
      qc.invalidateQueries({ queryKey: ['files', projectId] })
      toast.success('Documento cargado')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al subir'),
  })

  const deleteMut = useMutation({
    mutationFn: (fileId: string) => filesApi.delete(projectId, fileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-checklist', projectId] })
      toast.success('Documento eliminado')
    },
  })

  const reclassifyMut = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: string }) => filesApi.patch(projectId, id, { kind }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-checklist', projectId] })
      toast.success('Re-categorizado')
    },
  })

  const handleUploadClick = (kind: string) => {
    setActiveKind(kind)
    fileInputRef.current?.click()
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeKind) return
    uploadMut.mutate({ file, kind: activeKind })
    e.target.value = ''
  }

  const handleShareEmail = (file: any) => {
    const subject = encodeURIComponent(`Documento del proyecto ${projectName || projectId}: ${file.name}`)
    const body = encodeURIComponent(
      `Hola,\n\nComparto el siguiente documento del proyecto:\n\n` +
      `Proyecto: ${projectName || ''}\n` +
      (projectAddress ? `Dirección: ${projectAddress}\n` : '') +
      `Categoría: ${file.category || file.kind || 'Sin categoría'}\n` +
      `Documento: ${file.name}\n` +
      `Enlace: ${file.url}\n\n` +
      `Saludos.`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  const handleShareWhatsApp = (file: any) => {
    const text = encodeURIComponent(
      `📄 *Documento del proyecto*\n\n` +
      `*Proyecto:* ${projectName || projectId}\n` +
      (projectAddress ? `*Dirección:* ${projectAddress}\n` : '') +
      `*Categoría:* ${file.category || file.kind || 'Sin categoría'}\n` +
      `*Documento:* ${file.name}\n\n` +
      `🔗 ${file.url}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (!checklist) {
    return <div className="text-sm text-stone-500 py-6 text-center">Cargando checklist documental...</div>
  }

  const sum = checklist.summary
  const completePct = Math.round(sum.completePct * 100)

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.svg,.dwg,.dxf,.zip,.xlsx,.xls,.doc,.docx"
        onChange={handleFileSelected}
      />

      {/* RESUMEN */}
      <div className="bg-white rounded-2xl p-5"
        style={{ border: '1px solid rgba(45,75,82,0.1)', boxShadow: '0 1px 4px rgba(45,75,82,0.06)' }}
      >
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
              <FolderOpen size={18} style={{ color: 'var(--brand-gold)' }} /> Checklist documental del proyecto
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--brand-teal2)' }}>
              {sum.completed} de {sum.totalRequired} documentos obligatorios cargados
              {sum.unclassifiedCount > 0 && ` · ${sum.unclassifiedCount} archivos sin categorizar`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-mono" style={{
              color: completePct >= 100 ? '#059669' : completePct >= 70 ? '#C8922A' : '#dc2626',
            }}>{completePct}%</div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>completo</div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(45,75,82,0.1)' }}>
          <div
            className="h-full transition-all"
            style={{
              width: `${completePct}%`,
              background: completePct >= 100 ? '#059669' : completePct >= 70 ? 'var(--brand-gold)' : '#dc2626',
            }}
          />
        </div>

        {sum.missing > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-red-700">
              <AlertCircle size={14} /> Documentos obligatorios faltantes ({sum.missing}):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sum.missingKeys.map((k) => {
                const item = checklist.items.find((i) => i.key === k)
                return (
                  <button
                    key={k}
                    onClick={() => handleUploadClick(k)}
                    className="text-xs px-2.5 py-1 rounded-full bg-white border border-red-300 hover:bg-red-100 transition-colors text-red-700 font-semibold"
                  >
                    + {item?.label || k}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* LISTAS POR GRUPO */}
      {checklist.groups.filter((g) => g.items.length > 0).map((group) => (
        <div
          key={group.key}
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(45,75,82,0.1)', boxShadow: '0 1px 4px rgba(45,75,82,0.06)' }}
        >
          <button
            onClick={() => setOpenGroup({ ...openGroup, [group.key]: !openGroup[group.key] })}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors"
            style={{ background: 'rgba(200,146,42,0.04)' }}
          >
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
              {openGroup[group.key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {group.label}
            </h3>
            <div className="text-xs flex items-center gap-2" style={{ color: 'var(--brand-teal2)' }}>
              {group.items.filter((i) => i.status === 'complete').length} / {group.items.length} cargados
            </div>
          </button>
          {openGroup[group.key] && (
            <div className="divide-y" style={{ borderColor: 'rgba(45,75,82,0.06)' }}>
              {group.items.map((item) => (
                <div key={item.key} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {item.status === 'complete' ? (
                        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : item.status === 'missing' ? (
                        <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-stone-300 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm" style={{ color: 'var(--brand-teal)' }}>
                          {item.label}
                          {item.required && <span className="text-red-500 ml-1">*</span>}
                          {item.count > 0 && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                              style={{ background: 'rgba(200,146,42,0.12)', color: 'var(--brand-gold)' }}
                            >
                              {item.count}
                            </span>
                          )}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>{item.description}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUploadClick(item.key)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors text-white"
                      style={{ background: 'var(--brand-gold)' }}
                      disabled={uploadMut.isPending}
                    >
                      <Upload size={12} /> Subir
                    </button>
                  </div>

                  {/* Lista de archivos cargados en esta categoría */}
                  {item.files.length > 0 && (
                    <ul className="ml-6 mt-2 space-y-1.5">
                      {item.files.map((f: any) => (
                        <li key={f.id} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: 'var(--brand-cream2)' }}>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText size={13} style={{ color: 'var(--brand-gold)' }} className="flex-shrink-0" />
                            <span className="text-xs font-medium truncate" style={{ color: 'var(--brand-teal)' }} title={f.name}>{f.name}</span>
                            {f.size && (
                              <span className="text-[10px]" style={{ color: 'var(--brand-teal2)' }}>· {(f.size / 1024).toFixed(0)} KB</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a
                              href={`/api/download?url=${encodeURIComponent(f.url)}&inline=1`}
                              target="_blank"
                              rel="noreferrer"
                              title="Ver"
                              className="p-1 rounded hover:bg-stone-200 transition-colors"
                              style={{ color: 'var(--brand-teal2)' }}
                            >
                              <ExternalLink size={12} />
                            </a>
                            <a
                              href={`/api/download?url=${encodeURIComponent(f.url)}`}
                              download={f.name}
                              title="Descargar"
                              className="p-1 rounded hover:bg-stone-200 transition-colors"
                              style={{ color: 'var(--brand-teal2)' }}
                            >
                              <Download size={12} />
                            </a>
                            <button
                              onClick={() => handleShareEmail(f)}
                              title="Enviar por correo"
                              className="p-1 rounded hover:bg-stone-200 transition-colors"
                              style={{ color: 'var(--brand-teal2)' }}
                            >
                              <Mail size={12} />
                            </button>
                            <button
                              onClick={() => handleShareWhatsApp(f)}
                              title="Enviar por WhatsApp"
                              className="p-1 rounded hover:bg-stone-200 transition-colors"
                              style={{ color: '#25D366' }}
                            >
                              <MessageCircle size={12} />
                            </button>
                            <button
                              onClick={() => { if (confirm(`¿Eliminar "${f.name}"?`)) deleteMut.mutate(f.id) }}
                              title="Eliminar"
                              className="p-1 rounded hover:bg-red-100 transition-colors text-red-600"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Archivos sin categorizar (legacy) */}
      {checklist.unclassified.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-amber-600" />
            <h3 className="text-sm font-bold text-amber-800">{checklist.unclassified.length} archivo(s) sin categorizar</h3>
          </div>
          <p className="text-xs text-amber-700 mb-2">Re-categoriza cada uno para que aparezca en el checklist:</p>
          <ul className="space-y-1.5">
            {checklist.unclassified.map((f: any) => (
              <li key={f.id} className="flex items-center justify-between gap-2 text-xs bg-white rounded p-2 border border-amber-100">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText size={13} className="text-amber-600 flex-shrink-0" />
                  <span className="truncate font-medium" title={f.name}>{f.name}</span>
                  {f.category && <span className="text-[10px] text-amber-700">· {f.category}</span>}
                </div>
                <select
                  className="text-xs px-2 py-0.5 rounded border border-amber-300 bg-white"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) reclassifyMut.mutate({ id: f.id, kind: e.target.value })
                  }}
                >
                  <option value="">— categorizar como —</option>
                  {checklist.items.map((i) => (
                    <option key={i.key} value={i.key}>{i.label}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
