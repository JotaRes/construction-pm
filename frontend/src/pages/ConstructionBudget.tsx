import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { constructionBudgetApi, budgetInitApi, projectsApi } from '../lib/api'
import { formatUSD } from '../lib/calculations'
import type { BudgetLine } from '../lib/types'
import { useConfirm } from '../components/ConfirmDialog'
import { ChevronDown, ChevronRight, Upload, RefreshCw, CheckCircle, AlertCircle, FileText, Eraser, FileUp } from 'lucide-react'
import toast from 'react-hot-toast'

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

/* ── PDF Parse Panel ─────────────────────────────── */
interface ParsedMatch { itemCode: string; description: string; amount: number; confidence: number }

function BudgetPdfPanel({ projectId, onApply }: {
  projectId: string
  onApply: (matches: ParsedMatch[]) => void
}) {
  const [parsed, setParsed] = useState<{ rawLines: number; extracted: number; matched: ParsedMatch[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    setParsed(null)
    try {
      const result = await budgetInitApi.parsePdf(projectId, file)
      setParsed(result)
      setSelected(new Set(result.matched.map((m: ParsedMatch) => m.itemCode)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">Importar desde PDF</div>
          <div className="text-xs text-slate-400 mt-0.5">Sube un Construction Budget en PDF para extraer montos automáticamente</div>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#2D4B52] hover:bg-[#3a6068] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {loading ? 'Procesando...' : 'Subir PDF'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-600">{error}</span>
        </div>
      )}

      {parsed && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{parsed.rawLines} líneas leídas</span>
            <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" />{parsed.matched.length} ítems detectados</span>
          </div>

          {parsed.matched.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">No se detectaron montos que coincidan con el template. Verifica el formato del PDF.</div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] text-slate-400 font-medium w-8">
                      <input type="checkbox" checked={selected.size === parsed.matched.length}
                        onChange={e => setSelected(e.target.checked ? new Set(parsed.matched.map(m => m.itemCode)) : new Set())} />
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] text-slate-400 font-medium w-16">Cód.</th>
                    <th className="px-3 py-2 text-left text-[10px] text-slate-400 font-medium">Descripción</th>
                    <th className="px-3 py-2 text-right text-[10px] text-slate-400 font-medium w-28">Monto</th>
                    <th className="px-3 py-2 text-right text-[10px] text-slate-400 font-medium w-16">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.matched.map(m => (
                    <tr key={m.itemCode} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={selected.has(m.itemCode)}
                          onChange={e => {
                            const s = new Set(selected)
                            e.target.checked ? s.add(m.itemCode) : s.delete(m.itemCode)
                            setSelected(s)
                          }} />
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-[#C8922A]">{m.itemCode}</td>
                      <td className="px-3 py-1.5 text-slate-700">{m.description}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-800 font-semibold">{formatUSD(m.amount)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={`text-[10px] font-mono ${m.confidence > 0.6 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {(m.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parsed.matched.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{selected.size} de {parsed.matched.length} seleccionados</span>
              <button
                onClick={() => onApply(parsed.matched.filter(m => selected.has(m.itemCode)))}
                disabled={selected.size === 0}
                className="px-4 py-2 bg-[#C8922A] hover:bg-[#E0AD4F] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              >
                Aplicar al budget ({selected.size})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main ────────────────────────────────────────── */
export default function ConstructionBudget({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showPdfPanel, setShowPdfPanel] = useState(false)

  const { data: lines = [], isLoading } = useQuery<BudgetLine[]>({
    queryKey: ['construction-budget', projectId],
    queryFn: () => constructionBudgetApi.list(projectId),
  })

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      constructionBudgetApi.patch(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] }),
  })

  const initMut = useMutation({
    mutationFn: () => budgetInitApi.init(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['construction-budget', projectId] }),
  })

  // === Borrar TODO el construction budget ===
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
      detail: 'Esta acción elimina todas las líneas (template + extras). Podrás reinicializar desde template o cargar un PDF nuevo después. Esta acción no se puede deshacer.',
      destructive: true,
      confirmText: 'Sí, borrar todo',
      typeToConfirm: 'BORRAR BUDGET',
    })
    if (ok) resetCBMut.mutate()
  }

  // === Importar desde PDF (nuevo flujo con backend mejorado) ===
  const importPdfMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('pdf', file)
      const res = await axios.post(`/api/projects/${projectId}/construction-budget/import-from-pdf`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data
    },
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
        message: '¿Seguro que quieres cargar este PDF? Se reemplazarán TODAS las líneas actuales con las del PDF.',
        detail: `Archivo: "${f.name}" (${(f.size/1024).toFixed(0)} KB). El sistema extraerá los items con sus montos y reemplazará el contenido actual.`,
        destructive: true,
        confirmText: 'Sí, reemplazar e importar',
      })
      if (!ok) { e.target.value = ''; return }
    }
    importPdfMut.mutate(f)
    e.target.value = ''
  }

  // Handle PDF match apply: update lines with matched amounts
  const handlePdfApply = async (matches: Array<{ itemCode: string; description: string; amount: number; confidence: number }>) => {
    for (const match of matches) {
      const line = lines.find(l => l.itemCode === match.itemCode)
      if (line) {
        await mutation.mutateAsync({ id: line.id, data: { valorInicial: match.amount } })
      }
    }
    setShowPdfPanel(false)
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
  const totalPres = lines.reduce((s, l) => s + l.valorPresentado, 0)
  const totalApr  = lines.reduce((s, l) => s + l.valorAprobado, 0)
  const totalPag  = lines.reduce((s, l) => s + l.pagadoSubs, 0)
  const pctGlobal = totalIni > 0 ? (totalApr / totalIni) * 100 : 0
  const saldoPorAprobar = totalIni - totalApr

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando Construction Budget...</div>

  // Empty state — opción de importar PDF o inicializar template
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
            <div className="text-base font-semibold text-slate-700">Sin Construction Budget cargado</div>
            <div className="text-sm text-slate-400 mt-1">Recomendado: carga el PDF del lender para obtener los items exactos con sus valores iniciales</div>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 px-5 py-3 bg-[#C8922A] hover:bg-[#E0AD4F] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50">
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
            <button
              onClick={() => initMut.mutate()}
              disabled={initMut.isPending}
              className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:border-[#2D4B52] text-[#2D4B52] text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {initMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {initMut.isPending ? 'Inicializando...' : 'O usar template estándar'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">El PDF debe ser el reporte completo del lender con descripciones e items por monto. El sistema extraerá automáticamente los items y deshabilitará los que no aparezcan en el PDF.</p>
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
            Lender Report · Hera Holdings LLC · {lines.length} líneas · {groups.length} divisiones
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* NUEVO: cargar PDF directo y reemplazar todo */}
          <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-[#C8922A] bg-[#C8922A] text-white hover:bg-[#E0AD4F] transition-colors cursor-pointer disabled:opacity-50">
            <FileUp className="w-3.5 h-3.5" />
            {importPdfMut.isPending ? 'Importando…' : 'Cargar PDF nuevo'}
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={importPdfMut.isPending}
              onChange={handleImportPdf}
            />
          </label>
          {/* Panel viejo de matching incremental */}
          <button
            onClick={() => setShowPdfPanel(p => !p)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors
              ${showPdfPanel ? 'bg-[#2D4B52] text-white border-[#2D4B52]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#2D4B52] hover:text-[#2D4B52]'}`}
          >
            <Upload className="w-3.5 h-3.5" />
            Matching incremental
          </button>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: 'Reinicializar budget desde template',
                message: '¿Seguro que quieres reinicializar el budget desde el template?',
                detail: 'TODOS los valores actuales (valor inicial, presentado, aprobado, pagado) serán reemplazados por los del template. Esta acción no se puede deshacer.',
                destructive: true,
                confirmText: 'Sí, reinicializar',
              })
              if (ok) initMut.mutate()
            }}
            disabled={initMut.isPending}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${initMut.isPending ? 'animate-spin' : ''}`} />
            Re-init template
          </button>
          {/* NUEVO: borrar todo el budget */}
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

      {/* PDF parse panel */}
      {showPdfPanel && (
        <BudgetPdfPanel projectId={projectId} onApply={handlePdfApply} />
      )}

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
