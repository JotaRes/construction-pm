import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gantt, ViewMode, type Task } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'
import { phasesApi, type PhaseSummary } from '../lib/api'
import { GanttChart } from 'lucide-react'

export default function GanttView({ projectId }: { projectId: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week)

  const { data: phases = [], isLoading } = useQuery<PhaseSummary[]>({
    queryKey: ['phases-summary', projectId],
    queryFn: () => phasesApi.summary(projectId),
  })

  const tasks = useMemo<Task[]>(() => {
    const today = new Date()
    return phases
      .filter(p => p.startDateReal || p.endDateReal)
      .map(p => {
        const start = p.startDateReal ? new Date(p.startDateReal) : today
        let end = p.endDateReal ? new Date(p.endDateReal) : today
        // gantt-task-react requiere end > start; si coinciden, sumamos 1 día.
        if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 86400000)
        return {
          id: p.id,
          name: `${p.code} — ${p.name}`,
          start,
          end,
          progress: p.progressPct,
          type: 'task' as const,
          isDisabled: true,
          styles: {
            progressColor: p.variancePct > 10 ? '#ef4444' : p.status === 'COMPLETA' ? '#22c55e' : '#0071E3',
            progressSelectedColor: '#1D1D1F',
            backgroundColor: '#cbd5e1',
            backgroundSelectedColor: '#94a3b8',
          },
        }
      })
  }, [phases])

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando cronograma...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><GanttChart className="w-[22px] h-[22px]" strokeWidth={2.2} /></span><span>Cronograma Gantt</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">Secuencia de fases en el tiempo según fechas reales</p>
        </div>
        <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
          {(['Day', 'Week', 'Month'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(ViewMode[v])}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${viewMode === ViewMode[v] ? 'bg-[var(--brand-teal)] text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              {{ Day: 'Día', Week: 'Semana', Month: 'Mes' }[v]}
            </button>
          ))}
        </div>
      </div>

      {tasks.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-2 overflow-x-auto">
          <Gantt
            tasks={tasks}
            viewMode={viewMode}
            locale="es-ES"
            listCellWidth="220px"
            columnWidth={viewMode === ViewMode.Month ? 200 : viewMode === ViewMode.Week ? 70 : 50}
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl text-center py-16">
          <GanttChart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-slate-400 text-sm">
            Aún no hay fechas reales (inicio/fin) registradas en las fases.
          </div>
          <div className="text-slate-400 text-xs mt-1">
            Registra fechas en los ítems de Ejecución para ver el cronograma.
          </div>
        </div>
      )}
    </div>
  )
}
