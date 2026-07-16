import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { constructionBudgetApi, projectsApi } from '../lib/api'
import { formatUSD } from '../lib/calculations'
import type { BudgetLine } from '../lib/types'
import { useConfirm } from '../components/ConfirmDialog'
import { ChevronDown, ChevronRight, Upload, FileText, Eraser, FileUp } from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Inline editable number ─────────────────────── */
function Num({ value, onSave, dim = false, plain = false }: { value: number; onSave: (v: number) => void; dim?: boolean; plain?: boolean }) {
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
        className="w-full bg-white border border-[#2D4B52]/40 text-xs font-mono text-right text-slate-900 px-1.5 py-0.5 rounded focus:outline-none focus:border-[var(--brand-gold)]"
        autoFocus
      />
    )
  }
  return (
    <button
      onClick={() => { setText(String(value || '')); setEditing(true) }}
      title="Clic para editar"
      className={`w-full text-right text-xs font-mono transition-colors group/n flex items-center justify-end gap-1
        ${dim || value === 0 ? 'text-slate-400 hover:text-[var(--brand-gold)]' : 'text-slate-800 hover:text-[var(--brand-teal)]'}`}
    >
      {value > 0 ? (plain ? value.toLocaleString('en-US') : formatUSD(value)) : <span className="text-slate-400">—</span>}
      <span className="text-[9px] opacity-0 group-hover/n:opacity-50 text-[var(--brand-gold)]">✏</span>
    </button>
  )
}

/* ── Division section ────────────────────────────── */
interface DivGroup {
  divCode: string
  divName: string
  lines: BudgetLine[]
}

