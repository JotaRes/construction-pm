import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, MapPin, DollarSign, TrendingUp, ChevronRight, X, Trash2, Upload, FileText, CheckCircle, RefreshCw, Pencil, Camera, FolderKanban } from 'lucide-react'
import { projectsApi, projectsDeleteApi } from '../lib/api'
import { useProjectStore } from '../store/projectStore'
import { formatUSD } from '../lib/calculations'
import toast from 'react-hot-toast'
import type { Project, Draw } from '../lib/types'

type ProjectListItem = Pick<Project, 'id' | 'name' | 'spv' | 'address' | 'arv' | 'constructionBudget' | 'holdback' | 'photoUrl' | 'photoName'> & {
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

  const inputCls = "w-full bg-white border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400"

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
          <div className="rounded-xl border-2 border-dashed border-[#0071E3]/40 bg-[#0071E3]/5 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0071E3]/15 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[var(--brand-gold)]" />
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
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-gold)] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
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
              className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--brand-gold)] hover:bg-[#0077ED] text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Creando...' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Definición de los campos editables agrupados por sección. Cada campo
// declara su tipo de input para que el modal sepa cómo renderizar.
// Esto refleja exactamente el whitelist del backend.
type FieldDef = { key: string; label: string; type: 'text' | 'number' | 'date' | 'tel' | 'email'; placeholder?: string }

const EDIT_SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: 'Identidad',
    fields: [
      { key: 'name',     label: 'Nombre del proyecto', type: 'text', placeholder: 'Lote 88 — Highland Rd' },
      { key: 'spv',      label: 'SPV (LLC del proyecto)', type: 'text', placeholder: 'Highland 88 LLC' },
      { key: 'holding',  label: 'Holding (empresa matriz)', type: 'text', placeholder: 'Restrepo Acosta Global Holding LLC' },
      { key: 'address',  label: 'Dirección', type: 'text', placeholder: '123 N Highland Rd, Westminster SC' },
      { key: 'county',   label: 'Condado', type: 'text', placeholder: 'Oconee' },
      { key: 'hoa',      label: 'HOA', type: 'text', placeholder: 'Chickasaw Point' },
      { key: 'parcelId', label: 'Parcel ID', type: 'text', placeholder: '323-01-06-002' },
    ],
  },
  {
    title: 'Físico',
    fields: [
      { key: 'lotAcres',         label: 'Acres del lote', type: 'number', placeholder: '0' },
      { key: 'sfHeated',         label: 'SF Heated (área vivible)', type: 'number', placeholder: '2400' },
      { key: 'sfGarage',         label: 'SF Garage', type: 'number', placeholder: '0' },
      { key: 'sfPorches',        label: 'SF Porches', type: 'number', placeholder: '0' },
      { key: 'bedrooms',         label: 'Habitaciones', type: 'number', placeholder: '3' },
      { key: 'bathrooms',        label: 'Baños', type: 'text', placeholder: '2.5' },
      { key: 'foundationType',   label: 'Tipo de cimentación', type: 'text', placeholder: 'crawlspace / slab / basement' },
      { key: 'architecturalPlan',label: 'Plano arquitectónico', type: 'text', placeholder: '2400-5 CRAWLSPACE' },
    ],
  },
  {
    title: 'Permisos',
    fields: [
      { key: 'permitNumber',  label: 'Número de permiso', type: 'text', placeholder: 'BR26-XXXXXX' },
      { key: 'permitIssued',  label: 'Fecha emisión', type: 'date' },
      { key: 'permitExpires', label: 'Fecha vencimiento (180 días)', type: 'date' },
      { key: 'inspectorPhone',label: 'Teléfono inspector condado', type: 'tel' },
      { key: 'hoaPhone',      label: 'Teléfono HOA', type: 'tel' },
    ],
  },
  {
    title: 'General Contractor',
    fields: [
      { key: 'gcName',     label: 'Nombre GC', type: 'text', placeholder: 'AMA, LLC' },
      { key: 'gcPhone',    label: 'Teléfono GC', type: 'tel' },
      { key: 'gcLicense',  label: 'Licencia SC', type: 'text' },
      { key: 'gcEmail',    label: 'Email GC', type: 'email' },
    ],
  },
  {
    title: 'Financiamiento',
    fields: [
      { key: 'lender',           label: 'Lender', type: 'text', placeholder: 'Hera Holdings LLC' },
      { key: 'loanNumber',       label: 'Loan #', type: 'text', placeholder: 'HERA-2026-XXXX' },
      { key: 'loanAmount',       label: 'Loan Amount', type: 'number', placeholder: '0' },
      { key: 'day1Disbursement', label: 'Day 1 Disbursement', type: 'number', placeholder: '0' },
      { key: 'interestReserve',  label: 'Interest Reserve', type: 'number', placeholder: '0' },
      { key: 'holdback',         label: 'Holdback', type: 'number', placeholder: '0' },
      { key: 'interestRate',     label: 'Tasa anual % (ej 8.5)', type: 'number', placeholder: '8.5' },
      { key: 'loanTermMonths',   label: 'Plazo (meses)', type: 'number', placeholder: '18' },
      { key: 'settlementDate',   label: 'Fecha settlement', type: 'date' },
      { key: 'cashAtSettlement', label: 'Cash at Settlement', type: 'number', placeholder: '0' },
      { key: 'closingCosts',     label: 'Closing Costs', type: 'number', placeholder: '0' },
      { key: 'contractSalesPrice', label: 'Contract Sales Price', type: 'number', placeholder: '0' },
      { key: 'settlementAgent',  label: 'Settlement Agent', type: 'text' },
    ],
  },
  {
    title: 'Valoración',
    fields: [
      { key: 'arv',                label: 'ARV (After Repair Value)', type: 'number', placeholder: '0' },
      { key: 'constructionBudget', label: 'Construction Budget', type: 'number', placeholder: '0' },
    ],
  },
  {
    title: 'Inspector tercero (Trinity)',
    fields: [
      { key: 'trinityName',  label: 'Nombre', type: 'text' },
      { key: 'trinityPhone', label: 'Teléfono', type: 'tel' },
      { key: 'trinityEmail', label: 'Email', type: 'email' },
    ],
  },
  {
    title: 'Cronograma',
    fields: [
      { key: 'startDate',            label: 'Fecha inicio obra', type: 'date' },
      { key: 'targetCompletionDate', label: 'Fecha objetivo CO', type: 'date' },
    ],
  },
  {
    title: 'Realtor / Venta',
    fields: [
      { key: 'realtorName',         label: 'Realtor', type: 'text' },
      { key: 'realtorBrokerage',    label: 'Brokerage', type: 'text' },
      { key: 'realtorPhone',        label: 'Teléfono', type: 'tel' },
      { key: 'realtorEmail',        label: 'Email', type: 'email' },
      { key: 'listingCommission',   label: 'Comisión listing % (ej 3)', type: 'number' },
      { key: 'buyerCommission',     label: 'Comisión buyer % (ej 3)', type: 'number' },
      { key: 'targetListingPrice',  label: 'Precio listing objetivo', type: 'number' },
      { key: 'expectedPricePerSqft',label: 'Precio $/sqft esperado', type: 'number' },
    ],
  },
  {
    title: 'Benchmarks',
    fields: [
      { key: 'contingencyPct',    label: 'Contingencia % (ej 8)', type: 'number' },
      { key: 'targetMarginPct',   label: 'Margen objetivo % (ej 20)', type: 'number' },
      { key: 'benchmarkSfTarget', label: '$/SF benchmark (ej 220)', type: 'number' },
    ],
  },
]

