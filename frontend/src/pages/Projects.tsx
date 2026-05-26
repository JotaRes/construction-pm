import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, MapPin, DollarSign, TrendingUp, ChevronRight, X, Trash2, Upload, FileText, CheckCircle, RefreshCw } from 'lucide-react'
import { projectsApi, projectsDeleteApi } from '../lib/api'
import { useProjectStore } from '../store/projectStore'
import { formatUSD } from '../lib/calculations'
import type { Project, Draw } from '../lib/types'

type ProjectListItem = Pick<Project, 'id' | 'name' | 'spv' | 'address' | 'arv' | 'constructionBudget' | 'holdback'> & {
  draws: Draw[]
}

const REQUIRED_FIELDS = [
  { key: 'name', label: 'Nombre del proyecto', placeholder: 'Lote 88 — Highland Rd', required: true },
  { key: 'spv', label: 'SPV (LLC)', placeholder: 'Highland 88 LLC', required: true },
  { key: 'address', label: 'Dirección', placeholder: '123 N Highland Rd, Westminster SC', required: true },
  { key: 'county', label: 'Condado', placeholder: 'Oconee County', required: false },
  { key: 'gcName', label: 'Contratista General', placeholder: 'Nombre del GC', required: false },
  { key: 'permitNumber', label: 'Número de permiso', placeholder: 'BR26-XXXXXX', required: false },
]

const FINANCIAL_FIELDS = [
  { key: 'arv', label: 'ARV (Valor estimado post-remodelación)', type: 'number', placeholder: '0' },
  { key: 'loanAmount', label: 'Loan Amount', type: 'number', placeholder: '0' },
  { key: 'holdback', label: 'Holdback disponible', type: 'number', placeholder: '0' },
  { key: 'constructionBudget', label: 'Construction Budget', type: 'number', placeholder: '0' },
  { key: 'sfHeated', label: 'SF Heated (área vivible)', type: 'number', placeholder: '0' },
]

