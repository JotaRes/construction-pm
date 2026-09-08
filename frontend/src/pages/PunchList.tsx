// ============================================================
// PUNCH LIST (Lote B) — cierre de obra Etapa 9.
// Defecto → responsable → foto evidencia → ABIERTO/CORREGIDO/VERIFICADO.
// Los ALTA abiertos bloquean formalmente el cierre del proyecto.
// ============================================================
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { punchListApi, type PunchItem } from '../lib/api'
import { useConfirm } from '../components/ConfirmDialog'
import { ClipboardCheck, Plus, Trash2, Camera, CheckCircle2, RotateCcw, AlertTriangle, MapPin, User, Paperclip, CheckSquare } from 'lucide-react'
import { useI18n, type TranslationKey, currentLocale } from '../i18n'

const SEV_META: Record<PunchItem['severity'], { labelKey: TranslationKey; cls: string }> = {
  ALTA: { labelKey: 'common.alta', cls: 'bg-red-500/10 text-red-500' },
  MEDIA: { labelKey: 'common.media', cls: 'bg-amber-500/10 text-amber-600' },
  BAJA: { labelKey: 'common.baja', cls: 'bg-slate-100 text-slate-500' },
}

const STATUS_META: Record<PunchItem['status'], { labelKey: TranslationKey; cls: string }> = {
  ABIERTO: { labelKey: 'tech.punch.abierto', cls: 'bg-red-500/10 text-red-500' },
  CORREGIDO: { labelKey: 'tech.punch.corregido', cls: 'bg-amber-500/10 text-amber-600' },
  VERIFICADO: { labelKey: 'tech.punch.verificado', cls: 'bg-emerald-500/10 text-emerald-600' },
}

function ItemRow({ item, projectId }: { item: PunchItem; projectId: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['punch-list', projectId] })

  const statusMut = useMutation({
    mutationFn: (status: PunchItem['status']) => punchListApi.update(projectId, item.id, { status }),
    onSuccess: invalidate,
  })
  const photoMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return punchListApi.uploadPhoto(projectId, item.id, fd)
    },
    onSuccess: invalidate,
  })
  const removeMut = useMutation({
    mutationFn: () => punchListApi.remove(projectId, item.id),
    onSuccess: invalidate,
  })

  const sev = SEV_META[item.severity]
  const st = STATUS_META[item.status]

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sev.cls}`}>{t(sev.labelKey)}</span>
        <span className={`font-medium flex-1 min-w-0 truncate ${item.status === 'VERIFICADO' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          {item.title}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{t(st.labelKey)}</span>
        <button onClick={async () => {
          const ok = await confirm({
            title: t('tech.punch.eliminarItemDelPunchList'),
            message: t('tech.punch.eliminarV0', { v0: item.title }),
            destructive: true, confirmText: t('tech.projects.siEliminar'),
          })
          if (ok) removeMut.mutate()
        }} className="text-slate-300 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
        {item.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.location}</span>}
        {item.responsable && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {item.responsable}</span>}
        {item.dueDate && <span>{t('tech.punch.vence')} {new Date(item.dueDate).toLocaleDateString(currentLocale(), { day: '2-digit', month: 'short' })}</span>}
        {item.resolvedAt && <span className="text-emerald-600">{t('tech.punch.verificado2')} {new Date(item.resolvedAt).toLocaleDateString(currentLocale(), { day: '2-digit', month: 'short' })}</span>}
        {item.notes && <span>· {item.notes}</span>}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {item.photoUrl ? (
          <a href={item.photoUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-teal)] hover:underline">
            <Paperclip className="w-3 h-3" /> {t('tech.punch.evidencia')}
          </a>
        ) : (
          <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[var(--brand-gold)] cursor-pointer">
            <Camera className="w-3 h-3" /> {photoMut.isPending ? t('common.subiendo') : t('tech.punch.fotoEvidencia')}
            <input type="file" className="hidden" accept="image/*,.pdf" capture="environment"
              onChange={e => { const f = e.target.files?.[0]; if (f) photoMut.mutate(f) }} />
          </label>
        )}

        {item.status === 'ABIERTO' && (
          <button onClick={() => statusMut.mutate('CORREGIDO')}
            className="text-[11px] font-semibold px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
            {t('tech.punch.marcarCorregido')}
          </button>
        )}
        {item.status === 'CORREGIDO' && (
          <>
            <button onClick={() => statusMut.mutate('VERIFICADO')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> {t('tech.punch.verificar')}
            </button>
            <button onClick={() => statusMut.mutate('ABIERTO')}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:underline">
              <RotateCcw className="w-3 h-3" /> {t('common.reabrir')}
            </button>
          </>
        )}
        {item.status === 'VERIFICADO' && (
          <button onClick={() => statusMut.mutate('ABIERTO')}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:underline">
            <RotateCcw className="w-3 h-3" /> {t('common.reabrir')}
          </button>
        )}
      </div>
    </div>
  )
}