function DivSection({
  group,
  onUpdate,
  factor,
}: {
  group: DivGroup
  onUpdate: (id: string, data: Record<string, unknown>) => void
  factor: number
}) {
  const totalIni  = group.lines.reduce((s, l) => s + l.valorInicial, 0)
  const totalApr  = group.lines.reduce((s, l) => s + l.valorAprobado, 0)
  const totalDesemb = totalApr * factor
  const pct = totalIni > 0 ? (totalApr / totalIni) * 100 : 0

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
          <span className="text-[10px] font-mono text-[var(--brand-gold)] mr-2">{group.divCode}</span>
          <span className="text-sm font-semibold text-slate-800">{group.divName}</span>
        </div>
        <div className="flex items-center gap-0 shrink-0 text-xs font-mono">
          <span className={`w-28 text-right ${totalIni > 0 ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>
            {totalIni > 0 ? formatUSD(totalIni) : '—'}
          </span>
          <span className={`w-28 text-right ${totalDesemb > 0 ? 'text-[var(--brand-teal)]' : 'text-slate-500'}`} title="Desembolsado = Aprobado × factor del lender">
            {totalDesemb > 0 ? formatUSD(totalDesemb) : '—'}
          </span>
          <span className="w-16 text-right text-slate-400">
            {totalIni > 0 ? `${((totalApr / totalIni) * 100).toFixed(0)}%` : '—'}
          </span>
          <span className={`w-32 text-right ${totalApr > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
            {totalApr > 0 ? formatUSD(totalApr) : '—'}
          </span>
          <div className="w-24 flex items-center gap-2 justify-end pl-4">
            <div className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-[var(--brand-teal)]' : 'bg-slate-200'}`}
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
              <th className="px-2 py-1.5 text-right text-[9px] text-slate-400 uppercase tracking-wider w-20">Cant. ✏</th>
              <th className="px-2 py-1.5 text-right text-[9px] text-slate-400 uppercase tracking-wider w-28">Inicial ✏</th>
              <th className="px-2 py-1.5 text-right text-[9px] text-[var(--brand-teal)] uppercase tracking-wider w-28" title={`Desembolsado = Aprobado × ${(factor * 100).toFixed(2)}% (factor del lender)`}>Desembolsado</th>
              <th className="px-2 py-1.5 text-right text-[9px] text-slate-400 uppercase tracking-wider w-16">%APR</th>
              <th className="px-2 py-1.5 text-right text-[9px] text-emerald-600/70 uppercase tracking-wider w-32">Aprobado (auto desde Draws)</th>
              <th className="pr-4 pl-2 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-24">Progreso</th>
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
                    <Num value={line.quantity ?? 0} onSave={v => onUpdate(line.id, { quantity: v })} dim={!line.quantity} plain />
                  </td>
                  <td className="px-2 py-2">
                    <Num value={line.valorInicial} onSave={v => onUpdate(line.id, { valorInicial: v })} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {line.valorAprobado > 0
                      ? <span className="text-xs font-mono text-[var(--brand-teal)]" title="Aprobado × factor del lender">{formatUSD(line.valorAprobado * factor)}</span>
                      : <span className="text-xs font-mono text-slate-400">—</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className="text-[11px] font-mono text-slate-500">
                      {line.valorInicial > 0 ? `${((line.valorAprobado / line.valorInicial) * 100).toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <Num value={line.valorAprobado} onSave={v => onUpdate(line.id, { valorAprobado: v })} dim={line.valorAprobado === 0} />
                  </td>
                  <td className="pr-4 pl-2 py-2">
                    {line.valorInicial > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className={`h-full rounded-full ${pctLine >= 100 ? 'bg-emerald-500' : pctLine > 0 ? 'bg-[var(--brand-teal)]' : 'bg-slate-200'}`}
                            style={{ width: `${Math.min(pctLine, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-mono w-8 ${pctLine > 0 ? 'text-slate-500' : 'text-slate-500'}`}>
                          {pctLine.toFixed(0)}%
                        </span>
                        {diff < 0 && line.valorAprobado > 0 && (
                          <span className="text-[9px] text-[var(--brand-gold)] font-mono">{formatUSD(diff)}</span>
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
  const confirm = useConfirm()
  const importInputRef = useRef<HTMLInputElement>(null)

  const { data: lines = [], isLoading } = useQuery<BudgetLine[]>({
    queryKey: ['construction-budget', projectId],
    queryFn: () => constructionBudgetApi.list(projectId),
  })

  // Factor de desembolso del lender (holdback ÷ budget). Fuente única en el KPIs.
  const { data: dash } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => projectsApi.dashboard(projectId),
  })
  const factor: number = dash?.kpis?.disbursementFactor ?? 0.8488

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      constructionBudgetApi.patch(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] }),
  })

  const resetCBMut = useMutation({
    mutationFn: () => projectsApi.resetConstructionBudget(projectId),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
      toast.success(r?.message || 'Construction Budget reseteado')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error'),
  })

  const handleClearCB = async () => {
    const ok = await confirm({
      title: 'Borrar Construction Budget completo',
      message: '¿Seguro que quieres borrar TODAS las líneas del Construction Budget?',
      detail: 'Esta acción elimina todas las líneas. Podrás cargar un PDF nuevo después. No se puede deshacer.',
      destructive: true,
      confirmText: 'Sí, borrar todo',
      typeToConfirm: 'BORRAR BUDGET',
    })
    if (ok) resetCBMut.mutate()
  }

  const importPdfMut = useMutation({
    mutationFn: (file: File) => constructionBudgetApi.importFromPdf(projectId, file),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] })
      toast.success(r?.message || 'PDF importado', { duration: 7000 })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al importar PDF'),
  })

  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (lines.length > 0) {
      const ok = await confirm({
        title: 'Importar Construction Budget desde PDF',
        message: '¿Seguro? Se reemplazarán TODAS las líneas actuales con las del PDF.',
        detail: `Archivo: "${f.name}" (${(f.size / 1024).toFixed(0)} KB).`,
        destructive: true,
        confirmText: 'Sí, reemplazar e importar',
      })
      if (!ok) { e.target.value = ''; return }
    }
    importPdfMut.mutate(f)
    e.target.value = ''
  }

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
  const totalApr  = lines.reduce((s, l) => s + l.valorAprobado, 0)
  const totalDesemb = totalApr * factor
  const pctGlobal = totalIni > 0 ? (totalApr / totalIni) * 100 : 0
  const saldoPorAprobar = totalIni - totalApr

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando Construction Budget...</div>

  // Empty state — solo opción de importar PDF
  if (lines.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Construction Budget</h1>
          <p className="text-sm text-slate-500 mt-0.5">Lender Report · sin líneas todavía</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-5">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7 text-slate-400" />
          </div>
          <div>
            <div className="text-base font-semibold text-slate-700">Construction Budget vacío</div>
            <div className="text-sm text-slate-400 mt-1">
              Carga el PDF del lender para extraer los items con sus valores iniciales
            </div>
          </div>
          <label className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--brand-gold)] hover:bg-[#E0AD4F] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            {importPdfMut.isPending ? 'Importando PDF…' : 'Cargar Construction Budget (PDF)'}
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={importPdfMut.isPending}
              onChange={handleImportPdf}
            />
          </label>
          <p className="text-[11px] text-slate-400">
            El PDF debe ser el reporte del lender con items numerados tipo "1.1 Descripción $monto". El sistema extrae automáticamente todos los items.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Construction Budget</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Lender Report · {lines.length} líneas · {groups.length} divisiones
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-[var(--brand-gold)] bg-[var(--brand-gold)] text-white hover:bg-[#E0AD4F] transition-colors cursor-pointer">
            <FileUp className="w-3.5 h-3.5" />
            {importPdfMut.isPending ? 'Importando…' : 'Cargar PDF nuevo'}
            <input
              ref={importInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={importPdfMut.isPending}
              onChange={handleImportPdf}
            />
          </label>
          <button
            onClick={handleClearCB}
            disabled={resetCBMut.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <Eraser className="w-3.5 h-3.5" />
            {resetCBMut.isPending ? 'Borrando…' : 'Borrar todo'}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Valor Inicial<br/><span className="text-slate-400 normal-case">Lo pactado con lender</span></div>
          <div className="text-lg font-bold font-mono text-slate-900">{formatUSD(totalIni)}</div>
        </div>
        <div className="kpi-card kpi-card-amber">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Desembolsado<br/><span className="text-slate-400 normal-case">Aprobado × {(factor * 100).toFixed(2)}%</span></div>
          <div className="text-lg font-bold font-mono text-[var(--brand-teal)]">{formatUSD(totalDesemb)}</div>
        </div>
        <div className="kpi-card kpi-card-green">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Aprobado<br/><span className="text-slate-400 normal-case">Validado por Trinity</span></div>
          <div className="text-lg font-bold font-mono text-emerald-300">{formatUSD(totalApr)}</div>
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
            className={`h-full rounded-full transition-all ${pctGlobal >= 100 ? 'bg-emerald-500' : 'bg-[var(--brand-teal)]'}`}
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
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[var(--brand-teal)] inline-block"/>Desembolsado = Aprobado × {(factor * 100).toFixed(2)}% (lo que gira el lender)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500 inline-block"/>Aprobado = Trinity validated</span>
        <span className="ml-auto text-[#C8922A]/60">Todos los valores son editables · clic para editar · % calcula monto automáticamente</span>
      </div>

      {/* Main table */}
      <div className="section-card overflow-hidden">
        {/* Column header */}
        <div className="flex items-center px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="w-3.5 mr-3" />
          <div className="flex-1 text-[10px] text-slate-400 uppercase tracking-wider">División</div>
          <div className="flex items-center shrink-0 text-[10px] text-slate-400 uppercase tracking-wider">
            <span className="w-28 text-right">Inicial</span>
            <span className="w-28 text-right text-[var(--brand-teal)]">Desembolsado</span>
            <span className="w-16 text-right text-[#C8922A]/70">% Apr.</span>
            <span className="w-28 text-right text-emerald-700">Aprobado</span>
            <span className="w-24 text-right">Progreso</span>
          </div>
        </div>

        {groups.map(group => (
          <DivSection
            key={group.divCode}
            group={group}
            onUpdate={(id, data) => mutation.mutate({ id, data })}
            factor={factor}
          />
        ))}

        {/* Footer total */}
        <div className="flex items-center px-4 py-3.5 bg-slate-50/70 border-t border-slate-200/60">
          <div className="w-3.5 mr-3" />
          <div className="flex-1 text-sm font-bold text-slate-800 uppercase tracking-wider">Total General</div>
          <div className="flex items-center shrink-0 text-sm font-mono font-bold">
            <span className="w-28 text-right text-slate-900">{formatUSD(totalIni)}</span>
            <span className="w-28 text-right text-[var(--brand-teal)]">{totalDesemb > 0 ? formatUSD(totalDesemb) : '—'}</span>
            <span className="w-16 text-right text-[var(--brand-gold)]">
              {pctGlobal > 0 ? `${pctGlobal.toFixed(1)}%` : '—'}
            </span>
            <span className="w-28 text-right text-emerald-300">{totalApr > 0 ? formatUSD(totalApr) : '—'}</span>
            <span className="w-24 text-right text-slate-400">{pctGlobal.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
