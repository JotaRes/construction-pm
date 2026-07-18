import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../lib/api'
import type { Task, TaskPriority } from '../lib/types'
import { Plus, Trash2, CheckSquare, Square, ChevronDown, Calendar, Flag, User, AlertCircle, Mail, CheckCircle2, ListChecks } from 'lucide-react'
import { useConfirm } from '../components/ConfirmDialog'

const PRIORITIES: { value: TaskPriority; label: string; color: string; dot: string; bg: string }[] = [
  { value: 'LOW',    label: 'Baja',    color: 'text-slate-400',  dot: 'bg-slate-300',  bg: 'bg-slate-100' },
  { value: 'NORMAL', label: 'Normal',  color: 'text-[var(--brand-teal)]',  dot: 'bg-[var(--brand-teal)]', bg: 'bg-teal-50' },
  { value: 'HIGH',   label: 'Alta',    color: 'text-[var(--brand-gold)]',  dot: 'bg-[var(--brand-gold)]', bg: 'bg-amber-50' },
  { value: 'URGENT', label: 'Urgente', color: 'text-red-500',    dot: 'bg-red-500',   bg: 'bg-red-50' },
]

function priorityInfo(p: TaskPriority) {
  return PRIORITIES.find(x => x.value === p) ?? PRIORITIES[1]
}

function isOverdue(task: Task) {
  return !task.done && task.dueDate && new Date(task.dueDate) < new Date()
}