export default function PunchList({ projectId }: { projectId: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [responsable, setResponsable] = useState('')
  const [severity, setSeverity] = useState<PunchItem['severity']>('MEDIA')
  const [dueDate, setDueDate] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['punch-list', projectId],
    queryFn: () => punchListApi.list(projectId),
  })

  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => punchListApi.create(projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['punch-list', projectId] })
      setTitle(''); setLocation(''); setResponsable(''); setSeverity('MEDIA'); setDueDate(''); setShowForm(false)
    },
  })

  const items = data?.items ?? []
  const totals = data?.totals ?? { abiertos: 0, corregidos: 0, verificados: 0, altasAbiertas: 0 }
  const total = items.length
  const pct = total > 0 ? Math.round((totals.verificados / total) * 100) : 0

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">{t('tech.punch.cargandoPunchList')}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><CheckSquare className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('tech.punch.punchList')}</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('tech.punch.cierreDeObraDefectoResponsableEvidencia')}</p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-white text-sm font-semibold rounded-lg">
          <Plus className="w-4 h-4" /> {t('tech.punch.nuevoItem')}
        </button>
      </div>

      {totals.altasAbiertas > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {totals.altasAbiertas} {t('tech.punch.itemSDeSeveridadAltaSin')}
        </div>
      )}

      {/* KPIs + progreso */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><ClipboardCheck className="w-3 h-3" /> {t('common.total')}</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{total}</div>
        </div>
        <div className="kpi-card p-4 kpi-card-red">
          <div className="text-xs text-slate-400 mb-1">{t('tech.punch.abiertos')}</div>
          <div className={`text-2xl font-bold font-mono ${totals.abiertos > 0 ? 'text-red-500' : 'text-slate-900'}`}>{totals.abiertos}</div>
        </div>
        <div className="kpi-card p-4 kpi-card-amber">
          <div className="text-xs text-slate-400 mb-1">{t('tech.punch.corregidos')}</div>
          <div className={`text-2xl font-bold font-mono ${totals.corregidos > 0 ? 'text-amber-500' : 'text-slate-900'}`}>{totals.corregidos}</div>
        </div>
        <div className="kpi-card p-4 kpi-card-green">
          <div className="text-xs text-slate-400 mb-1">{t('tech.punch.verificados')}</div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{totals.verificados} <span className="text-xs text-slate-400">({pct}%)</span></div>
        </div>
      </div>

      {total > 0 && (
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* create form */}
      {showForm && (
        <form onSubmit={e => {
          e.preventDefault()
          if (!title.trim()) return
          createMut.mutate({
            title: title.trim(),
            location: location.trim() || null,
            responsable: responsable.trim() || null,
            severity,
            dueDate: dueDate || null,
          })
        }} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.punch.defecto')}</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t('tech.punch.ejRetocarPinturaParedNorte')}
              className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.punch.ubicacion')}</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('tech.punch.cocinaBano')}
              className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.punch.responsable')}</label>
            <input value={responsable} onChange={e => setResponsable(e.target.value)} placeholder={t('tech.punch.gcSub')}
              className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.punch.severidad')}</label>
              <select value={severity} onChange={e => setSeverity(e.target.value as PunchItem['severity'])}
                className="w-full bg-slate-50 border border-slate-200 text-sm px-2 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
                <option value="BAJA">{t('common.baja')}</option>
                <option value="MEDIA">{t('common.media')}</option>
                <option value="ALTA">{t('tech.punch.altaBloqueaCierre')}</option>
              </select>
            </div>
            <button type="submit" disabled={!title.trim() || createMut.isPending}
              className="px-3 py-2 bg-[var(--brand-teal)] hover:opacity-90 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
              {t('common.crear')}
            </button>
          </div>
        </form>
      )}

      {/* list */}
      <div className="space-y-2">
        {items.map(i => <ItemRow key={i.id} item={i} projectId={projectId} />)}
        {items.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl text-center py-16">
            <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-slate-400 text-sm">{t('tech.punch.punchListVacio')}</div>
            <div className="text-slate-300 text-xs mt-1">{t('tech.punch.registraAquiCadaDetallePendienteDel')}</div>
          </div>
        )}
      </div>
    </div>
  )
}
