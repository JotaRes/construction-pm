import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subcontractsApi, providersApi, type SubContract, type SubPayment } from '../lib/api'
import { useConfirm } from '../components/ConfirmDialog'
import { HardHat, Plus, Trash2, ChevronDown, CheckCircle2, Clock, AlertCircle, DollarSign, ShieldCheck, ShieldAlert, Upload, FileSignature } from 'lucide-react'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const STATUS_BADGE: Record<SubContract['status'], string> = {
  ACTIVO: 'bg-[#2E6BB4]/15 text-[var(--brand-gold)]',
  COMPLETADO: 'bg-emerald-500/15 text-emerald-600',
  CANCELADO: 'bg-slate-100 text-slate-500',
}

function paidPct(c: SubContract) {
  const total = c.paymentSchedule.reduce((s, p) => s + p.amount, 0)
  const paid = c.paymentSchedule.filter(p => p.status === 'PAGADO').reduce((s, p) => s + p.amount, 0)
  return total > 0 ? Math.round((paid / total) * 100) : 0
}

function paymentTone(p: SubPayment) {
  if (p.status === 'PAGADO') return { icon: CheckCircle2, cls: 'text-emerald-600', label: 'Pagado' }
  if (p.dueDate && new Date(p.dueDate) < new Date()) return { icon: AlertCircle, cls: 'text-red-500', label: 'Vencido' }
  return { icon: Clock, cls: 'text-slate-400', label: 'Pendiente' }
}