const DATE_FIELDS = [
  { key: 'startDate', label: 'Fecha inicio obra' },
  { key: 'targetCompletionDate', label: 'Fecha objetivo CO' },
]

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [hudParsing, setHudParsing] = useState(false)
  const [hudFileName, setHudFileName] = useState<string | null>(null)
  const [hudError, setHudError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.create(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onCreated(project.id)
    },
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleHudUpload = async (file: File) => {
    setHudParsing(true)
    setHudError(null)
    setHudFileName(file.name)
    try {
      const parsed = await projectsApi.parseHud(file)
      const updates: Record<string, string> = {}
      if (parsed.address) updates.address = String(parsed.address)
      if (parsed.county) updates.county = String(parsed.county)
      if (parsed.loanAmount) updates.loanAmount = String(parsed.loanAmount)
      if (parsed.holdback) updates.holdback = String(parsed.holdback)
      if (parsed.cashAtSettlement) updates.cashAtSettlement = String(parsed.cashAtSettlement)
      if (parsed.contractSalesPrice) updates.contractSalesPrice = String(parsed.contractSalesPrice)
      setForm(f => ({ ...f, ...updates }))
    } catch {
      setHudError('No se pudo leer el HUD. Revisa el formato e intenta de nuevo.')
    } finally {
      setHudParsing(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {}
    const numKeys = ['arv', 'loanAmount', 'holdback', 'constructionBudget', 'sfHeated', 'sfGarage', 'sfPorches', 'cashAtSettlement', 'contractSalesPrice']
    for (const [k, v] of Object.entries(form)) {
      if (v === '') continue
      payload[k] = numKeys.includes(k) ? parseFloat(v) || 0 : v
    }
    mutation.mutate(payload)
  }

  const inputCls = "w-full bg-white border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A] placeholder-slate-400"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Nuevo Proyecto</h2>
            <p className="text-xs text-slate-400 mt-0.5">Se crean 20 fases · 204 ítems · 8 draws · 16 inspecciones</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* ── PASO 1: HUD del lote ── */}
          <div className="rounded-xl border-2 border-dashed border-[#C8922A]/40 bg-[#C8922A]/5 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#C8922A]/15 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#C8922A]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-700 mb-0.5">
                  Paso 1 — HUD del lote <span className="text-slate-400 font-normal">(opcional pero recomendado)</span>
                </div>
                <div className="text-[11px] text-slate-500 mb-2">
                  Sube el HUD de cierre para auto-completar dirección, condado y datos financieros. Todos los campos quedan editables.
                </div>

                {hudFileName ? (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-emerald-700 font-medium truncate">{hudFileName}</span>
                    <button
                      type="button"
                      onClick={() => { setHudFileName(null); setHudError(null); if (fileRef.current) fileRef.current.value = '' }}
                      className="text-slate-400 hover:text-red-500 ml-auto flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={hudParsing}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#C8922A] hover:bg-[#E0AD4F] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {hudParsing
                      ? <><RefreshCw className="w-3 h-3 animate-spin" />Leyendo HUD…</>
                      : <><Upload className="w-3 h-3" />Subir HUD del lote</>}
                  </button>
                )}

                {hudError && (
                  <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                    {hudError}
                  </div>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleHudUpload(f) }}
            />
          </div>

          {/* ── PASO 2: Datos básicos ── */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Paso 2 — Información básica
            </div>
            <div className="space-y-3">
              {REQUIRED_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-500 mb-1">
                    {f.label} {f.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={form[f.key] ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    required={f.required}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Financiero ── */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Datos financieros</div>
            <div className="grid grid-cols-2 gap-3">
              {FINANCIAL_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                  <input
                    type="number"
                    placeholder={f.placeholder}
                    value={form[f.key] ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Fechas ── */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Cronograma</div>
            <div className="grid grid-cols-2 gap-3">
              {DATE_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                  <input
                    type="date"
                    value={form[f.key] ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          {mutation.isError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg">
              Error al crear: {String(mutation.error)}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || hudParsing}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#C8922A] hover:bg-[#E0AD4F] text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Creando...' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProjectCard({ project, isActive, onSelect, onDelete }: {
  project: ProjectListItem
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const totalDrawn = project.draws.filter(d => d.estado === 'WIRED').reduce((s, d) => s + d.netWire, 0)
  const drawPct = project.holdback > 0 ? (totalDrawn / project.holdback) * 100 : 0

  return (
    <div className={`relative bg-white rounded-xl border transition-all group
      ${isActive ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-slate-200 hover:border-slate-200'}`}>
      {/* Delete button — top right, visible on hover */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 z-10"
        title="Eliminar proyecto"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <button onClick={onSelect} className="w-full text-left p-5">
        <div className="flex items-start justify-between mb-4 pr-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isActive && <span className="text-[9px] font-bold tracking-wider text-[#C8922A] bg-[#C8922A]/15 px-2 py-0.5 rounded-full">ACTIVO</span>}
              <h3 className="text-sm font-bold text-slate-900">{project.name}</h3>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">{project.spv}</div>
            <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{project.address}</span>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:text-[#C8922A] transition-colors flex-shrink-0 ${isActive ? 'text-[#C8922A]' : ''}`} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-slate-400">ARV</span>
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800">{formatUSD(project.arv)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3 h-3 text-[#C8922A]" />
              <span className="text-[10px] text-slate-400">Budget</span>
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800">{formatUSD(project.constructionBudget)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 mb-1">Draws</div>
            <div className="text-sm font-mono font-semibold text-slate-800">{drawPct.toFixed(0)}%</div>
            <div className="mt-1.5 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(drawPct, 100)}%` }} />
            </div>
          </div>
        </div>
      </button>
    </div>
  )
}

function ConfirmDeleteModal({ projectName, onConfirm, onCancel, isPending }: {
  projectName: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Eliminar proyecto</div>
            <div className="text-xs text-slate-400 mt-0.5">Esta acción no se puede deshacer</div>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Se eliminará <span className="text-slate-800 font-semibold">"{projectName}"</span> junto con todas
          sus fases, ítems, draws, inspecciones y tareas.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:text-slate-800 hover:border-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isPending ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const [showModal, setShowModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null)
  const { activeProjectId, setActiveProjectId } = useProjectStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading } = useQuery<ProjectListItem[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsDeleteApi.delete(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setDeleteTarget(null)
      if (activeProjectId === deletedId) {
        const remaining = projects.filter(p => p.id !== deletedId)
        if (remaining.length > 0) setActiveProjectId(remaining[0].id)
        else setActiveProjectId('')
      }
    },
  })

  const handleSelect = (id: string) => {
    setActiveProjectId(id)
    navigate('/tech/dashboard')
  }

  const handleCreated = (id: string) => {
    setShowModal(false)
    setActiveProjectId(id)
    navigate('/tech/dashboard')
  }

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando proyectos...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Proyectos</h1>
          <p className="text-sm text-slate-500 mt-0.5">{projects.length} proyecto{projects.length !== 1 ? 's' : ''} · Restrepo Acosta Global Holding LLC</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#C8922A] hover:bg-[#E0AD4F] text-sm font-semibold text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          <Building2 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          No hay proyectos. Crea uno para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              isActive={p.id === activeProjectId}
              onSelect={() => handleSelect(p.id)}
              onDelete={() => setDeleteTarget(p)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewProjectModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          projectName={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
