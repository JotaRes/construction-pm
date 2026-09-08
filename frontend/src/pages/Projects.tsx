import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, MapPin, DollarSign, TrendingUp, ChevronRight, X, Trash2, Upload, FileText, CheckCircle, RefreshCw, Pencil, Camera, FolderKanban } from 'lucide-react'
import { projectsApi, projectsDeleteApi } from '../lib/api'
import { useProjectStore } from '../store/projectStore'
import { formatUSD } from '../lib/calculations'
import toast from 'react-hot-toast'
import type { Project, Draw } from '../lib/types'
import { useI18n, type TranslationKey } from '../i18n'

type ProjectListItem = Pick<Project, 'id' | 'name' | 'spv' | 'address' | 'arv' | 'constructionBudget' | 'holdback' | 'photoUrl' | 'photoName'> & {
  draws: Draw[]
}

const REQUIRED_FIELDS: { key: string; labelKey: TranslationKey; placeholderKey: TranslationKey; required: boolean }[] = [
  { key: 'name', labelKey: 'tech.projects.nombreDelProyecto', placeholderKey: 'tech.projects.lote88HighlandRd', required: true },
  { key: 'spv', labelKey: 'tech.projects.spvLlc', placeholderKey: 'tech.projects.highland88Llc', required: true },
  { key: 'address', labelKey: 'common.direccion', placeholderKey: 'tech.projects.123NHighlandRdWestminsterSc', required: true },
  { key: 'county', labelKey: 'tech.projects.condado', placeholderKey: 'tech.projects.oconeeCounty', required: false },
  { key: 'gcName', labelKey: 'tech.projects.contratistaGeneral', placeholderKey: 'tech.projects.nombreDelGc', required: false },
  { key: 'permitNumber', labelKey: 'tech.projects.numeroDePermiso', placeholderKey: 'tech.projects.br26Xxxxxx', required: false },
]

const FINANCIAL_FIELDS: { key: string; labelKey: TranslationKey; type: string; placeholder: string }[] = [
  { key: 'arv', labelKey: 'tech.projects.arvValorEstimadoPostRemodelacion', type: 'number', placeholder: '0' },
  { key: 'loanAmount', labelKey: 'tech.fin.loanAmount', type: 'number', placeholder: '0' },
  { key: 'holdback', labelKey: 'tech.fin.holdbackDisponible', type: 'number', placeholder: '0' },
  { key: 'constructionBudget', labelKey: 'common.constructionBudget', type: 'number', placeholder: '0' },
  { key: 'sfHeated', labelKey: 'tech.projects.sfHeatedAreaVivible', type: 'number', placeholder: '0' },
]