function ContractCard({ contract, projectId }: { contract: SubContract; projectId: string }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [expanded, setExpanded] = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)
  const [milestone, setMilestone] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  // Lien waiver (Lote A): panel de excepción por pago
  const [exceptionFor, setExceptionFor] = useState<string | null>(null)
  const [exceptionText, setExceptionText] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['subcontracts', projectId] })

  const addPaymentMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => subcontractsApi.addPayment(contract.id, data),
    onSuccess: () => { invalidate(); setMilestone(''); setAmount(''); setDueDate(''); setShowPayForm(false) },
  })
  const payMut = useMutation({
    mutationFn: ({ paymentId, waiverException }: { paymentId: string; waiverException?: string }) =>
      subcontractsApi.pay(paymentId, waiverException),
    onSuccess: () => { invalidate(); setExceptionFor(null); setExceptionText('') },
  })
  const uploadWaiverMut = useMutation({
    mutationFn: ({ paymentId, file }: { paymentId: string; file: File }) => {
      const fd = new FormData()
      fd.append('file', file)
      return subcontractsApi.uploadWaiver(paymentId, fd)
    },
    onSuccess: invalidate,
  })
  const removeWaiverMut = useMutation({
    mutationFn: (paymentId: string) => subcontractsApi.removeWaiver(paymentId),
    onSuccess: invalidate,
  })
  const removePaymentMut = useMutation({
    mutationFn: (paymentId: string) => subcontractsApi.removePayment(paymentId),
    onSuccess: invalidate,
  })
  const removeContractMut = useMutation({
    mutationFn: () => subcontractsApi.remove(contract.id),
    onSuccess: invalidate,
  })

  const committed = contract.paymentSchedule.reduce((s, p) => s + p.amount, 0)
  const pct = paidPct(contract)

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60">
        <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-600">
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 truncate">{contract.provider?.name ?? 'Proveedor'}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[contract.status]}`}>{contract.status}</span>
          </div>
          {contract.scopeDetails && <div className="text-xs text-slate-400 truncate">{contract.scopeDetails}</div>}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono font-semibold text-slate-800">{fmt(contract.contractValue)}</div>
          <div className="text-[10px] text-slate-400">{pct}% pagado</div>
        </div>
        <button onClick={async () => {
          const ok = await confirm({
            title: 'Eliminar contrato',
            message: `¿Eliminar el contrato de "${contract.provider?.name}"?`,
            detail: 'Se eliminarán también todos sus pagos programados. Esta acción no se puede deshacer.',
            destructive: true, confirmText: 'Sí, eliminar',
          })
          if (ok) removeContractMut.mutate()
        }} className="text-slate-300 hover:text-red-400 p-1 flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50/40">
          {/* progress */}
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-slate-500 whitespace-nowrap">{fmt(committed * pct / 100)} / {fmt(committed)}</span>
          </div>

          {/* payments */}
          <div className="space-y-1.5">
            {contract.paymentSchedule.length === 0 && (
              <div className="text-xs text-slate-400 py-2">Sin pagos programados todavía.</div>
            )}
            {contract.paymentSchedule.map(p => {
              const tone = paymentTone(p)
              const Icon = tone.icon
              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 space-y-1.5">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${tone.cls}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-700 truncate">{p.milestoneDesc}</div>
                      <div className="text-[10px] text-slate-400">
                        {tone.label}
                        {p.dueDate && ` · vence ${new Date(p.dueDate).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        {p.paidDate && ` · pagado ${new Date(p.paidDate).toLocaleDateString('es', { day: '2-digit', month: 'short' })}`}
                      </div>
                    </div>
                    <span className="font-mono text-sm text-slate-700 whitespace-nowrap">{fmt(p.amount)}</span>
                    {p.status !== 'PAGADO' && (
                      <button onClick={() => {
                        if (p.lienWaiverUrl) payMut.mutate({ paymentId: p.id })
                        else setExceptionFor(f => (f === p.id ? null : p.id))
                      }}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 whitespace-nowrap">
                        Registrar pago
                      </button>
                    )}
                    <button onClick={() => removePaymentMut.mutate(p.id)} className="text-slate-300 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Lien waiver (Lote A) — protección contra mechanic's liens en SC */}
                  <div className="flex items-center gap-2 flex-wrap pl-7">
                    {p.lienWaiverUrl ? (
                      <>
                        <a href={p.lienWaiverUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" /> Lien waiver{p.lienWaiverName ? ` · ${p.lienWaiverName}` : ''}
                        </a>
                        {p.status !== 'PAGADO' && (
                          <button onClick={() => removeWaiverMut.mutate(p.id)}
                            className="text-[10px] text-slate-400 hover:text-red-400 hover:underline">quitar</button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          p.status === 'PAGADO'
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          <ShieldAlert className="w-3 h-3" />
                          {p.status === 'PAGADO'
                            ? `Pagado SIN waiver${p.waiverException ? ` — ${p.waiverException}` : ''}`
                            : 'Sin lien waiver'}
                        </span>
                        <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--brand-teal)] hover:underline cursor-pointer">
                          <Upload className="w-3 h-3" />
                          {uploadWaiverMut.isPending ? 'Subiendo…' : 'Subir waiver firmado'}
                          <input type="file" className="hidden" accept=".pdf,image/*"
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadWaiverMut.mutate({ paymentId: p.id, file: f }) }} />
                        </label>
                      </>
                    )}
                  </div>

                  {/* Panel de excepción: pagar sin waiver exige razón explícita */}
                  {exceptionFor === p.id && !p.lienWaiverUrl && p.status !== 'PAGADO' && (
                    <div className="ml-7 bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-2">
                      <div className="text-[11px] text-amber-700 font-medium">
                        Este pago no tiene lien waiver. En Carolina del Sur, pagar sin waiver deja el lote expuesto a un mechanic's lien.
                        Sube el waiver firmado (recomendado) o registra la razón de la excepción — quedará en el historial.
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input value={exceptionText} onChange={e => setExceptionText(e.target.value)}
                          placeholder="Razón de pagar sin waiver (obligatoria)"
                          className="flex-1 min-w-[200px] bg-white border border-amber-200 text-[11px] px-2 py-1.5 rounded-lg focus:outline-none focus:border-amber-400" />
                        <button disabled={!exceptionText.trim() || payMut.isPending}
                          onClick={() => payMut.mutate({ paymentId: p.id, waiverException: exceptionText.trim() })}
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 whitespace-nowrap">
                          Pagar sin waiver
                        </button>
                        <button onClick={() => { setExceptionFor(null); setExceptionText('') }}
                          className="text-[11px] text-slate-400 hover:underline">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* add payment */}
          {showPayForm ? (
            <form onSubmit={e => {
              e.preventDefault()
              if (!milestone.trim() || !amount) return
              addPaymentMut.mutate({ milestoneDesc: milestone.trim(), amount: parseFloat(amount), dueDate: dueDate || null })
            }} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end bg-white border border-slate-200 rounded-lg p-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Hito</label>
                <input value={milestone} onChange={e => setMilestone(e.target.value)}
                  placeholder='Ej. "Framing completado al 100%"'
                  className="w-full bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Monto</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                  className="w-28 bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Vence</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
              </div>
              <button type="submit" disabled={!milestone.trim() || !amount || addPaymentMut.isPending}
                className="px-3 py-1.5 bg-[var(--brand-gold)] hover:bg-[#4A86CF] text-white text-xs font-semibold rounded-lg disabled:opacity-40">
                Agregar
              </button>
            </form>
          ) : (
            <button onClick={() => setShowPayForm(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-gold)] hover:underline">
              <Plus className="w-3.5 h-3.5" /> Agregar pago al calendario
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Subcontracts({ projectId }: { projectId: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [providerId, setProviderId] = useState('')
  const [contractValue, setContractValue] = useState('')
  const [scopeDetails, setScopeDetails] = useState('')

  const { data: contracts = [], isLoading } = useQuery<SubContract[]>({
    queryKey: ['subcontracts', projectId],
    queryFn: () => subcontractsApi.list(projectId),
  })
  const { data: providers = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['providers', projectId],
    queryFn: () => providersApi.list(projectId),
  })

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => subcontractsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subcontracts', projectId] })
      setProviderId(''); setContractValue(''); setScopeDetails(''); setShowForm(false)
    },
  })

  const totalCommitted = contracts.reduce((s, c) => s + c.contractValue, 0)
  const totalPaid = contracts.reduce((s, c) =>
    s + c.paymentSchedule.filter(p => p.status === 'PAGADO').reduce((ss, p) => ss + p.amount, 0), 0)

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando subcontratos...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><FileSignature className="w-[22px] h-[22px]" strokeWidth={2.2} /></span><span>Subcontratistas</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">Contratos, alcance y calendario de pagos por hito</p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-gold)] hover:bg-[#4A86CF] text-white text-sm font-semibold rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo contrato
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><HardHat className="w-3 h-3" /> Contratos</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{contracts.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><DollarSign className="w-3 h-3" /> Comprometido</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{fmt(totalCommitted)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><CheckCircle2 className="w-3 h-3" /> Pagado</div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{fmt(totalPaid)}</div>
        </div>
      </div>

      {/* create form */}
      {showForm && (
        <form onSubmit={e => {
          e.preventDefault()
          if (!providerId) return
          createMut.mutate({
            projectId, providerId,
            contractValue: contractValue ? parseFloat(contractValue) : 0,
            scopeDetails: scopeDetails || null,
          })
        }} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Proveedor *</label>
              <select value={providerId} onChange={e => setProviderId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
                <option value="">Selecciona...</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Valor del contrato</label>
              <input type="number" value={contractValue} onChange={e => setContractValue(e.target.value)} placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Alcance (scope)</label>
              <input value={scopeDetails} onChange={e => setScopeDetails(e.target.value)} placeholder="Descripción del trabajo"
                className="w-full bg-slate-50 border border-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
          </div>
          <button type="submit" disabled={!providerId || createMut.isPending}
            className="px-4 py-2 bg-[var(--brand-teal)] hover:opacity-90 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
            Crear contrato
          </button>
        </form>
      )}

      {providers.length === 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Aún no hay proveedores en este proyecto. Crea proveedores en la sección Proveedores para asignarles contratos.
        </div>
      )}

      {/* contracts list */}
      <div className="space-y-3">
        {contracts.map(c => <ContractCard key={c.id} contract={c} projectId={projectId} />)}
        {contracts.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl text-center py-16">
            <HardHat className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-slate-400 text-sm">No hay contratos de subcontratistas todavía.</div>
          </div>
        )}
      </div>
    </div>
  )
}
