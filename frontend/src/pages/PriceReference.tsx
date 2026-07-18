import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { priceRefsApi, type ComputedPriceRefs, type ComputedPriceActivity } from '../lib/api'
import { formatUSD } from '../lib/calculations'
import type { PriceRef } from '../lib/types'
import { Plus, Trash2, Tag, Search, ChevronDown, ChevronRight, Calculator, Sparkles } from 'lucide-react'

const UNIT_LABELS: Record<string, string> = {
  SF: 'pie²', LF: 'lineal', CY: 'yarda³', AC: 'acre', EA: 'unidad', MO: 'mes', LS: 'global', HR: 'hora', SY: 'yarda²',
}
function unitLabel(u: string) { return UNIT_LABELS[u] ? `${u} · ${UNIT_LABELS[u]}` : u }

/* ── Referencias AUTO-CALCULADAS desde presupuesto + ejecución ── */
function ComputedSection() {
  const { data, isLoading } = useQuery<ComputedPriceRefs>({
    queryKey: ['price-refs-computed'],
    queryFn: priceRefsApi.computed,
  })
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({})

  if (isLoading) return <div className="text-slate-400 text-sm animate-pulse">Calculando promedios...</div>
  if (!data || data.totalRecords === 0) {
    return (
      <div className="section-card p-6 text-center text-slate-400 text-sm">
        Aún no hay presupuestos ni ejecución cargados para calcular promedios. Carga un Construction Budget o registra ejecución de obra y aquí aparecerán solos.
      </div>
    )
  }

  const byUnitMap = new Map<string, ComputedPriceActivity[]>()
  data.byActivity.forEach(a => { if (!byUnitMap.has(a.unit)) byUnitMap.set(a.unit, []); byUnitMap.get(a.unit)!.push(a) })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.byUnit.map(u => (
          <div key={u.unit} className="kpi-card">
            <div className="text-xs text-slate-400 uppercase mb-1">{unitLabel(u.unit)}</div>
            <div className="text-lg font-bold font-mono text-slate-800">
              {u.avgUnitPrice != null ? `${formatUSD(u.avgUnitPrice)}/${u.unit}` : formatUSD(u.avgCost)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{u.count} muestra(s){u.avgUnitPrice == null ? ' · costo prom.' : ' · $/unidad'}</div>
          </div>
        ))}
      </div>

      {[...byUnitMap.entries()].map(([unit, acts]) => {
        const open = openUnits[unit] ?? true
        return (
          <div key={unit} className="section-card overflow-hidden">
            <button onClick={() => setOpenUnits(s => ({ ...s, [unit]: !open }))}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors">
              {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{unitLabel(unit)}</span>
              <span className="text-[10px] text-slate-400">({acts.length} actividad(es))</span>
            </button>
            {open && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Actividad</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-40">Categoría</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-16">Muestras</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-28 border-l border-slate-100">Costo prom.</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-[var(--brand-gold)] uppercase tracking-wider w-32 border-l border-slate-100">Precio / {unit}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acts.map((a, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-2 text-xs text-slate-800">{a.activity}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-500 truncate max-w-[160px]">{a.category}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono text-slate-600">{a.count}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono text-slate-700 border-l border-slate-100">{formatUSD(a.avgCost)}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono font-semibold border-l border-slate-100">
                          {a.avgUnitPrice != null
                            ? <span className="text-[var(--brand-gold)]" title={`Rango ${formatUSD(a.minUnitPrice ?? 0)} – ${formatUSD(a.maxUnitPrice ?? 0)} · ${a.qtyCount} con cantidad`}>{formatUSD(a.avgUnitPrice)}</span>
                            : <span className="text-slate-300" title="Carga la cantidad en el presupuesto/ejecución para calcular el precio por unidad">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const CATEGORIES = [
  'Sitework & Demo',
  'Concrete & Masonry',
  'Framing & Structural',
  'Roofing',
  'Exterior Finishes',
  'Windows & Doors',
  'Plumbing',
  'HVAC',
  'Electrical',
  'Insulation',
  'Drywall',
  'Flooring',
  'Cabinets & Countertops',
  'Fixtures & Hardware',
  'Painting',
  'Landscaping',
  'General Conditions',
  'Otro',
]

const CATEGORY_COLORS: Record<string, string> = {
  'Sitework & Demo': 'bg-slate-200 text-slate-700',
  'Concrete & Masonry': 'bg-orange-500/25 text-orange-300',
  'Framing & Structural': 'bg-blue-500/25 text-[var(--brand-teal)]',
  'Roofing': 'bg-red-500/20 text-red-300',
  'Exterior Finishes': 'bg-yellow-500/20 text-yellow-300',
  'Windows & Doors': 'bg-sky-500/20 text-sky-300',
  'Plumbing': 'bg-[#3E6B85]/20 text-blue-300',
  'HVAC': 'bg-cyan-500/20 text-cyan-300',
  'Electrical': 'bg-yellow-400/25 text-yellow-200',
  'Insulation': 'bg-pink-500/20 text-pink-300',
  'Drywall': 'bg-slate-100 text-slate-700',
  'Flooring': 'bg-lime-500/20 text-lime-300',
  'Cabinets & Countertops': 'bg-teal-500/20 text-teal-300',
  'Fixtures & Hardware': 'bg-violet-500/20 text-violet-300',
  'Painting': 'bg-purple-500/20 text-purple-300',
  'Landscaping': 'bg-green-500/20 text-green-300',
  'General Conditions': 'bg-[#3E6B85]/10 text-[var(--brand-gold)]',
  'Otro': 'bg-slate-200 text-slate-500',
}

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'bg-slate-200 text-slate-500'
}

/* ── Inline editable cells ──────────────────────────── */
function Num({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  if (editing) {
    return (
      <input
        type="number"
        value={text}
        autoFocus
        onChange={e => setText(e.target.value)}
        onBlur={() => { onSave(parseFloat(text) || 0); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(parseFloat(text) || 0); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-24 bg-amber-50/60 border border-amber-500/40 text-xs font-mono text-right text-amber-200 px-1.5 py-0.5 rounded focus:outline-none"
      />
    )
  }
  return (
    <button
      onClick={() => { setText(String(value || '')); setEditing(true) }}
      className="w-full text-right text-xs font-mono text-slate-700 hover:text-[var(--brand-teal)] transition-colors"
    >
      {value > 0 ? formatUSD(value) : <span className="text-slate-500">—</span>}
    </button>
  )
}

function Txt({ value, onSave, placeholder }: { value: string | null; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value ?? '')
  if (editing) {
    return (
      <input
        type="text"
        value={text}
        autoFocus
        onChange={e => setText(e.target.value)}
        onBlur={() => { onSave(text); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(text); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-full bg-amber-50/60 border border-amber-500/40 text-xs text-slate-800 px-1.5 py-0.5 rounded focus:outline-none"
      />
    )
  }
  return (
    <button
      onClick={() => { setText(value ?? ''); setEditing(true) }}
      className="w-full text-left text-xs text-slate-700 hover:text-[var(--brand-teal)] transition-colors truncate"
    >
      {value || <span className="text-slate-500">{placeholder ?? '—'}</span>}
    </button>
  )
}

/* ── Category Section ───────────────────────────────── */
function CategorySection({
  category, refs, onUpdate, onDelete,
}: {
  category: string
  refs: PriceRef[]
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const avgMid = refs.length === 0 ? 0
    : refs.reduce((s, r) => s + (r.priceLow + r.priceHigh) / 2, 0) / refs.length

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/70 rounded-xl border border-slate-200/40 hover:border-slate-200/60 transition-all"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${catColor(category)}`}>{category}</span>
        <span className="text-xs text-slate-500 flex-1 text-left">{refs.length} {refs.length === 1 ? 'ítem' : 'ítems'}</span>
        {avgMid > 0 && (
          <span className="text-xs font-mono text-slate-400">avg mid {formatUSD(avgMid)}</span>
        )}
      </button>

      {open && (
        <div className="mt-0.5 border border-slate-200/30 border-t-0 rounded-b-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/30">
                <th className="px-4 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider">Descripción</th>
                <th className="px-3 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-14">Cód.</th>
                <th className="px-3 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-16">Unidad</th>
                <th className="px-3 py-1.5 text-right text-[9px] text-slate-400 uppercase tracking-wider w-24">Precio Bajo</th>
                <th className="px-3 py-1.5 text-right text-[9px] text-slate-400 uppercase tracking-wider w-24">Precio Alto</th>
                <th className="px-3 py-1.5 text-right text-[9px] text-[#3E6B85]/60 uppercase tracking-wider w-24">Promedio</th>
                <th className="px-3 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-32">Fuente</th>
                <th className="px-3 py-1.5 text-left text-[9px] text-slate-400 uppercase tracking-wider w-24">Región</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {refs.map(ref => {
                const mid = (ref.priceLow + ref.priceHigh) / 2
                return (
                  <tr key={ref.id} className="border-b border-slate-200/20 hover:bg-white/40 transition-colors group">
                    <td className="px-4 py-2">
                      <Txt value={ref.description} onSave={v => onUpdate(ref.id, { description: v })} placeholder="Descripción" />
                    </td>
                    <td className="px-3 py-2">
                      <Txt value={ref.code} onSave={v => onUpdate(ref.id, { code: v })} placeholder="Cód." />
                    </td>
                    <td className="px-3 py-2">
                      <Txt value={ref.unit} onSave={v => onUpdate(ref.id, { unit: v })} placeholder="LS" />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={ref.priceLow} onSave={v => onUpdate(ref.id, { priceLow: v })} />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={ref.priceHigh} onSave={v => onUpdate(ref.id, { priceHigh: v })} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`text-xs font-mono ${mid > 0 ? 'text-[#3E6B85]/80' : 'text-slate-500'}`}>
                        {mid > 0 ? formatUSD(mid) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Txt value={ref.source} onSave={v => onUpdate(ref.id, { source: v })} placeholder="Fuente" />
                    </td>
                    <td className="px-3 py-2">
                      <Txt value={ref.region} onSave={v => onUpdate(ref.id, { region: v })} placeholder="Región" />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => onDelete(ref.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Add Form ───────────────────────────────────────── */
function AddPriceForm({ onSave, onClose }: { onSave: (data: Record<string, unknown>) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    description: '',
    code: '',
    unit: 'LS',
    priceLow: '',
    priceHigh: '',
    source: '',
    region: 'SC Upstate',
    notes: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="bg-white/60 border border-amber-500/20 rounded-2xl p-5 mb-4">
      <div className="text-sm font-semibold text-slate-800 mb-4">Nuevo precio de referencia</div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Categoría</label>
          <select
            value={form.category}
            onChange={e => set('category', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#3E6B85]/60"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Descripción *</label>
          <input
            type="text"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Ej: Framing 2x6 walls"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#3E6B85]/60 placeholder-slate-400"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Código (opcional)</label>
          <input type="text" value={form.code} onChange={e => set('code', e.target.value)}
            placeholder="03.01"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#3E6B85]/60 placeholder-slate-400" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Unidad</label>
          <input type="text" value={form.unit} onChange={e => set('unit', e.target.value)}
            placeholder="SF / LF / EA / LS"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#3E6B85]/60 placeholder-slate-400" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Precio Bajo</label>
          <input type="number" value={form.priceLow} onChange={e => set('priceLow', e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#3E6B85]/60 font-mono placeholder-slate-400" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Precio Alto</label>
          <input type="number" value={form.priceHigh} onChange={e => set('priceHigh', e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#3E6B85]/60 font-mono placeholder-slate-400" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Fuente</label>
          <input type="text" value={form.source} onChange={e => set('source', e.target.value)}
            placeholder="Contratista ABC / RS Means 2024"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#3E6B85]/60 placeholder-slate-400" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Región</label>
          <input type="text" value={form.region} onChange={e => set('region', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#3E6B85]/60" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => {
            if (!form.description.trim()) return
            onSave({
              ...form,
              priceLow: parseFloat(form.priceLow) || 0,
              priceHigh: parseFloat(form.priceHigh) || 0,
            })
            onClose()
          }}
          className="px-4 py-1.5 bg-[var(--brand-gold)] hover:bg-[#55809B] text-white text-xs font-medium rounded-lg transition-colors"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

/* ── Main ───────────────────────────────────────────── */
export default function PriceReference() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [view, setView] = useState<'auto' | 'manual'>('auto')

  const { data: refs = [], isLoading } = useQuery<PriceRef[]>({
    queryKey: ['price-refs'],
    queryFn: priceRefsApi.list,
  })

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => priceRefsApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-refs'] }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => priceRefsApi.patch(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-refs'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => priceRefsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-refs'] }),
  })

  const filtered = useMemo(() => {
    return refs.filter(r => {
      if (filterCat !== 'ALL' && r.category !== filterCat) return false
      if (search) {
        const q = search.toLowerCase()
        return r.description.toLowerCase().includes(q)
          || r.category.toLowerCase().includes(q)
          || (r.code ?? '').toLowerCase().includes(q)
          || (r.source ?? '').toLowerCase().includes(q)
      }
      return true
    })
  }, [refs, search, filterCat])

  const byCategory = useMemo(() => {
    const map = new Map<string, PriceRef[]>()
    filtered.forEach(r => {
      if (!map.has(r.category)) map.set(r.category, [])
      map.get(r.category)!.push(r)
    })
    return map
  }, [filtered])

  const categories = useMemo(() => [...new Set(refs.map(r => r.category))].sort(), [refs])

  const stats = useMemo(() => {
    const withPrices = refs.filter(r => r.priceLow > 0 || r.priceHigh > 0)
    return { total: refs.length, cats: categories.length, withPrices: withPrices.length }
  }, [refs, categories])

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando precios...</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Tag className="w-5 h-5 text-[var(--brand-gold)]" />
            <h1 className="text-xl font-bold text-slate-900">Precios de Referencia</h1>
          </div>
          <p className="text-xs text-slate-400">Promedios automáticos de tus presupuestos y ejecución (general al módulo técnico), más un catálogo manual opcional.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
            <button onClick={() => setView('auto')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'auto' ? 'bg-[var(--brand-gold)] text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              <Sparkles className="w-3.5 h-3.5" />Automáticos
            </button>
            <button onClick={() => setView('manual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'manual' ? 'bg-[var(--brand-teal)] text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              <Tag className="w-3.5 h-3.5" />Catálogo manual
            </button>
          </div>
          {view === 'manual' && (
            <button
              onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-gold)] hover:bg-[#55809B] text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar precio
            </button>
          )}
        </div>
      </div>

      {view === 'auto' && (
        <div className="section-card p-3 flex items-start gap-2" style={{ background: 'rgba(62,107,133,0.05)' }}>
          <Calculator className="w-4 h-4 text-[var(--brand-gold)] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600">Calculado en vivo desde tus presupuestos y ejecución de todos los proyectos: costo promedio por actividad y precio por unidad ($/pie², $/yarda³, $/lineal...) donde hayas cargado la cantidad. Se actualiza solo.</p>
        </div>
      )}
      {view === 'auto' && <ComputedSection />}

      {view === 'manual' && (<>
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total referencias</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{stats.total}</div>
        </div>
        <div className="kpi-card kpi-card-green">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Categorías</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{stats.cats}</div>
        </div>
        <div className="kpi-card kpi-card-amber">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Con precio</div>
          <div className="text-2xl font-bold font-mono text-[var(--brand-gold)]">{stats.withPrices}</div>
          <div className="text-xs text-slate-400 mt-1">{stats.total > 0 ? Math.round(stats.withPrices / stats.total * 100) : 0}% del catálogo</div>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddPriceForm
          onSave={data => createMut.mutate(data)}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por descripción, categoría, fuente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 text-xs text-slate-800 rounded-xl focus:outline-none focus:border-[#3E6B85]/60 placeholder-slate-400"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCat('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${filterCat === 'ALL' ? 'bg-[#3E6B85]/10 text-[var(--brand-teal)] border border-amber-500/40' : 'text-slate-500 hover:text-slate-800 bg-white/50'}`}
          >
            Todas
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(filterCat === c ? 'ALL' : c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${filterCat === c ? 'bg-[#3E6B85]/10 text-[var(--brand-teal)] border border-amber-500/40' : 'text-slate-500 hover:text-slate-800 bg-white/50'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {byCategory.size === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay precios de referencia todavía.</p>
          <p className="text-xs mt-1">Agrega cotizaciones, valores de mercado o referencias de RS Means.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 px-4 py-2 bg-[#3E6B85]/10 text-[var(--brand-gold)] border border-amber-500/30 rounded-xl text-sm hover:bg-blue-600/30 transition-colors"
          >
            + Agregar primer precio
          </button>
        </div>
      ) : (
        <div>
          {[...byCategory.entries()].map(([cat, catRefs]) => (
            <CategorySection
              key={cat}
              category={cat}
              refs={catRefs}
              onUpdate={(id, data) => updateMut.mutate({ id, data })}
              onDelete={id => deleteMut.mutate(id)}
            />
          ))}
        </div>
      )}
      </>)}
    </div>
  )
}
