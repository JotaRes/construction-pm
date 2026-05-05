import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { constructionBudgetApi } from '../lib/api'
import { formatUSD } from '../lib/calculations'
import type { BudgetLine } from '../lib/types'
import { ChevronDown, ChevronRight } from 'lucide-react'

/* ── Inline editable number ─────────────────────── */
function Num({ value, onSave, dim = false }: { value: number; onSave: (v: number) => void; dim?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  if (editing) {
    return (
      <input
        type="number"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { onSave(parseFloat(text) || 0); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(parseFloat(text) || 0); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-full bg-amber-50/60 border border-amber-500/50 text-xs font-mono text-right text-amber-200 px-1.5 py-0.5 rounded focus:outline-none"
        autoFocus
      />
    )
  }
  return (
    <button
      onClick={() => { setText(String(value || '')); setEditing(true) }}
      title="Clic para editar"
      className={`w-full text-right text-xs font-mono transition-colors group/n flex items-center justify-end gap-1
        ${dim || value === 0 ? 'text-slate-500 hover:text-[#C8922A]' : 'text-slate-800 hover:text-[#2D4B52]'}`}
    >
      {value > 0 ? formatUSD(value) : <span className="text-slate-800">—</span>}
      <span className="text-[9px] opacity-0 group-hover/n:opacity-50 text-[#C8922A]">✏</span>
    </button>
  )
}

/* ── Division section ────────────────────────────── */
interface DivGroup {
  divCode: string
  divName: string
  lines: BudgetLine[]
}

function DivSection({ group, onUpdate }: { group: DivGroup; onUpdate: (id: string, data: Record<string, unknown>) => void }) {
  const totalIni = group.lines.reduce((s, l) => s + l.valorInicial, 0)
  const totalPres = group.lines.reduce((s, l) => s + l.valorPresentado, 0)
  const totalApr = group.lines.reduce((s, l) => s + l.valorAprobado, 0)
  const totalPag = group.lines.reduce((s, l) => s + l.pagadoSubs, 0)
  const pct = totalIni > 0 ? (totalApr / totalIni) * 100 : 0

  // default open if has any value
  const [open, setOpen] = useState(totalIni > 0)

  const borderColor = pct === 100 ? 'border-l-emerald-500/60'
    : pct > 0 ? 'border-l-amber-500/60'
    : 'border-l-slate-700'

  return (
    <div className="border-b border-slate-200/60 last:border-0">
      {/* Division header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 bg-white/60 hover:bg-white/90 transition-colors border-l-2 ${borderColor}`}
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
        <div className="flex-1 text-left">
          <span className="text-[10px] font-mono text-[#C8922A] mr-2">{group.divCode}</span>
          <span className="text-sm font-semibold text-slate-800">{group.divName}</span>
        </div>
        <div className="flex items-center gap-0 shrink-0 text-xs font-mono">
          <span className={`w-28 text-right ${totalIni > 0 ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>
            {totalIni > 0 ? formatUSD(totalIni) : '—'}
          </span>
          <span className={`w-28 text-right ${totalPres > 0 ? 'text-[#2D4B52]' : 'text-slate-500'}`}>
            {totalPres > 0 ? formatUSD(totalPres) : '—'}
          </span>
          <span className={`w-28 text-right ${totalApr > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
            {totalApr > 0 ? formatUSD(totalApr) : '—'}
          </span>
          <span className={`w-24 text-right ${totalPag > 0 ? 'text-violet-400' : 'text-slate-500'}`}>
            {totalPag > 0 ? formatUSD(totalPag) : '—'}
          </span>
          <div className="w-24 flex items-center gap-2 justify-end pl-4">
            <div className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-[#2D4B52]' : 'bg-slate-200'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className={`text-[10px] w-6 text-right ${pct > 0 ? 'text-slate-500' : 'text-slate-500'}`}>{pct.toFixed(0)}%</span>
          </div>
        </div>
      </button>

      {open && (
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="pl-8 pr-2 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-16">Cód.</th>
              <th className="px-2 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider">Descripción</th>
              <th className="px-2 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-10">Ud.</th>
              <th className="px-2 py-1.5 text-right text-[9px] text-slate-400 uppercase tracking-wider w-28">Inicial ✏</th>
              <th className="px-2 py-1.5 text-right text-[9px] text-slate-400 uppercase tracking-wider w-28">Presentado ✏</th>
              <th className="px-2 py-1.5 text-right text-[9px] text-emerald-600/70 uppercase tracking-wider w-28">Aprobado ✏</th>
              <th className="px-2 py-1.5 text-right text-[9px] text-violet-600/70 uppercase tracking-wider w-24">Pagado Subs ✏</th>
              <th className="pr-4 pl-2 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-24">% Aprob.</th>
            </tr>
          </thead>
          <tbody>
            {group.lines.map(line => {
              const pctLine = line.valorInicial > 0 ? (line.valorAprobado / line.valorInicial) * 100 : 0
              const diff = line.valorAprobado - line.valorInicial
              return (
                <tr
                  key={line.id}
                  className={`border-b border-slate-200/30 transition-colors
                    ${line.valorAprobado > 0 && line.valorAprobado >= line.valorInicial && line.valorInicial > 0
                      ? 'bg-emerald-950/15 hover:bg-emerald-950/25'
                      : line.valorAprobado > 0
                      ? 'bg-amber-50/60 hover:bg-amber-50/40'
                      : 'hover:bg-white/30'}`}
                >
                  <td className="pl-8 pr-2 py-2">
                    <span className="text-[10px] font-mono text-slate-400">{line.itemCode}</span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="text-xs text-slate-700">{line.description}</div>
                    {line.vendor && <div className="text-[9px] text-slate-400 mt-0.5">{line.vendor}</div>}
                  </td>
                  <td className="px-2 py-2 text-[10px] text-slate-400 text-center">{line.unit}</td>
                  <td className="px-2 py-2">
                    <Num value={line.valorInicial} onSave={v => onUpdate(line.id, { valorInicial: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <Num value={line.valorPresentado} onSave={v => onUpdate(line.id, { valorPresentado: v })} dim={line.valorPresentado === 0} />
                  </td>
                  <td className="px-2 py-2">
                    <Num value={line.valorAprobado} onSave={v => onUpdate(line.id, { valorAprobado: v })} dim={line.valorAprobado === 0} />
                  </td>
                  <td className="px-2 py-2">
                    <Num value={line.pagadoSubs} onSave={v => onUpdate(line.id, { pagadoSubs: v })} dim={line.pagadoSubs === 0} />
                  </td>
                  <td className="pr-4 pl-2 py-2">
                    {line.valorInicial > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className={`h-full rounded-full ${pctLine >= 100 ? 'bg-emerald-500' : pctLine > 0 ? 'bg-[#2D4B52]' : 'bg-slate-200'}`}
                            style={{ width: `${Math.min(pctLine, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-mono w-8 ${pctLine > 0 ? 'text-slate-500' : 'text-slate-500'}`}>
                          {pctLine.toFixed(0)}%
                        </span>
                        {diff < 0 && line.valorAprobado > 0 && (
                          <span className="text-[9px] text-[#C8922A] font-mono">{formatUSD(diff)}</span>
                        )}
                      </div>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ── Main ────────────────────────────────────────── */
export default function ConstructionBudget({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()

  const { data: lines = [], isLoading } = useQuery<BudgetLine[]>({
    queryKey: ['construction-budget', projectId],
    queryFn: () => constructionBudgetApi.list(projectId),
  })

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      constructionBudgetApi.patch(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] }),
  })

  // Group by division
  const divMap = new Map<string, DivGroup>()
  for (const line of lines) {
    if (!divMap.has(line.divCode)) {
      divMap.set(line.divCode, { divCode: line.divCode, divName: line.divName, lines: [] })
    }
    divMap.get(line.divCode)!.lines.push(line)
  }
  const groups = Array.from(divMap.values())

  const totalIni  = lines.reduce((s, l) => s + l.valorInicial, 0)
  const totalPres = lines.reduce((s, l) => s + l.valorPresentado, 0)
  const totalApr  = lines.reduce((s, l) => s + l.valorAprobado, 0)
  const totalPag  = lines.reduce((s, l) => s + l.pagadoSubs, 0)
  const pctGlobal = totalIni > 0 ? (totalApr / totalIni) * 100 : 0
  const saldoPorAprobar = totalIni - totalApr

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando Construction Budget...</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Construction Budget</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Lender Report · Hera Holdings LLC · {lines.length} líneas · 10 divisiones
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-3">
        <div className="kpi-card">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Valor Inicial<br/><span className="text-slate-400 normal-case">Lo pactado con lender</span></div>
          <div className="text-lg font-bold font-mono text-slate-900">{formatUSD(totalIni)}</div>
        </div>
        <div className="kpi-card kpi-card-amber">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Presentado<br/><span className="text-slate-400 normal-case">Solicitado en draws</span></div>
          <div className="text-lg font-bold font-mono text-[#2D4B52]">{formatUSD(totalPres)}</div>
        </div>
        <div className="kpi-card kpi-card-green">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Aprobado<br/><span className="text-slate-400 normal-case">Validado por Trinity</span></div>
          <div className="text-lg font-bold font-mono text-emerald-300">{formatUSD(totalApr)}</div>
        </div>
        <div className="kpi-card kpi-card-purple">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Pagado Subs<br/><span className="text-slate-400 normal-case">A subcontratistas</span></div>
          <div className="text-lg font-bold font-mono text-violet-300">{formatUSD(totalPag)}</div>
        </div>
        <div className={`kpi-card ${saldoPorAprobar > 0 ? '' : 'kpi-card-green'}`}>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Saldo por aprobar<br/><span className="text-slate-400 normal-case">{pctGlobal.toFixed(1)}% ejecutado</span></div>
          <div className={`text-lg font-bold font-mono ${saldoPorAprobar > 0 ? 'text-slate-700' : 'text-emerald-400'}`}>
            {formatUSD(saldoPorAprobar)}
          </div>
        </div>
      </div>

      {/* Global progress bar */}
      <div className="bg-white/60 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">Progreso global de aprobación</span>
          <span className="text-sm font-mono font-semibold text-slate-800">{pctGlobal.toFixed(1)}%</span>
        </div>
        <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pctGlobal >= 100 ? 'bg-emerald-500' : 'bg-[#2D4B52]'}`}
            style={{ width: `${Math.min(pctGlobal, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
          <span>$0</span>
          <span className="text-emerald-600">{formatUSD(totalApr)} aprobado</span>
          <span>{formatUSD(totalIni)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-slate-500 inline-block"/>Inicial = firmado con lender</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-blue-500 inline-block"/>Presentado = solicitado en draw</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500 inline-block"/>Aprobado = Trinity validated</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-violet-500 inline-block"/>Pagado = real a subs</span>
        <span className="ml-auto text-[#C8922A]/60">Todos los valores son editables · clic para editar</span>
      </div>

      {/* Main table */}
      <div className="section-card overflow-hidden">
        {/* Column header */}
        <div className="flex items-center px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="w-3.5 mr-3" /><div className="flex-1 text-[10px] text-slate-400 uppercase tracking-wider">División</div>
          <div className="flex items-center shrink-0 text-[10px] text-slate-400 uppercase tracking-wider">
            <span className="w-28 text-right">Inicial</span>
            <span className="w-28 text-right">Presentado</span>
            <span className="w-28 text-right text-emerald-700">Aprobado</span>
            <span className="w-24 text-right text-violet-700">Pag. Subs</span>
            <span className="w-24 text-right">% Aprob.</span>
          </div>
        </div>

        {groups.map(group => (
          <DivSection
            key={group.divCode}
            group={group}
            onUpdate={(id, data) => mutation.mutate({ id, data })}
          />
        ))}

        {/* Footer total */}
        <div className="flex items-center px-4 py-3.5 bg-slate-50/70 border-t border-slate-200/60">
          <div className="w-3.5 mr-3" />
          <div className="flex-1 text-sm font-bold text-slate-800 uppercase tracking-wider">Total General</div>
          <div className="flex items-center shrink-0 text-sm font-mono font-bold">
            <span className="w-28 text-right text-slate-900">{formatUSD(totalIni)}</span>
            <span className="w-28 text-right text-[#2D4B52]">{totalPres > 0 ? formatUSD(totalPres) : '—'}</span>
            <span className="w-28 text-right text-emerald-300">{totalApr > 0 ? formatUSD(totalApr) : '—'}</span>
            <span className="w-24 text-right text-violet-300">{totalPag > 0 ? formatUSD(totalPag) : '—'}</span>
            <span className={`w-24 text-right ${pctGlobal > 0 ? 'text-[#2D4B52]' : 'text-slate-400'}`}>
              {pctGlobal.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
