import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inspectionsApi } from '../lib/api'
import type { Inspection, InspectionEstado } from '../lib/types'
import { CheckCircle2, AlertTriangle, Plus, X, ClipboardCheck } from 'lucide-react'

// ── T2: checklist de prerequisitos por inspección ──────────────
// Regla de obra: NO llamar inspección sin checklist cerrado. Una reprobación
// cuesta $50-100 y bloquea la secuencia 3-7 días hábiles.
type Prereq = { label: string; done: boolean }

function parsePrereqs(ins: Inspection): Prereq[] {
  if (ins.prereqs) {
    try { const p = JSON.parse(ins.prereqs); if (Array.isArray(p)) return p } catch { /* seed abajo */ }
  }
  // Semilla desde el texto libre legacy (separado por comas / puntos medios)
  if (ins.prerrequisitos) {
    return ins.prerrequisitos.split(/[,·;]+/).map(x => x.trim()).filter(Boolean)
      .map(label => ({ label, done: false }))
  }
  return []
}

function PrereqChecklist({ ins, onSave }: { ins: Inspection; onSave: (json: string) => void }) {
  const [items, setItems] = useState<Prereq[]>(() => parsePrereqs(ins))
  const [newLabel, setNewLabel] = useState('')
  const persist = (next: Prereq[]) => { setItems(next); onSave(JSON.stringify(next)) }
  const doneCount = items.filter(i => i.done).length
  const ready = items.length > 0 && doneCount === items.length

  return (
    <div className="mt-1.5 space-y-1 max-w-md">
      {items.length > 0 && (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          ready ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
          {ready ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {ready ? 'LISTA para llamar' : `${items.length - doneCount} prerequisito(s) pendiente(s)`}
        </span>
      )}
      {items.map((p, idx) => (
        <label key={idx} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer group">
          <input type="checkbox" checked={p.done}
            onChange={() => persist(items.map((x, i) => i === idx ? { ...x, done: !x.done } : x))}
            className="accent-[var(--brand-gold)]" />
          <span className={p.done ? 'line-through text-slate-400' : ''}>{p.label}</span>
          <button onClick={e => { e.preventDefault(); persist(items.filter((_, i) => i !== idx)) }}
            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400"><X className="w-3 h-3" /></button>
        </label>
      ))}
      <form onSubmit={e => { e.preventDefault(); const v = newLabel.trim(); if (v) { persist([...items, { label: v, done: false }]); setNewLabel('') } }}
        className="flex items-center gap-1.5">
        <Plus className="w-3 h-3 text-slate-400" />
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Agregar prerequisito…"
          className="flex-1 bg-transparent text-[11px] text-slate-500 focus:outline-none border-b border-transparent focus:border-[var(--brand-gold)] py-0.5" />
      </form>
    </div>
  )
}

const ESTADOS: InspectionEstado[] = ['PENDIENTE', 'PROGRAMADA', 'APROBADA', 'RECHAZADA']

export default function Inspections({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()

  const { data: inspections = [], isLoading } = useQuery<Inspection[]>({
    queryKey: ['inspections', projectId],
    queryFn: () => inspectionsApi.list(projectId),
  })

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      inspectionsApi.patch(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspections', projectId] }),
  })

  const aprobadas = inspections.filter(i => i.estado === 'APROBADA').length
  const rechazadas = inspections.filter(i => i.estado === 'RECHAZADA').length

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando inspecciones...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><ClipboardCheck className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>Tracker de Inspecciones</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Permit BR26-000029 · Inspector Oconee: (864) 718-1005
            · <span className="text-emerald-400">{aprobadas} aprobadas</span>
            {rechazadas > 0 && <span className="text-red-400"> · {rechazadas} rechazadas</span>}
          </p>
        </div>
      </div>

      <div className="bg-[#3E5A70]/10 border border-amber-500/30 rounded-lg px-4 py-3 text-xs text-[var(--brand-teal)]">
        ⚠️ Re-inspección cuesta $50–100 y retrasa la obra mínimo 3–7 días hábiles. No llamar inspección sin estar 100% listos.
        Regla: No se avanza sin inspección aprobada de fase anterior.
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-16">WBS</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase">Tipo Inspección</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-32">Fase</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-32">F. Solicitada</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-32">F. Realizada</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-28">Resultado</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-32">Estado</th>
            </tr>
          </thead>
          <tbody>
            {inspections.map(ins => (
              <tr key={ins.id} className="table-row-base">
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-[var(--brand-gold)]">{ins.wbs}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-slate-800">{ins.tipo}</div>
                  <PrereqChecklist key={ins.id + (ins.prereqs ?? '')} ins={ins}
                    onSave={json => mutation.mutate({ id: ins.id, data: { prereqs: json } })} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500">{ins.fase}</span>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="date"
                    defaultValue={ins.fechaSolicitada?.slice(0, 10) ?? ''}
                    onChange={e => mutation.mutate({ id: ins.id, data: { fechaSolicitada: e.target.value || null } })}
                    className="bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-200 text-xs w-32"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="date"
                    defaultValue={ins.fechaRealizada?.slice(0, 10) ?? ''}
                    onChange={e => mutation.mutate({ id: ins.id, data: { fechaRealizada: e.target.value || null } })}
                    className="bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-200 text-xs w-32"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={ins.resultado ?? ''}
                    onChange={e => mutation.mutate({ id: ins.id, data: { resultado: e.target.value || null } })}
                    className="bg-slate-200 text-slate-700 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none w-28"
                  >
                    <option value="">—</option>
                    <option value="PASS">✅ PASS</option>
                    <option value="FAIL">❌ FAIL</option>
                    <option value="RE-INSPECCION">🔄 RE-INSP</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={ins.estado}
                    onChange={e => mutation.mutate({ id: ins.id, data: { estado: e.target.value } })}
                    className="bg-transparent text-xs border-0 focus:ring-0 cursor-pointer"
                    style={{
                      color: ins.estado === 'APROBADA' ? '#34d399'
                        : ins.estado === 'RECHAZADA' ? '#f87171'
                        : ins.estado === 'PROGRAMADA' ? '#fbbf24'
                        : '#94a3b8'
                    }}
                  >
                    {ESTADOS.map(s => <option key={s} value={s} className="bg-white text-slate-800">{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