function TaskRow({ task, onUpdate, onDelete }: {
  task: Task
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [titleText, setTitleText] = useState(task.title)
  const [editTitle, setEditTitle] = useState(false)
  const [notesText, setNotesText] = useState(task.notes ?? '')
  const pri = priorityInfo(task.priority)
  const overdue = isOverdue(task)

  return (
    <div className={`border-b border-slate-100 last:border-0 transition-colors ${task.done ? 'opacity-50' : overdue ? 'bg-red-50/60' : ''}`}>
      <div className="flex items-start gap-3 px-4 py-3 group hover:bg-slate-50/60">
        {/* Checkbox */}
        <button onClick={() => onUpdate(task.id, { done: !task.done })}
          className="text-slate-300 hover:text-emerald-500 transition-colors flex-shrink-0 mt-0.5">
          {task.done ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
        </button>

        {/* Priority dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${pri.dot} ${task.priority === 'URGENT' && !task.done ? 'animate-pulse' : ''}`} />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start gap-2">
            {task.tipo === 'NOTA' && (
              <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-200 rounded px-1 py-0.5 flex-shrink-0 mt-0.5">Nota</span>
            )}
            <div className="flex-1 min-w-0">
              {editTitle ? (
                <input type="text" value={titleText}
                  onChange={e => setTitleText(e.target.value)}
                  onBlur={() => { onUpdate(task.id, { title: titleText }); setEditTitle(false) }}
                  onKeyDown={e => { if (e.key === 'Enter') { onUpdate(task.id, { title: titleText }); setEditTitle(false) } if (e.key === 'Escape') setEditTitle(false) }}
                  className="w-full bg-white text-sm text-slate-800 px-2 py-0.5 rounded border border-[var(--brand-gold)] focus:outline-none"
                  autoFocus />
              ) : (
                <button onClick={() => setEditTitle(true)}
                  className={`text-sm text-left w-full leading-snug ${task.done ? 'line-through text-slate-400' : 'text-slate-800 hover:text-slate-900'}`}>
                  {task.title}
                </button>
              )}
            </div>
            {overdue && <span title="Vencida"><AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" /></span>}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {task.responsable && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <User className="w-2.5 h-2.5" />{task.responsable}
              </span>
            )}
            {(task as any).responsableEmail && (
              <a href={`mailto:${(task as any).responsableEmail}`} className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                <Mail className="w-2.5 h-2.5" />{(task as any).responsableEmail}
              </a>
            )}
            {task.dueDate && (
              <span className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                <Calendar className="w-2.5 h-2.5" />
                {overdue ? 'VENCIDA · ' : ''}
                {new Date(task.dueDate).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
            {(task as any).completedAt && task.done && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Completada {new Date((task as any).completedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
              </span>
            )}
            {task.notes && <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{task.notes}</span>}
          </div>
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <select value={task.priority} onChange={e => onUpdate(task.id, { priority: e.target.value })}
            className="bg-transparent text-[10px] border-0 focus:ring-0 cursor-pointer text-slate-400">
            {PRIORITIES.map(p => <option key={p.value} value={p.value} className="bg-white">{p.label}</option>)}
          </select>
          <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-600 p-1">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => onDelete(task.id)} className="text-slate-400 hover:text-red-400 p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 ml-10 space-y-3 border-t border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] text-slate-400 uppercase mb-1 flex items-center gap-1"><User className="w-2.5 h-2.5" /> Responsable</div>
              <input type="text" defaultValue={task.responsable ?? ''}
                onBlur={e => onUpdate(task.id, { responsable: e.target.value || null })}
                placeholder="Nombre o cargo"
                className="w-full bg-white border border-slate-200 text-xs text-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase mb-1 flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> Email</div>
              <input type="email" defaultValue={(task as any).responsableEmail ?? ''}
                onBlur={e => onUpdate(task.id, { responsableEmail: e.target.value || null })}
                placeholder="email@ejemplo.com"
                className="w-full bg-white border border-slate-200 text-xs text-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase mb-1 flex items-center gap-1"><Flag className="w-2.5 h-2.5" /> Prioridad</div>
              <select value={task.priority} onChange={e => onUpdate(task.id, { priority: e.target.value })}
                className="w-full bg-white border border-slate-200 text-xs text-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase mb-1 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> Fecha límite</div>
              <input type="date" defaultValue={task.dueDate?.slice(0, 10) ?? ''}
                onChange={e => onUpdate(task.id, { dueDate: e.target.value || null })}
                className="w-full bg-white border border-slate-200 text-xs text-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase mb-1">Descripción / Notas</div>
            <textarea value={notesText} onChange={e => setNotesText(e.target.value)}
              onBlur={() => onUpdate(task.id, { notes: notesText || null })}
              placeholder="Detalles, instrucciones, contexto..." rows={3}
              className="w-full bg-white border border-slate-200 text-xs text-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none placeholder-slate-400" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Tasks({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [newTitle, setNewTitle] = useState('')
  const [newResponsable, setNewResponsable] = useState('')
  const [newResponsableEmail, setNewResponsableEmail] = useState('')
  const [newPriority, setNewPriority] = useState<TaskPriority>('NORMAL')
  const [newDueDate, setNewDueDate] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [showFullForm, setShowFullForm] = useState(false)
  const [filterDone, setFilterDone] = useState<'all' | 'pending' | 'done'>('all')
  const [filterTipo, setFilterTipo] = useState<'all' | 'TAREA' | 'NOTA'>('all')
  const [newTipo, setNewTipo] = useState<'TAREA' | 'NOTA'>('TAREA')

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.list(projectId),
  })

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      setNewTitle(''); setNewResponsable(''); setNewResponsableEmail(''); setNewDueDate(''); setNewPriority('NORMAL'); setNewNotes('')
      setShowFullForm(false)
    },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => tasksApi.patch(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => tasksApi.delete(projectId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({
      title: 'Eliminar tarea',
      message: `¿Seguro que quieres eliminar la tarea "${title}"?`,
      detail: 'Esta acción no se puede deshacer. Si la tarea ya está completada, considera mantenerla en el histórico.',
      destructive: true,
      confirmText: 'Sí, eliminar',
    })
    if (ok) deleteMut.mutate(id)
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    createMut.mutate({
      tipo: newTipo,
      title: newTitle.trim(),
      responsable: newResponsable || null,
      responsableEmail: newResponsableEmail || null,
      priority: newPriority,
      dueDate: newDueDate || null,
      notes: newNotes || null,
    })
  }

  const filtered = tasks.filter(t => {
    if (filterDone === 'pending') return !t.done
    if (filterDone === 'done') return t.done
    return true
  })

  // Filtro por tipo (Tareas / Notas) aplicado a las listas visibles.
  const visibleTasks = tasks.filter(t => filterTipo === 'all' || (t.tipo ?? 'TAREA') === filterTipo)

  const pendingCount = tasks.filter(t => !t.done).length
  const urgentCount  = tasks.filter(t => !t.done && t.priority === 'URGENT').length
  const overdueCount = tasks.filter(t => isOverdue(t)).length

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando tareas...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><ListChecks className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>Tareas y Notas</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pendingCount} pendientes
            {urgentCount > 0 && <span className="text-red-500 font-medium"> · {urgentCount} urgentes</span>}
            {overdueCount > 0 && <span className="text-red-500 font-medium"> · {overdueCount} vencidas</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
            {([['all','Todo'],['TAREA','Tareas'],['NOTA','Notas']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilterTipo(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${filterTipo === v ? 'bg-[var(--brand-gold)] text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
            {(['all','pending','done'] as const).map((v, i) => (
              <button key={v} onClick={() => setFilterDone(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${filterDone === v ? 'bg-[var(--brand-teal)] text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                {['Todas','Pendientes','Completadas'][i]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI row */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-600 font-medium">{overdueCount} tarea{overdueCount > 1 ? 's' : ''} vencida{overdueCount > 1 ? 's' : ''} — requiere atención inmediata</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PRIORITIES.map(p => {
          const count = tasks.filter(t => !t.done && t.priority === p.value).length
          return (
            <div key={p.value} className={`bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 ${count > 0 && p.value === 'URGENT' ? 'border-red-200 bg-red-50/40' : ''}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${p.dot} ${p.value === 'URGENT' && count > 0 ? 'animate-pulse' : ''}`} />
              <div>
                <div className="text-xs text-slate-400">{p.label}</div>
                <div className={`text-xl font-bold font-mono ${count > 0 ? p.color : 'text-slate-300'}`}>{count}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* === Create form profesional === */}
      <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5 w-fit">
          {([['TAREA','Tarea'],['NOTA','Nota']] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setNewTipo(v)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors
                ${newTipo === v ? 'bg-[var(--brand-gold)] text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              {l}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{newTipo === 'NOTA' ? 'Título de la nota' : 'Concepto (descripción de la tarea)'} *</label>
          <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder={newTipo === 'NOTA' ? 'Ej. Recordatorio: el HOA aprueba planos solo los martes...' : 'Ej. Llamar al inspector para coordinar visita...'}
            className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
        </div>
        <button
          type="button"
          onClick={() => setShowFullForm(s => !s)}
          className="text-xs text-[var(--brand-gold)] hover:underline font-semibold"
        >
          {showFullForm ? '▼ Ocultar campos avanzados' : '▶ Mostrar más campos (responsable, email, prioridad, fecha)'}
        </button>
        {showFullForm && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1"><User className="w-2.5 h-2.5 inline mr-1" />Responsable</label>
                <input type="text" value={newResponsable} onChange={e => setNewResponsable(e.target.value)}
                  placeholder="Nombre del responsable"
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1"><Mail className="w-2.5 h-2.5 inline mr-1" />Correo del responsable</label>
                <input type="email" value={newResponsableEmail} onChange={e => setNewResponsableEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1"><Flag className="w-2.5 h-2.5 inline mr-1" />Prioridad</label>
                <select value={newPriority} onChange={e => setNewPriority(e.target.value as TaskPriority)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1"><Calendar className="w-2.5 h-2.5 inline mr-1" />Fecha en que se debe realizar</label>
                <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Notas / detalles</label>
              <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)}
                rows={2}
                placeholder="Contexto, instrucciones, dependencias..."
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none" />
            </div>
          </div>
        )}
        <button type="submit" disabled={!newTitle.trim() || createMut.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-gold)] hover:bg-[#0077ED] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40">
          <Plus className="w-4 h-4" />Agregar {newTipo === 'NOTA' ? 'nota' : 'tarea'}
        </button>
      </form>

      {/* Task list separada: PENDIENTES + COMPLETADAS */}
      {(filterDone === 'all' || filterDone === 'pending') && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Square className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Pendientes</span>
            <span className="text-[10px] text-slate-400 font-mono">({visibleTasks.filter(t => !t.done).length})</span>
          </div>
          {visibleTasks.filter(t => !t.done).length === 0 ? (
            <div className="text-center py-8">
              <Flag className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <div className="text-slate-400 text-sm">Sin pendientes</div>
            </div>
          ) : (
            visibleTasks.filter(t => !t.done).map(task => (
              <TaskRow key={task.id} task={task}
                onUpdate={(id, data) => updateMut.mutate({ id, data })}
                onDelete={id => handleDelete(id, task.title)} />
            ))
          )}
        </div>
      )}

      {(filterDone === 'all' || filterDone === 'done') && visibleTasks.filter(t => t.done).length > 0 && (
        <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-emerald-100 bg-emerald-50 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Cumplidas (histórico)</span>
            <span className="text-[10px] text-emerald-600 font-mono">({visibleTasks.filter(t => t.done).length})</span>
          </div>
          {visibleTasks.filter(t => t.done).map(task => (
            <TaskRow key={task.id} task={task}
              onUpdate={(id, data) => updateMut.mutate({ id, data })}
              onDelete={id => handleDelete(id, task.title)} />
          ))}
        </div>
      )}

      {/* Si filterDone es algo específico, mantener mensaje de empty si no hay nada */}
      {filterDone === 'done' && visibleTasks.filter(t => t.done).length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 text-center py-12">
          <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-slate-400 text-sm">Ninguna completada todavía</div>
        </div>
      )}
      {filterDone === 'pending' && visibleTasks.filter(t => !t.done).length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 text-center py-12">
          <Flag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-slate-400 text-sm">Sin pendientes — ¡todo al día!</div>
        </div>
      )}

      {/* compat — antiguo filtered list (oculto pero TS compatible) */}
      <div className="hidden">
        {filtered.length}
      </div>
    </div>
  )
}
