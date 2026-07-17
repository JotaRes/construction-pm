import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eraser } from 'lucide-react'
import { projectsApi } from '../lib/api'
import { useConfirm } from '../components/ConfirmDialog'
import toast from 'react-hot-toast'
import { phasesApi, itemsApi, drawsApi } from '../lib/api'
import { formatUSD } from '../lib/calculations'
import type { Phase, Item, Draw } from '../lib/types'
import { ChevronDown, ChevronRight, Plus, Trash2, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react'

/* ── Editable number cell ──────────────────────── */
function NumCell({ value, onSave, className = '' }: { value: number; onSave: (v: number) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')

  if (editing) {
    return (
      <input
        type="number"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { onSave(parseFloat(text) || 0); setEditing(false) }}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(parseFloat(text) || 0); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-amber-50/60 border border-blue-500/60 text-sm font-mono text-right text-amber-200 px-2 py-0.5 rounded-md focus:outline-none"
        autoFocus
      />
    )
  }
  return (
    <button
      onClick={() => { setText(String(value || '')); setEditing(true) }}
      title="Clic para editar"
      className={`w-full text-right text-sm font-mono hover:text-[var(--brand-teal)] transition-colors group/n flex items-center justify-end gap-1 ${className}`}
    >
      <span className="text-[9px] text-slate-500 group-hover/n:text-[var(--brand-gold)] transition-colors">✏</span>
      {value > 0 ? formatUSD(value) : <span className="text-slate-500">—</span>}
    </button>
  )
}

/* ── Inline text cell ──────────────────────────── */
function TxtCell({ value, placeholder, onSave, className = '' }: { value: string; placeholder?: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  if (editing) {
    return (
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { onSave(text); setEditing(false) }}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(text); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-amber-50/60 border border-blue-500/60 text-xs text-slate-800 px-2 py-0.5 rounded-md focus:outline-none"
        autoFocus
      />
    )
  }
  return (
    <button onClick={() => { setText(value); setEditing(true) }}
      className={`text-left w-full text-xs hover:text-slate-800 transition-colors ${className}`}>
      {value || <span className="text-slate-500 italic">{placeholder ?? '—'}</span>}
    </button>
  )
}

/* ── Item row ──────────────────────────────────── */
function BudgetItemRow({ item, onUpdate, onDelete, isCustom }: {
  item: Item
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
  isCustom: boolean
}) {
  const isSlot = item.itemCode.includes('X') && !item.valorPresupuestado && !item.valorEjecutado && !isCustom
  if (isSlot) return null

  const desv = item.valorEjecutado - item.valorPresupuestado
  const pctEjec = item.valorPresupuestado > 0 ? (item.valorEjecutado / item.valorPresupuestado) * 100 : 0

  let rowClass = 'border-b border-slate-200/30 hover:bg-white/50 transition-colors group/row'
  if (item.completado) rowClass = 'border-b border-slate-200/20 bg-emerald-950/15 hover:bg-emerald-950/25 transition-colors group/row'
  else if (item.estado === 'EN_CURSO') rowClass = 'border-b border-slate-200/30 bg-amber-50/60 hover:bg-amber-50/40 transition-colors group/row'

  return (
    <tr className={`${rowClass} ${item.esNA ? 'opacity-35' : ''}`}>
      <td className="pl-5 pr-2 py-2 w-16">
        <div className="flex items-center gap-1.5">
          {item.completado
            ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            : item.estado === 'EN_CURSO'
            ? <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            : <div className="w-1.5 h-1.5 rounded-full bg-slate-200 flex-shrink-0" />}
          <span className="text-[10px] font-mono text-slate-400">{item.itemCode}</span>
        </div>
      </td>
      <td className="px-2 py-2">
        <TxtCell
          value={item.activity}
          onSave={v => onUpdate(item.id, { activity: v })}
          className={item.completado ? 'line-through text-slate-400' : 'text-slate-700'}
        />
        {item.responsable && <div className="text-[9px] text-slate-400 mt-0.5">{item.responsable}</div>}
      </td>
      <td className="px-2 py-2 w-14">
        <TxtCell value={item.unit ?? ''} placeholder="LS" onSave={v => onUpdate(item.id, { unit: v })} className="text-slate-400 text-center" />
      </td>
      <td className="px-2 py-2 w-32">
        <NumCell
          value={item.valorPresupuestado}
          onSave={v => onUpdate(item.id, { valorPresupuestado: v })}
          className={item.valorPresupuestado > 0 ? 'text-slate-800 font-semibold' : 'text-slate-500'}
        />
      </td>
      <td className="px-2 py-2 w-28 text-right">
        <span className={`text-sm font-mono ${item.valorEjecutado > 0 ? 'text-[var(--brand-teal)]' : 'text-slate-500'}`}>
          {item.valorEjecutado > 0 ? formatUSD(item.valorEjecutado) : '—'}
        </span>
      </td>
      <td className="px-2 py-2 w-24 text-right">
        {item.valorPresupuestado > 0 && item.valorEjecutado > 0 && (
          <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
            desv > 0 ? 'text-red-300 bg-red-500/15' : desv < 0 ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-400'
          }`}>
            {desv > 0 ? '+' : ''}{formatUSD(desv)}
          </span>
        )}
      </td>
      <td className="pr-4 pl-2 py-2 w-24">
        {item.valorPresupuestado > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pctEjec > 100 ? 'bg-red-500' : pctEjec > 0 ? 'bg-[var(--brand-teal)]' : 'bg-slate-200'
                }`}
                style={{ width: `${Math.min(pctEjec, 100)}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono w-7 text-right ${pctEjec > 100 ? 'text-red-400' : 'text-slate-400'}`}>
              {pctEjec.toFixed(0)}%
            </span>
          </div>
        ) : (
          isCustom ? (
            <button
              onClick={() => onDelete(item.id)}
              className="opacity-0 group-hover/row:opacity-100 transition-opacity text-slate-500 hover:text-red-400 ml-auto block"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : null
        )}
      </td>
    </tr>
  )
}

/* ── Phase section ─────────────────────────────── */
function PhaseSection({ phase, onUpdate, onCreate, onDelete }: {
  phase: Phase
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onCreate: (phaseId: string) => void
  onDelete: (id: string) => void
}) {
  const budget = phase.items.reduce((s, i) => s + i.valorPresupuestado, 0)
  const ejec = phase.items.reduce((s, i) => s + i.valorEjecutado, 0)
  const desv = ejec - budget
  const pct = budget > 0 ? (ejec / budget) * 100 : 0
  const hasBudget = budget > 0
  const doneItems = phase.items.filter(i => i.completado && !i.esNA).length
  const totalActive = phase.items.filter(i => !i.esNA && !i.itemCode.includes('X')).length + phase.items.filter(i => i.itemCode.includes('A')).length
  const completionPct = totalActive > 0 ? (doneItems / totalActive) * 100 : 0

  const [open, setOpen] = useState(hasBudget)

  const phaseHeaderClass = completionPct === 100 ? 'phase-header phase-header-done'
    : completionPct > 0 ? 'phase-header phase-header-active'
    : 'phase-header phase-header-empty'

  const customItems = phase.items.filter(i => i.itemCode.includes('.A'))

  return (
    <div className="border-b border-slate-200/30 last:border-0">
      <button onClick={() => setOpen(o => !o)} className={phaseHeaderClass + ' rounded-none border-x-0 border-t-0 rounded-b-none'}>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
        <span className="text-[10px] font-mono text-[var(--brand-gold)] w-7 flex-shrink-0">{phase.code}</span>
        <span className="text-sm font-medium text-slate-800 flex-1 text-left">{phase.name}</span>

        {/* Phase stats bar */}
        <div className="flex items-center gap-4 text-xs shrink-0">
          {hasBudget ? (
            <>
              <span className="font-mono font-semibold text-slate-900 w-28 text-right">{formatUSD(budget)}</span>
              <span className={`font-mono w-28 text-right ${ejec > 0 ? 'text-[var(--brand-teal)]' : 'text-slate-400'}`}>{ejec > 0 ? formatUSD(ejec) : '—'}</span>
              <span className={`font-mono w-20 text-right text-[11px] font-semibold ${
                desv > 0 ? 'text-red-400' : desv < 0 ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {ejec > 0 ? (desv > 0 ? '+' : '') + formatUSD(desv) : '—'}
              </span>
              <div className="flex items-center gap-1.5 w-20">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct > 100 ? 'bg-red-500' : pct > 0 ? 'bg-[var(--brand-teal)]' : 'bg-slate-200'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <span className="text-[10px] font-mono text-slate-400 w-6 text-right">{pct.toFixed(0)}%</span>
              </div>
            </>
          ) : (
            <span className="text-[10px] text-slate-500 italic w-[236px] text-right">sin presupuesto</span>
          )}
        </div>
      </button>

      {open && (
        <div className="bg-slate-50/60">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="pl-5 pr-2 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-16">Cód.</th>
                <th className="px-2 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider">Actividad</th>
                <th className="px-2 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-14">Ud.</th>
                <th className="px-2 py-1.5 text-right text-[9px] text-[#C8922A]/80 uppercase tracking-wider w-32">Presup. ✏</th>
                <th className="px-2 py-1.5 text-right text-[9px] text-slate-400 uppercase tracking-wider w-28">Ejecutado</th>
                <th className="px-2 py-1.5 text-right text-[9px] text-slate-400 uppercase tracking-wider w-24">Desv.</th>
                <th className="pr-4 pl-2 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-24">%</th>
              </tr>
            </thead>
            <tbody>
              {phase.items.map(item => (
                <BudgetItemRow
                  key={item.id}
                  item={item}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  isCustom={item.itemCode.includes('.A')}
                />
              ))}
            </tbody>
          </table>

          {/* Add activity button */}
          <button
            onClick={() => onCreate(phase.id)}
            className="flex items-center gap-2 px-5 py-2 text-xs text-slate-400 hover:text-[var(--brand-gold)] hover:bg-[#C8922A]/5 transition-colors w-full border-t border-slate-200/50"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar actividad imprevista
            {customItems.length > 0 && <span className="ml-1 text-slate-500">({customItems.length} agregada{customItems.length > 1 ? 's' : ''})</span>}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Main ──────────────────────────────────────── */
export default function Budget({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const resetBudget = useMutation({
    mutationFn: () => projectsApi.resetBudget(projectId),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['phases', projectId] })
      toast.success(r?.message || 'Presupuesto reseteado')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error'),
  })

  const handleClearBudget = async () => {
    const ok = await confirm({
      title: 'Borrar todos los datos del presupuesto',
      message: '¿Seguro que quieres borrar TODOS los valores presupuestados?',
      detail: 'Esta acción resetea el valorPresupuestado de TODOS los items a 0. La estructura de fases e items se conserva. La ejecución NO se toca. Esta acción no se puede deshacer.',
      destructive: true,
      confirmText: 'Sí, borrar presupuesto',
      typeToConfirm: 'BORRAR PRESUPUESTO',
    })
    if (ok) resetBudget.mutate()
  }


  const { data: phases = [], isLoading } = useQuery<Phase[]>({
    queryKey: ['phases', projectId],
    queryFn: () => phasesApi.list(projectId),
  })

  const { data: draws = [] } = useQuery<Draw[]>({
    queryKey: ['draws', projectId],
    queryFn: () => drawsApi.list(projectId),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => itemsApi.patch(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phases', projectId] }),
  })

  const createMutation = useMutation({
    mutationFn: (phaseId: string) => itemsApi.create({ phaseId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phases', projectId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phases', projectId] }),
  })

  const totalBudget = phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorPresupuestado, 0), 0)
  const totalEjec = phases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.valorEjecutado, 0), 0)
  const totalDesv = totalEjec - totalBudget
  const pctEjec = totalBudget > 0 ? (totalEjec / totalBudget) * 100 : 0
  const wiredDraws = draws.filter(d => d.estado === 'WIRED')
  const totalDrawn = wiredDraws.reduce((s, d) => s + d.netWire, 0)

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse px-1">Cargando presupuesto...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Presupuesto Maestro</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Edita los valores presupuestados por ítem — baseline compartido con Ejecución
          </p>
        </div>
        <button
          onClick={handleClearBudget}
          disabled={resetBudget.isPending}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          title="Borrar todos los valores presupuestados (mantiene estructura)"
        >
          <Eraser className="w-3.5 h-3.5" />
          {resetBudget.isPending ? 'Borrando…' : 'Borrar presupuesto'}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Total presupuestado</div>
          <div className="text-xl font-bold font-mono text-slate-900">{formatUSD(totalBudget)}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">{phases.filter(p => p.items.some(i => i.valorPresupuestado > 0)).length} de {phases.length} fases</div>
        </div>
        <div className="kpi-card kpi-card-green">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Total ejecutado</div>
          <div className="text-xl font-bold font-mono text-[var(--brand-teal)]">{formatUSD(totalEjec)}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">{pctEjec.toFixed(1)}% del presupuesto</div>
        </div>
        <div className={`kpi-card ${totalDesv > 0 ? 'kpi-card-red' : 'kpi-card-green'}`}>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Saldo disponible</div>
          <div className={`text-xl font-bold font-mono ${totalDesv > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatUSD(totalBudget - totalEjec)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            {totalDesv > 0 ? '▲ sobre presupuesto' : totalDesv < 0 ? '▼ bajo presupuesto' : 'en balance'}
          </div>
        </div>
        <div className="kpi-card kpi-card-purple">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
            <TrendingUp className="w-3 h-3" />Draws wired
          </div>
          <div className="text-xl font-bold font-mono text-violet-300">{formatUSD(totalDrawn)}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">{wiredDraws.length} draw{wiredDraws.length !== 1 ? 's' : ''} desembolsado{wiredDraws.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Draw vs Execution clarification */}
      {totalDrawn > 0 && (
        <div className="flex items-start gap-2.5 bg-violet-500/8 border border-violet-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-500 leading-relaxed">
            <span className="text-violet-300 font-semibold">Draws wired ({formatUSD(totalDrawn)})</span>
            {' '}= dinero desembolsado por el lender a tu cuenta.{' '}
            <span className="text-[var(--brand-teal)] font-semibold">Ejecutado ({formatUSD(totalEjec)})</span>
            {' '}= costo real registrado por ítem de obra.
            Son dos vistas distintas del mismo flujo — los draws financian, los ítems controlan.
          </div>
        </div>
      )}

      {/* Tip */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <DollarSign className="w-3.5 h-3.5 text-[#C8922A]/50" />
        Clic en cualquier valor de <span className="text-[#C8922A]/70">Presup. ✏</span> para editarlo. Los cambios se ven inmediatamente en Ejecución.
        Clic en el nombre de la actividad para editarlo también.
      </div>

      {/* Main table */}
      <div className="section-card">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-200 bg-slate-50/40">
          <div className="w-3.5 flex-shrink-0" />
          <div className="w-7 flex-shrink-0" />
          <div className="flex-1 text-[10px] text-slate-400 uppercase tracking-wider">Fase</div>
          <div className="flex items-center gap-4 text-[10px] shrink-0">
            <span className="text-[#C8922A]/70 uppercase tracking-wider w-28 text-right">Presupuestado</span>
            <span className="text-slate-400 uppercase tracking-wider w-28 text-right">Ejecutado</span>
            <span className="text-slate-400 uppercase tracking-wider w-20 text-right">Desviación</span>
            <span className="text-slate-400 uppercase tracking-wider w-20 text-right">% Ejec.</span>
          </div>
        </div>

        {phases.map(phase => (
          <PhaseSection
            key={phase.id}
            phase={phase}
            onUpdate={(id, data) => updateMutation.mutate({ id, data })}
            onCreate={phaseId => createMutation.mutate(phaseId)}
            onDelete={id => deleteMutation.mutate(id)}
          />
        ))}

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-t border-slate-300/50">
          <div className="w-3.5" /><div className="w-7" />
          <div className="flex-1 text-xs font-bold text-slate-700 uppercase tracking-wider">Total general</div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="font-mono font-bold text-base text-slate-900 w-28 text-right">{formatUSD(totalBudget)}</span>
            <span className={`font-mono text-base w-28 text-right font-semibold ${totalEjec > 0 ? 'text-[var(--brand-teal)]' : 'text-slate-400'}`}>
              {totalEjec > 0 ? formatUSD(totalEjec) : '—'}
            </span>
            <span className={`font-mono text-sm w-20 text-right font-bold ${totalDesv > 0 ? 'text-red-400' : totalDesv < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              {totalEjec > 0 ? (totalDesv > 0 ? '+' : '') + formatUSD(totalDesv) : '—'}
            </span>
            <span className={`font-mono text-sm w-20 text-right ${pctEjec > 100 ? 'text-red-400' : pctEjec > 0 ? 'text-[var(--brand-teal)]' : 'text-slate-400'}`}>
              {totalBudget > 0 ? pctEjec.toFixed(1) + '%' : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
