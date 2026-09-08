// ============================================================
// CHANGE ORDERS (Lote A) — control formal de cambios de alcance.
// Cada cambio registra qué cambió, cuánto cuesta (+/-), cuántos
// días agrega y quién lo aprobó. Sin CO aprobado, el sobrecosto
// no existe formalmente.
// ============================================================
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { changeOrdersApi, subcontractsApi, type ChangeOrder, type SubContract } from '../lib/api'
import { useConfirm } from '../components/ConfirmDialog'
import { FileDiff, Plus, Trash2, CheckCircle2, XCircle, Clock, DollarSign, CalendarPlus, Paperclip, Upload, ClipboardList } from 'lucide-react'
import { useI18n, type TranslationKey, currentLocale } from '../i18n'
import { CO_REASON_LABELS } from '../i18n/dataLabels'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })


const STATUS_META: Record<ChangeOrder['status'], { labelKey: TranslationKey; cls: string; icon: typeof Clock }> = {
  BORRADOR: { labelKey: 'tech.co.borrador', cls: 'bg-amber-500/15 text-amber-600', icon: Clock },
  APROBADO: { labelKey: 'tech.co.aprobado', cls: 'bg-emerald-500/15 text-emerald-600', icon: CheckCircle2 },
  RECHAZADO: { labelKey: 'tech.co.rechazado', cls: 'bg-slate-100 text-slate-500', icon: XCircle },
}