// T4: campos que se MUESTRAN y EDITAN como porcentaje (3 = 3%) pero se
// almacenan como decimal (0.03). Conversión automática en carga y guardado.
const PCT_KEYS = new Set<string>(['listingCommission', 'buyerCommission', 'contingencyPct', 'targetMarginPct', 'interestRate'])

const NUM_KEYS = new Set<string>(
  EDIT_SECTIONS.flatMap(s => s.fields).filter(f => f.type === 'number').map(f => f.key)
)
const DATE_KEYS = new Set<string>(
  EDIT_SECTIONS.flatMap(s => s.fields).filter(f => f.type === 'date').map(f => f.key)
)

function EditProjectModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Record<string, string>>({})
  const [openSection, setOpenSection] = useState<string>('Identidad')

  // Cargar datos actuales del proyecto y poblar el form
  const { data: project, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  })

  useEffect(() => {
    if (!project) return
    const next: Record<string, string> = {}
    for (const section of EDIT_SECTIONS) {
      for (const f of section.fields) {
        const v = project[f.key]
        if (v === null || v === undefined) { next[f.key] = ''; continue }
        if (DATE_KEYS.has(f.key) && typeof v === 'string') {
          // ISO date → YYYY-MM-DD para input type=date
          next[f.key] = v.slice(0, 10)
        } else if (PCT_KEYS.has(f.key) && typeof v === 'number') {
          // decimal almacenado → porcentaje visible (0.03 → "3")
          next[f.key] = String(parseFloat((v * 100).toFixed(4)))
        } else {
          next[f.key] = String(v)
        }
      }
    }
    setForm(next)
  }, [project])

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.patch(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Proyecto actualizado')
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar'
      toast.error(msg)
    },
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return
    // Sólo enviar campos cuyo valor cambió respecto al original
    const payload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(form)) {
      const orig = project[k]
      const origStr = orig === null || orig === undefined ? '' :
        DATE_KEYS.has(k) && typeof orig === 'string' ? orig.slice(0, 10) :
        PCT_KEYS.has(k) && typeof orig === 'number' ? String(parseFloat((orig * 100).toFixed(4))) :
        String(orig)
      if (v === origStr) continue
      if (v === '') {
        // Campo vacío en input — pasar null para limpiar
        payload[k] = null
      } else if (PCT_KEYS.has(k)) {
        // porcentaje visible → decimal almacenado ("3" → 0.03)
        const n = parseFloat(v)
        if (!Number.isNaN(n)) payload[k] = n / 100
      } else if (NUM_KEYS.has(k)) {
        const n = parseFloat(v)
        if (!Number.isNaN(n)) payload[k] = n
      } else if (DATE_KEYS.has(k)) {
        payload[k] = new Date(v).toISOString()
      } else {
        payload[k] = v
      }
    }
    if (Object.keys(payload).length === 0) {
      toast('No hay cambios para guardar', { icon: 'ℹ️' })
      return
    }
    mutation.mutate(payload)
  }

  const inputCls = "w-full bg-white border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Editar proyecto</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {project?.name as string ?? '...'} · Los campos vacíos al guardar limpian el dato
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
            {EDIT_SECTIONS.map(section => (
              <div key={section.title} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === section.title ? '' : section.title)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-700">{section.title}</span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${openSection === section.title ? 'rotate-90' : ''}`} />
                </button>
                {openSection === section.title && (
                  <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    {section.fields.map(f => (
                      <div key={f.key}>
                        <label className="block text-[11px] text-slate-500 mb-1">{f.label}</label>
                        <input
                          type={f.type}
                          step={f.type === 'number' ? 'any' : undefined}
                          value={form[f.key] ?? ''}
                          onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className={inputCls}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {mutation.isError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg">
                Error al guardar: {String(mutation.error)}
              </div>
            )}

            <div className="flex gap-3 pt-3 sticky bottom-0 bg-slate-50 -mx-6 px-6 pb-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--brand-gold)] hover:bg-[#0077ED] text-sm font-semibold text-white transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, isActive, onSelect, onDelete, onEdit, onPhoto }: {
  onPhoto: (file: File) => void
  project: ProjectListItem
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  const totalDrawn = project.draws.filter(d => d.estado === 'WIRED').reduce((s, d) => s + d.netWire, 0)
  const drawPct = project.holdback > 0 ? (totalDrawn / project.holdback) * 100 : 0

  return (
    <div className={`relative bg-white rounded-xl border transition-all group
      ${isActive ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-slate-200 hover:border-slate-200'}`}>
      {/* Edit + Delete buttons — top right, visible on hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--brand-gold)] hover:bg-[#0071E3]/10 transition-colors"
          title="Editar información general del proyecto"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {/* Foto de referencia: subir/cambiar */}
        <label
          onClick={e => e.stopPropagation()}
          className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--brand-teal)] hover:bg-[#1D1D1F]/10 transition-colors cursor-pointer"
          title={project.photoUrl ? 'Cambiar foto de referencia' : 'Subir foto de referencia'}
        >
          <Camera className="w-3.5 h-3.5" />
          <input type="file" className="hidden" accept="image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = '' }} />
        </label>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Eliminar proyecto"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <button onClick={onSelect} className="w-full text-left p-5">
        <div className="flex items-start justify-between mb-4 pr-6">
          {/* Foto de referencia del proyecto */}
          {project.photoUrl && (
            <img src={project.photoUrl} alt={project.name}
              className="w-14 h-14 rounded-xl object-cover mr-3 flex-shrink-0 border border-slate-200 shadow-sm" />
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isActive && <span className="text-[9px] font-bold tracking-wider text-[var(--brand-gold)] bg-[#0071E3]/15 px-2 py-0.5 rounded-full">ACTIVO</span>}
              <h3 className="text-sm font-bold text-slate-900">{project.name}</h3>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">{project.spv}</div>
            <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{project.address}</span>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:text-[var(--brand-gold)] transition-colors flex-shrink-0 ${isActive ? 'text-[var(--brand-gold)]' : ''}`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-slate-400">ARV</span>
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800">{formatUSD(project.arv)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3 h-3 text-[var(--brand-gold)]" />
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
  const [editTarget, setEditTarget] = useState<ProjectListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null)
  const { activeProjectId, setActiveProjectId } = useProjectStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading } = useQuery<ProjectListItem[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const photoMutation = useMutation({
    mutationFn: ({ projectId, file }: { projectId: string; file: File }) => {
      const fd = new FormData()
      fd.append('file', file)
      return projectsApi.uploadPhoto(projectId, fd)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
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
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><FolderKanban className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>Proyectos</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">{projects.length} proyecto{projects.length !== 1 ? 's' : ''} · Restrepo Acosta Global Holding LLC</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-gold)] hover:bg-[#0077ED] text-sm font-semibold text-white rounded-lg transition-colors"
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
              onEdit={() => setEditTarget(p)}
              onPhoto={file => photoMutation.mutate({ projectId: p.id, file })}
              onDelete={() => setDeleteTarget(p)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewProjectModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}

      {editTarget && (
        <EditProjectModal projectId={editTarget.id} onClose={() => setEditTarget(null)} />
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
