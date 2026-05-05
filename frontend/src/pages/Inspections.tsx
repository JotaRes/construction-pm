import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inspectionsApi } from '../lib/api'
import type { Inspection, InspectionEstado } from '../lib/types'

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
          <h1 className="text-xl font-bold text-slate-900">Tracker de Inspecciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Permit BR26-000029 · Inspector Oconee: (864) 718-1005
            · <span className="text-emerald-400">{aprobadas} aprobadas</span>
            {rechazadas > 0 && <span className="text-red-400"> · {rechazadas} rechazadas</span>}
          </p>
        </div>
      </div>

      <div className="bg-[#C8922A]/10 border border-amber-500/30 rounded-lg px-4 py-3 text-xs text-[#2D4B52]">
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
                  <span className="text-xs font-mono text-[#C8922A]">{ins.wbs}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-slate-800">{ins.tipo}</div>
                  {ins.prerrequisitos && (
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed max-w-md">
                      {ins.prerrequisitos}
                    </div>
                  )}
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