function OrderCard({ order, projectId }: { order: ChangeOrder; projectId: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [decidingAs, setDecidingAs] = useState('')
  const [showDecide, setShowDecide] = useState(false)
  const invalidate = () => qc.invalidateQueries({ queryKey: ['change-orders', projectId] })

  const decideMut = useMutation({
    mutationFn: ({ decision }: { decision: 'APROBADO' | 'RECHAZADO' }) =>
      changeOrdersApi.decide(projectId, order.id, decision, decidingAs),
    onSuccess: () => { invalidate(); setShowDecide(false); setDecidingAs('') },
  })
  const removeMut = useMutation({
    mutationFn: () => changeOrdersApi.remove(projectId, order.id),
    onSuccess: invalidate,
  })
  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return changeOrdersApi.uploadDocument(projectId, order.id, fd)
    },
    onSuccess: invalidate,
  })

  const meta = STATUS_META[order.status]
  const StatusIcon = meta.icon

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-xs font-bold text-slate-400">{t('tech.co.co')}{order.coNumber}</span>
        <span className="font-semibold text-slate-800 flex-1 min-w-0 truncate">{order.title}</span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>
          <StatusIcon className="w-3 h-3" /> {t(meta.labelKey)}
        </span>
        <span className={`font-mono font-semibold whitespace-nowrap ${order.costDelta > 0 ? 'text-red-500' : order.costDelta < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
          {order.costDelta > 0 ? '+' : ''}{fmt(order.costDelta)}
        </span>
        {order.daysDelta !== 0 && (
          <span className="text-[11px] text-slate-500 whitespace-nowrap">
            {order.daysDelta > 0 ? '+' : ''}{order.daysDelta} {t('tech.co.diaS')}
          </span>
        )}
        <button onClick={async () => {
          const ok = await confirm({
            title: t('tech.co.eliminarChangeOrder'),
            message: t('tech.co.eliminarCoV0V1', { v0: order.coNumber, v1: order.title }),
            detail: order.status === 'APROBADO' ? t('tech.co.esteCoEstaAprobadoEliminarloCambia') : t('tech.co.estaAccionNoSePuedeDeshacer'),
            destructive: true, confirmText: t('tech.projects.siEliminar'),
          })
          if (ok) removeMut.mutate()
        }} className="text-slate-300 hover:text-red-400 flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
        <span className="bg-slate-100 rounded-md px-2 py-0.5">{t(CO_REASON_LABELS[order.reason])}</span>
        {order.requestedBy && <span>{t('tech.co.solicita')} {order.requestedBy}</span>}
        {order.contract?.provider && <span>{t('tech.co.contrato')} {order.contract.provider.name}</span>}
        {order.budgetLine && <span>{t('tech.co.linea')} {order.budgetLine.itemCode}</span>}
        {order.approvedBy && (
          <span>
            {order.status === 'APROBADO' ? t('tech.co.aprobo') : t('tech.co.rechazo')}: {order.approvedBy}
            {order.approvedAt && ` · ${new Date(order.approvedAt).toLocaleDateString(currentLocale(), { day: '2-digit', month: 'short', year: 'numeric' })}`}
          </span>
        )}
      </div>

      {order.description && <p className="text-xs text-slate-500">{order.description}</p>}

      <div className="flex items-center gap-3 flex-wrap pt-1">
        {order.docUrl ? (
          <a href={order.docUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-teal)] hover:underline">
            <Paperclip className="w-3 h-3" /> {order.docName ?? t('tech.co.soporte')}
          </a>
        ) : (
          <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[var(--brand-gold)] cursor-pointer">
            <Upload className="w-3 h-3" /> {uploadMut.isPending ? t('common.subiendo') : t('tech.co.subirSoporteFirmado')}
            <input type="file" className="hidden" accept=".pdf,image/*"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadMut.mutate(f) }} />
          </label>
        )}

        {order.status === 'BORRADOR' && (
          showDecide ? (
            <span className="inline-flex items-center gap-2 flex-wrap">
              <input value={decidingAs} onChange={e => setDecidingAs(e.target.value)} placeholder={t('tech.co.quienDecideNombre')}
                className="bg-slate-50 border border-slate-200 text-[11px] px-2 py-1 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] w-44" />
              <button disabled={!decidingAs.trim() || decideMut.isPending}
                onClick={() => decideMut.mutate({ decision: 'APROBADO' })}
                className="text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-40">
                {t('tech.co.aprobar')}
              </button>
              <button disabled={!decidingAs.trim() || decideMut.isPending}
                onClick={() => decideMut.mutate({ decision: 'RECHAZADO' })}
                className="text-[11px] font-semibold px-2 py-1 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-40">
                {t('tech.co.rechazar')}
              </button>
              <button onClick={() => setShowDecide(false)} className="text-[11px] text-slate-400 hover:underline">{t('common.cancelar')}</button>
            </span>
          ) : (
            <button onClick={() => setShowDecide(true)}
              className="text-[11px] font-semibold text-[var(--brand-gold)] hover:underline">
              {t('tech.co.decidirAprobarRechazar')}
            </button>
          )
        )}
      </div>
    </div>
  )
}

export default function ChangeOrders({ projectId }: { projectId: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [costDelta, setCostDelta] = useState('')
  const [daysDelta, setDaysDelta] = useState('')
  const [reason, setReason] = useState<ChangeOrder['reason']>('OTRO')
  const [requestedBy, setRequestedBy] = useState('')
  const [description, setDescription] = useState('')
  const [contractId, setContractId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['change-orders', projectId],
    queryFn: () => changeOrdersApi.list(projectId),
  })
  const { data: contracts = [] } = useQuery<SubContract[]>({
    queryKey: ['subcontracts', projectId],
    queryFn: () => subcontractsApi.list(projectId),
  })

  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => changeOrdersApi.create(projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-orders', projectId] })
      setTitle(''); setCostDelta(''); setDaysDelta(''); setReason('OTRO')
      setRequestedBy(''); setDescription(''); setContractId(''); setShowForm(false)
    },
  })

  const orders = data?.orders ?? []
  const totals = data?.totals ?? { approvedCost: 0, approvedDays: 0, approvedCount: 0, pendingCount: 0 }

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">{t('tech.co.cargandoChangeOrders')}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><ClipboardList className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('tech.co.changeOrders')}</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('tech.co.controlFormalDeCambiosDeAlcance')}</p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-white text-sm font-semibold rounded-lg">
          <Plus className="w-4 h-4" /> {t('tech.co.nuevoChangeOrder')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><FileDiff className="w-3 h-3" /> {t('tech.co.totalCos')}</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{orders.length}</div>
        </div>
        <div className="kpi-card p-4 kpi-card-gold">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><DollarSign className="w-3 h-3" /> {t('tech.co.impactoAprobado')}</div>
          <div className={`text-2xl font-bold font-mono ${totals.approvedCost > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {totals.approvedCost > 0 ? '+' : ''}{fmt(totals.approvedCost)}
          </div>
        </div>
        <div className="kpi-card p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><CalendarPlus className="w-3 h-3" /> {t('tech.co.diasAgregados')}</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{totals.approvedDays > 0 ? '+' : ''}{totals.approvedDays}</div>
        </div>
        <div className="kpi-card p-4 kpi-card-amber">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><Clock className="w-3 h-3" /> {t('tech.co.sinDecidir')}</div>
          <div className={`text-2xl font-bold font-mono ${totals.pendingCount > 0 ? 'text-amber-500' : 'text-slate-900'}`}>{totals.pendingCount}</div>
        </div>
      </div>

      {/* create form */}
      {showForm && (
        <form onSubmit={e => {
          e.preventDefault()
          if (!title.trim() || costDelta === '') return
          createMut.mutate({
            title: title.trim(),
            costDelta: parseFloat(costDelta),
            daysDelta: daysDelta ? parseInt(daysDelta, 10) : 0,
            reason,
            requestedBy: requestedBy.trim() || null,
            description: description.trim() || null,
            contractId: contractId || null,
          })
        }} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.co.queCambio')}</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder={t('tech.co.ejCambioDeEncimeraACuarzo')}
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.co.razon')}</label>
              <select value={reason} onChange={e => setReason(e.target.value as ChangeOrder['reason'])}
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
                {Object.entries(CO_REASON_LABELS).map(([k, key]) => <option key={k} value={k}>{t(key)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.co.impactoEnCostoUsd')}</label>
              <input type="number" step="any" value={costDelta} onChange={e => setCostDelta(e.target.value)}
                placeholder={t('tech.co.8000O2500')}
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.co.diasQueAgrega')}</label>
              <input type="number" value={daysDelta} onChange={e => setDaysDelta(e.target.value)} placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.co.quienLoSolicita')}</label>
              <input value={requestedBy} onChange={e => setRequestedBy(e.target.value)} placeholder={t('tech.co.gcSubPropietarioInspector')}
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('tech.co.contratoRelacionado')}</label>
              <select value={contractId} onChange={e => setContractId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
                <option value="">{t('tech.co.ninguno')}</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.provider?.name ?? t('tech.co.contrato2')}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t('fin.reports.detalle')}</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('tech.co.contextoAdicionalOpcional')}
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
          </div>
          <button type="submit" disabled={!title.trim() || costDelta === '' || createMut.isPending}
            className="px-4 py-2 bg-[var(--brand-teal)] hover:opacity-90 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
            {t('tech.co.crearChangeOrder')}
          </button>
        </form>
      )}

      {/* list */}
      <div className="space-y-3">
        {orders.map(o => <OrderCard key={o.id} order={o} projectId={projectId} />)}
        {orders.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl text-center py-16">
            <FileDiff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-slate-400 text-sm">{t('tech.co.noHayChangeOrdersRegistrados')}</div>
            <div className="text-slate-300 text-xs mt-1">{t('tech.co.cadaCambioDeAlcanceConImpacto')}</div>
          </div>
        )}
      </div>
    </div>
  )
}