const DATE_FIELDS: { key: string; labelKey: TranslationKey }[] = [
  { key: 'startDate', labelKey: 'tech.projects.fechaInicioObra' },
  { key: 'targetCompletionDate', labelKey: 'tech.projects.fechaObjetivoCo' },
]

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useI18n()
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
      setHudError(t('tech.projects.noSePudoLeerElHud'))
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
            <h2 className="text-base font-bold text-slate-900">{t('tech.projects.nuevoProyecto')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t('tech.projects.seCrean20Fases204Items')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* ── PASO 1: HUD del lote ── */}
          <div className="rounded-xl border-2 border-dashed border-[#3E5A70]/40 bg-[#3E5A70]/5 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#3E5A70]/15 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[var(--brand-gold)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-700 mb-0.5">
                  {t('tech.projects.paso1HudDelLote')} <span className="text-slate-400 font-normal">{t('tech.projects.opcionalPeroRecomendado')}</span>
                </div>
                <div className="text-[11px] text-slate-500 mb-2">
                  {t('tech.projects.subeElHudDeCierrePara')}
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
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {hudParsing
                      ? <><RefreshCw className="w-3 h-3 animate-spin" />{t('tech.projects.leyendoHud')}</>
                      : <><Upload className="w-3 h-3" />{t('tech.projects.subirHudDelLote')}</>}
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
              {t('tech.projects.paso2InformacionBasica')}
            </div>
            <div className="space-y-3">
              {REQUIRED_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-500 mb-1">
                    {t(f.labelKey)} {f.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type="text"
                    placeholder={t(f.placeholderKey)}
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
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('tech.projects.datosFinancieros')}</div>
            <div className="grid grid-cols-2 gap-3">
              {FINANCIAL_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-500 mb-1">{t(f.labelKey)}</label>
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
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('tech.exec.cronograma')}</div>
            <div className="grid grid-cols-2 gap-3">
              {DATE_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-500 mb-1">{t(f.labelKey)}</label>
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
              {t('tech.projects.errorAlCrear')} {String(mutation.error)}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              {t('common.cancelar')}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || hudParsing}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--brand-gold)] hover:bg-[#4A6880] text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? t('tech.projects.creando') : t('fin.projs.crearProyecto')}
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
type FieldDef = { key: string; labelKey: TranslationKey; type: 'text' | 'number' | 'date' | 'tel' | 'email'; placeholderKey?: TranslationKey; placeholder?: string }

const EDIT_SECTIONS: Array<{ titleKey: TranslationKey; fields: FieldDef[] }> = [
  {
    titleKey: 'tech.projects.identidad',
    fields: [
      { key: 'name',     labelKey: 'tech.projects.nombreDelProyecto', type: 'text', placeholderKey: 'tech.projects.lote88HighlandRd' },
      { key: 'spv',      labelKey: 'tech.projects.spvLlcDelProyecto', type: 'text', placeholderKey: 'tech.projects.highland88Llc' },
      { key: 'holding',  labelKey: 'tech.projects.holdingEmpresaMatriz', type: 'text', placeholderKey: 'landing.restrepoAcostaGlobalHoldingLlc' },
      { key: 'address',  labelKey: 'common.direccion', type: 'text', placeholderKey: 'tech.projects.123NHighlandRdWestminsterSc' },
      { key: 'county',   labelKey: 'tech.projects.condado', type: 'text', placeholderKey: 'tech.projects.oconee' },
      { key: 'hoa',      labelKey: 'tech.projects.hoa', type: 'text', placeholderKey: 'tech.projects.chickasawPoint' },
      { key: 'parcelId', labelKey: 'tech.projects.parcelId', type: 'text', placeholder: '323-01-06-002' },
    ],
  },
  {
    titleKey: 'tech.projects.fisico',
    fields: [
      { key: 'lotAcres',         labelKey: 'tech.projects.acresDelLote', type: 'number', placeholder: '0' },
      { key: 'sfHeated',         labelKey: 'tech.projects.sfHeatedAreaVivible', type: 'number', placeholder: '2400' },
      { key: 'sfGarage',         labelKey: 'tech.fin.sfGarage', type: 'number', placeholder: '0' },
      { key: 'sfPorches',        labelKey: 'tech.fin.sfPorches', type: 'number', placeholder: '0' },
      { key: 'bedrooms',         labelKey: 'tech.projects.habitaciones', type: 'number', placeholder: '3' },
      { key: 'bathrooms',        labelKey: 'tech.projects.banos', type: 'text', placeholder: '2.5' },
      { key: 'foundationType',   labelKey: 'tech.projects.tipoDeCimentacion', type: 'text', placeholderKey: 'tech.projects.crawlspaceSlabBasement' },
      { key: 'architecturalPlan',labelKey: 'tech.projects.planoArquitectonico', type: 'text', placeholderKey: 'tech.projects.24005Crawlspace' },
    ],
  },
  {
    titleKey: 'tech.projects.permisos',
    fields: [
      { key: 'permitNumber',  labelKey: 'tech.projects.numeroDePermiso', type: 'text', placeholderKey: 'tech.projects.br26Xxxxxx' },
      { key: 'permitIssued',  labelKey: 'tech.projects.fechaEmision', type: 'date' },
      { key: 'permitExpires', labelKey: 'tech.projects.fechaVencimiento180Dias', type: 'date' },
      { key: 'inspectorPhone',labelKey: 'tech.projects.telefonoInspectorCondado', type: 'tel' },
      { key: 'hoaPhone',      labelKey: 'tech.projects.telefonoHoa', type: 'tel' },
    ],
  },
  {
    titleKey: 'tech.projects.generalContractor',
    fields: [
      { key: 'gcName',     labelKey: 'tech.projects.nombreGc', type: 'text', placeholderKey: 'tech.projects.amaLlc' },
      { key: 'gcPhone',    labelKey: 'tech.projects.telefonoGc', type: 'tel' },
      { key: 'gcLicense',  labelKey: 'tech.projects.licenciaSc', type: 'text' },
      { key: 'gcEmail',    labelKey: 'tech.projects.emailGc', type: 'email' },
    ],
  },
  {
    titleKey: 'tech.projects.financiamiento',
    fields: [
      { key: 'lender',           labelKey: 'common.lender', type: 'text', placeholderKey: 'tech.projects.heraHoldingsLlc' },
      { key: 'loanNumber',       labelKey: 'tech.projects.loan', type: 'text', placeholderKey: 'tech.projects.hera2026Xxxx' },
      { key: 'loanAmount',       labelKey: 'tech.fin.loanAmount', type: 'number', placeholder: '0' },
      { key: 'day1Disbursement', labelKey: 'tech.fin.day1Disbursement', type: 'number', placeholder: '0' },
      { key: 'interestReserve',  labelKey: 'tech.fin.interestReserve', type: 'number', placeholder: '0' },
      { key: 'holdback',         labelKey: 'tech.projects.holdback', type: 'number', placeholder: '0' },
      { key: 'interestRate',     labelKey: 'tech.projects.tasaAnualEj85', type: 'number', placeholder: '8.5' },
      { key: 'loanTermMonths',   labelKey: 'fin.debt.plazoMeses', type: 'number', placeholder: '18' },
      { key: 'settlementDate',   labelKey: 'tech.projects.fechaSettlement', type: 'date' },
      { key: 'cashAtSettlement', labelKey: 'tech.fin.cashAtSettlement', type: 'number', placeholder: '0' },
      { key: 'closingCosts',     labelKey: 'tech.fin.closingCosts2', type: 'number', placeholder: '0' },
      { key: 'contractSalesPrice', labelKey: 'tech.projects.contractSalesPrice', type: 'number', placeholder: '0' },
      { key: 'settlementAgent',  labelKey: 'tech.projects.settlementAgent', type: 'text' },
    ],
  },
  {
    titleKey: 'tech.projects.valoracion',
    fields: [
      { key: 'arv',                labelKey: 'tech.projects.arvAfterRepairValue', type: 'number', placeholder: '0' },
      { key: 'constructionBudget', labelKey: 'common.constructionBudget', type: 'number', placeholder: '0' },
    ],
  },
  {
    titleKey: 'tech.projects.inspectorTerceroTrinity',
    fields: [
      { key: 'trinityName',  labelKey: 'fin.cat.nombre', type: 'text' },
      { key: 'trinityPhone', labelKey: 'common.telefono', type: 'tel' },
      { key: 'trinityEmail', labelKey: 'common.email', type: 'email' },
    ],
  },
  {
    titleKey: 'tech.exec.cronograma',
    fields: [
      { key: 'startDate',            labelKey: 'tech.projects.fechaInicioObra', type: 'date' },
      { key: 'targetCompletionDate', labelKey: 'tech.projects.fechaObjetivoCo', type: 'date' },
    ],
  },
  {
    titleKey: 'tech.projects.realtorVenta',
    fields: [
      { key: 'realtorName',         labelKey: 'tech.projects.realtor', type: 'text' },
      { key: 'realtorBrokerage',    labelKey: 'tech.projects.brokerage', type: 'text' },
      { key: 'realtorPhone',        labelKey: 'common.telefono', type: 'tel' },
      { key: 'realtorEmail',        labelKey: 'common.email', type: 'email' },
      { key: 'listingCommission',   labelKey: 'tech.projects.comisionListingEj3', type: 'number' },
      { key: 'buyerCommission',     labelKey: 'tech.projects.comisionBuyerEj3', type: 'number' },
      { key: 'targetListingPrice',  labelKey: 'tech.projects.precioListingObjetivo', type: 'number' },
      { key: 'expectedPricePerSqft',labelKey: 'tech.projects.precioSqftEsperado', type: 'number' },
    ],
  },
  {
    titleKey: 'tech.projects.benchmarks',
    fields: [
      { key: 'contingencyPct',    labelKey: 'tech.projects.contingenciaEj8', type: 'number' },
      { key: 'targetMarginPct',   labelKey: 'tech.projects.margenObjetivoEj20', type: 'number' },
      { key: 'benchmarkSfTarget', labelKey: 'tech.projects.sfBenchmarkEj220', type: 'number' },
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
  const { t } = useI18n()
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
      toast.success(t('tech.projects.proyectoActualizado'))
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('common.saveError')
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
      toast(t('tech.projects.noHayCambiosParaGuardar'), { icon: 'ℹ️' })
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
            <h2 className="text-base font-bold text-slate-900">{t('tech.projects.editarProyecto')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {project?.name as string ?? '...'} {t('tech.projects.losCamposVaciosAlGuardarLimpian')}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">{t('common.cargando2')}</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
            {EDIT_SECTIONS.map(section => (
              <div key={section.titleKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === section.titleKey ? '' : section.titleKey)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-700">{t(section.titleKey)}</span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${openSection === section.titleKey ? 'rotate-90' : ''}`} />
                </button>
                {openSection === section.titleKey && (
                  <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    {section.fields.map(f => (
                      <div key={f.key}>
                        <label className="block text-[11px] text-slate-500 mb-1">{t(f.labelKey)}</label>
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
                {t('tech.projects.errorAlGuardar')} {String(mutation.error)}
              </div>
            )}

            <div className="flex gap-3 pt-3 sticky bottom-0 bg-slate-50 -mx-6 px-6 pb-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:text-slate-800 transition-colors"
              >
                {t('common.cancelar')}
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--brand-gold)] hover:bg-[#4A6880] text-sm font-semibold text-white transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? t('common.guardando2') : t('common.guardarCambios')}
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
  const { t } = useI18n()
  const totalDrawn = project.draws.filter(d => d.estado === 'WIRED').reduce((s, d) => s + d.netWire, 0)
  const drawPct = project.holdback > 0 ? (totalDrawn / project.holdback) * 100 : 0

  return (
    <div className={`relative bg-white rounded-xl border transition-all group
      ${isActive ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-slate-200 hover:border-slate-200'}`}>
      {/* Edit + Delete buttons — top right, visible on hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--brand-gold)] hover:bg-[#3E5A70]/10 transition-colors"
          title={t('tech.projects.editarInformacionGeneralDelProyecto')}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {/* Foto de referencia: subir/cambiar */}
        <label
          onClick={e => e.stopPropagation()}
          className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--brand-teal)] hover:bg-[#1D1D1F]/10 transition-colors cursor-pointer"
          title={project.photoUrl ? t('tech.projects.cambiarFotoDeReferencia') : t('tech.projects.subirFotoDeReferencia')}
        >
          <Camera className="w-3.5 h-3.5" />
          <input type="file" className="hidden" accept="image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = '' }} />
        </label>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title={t('fin.projs.eliminarProyecto')}
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
              {isActive && <span className="text-[9px] font-bold tracking-wider text-[var(--brand-gold)] bg-[#3E5A70]/15 px-2 py-0.5 rounded-full">ACTIVO</span>}
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
              <span className="text-[10px] text-slate-400">{t('tech.projects.budget')}</span>
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800">{formatUSD(project.constructionBudget)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 mb-1">{t('tech.draws.draws')}</div>
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
  const { t } = useI18n()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{t('fin.projs.eliminarProyecto')}</div>
            <div className="text-xs text-slate-400 mt-0.5">{t('tech.projects.estaAccionNoSePuedeDeshacer')}</div>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          {t('tech.projects.seEliminara')} <span className="text-slate-800 font-semibold">"{projectName}"</span> {t('tech.projects.juntoConTodasSusFasesItems')}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:text-slate-800 hover:border-slate-200 transition-colors"
          >
            {t('common.cancelar')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isPending ? t('tech.projects.eliminando') : t('tech.projects.siEliminar')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const { t } = useI18n()
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

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">{t('tech.projects.cargandoProyectos')}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><FolderKanban className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('common.proyectos')}</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">{projects.length} {t('tech.projects.proyecto')}{projects.length !== 1 ? 's' : ''} {t('tech.projects.restrepoAcostaGlobalHoldingLlc')}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-sm font-semibold text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('fin.projs.nuevoProyecto')}
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          <Building2 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          {t('tech.projects.noHayProyectosCreaUnoPara')}
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
