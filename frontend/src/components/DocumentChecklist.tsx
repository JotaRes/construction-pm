import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi } from '../lib/api'
import {
  CheckCircle2, AlertCircle, Upload, FileText, Trash2, ExternalLink, Download,
  Mail, MessageCircle, ChevronDown, ChevronRight, FolderOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useConfirm } from './ConfirmDialog'

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
  const confirm = useConfirm()
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
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ['document-checklist', projectId] })
      qc.invalidateQueries({ queryKey: ['files', projectId] })
      // Si el backend extrajo + aplicó campos al proyecto, lo mostramos al usuario
      // para que vea que el sistema actualizó automáticamente sfHeated, holdback, etc.
      const applied: string[] = result?.applied ?? []
      const extracted: Record<string, unknown> = result?.extracted ?? {}
      const executionApplied: Array<{ itemCode: string; activity: string; applied: string[] }> = result?.executionApplied ?? []
      const ocrUsed: boolean = !!result?.ocrUsed
      const extractionError: string | null = result?.extractionError ?? null

      // Si el documento diligenció ítems de la sección Ejecución, refrescar esas vistas
      // y avisar al usuario qué asuntos (adquisición, financiamiento, etc.) se cargaron.
      if (executionApplied.length > 0) {
        qc.invalidateQueries({ queryKey: ['phases', projectId] })
        const n = executionApplied.length
        const codes = executionApplied.map(e => e.itemCode).join(', ')
        const conValor = executionApplied.filter(e => e.applied.includes('valor ejecutado')).length
        toast.success(
          `✓ Ejecución diligenciada: ${n} ítem(s) — ${codes}` +
          (conValor > 0 ? ` (${conValor} con monto de gasto)` : ''),
          { duration: 9000 },
        )
      }

      if (applied.length > 0) {
        const friendly: Record<string, string> = {
          sfHeated: 'pies cuadrados (heated)', sfGarage: 'pies cuadrados (garaje)',
          sfPorches: 'pies cuadrados (porches)', bedrooms: 'habitaciones',
          bathrooms: 'baños', foundationType: 'tipo de cimentación',
          parcelId: 'parcel ID', lotAcres: 'acres del lote',
          address: 'dirección', county: 'condado',
          lender: 'lender', loanNumber: 'número de préstamo',
          loanAmount: 'monto del préstamo', interestRate: 'tasa de interés',
          holdback: 'holdback', day1Disbursement: 'desembolso día 1',
          interestReserve: 'reserva de interés', settlementDate: 'fecha settlement',
          closingCosts: 'costos de cierre', cashAtSettlement: 'cash at settlement',
          contractSalesPrice: 'precio de venta', permitNumber: 'número de permiso',
          permitIssued: 'fecha emisión permiso', permitExpires: 'fecha vencimiento permiso',
          loiSalePrice: 'precio LOI', loiOfferDate: 'fecha oferta LOI',
          loiExpectedClose: 'cierre esperado LOI', loiEarnestMoney: 'earnest money LOI',
        }
        const fieldNames = applied.map(k => friendly[k] || k).join(', ')
        toast.success(
          `✓ Documento cargado. ${applied.length} campo(s) aplicados al proyecto: ${fieldNames}${ocrUsed ? ' (OCR usado)' : ''}`,
          { duration: 8000 }
        )
        // Invalidate project queries to refresh CFO Dashboard, etc.
        qc.invalidateQueries({ queryKey: ['projects'] })
        qc.invalidateQueries({ queryKey: ['project', projectId] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      } else if (Object.keys(extracted).length > 0) {
        toast(`Documento cargado. Extraje ${Object.keys(extracted).length} campo(s) pero ya estaban configurados en el proyecto.`, { duration: 6000 })
      } else if (extractionError) {
        toast(`Documento cargado. No fue posible extraer datos automáticamente: ${extractionError}`, { icon: '⚠', duration: 8000 })
      } else {
        toast.success('Documento cargado')
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al subir'),
  })

  const deleteMut = useMutation({
    mutationFn: (fileId: string) => filesApi.delete(projectId, fileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-checklist', projectId] })
      qc.invalidateQueries({ queryKey: ['files', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Documento eliminado')
    },
    // BUG REPARADO: sin onError el fallo era invisible y parecía que el botón no funcionaba
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al eliminar el documento'),
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

  // Construye URL del proxy de descarga.
  // - Pasa el name original para garantizar Content-Disposition con extensión correcta
  // - El backend infiere el Content-Type por extensión si Cloudinary no lo da bien
  const buildDownloadUrl = (file: any) => {
    const params = new URLSearchParams({ url: file.url })
    if (file.name) params.set('name', file.name)
    return `${window.location.origin}/api/download?${params.toString()}`
  }

  const handleShareEmail = (file: any) => {
    const subject = encodeURIComponent(`Documento del proyecto ${projectName || projectId}: ${file.name}`)
    const body = encodeURIComponent(
      `Hola,\n\nComparto el siguiente documento del proyecto:\n\n` +
      `Proyecto: ${projectName || ''}\n` +
      (projectAddress ? `Dirección: ${projectAddress}\n` : '') +
      `Categoría: ${file.category || file.kind || 'Sin categoría'}\n` +
      `Documento: ${file.name}\n\n` +
      `🔗 Descargar: ${buildDownloadUrl(file)}\n\n` +
      `Saludos.`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  // Web Share API nativa cuando esté disponible — permite adjuntar el PDF real al chat
  // En móvil con soporte (Android Chrome / iOS), abre el selector de apps (WhatsApp, Telegram, etc.)
  // y comparte el archivo binario. En desktop o sin soporte, fallback a wa.me con link de descarga.
  const handleShareWhatsApp = async (file: any) => {
    const downloadUrl = buildDownloadUrl(file)
    const captionText =
      `📄 *Documento del proyecto*\n\n` +
      `*Proyecto:* ${projectName || projectId}\n` +
      (projectAddress ? `*Dirección:* ${projectAddress}\n` : '') +
      `*Categoría:* ${file.category || file.kind || 'Sin categoría'}\n` +
      `*Documento:* ${file.name}`

    // 1) Intentar compartir el archivo binario directamente (móvil con Web Share Level 2)
    if (typeof navigator !== 'undefined' && (navigator as any).canShare && (navigator as any).share) {
      try {
        const response = await fetch(downloadUrl)
        if (response.ok) {
          const blob = await response.blob()
          const mimetype = file.mimetype || blob.type || 'application/octet-stream'
          const sharedFile = new File([blob], file.name, { type: mimetype })

          if ((navigator as any).canShare({ files: [sharedFile] })) {
            await (navigator as any).share({
              files: [sharedFile],
              title: file.name,
              text: captionText,
            })
            return
          }
        }
      } catch (err) {
        // Si el usuario cancela el dialog nativo, lanza AbortError — no es error real
        if ((err as any)?.name === 'AbortError') return
        console.warn('Web Share API falló, usando fallback wa.me', err)
      }
    }

    // 2) Fallback: abrir WhatsApp Web/App con el LINK de descarga (no es un attach pero al hacer click descarga el PDF correctamente)
    const text = encodeURIComponent(`${captionText}\n\n🔗 ${downloadUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
    toast('Tu navegador no permite adjuntar el archivo. Se compartió el link de descarga.', { icon: 'ℹ️' })
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
              color: completePct >= 100 ? '#059669' : completePct >= 70 ? '#3E6B85' : '#dc2626',
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
            style={{ background: 'rgba(62,107,133,0.04)' }}
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
                              style={{ background: 'rgba(62,107,133,0.12)', color: 'var(--brand-gold)' }}
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
                            {!f.url && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--brand-teal-xl)', color: 'var(--brand-teal)' }}>
                                importado
                              </span>
                            )}
                            {f.url && (<>
                            <a
                              href={`/api/download?url=${encodeURIComponent(f.url)}&name=${encodeURIComponent(f.name)}&inline=1`}
                              target="_blank"
                              rel="noreferrer"
                              title="Ver"
                              className="p-1 rounded hover:bg-stone-200 transition-colors"
                              style={{ color: 'var(--brand-teal2)' }}
                            >
                              <ExternalLink size={12} />
                            </a>
                            <a
                              href={`/api/download?url=${encodeURIComponent(f.url)}&name=${encodeURIComponent(f.name)}`}
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
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Eliminar documento',
                                  message: `¿Seguro que quieres eliminar "${f.name}"?`,
                                  detail: `Categoría: ${item.label}. Esta acción no se puede deshacer.`,
                                  destructive: true,
                                  confirmText: 'Sí, eliminar',
                                })
                                if (ok) deleteMut.mutate(f.id)
                              }}
                              title="Eliminar"
                              className="p-1 rounded hover:bg-red-100 transition-colors text-red-600"
                            >
                              <Trash2 size={12} />
                            </button>
                            </>)}
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
