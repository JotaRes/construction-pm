import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../lib/api'
import type { Task, TaskPriority } from '../lib/types'
import { Plus, Trash2, CheckSquare, Square, ChevronDown, Calendar, Flag } from 'lucide-react'

const PRIORITIES: { value: TaskPriority; label: string; color: string; dot: string }[] = [
  { value: 'LOW',    label: 'Baja',    color: 'text-slate-400',  dot: 'bg-slate-300' },
  { value: 'NORMAL', label: 'Normal',  color: 'text-[#C8922A]',   dot: 'bg-[#2D4B52]' },
  { value: 'HIGH',   label: 'Alta',    color: 'text-[#C8922A]',  dot: 'bg-[#2D4B52]' },
  { value: 'URGENT', label: 'Urgente', color: 'text-red-400',    dot: 'bg-red-500' },
]

function priorityInfo(p: TaskPriority) {
  return PRIORITIES.find(x => x.value === p) ?? PRIORITIES[1]
}

function TaskRow({ task, onUpdate, onDelete }: {
  task: Task
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [titleText, setTitleText] = useState(task.title)
  const [notesText, setNotesText] = useState(task.notes ?? '')
  const pri = priorityInfo(task.priority)

  return (
    <div className={`border-b border-slate-200/60 transition-colors ${task.done ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3 group hover:bg-white/30">
        {/* Checkbox */}
        <button
          onClick={() => onUpdate(task.id, { done: !task.done })}
          className="text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
        >
          {task.done
            ? <CheckSquare className="w-4 h-4 text-emerald-400" />
            : <Square className="w-4 h-4" />}
        </button>

        {/* Priority dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pri.dot}`} title={pri.label} />

        {/* Title */}
        <div className="flex-1 min-w-0">
          {editTitle ? (
            <input
              type="text"
              value={titleText}
              onChange={e => setTitleText(e.target.value)}
              onBlur={() => { onUpdate(task.id, { title: titleText }); setEditTitle(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { onUpdate(task.id, { title: titleText }); setEditTitle(false) }
                if (e.key === 'Escape') setEditTitle(false)
              }}
              className="w-full bg-slate-200 text-sm text-slate-800 px-2 py-0.5 rounded border border-blue-500 focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditTitle(true)}
              className={`text-sm text-left w-full ${task.done ? 'line-through text-slate-400' : 'text-slate-800 hover:text-slate-900'}`}
            >
              {task.title}
            </button>
          )}
          {task.dueDate && (
            <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${
              !task.done && new Date(task.dueDate) < new Date() ? 'text-red-400' : 'text-slate-400'
            }`}>
              <Calendar className="w-2.5 h-2.5" />
              {new Date(task.dueDate).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* Actions (visible on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {/* Priority selector */}
          <select
            value={task.priority}
            onChange={e => onUpdate(task.id, { priority: e.target.value })}
            className="bg-transparent text-[10px] border-0 focus:ring-0 cursor-pointer text-slate-400 hover:text-slate-700"
          >
            {PRIORITIES.map(p => <option key={p.value} value={p.value} className="bg-white">{p.label}</option>)}
          </select>

          <button
            onClick={() => setExpanded(e => !e)}
            className="text-slate-400 hover:text-slate-500 transition-colors p-1"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={() => onDelete(task.id)}
            className="text-slate-500 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-12 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Prioridad</div>
              <select
                value={task.priority}
                onChange={e => onUpdate(task.id, { priority: e.target.value })}
                className="bg-white border border-slate-200 text-xs text-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 w-full"
              >
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Fecha límite</div>
              <input
                type="date"
                defaultValue={task.dueDate?.slice(0, 10) ?? ''}
                onChange={e => onUpdate(task.id, { dueDate: e.target.value || null })}
                className="bg-white border border-slate-200 text-xs text-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 w-full"
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 mb-1">Notas</div>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              onBlur={() => onUpdate(task.id, { notes: notesText })}
              placeholder="Detalles adicionales..."
              rows={2}
              className="w-full bg-white border border-slate-200 text-xs text-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 resize-none placeholder-slate-600"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Tasks({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [newTitle, setNewTitle] = useState('')
  const [filterDone, setFilterDone] = useState<'all' | 'pending' | 'done'>('all')

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.list(projectId),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      setNewTitle('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      tasksApi.patch(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(projectId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    createMutation.mutate({ title: newTitle.trim() })
  }

  const handleUpdate = (id: string, data: Record<string, unknown>) => updateMutation.mutate({ id, data })
  const handleDelete = (id: string) => deleteMutation.mutate(id)

  const filtered = tasks.filter(t => {
    if (filterDone === 'pending') return !t.done
    if (filterDone === 'done') return t.done
    return true
  })

  const pendingCount = tasks.filter(t => !t.done).length
  const urgentCount = tasks.filter(t => !t.done && t.priority === 'URGENT').length
  const overdueCount = tasks.filter(t => !t.done && t.dueDate && new Date(t.dueDate) < new Date()).length

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando tareas...</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tareas Pendientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pendingCount} pendientes
            {urgentCount > 0 && <span className="text-red-400"> · {urgentCount} urgentes</span>}
            {overdueCount > 0 && <span className="text-red-400"> · {overdueCount} vencidas</span>}
          </p>
        </div>
        <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
          {([['all', 'Todas'], ['pending', 'Pendientes'], ['done', 'Completadas']] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterDone(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${filterDone === v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        {PRIORITIES.map(p => {
          const count = tasks.filter(t => !t.done && t.priority === p.value).length
          return (
            <div key={p.value} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${p.dot}`} />
              <div>
                <div className="text-xs text-slate-400">{p.label}</div>
                <div className={`text-lg font-bold font-mono ${count > 0 ? p.color : 'text-slate-500'}`}>{count}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add task form */}
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Nueva tarea... (Enter para agregar)"
          className="flex-1 bg-white border border-slate-200 text-sm text-slate-800 px-4 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 placeholder-slate-600"
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || createMutation.isPending}
          className="px-4 py-2.5 bg-[#C8922A] hover:bg-[#E0AD4F] text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </form>

      {/* Task list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Flag className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <div className="text-slate-400 text-sm">
              {filterDone === 'done' ? 'Ninguna tarea completada aún' :
               filterDone === 'pending' ? 'Sin tareas pendientes' :
               'Sin tareas. Agrega una arriba.'}
            </div>
          </div>
        ) : (
          filtered.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
