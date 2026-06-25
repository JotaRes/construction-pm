import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi, drawsApi, projectsApi, phasesApi, itemsApi, drawParseApi, docParseApi } from '../lib/api'
import { formatDate, formatUSD } from '../lib/calculations'
import type { ProjectFile, Draw, Phase } from '../lib/types'
import { Plus, ExternalLink, Trash2, Upload, FileText, CheckCircle, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react'
import axios from 'axios'
import DocumentChecklist from '../components/DocumentChecklist'

const api = axios.create({ baseURL: '/api' })
// Inyecta el token JWT en cada request — sin esto, /api/* da 401 con la auth global.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pm_auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const CATEGORIES = ['Contrato', 'Permiso', 'Plano', 'Seguro', 'Draw', 'HOA', 'Legal', 'Inspección', 'Otro']

const DOC_TYPES = [
  { value: 'DRAW',      label: 'Draw / Inspección Trinity',      cat: 'Draw' },
  { value: 'HUD',       label: 'HUD-1 / Closing Disclosure',     cat: 'Legal' },
  { value: 'LOAN',      label: 'Carta aprobación préstamo (Lender Commitment)', cat: 'Legal' },
  { value: 'SURVEY',    label: 'Survey / Levantamiento',         cat: 'Legal' },
  { value: 'PLANS',     label: 'Planos Arquitectónicos',         cat: 'Plano' },
  { value: 'PERMIT',    label: 'Building Permit',                cat: 'Permiso' },
  { value: 'APPRAISAL', label: 'Appraisal / Avalúo',            cat: 'Otro' },
  { value: 'BUDGET',    label: 'Construction Budget (PDF)',      cat: 'Otro' },
  { value: 'INSURANCE', label: 'Seguro / Insurance',            cat: 'Seguro' },
  { value: 'HOA',       label: 'HOA Documents',                 cat: 'HOA' },
  { value: 'CONTRACT',  label: 'Contrato GC / Subcontratista',  cat: 'Contrato' },
  { value: 'GENERAL',   label: 'Otro documento (solo guardar)', cat: 'Otro' },
]

const FIELD_LABELS: Record<string, string> = {
  // Draw
  drawNumber: 'Nº de Draw',
  fechaSolicitud: 'Fecha solicitud',
  fechaInspeccion: 'Fecha inspección',
  fechaWire: 'Fecha wire',
  montoSolicitado: 'Monto solicitado',
  elegibleTrinity: 'Elegible Trinity',
  netWire: 'Net wire',
  porcentajeFunded: '% fundado',
  // HUD / Closing
  settlementDate: 'Fecha de cierre',
  cashAtSettlement: 'Cash al cierre',
  closingCosts: 'Costos de cierre',
  // Loan
  lender: 'Prestamista',
  loanNumber: 'Nº de préstamo',
  loanAmount: 'Monto del préstamo',
  interestRate: 'Tasa de interés',
  loanTermMonths: 'Plazo (meses)',
  holdback: 'Holdback',
  day1Disbursement: 'Desembolso Día 1',
  interestReserve: 'Reserva de intereses',
  // Survey
  parcelId: 'Parcel ID',
  lotAcres: 'Acres del lote',
  address: 'Dirección',
  county: 'Condado',
  // Plans
  sfHeated: 'SF calefaccionados',
  sfGarage: 'SF garaje',
  sfPorches: 'SF porches',
  bedrooms: 'Habitaciones',
  bathrooms: 'Baños',
  foundationType: 'Tipo de fundación',
  // Permit
  permitNumber: 'Nº de permiso',
  permitIssued: 'Fecha emisión',
  permitExpires: 'Fecha vencimiento',
  // Appraisal
  arv: 'ARV (valor mercado)',
  targetListingPrice: 'Precio de lista estimado',
  // HUD land purchase
  contractSalesPrice: 'Precio de compra (lote)',
}

function formatExtracted(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—'
  const moneyKeys = ['montoSolicitado', 'elegibleTrinity', 'netWire', 'loanAmount', 'cashAtSettlement', 'closingCosts']
  const pctKeys = ['porcentajeFunded', 'interestRate']
  if (moneyKeys.includes(key)) return formatUSD(Number(val))
  if (pctKeys.includes(key)) return `${(Number(val) * 100).toFixed(2)}%`
  if (typeof val === 'string' && val.includes('T00:00:00')) return new Date(val).toLocaleDateString('es-CO')
  return String(val)
}

interface ExtractResult {
  parsed: Record<string, unknown>
  preview: string | null
  isImage: boolean
  imageUrl: string | null
}

export default function Files({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()

  // URL-reference form
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('Otro')
  const [filterCat, setFilterCat] = useState('ALL')

  // PDF extraction
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('DRAW')
  const [extracting, setExtracting] = useState(false)
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [applyStatus, setApplyStatus] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [applying, setApplying] = useState(false)

  const { data: files = [], isLoading } = useQuery<ProjectFile[]>({
    queryKey: ['files', projectId],
    queryFn: () => filesApi.list(projectId),
  })

  const { data: draws = [] } = useQuery<Draw[]>({
    queryKey: ['draws', projectId],
    queryFn: () => drawsApi.list(projectId),
  })

  const createMut = useMutation({
    mutationFn: () => filesApi.create(projectId, { name, url, category }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['files', projectId] }); setName(''); setUrl('') },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => filesApi.delete(projectId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files', projectId] }),
  })

  const filtered = filterCat === 'ALL' ? files : files.filter(f => f.category === filterCat)

  // Core apply logic — accepts parsed data directly so it can be called
  // both automatically (from handleExtract) and manually (re-apply button).
  async function doApply(p: Record<string, unknown>, dtype: string) {
    setApplying(true)
    setApplyStatus(null)
    try {
      if (dtype === 'DRAW') {
        const drawNum = p.drawNumber as number | undefined
        if (!drawNum) { setApplyStatus('⚠ No se detectó número de draw'); return }
        const draw = draws.find(d => d.drawNumber === drawNum)
        if (!draw) { setApplyStatus(`⚠ Draw #${drawNum} no encontrado en el proyecto`); return }
        const drawFields = ['fechaSolicitud', 'fechaInspeccion', 'fechaWire', 'montoSolicitado', 'elegibleTrinity', 'netWire', 'porcentajeFunded', 'pdfUrl']
        const update: Record<string, unknown> = {}
        drawFields.forEach(k => { if (p[k] !== undefined) update[k] = p[k] })
        await drawsApi.patch(draw.id, update)
        queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
        setApplyStatus(`✓ Draw #${drawNum} actualizado`)

      } else if (dtype === 'BUDGET') {
        setApplyStatus('✓ Budget extraído — ver sección "Const. Budget" para aplicar línea por línea')

      } else if (dtype === 'HUD') {
        // 1. Project-level financial fields
        const hudProjectFields = ['loanAmount', 'cashAtSettlement', 'closingCosts', 'interestRate', 'loanTermMonths', 'settlementDate']
        const update: Record<string, unknown> = {}
        hudProjectFields.forEach(k => { if (p[k] !== undefined) update[k] = p[k] })
        if (Object.keys(update).length > 0) {
          await projectsApi.patch(projectId, update)
          queryClient.invalidateQueries({ queryKey: ['projects'] })
        }
        // 2. Execution items: lot price → 00.01, closing charges → 00.02
        const appliedItems: string[] = []
        if (p.contractSalesPrice !== undefined || p.closingCosts !== undefined) {
          const phases: Phase[] = await phasesApi.list(projectId)
          const allItems = phases.flatMap(ph => ph.items ?? [])
          if (p.contractSalesPrice !== undefined) {
            const item = allItems.find(i => i.itemCode === '00.01')
            if (item) { await itemsApi.patch(item.id, { valorEjecutado: p.contractSalesPrice }); appliedItems.push('Compra del lote (00.01)') }
          }
          if (p.closingCosts !== undefined) {
            const item = allItems.find(i => i.itemCode === '00.02')
            if (item) { await itemsApi.patch(item.id, { valorEjecutado: p.closingCosts }); appliedItems.push('Closing del lote (00.02)') }
          }
          if (appliedItems.length > 0) queryClient.invalidateQueries({ queryKey: ['phases', projectId] })
        }
        const total = Object.keys(update).length + appliedItems.length
        if (total === 0) { setApplyStatus('⚠ No se extrajeron campos del HUD'); return }
        const itemStr = appliedItems.length > 0 ? ` · Ejecución: ${appliedItems.join(', ')}` : ''
        setApplyStatus(`✓ ${Object.keys(update).length} campos del proyecto${itemStr}`)

      } else {
        // LOAN, SURVEY, PLANS, PERMIT, APPRAISAL — update project fields
        const projectFieldsByType: Record<string, string[]> = {
          LOAN:      ['lender', 'loanNumber', 'loanAmount', 'interestRate', 'loanTermMonths', 'holdback', 'day1Disbursement', 'interestReserve', 'settlementDate'],
          SURVEY:    ['parcelId', 'lotAcres', 'address', 'county'],
          PLANS:     ['sfHeated', 'sfGarage', 'sfPorches', 'bedrooms', 'bathrooms', 'foundationType'],
          PERMIT:    ['permitNumber', 'permitIssued', 'permitExpires', 'county'],
          APPRAISAL: ['arv', 'sfHeated', 'targetListingPrice'],
        }
        const fields = projectFieldsByType[dtype] ?? Object.keys(p).filter(k => k !== 'pdfUrl')
        const update: Record<string, unknown> = {}
        fields.forEach(k => { if (p[k] !== undefined) update[k] = p[k] })
        if (Object.keys(update).length === 0) { setApplyStatus('⚠ No se extrajeron campos reconocibles de este documento'); return }
        await projectsApi.patch(projectId, update)
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        const label = DOC_TYPES.find(d => d.value === dtype)?.label ?? dtype
        setApplyStatus(`✓ ${Object.keys(update).length} campos de "${label}" aplicados al proyecto`)
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        ?? (e as Error)?.message ?? 'Error'
      setApplyStatus(`✗ Error: ${msg}`)
    } finally {
      setApplying(false)
    }
  }

  async function handleExtract() {
    if (!uploadFile) return
    setExtracting(true)
    setExtractResult(null)
    setExtractError(null)
    setApplyStatus(null)
    try {
      const fd = new FormData()
      fd.append('pdf', uploadFile)
      const docTypeDef = DOC_TYPES.find(d => d.value === docType)!

      let result: ExtractResult
      if (docType === 'DRAW') {
        result = await drawParseApi.parsePdf(projectId, uploadFile)
      } else if (docType === 'BUDGET') {
        const r = await api.post(
          `/projects/${projectId}/construction-budget/parse-pdf`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        result = r.data.data
      } else if (docType === 'GENERAL' || docType === 'INSURANCE' || docType === 'HOA' || docType === 'CONTRACT') {
        await filesApi.create(projectId, { name: uploadFile.name, url: uploadFile.name, category: docTypeDef.cat })
        queryClient.invalidateQueries({ queryKey: ['files', projectId] })
        setUploadFile(null)
        setApplyStatus('✓ Archivo guardado en el repositorio')
        return
      } else {
        result = await docParseApi.parsePdf(projectId, uploadFile, docType)
      }

      setExtractResult(result)
      // Auto-save file reference
      await filesApi.create(projectId, {
        name: `${docTypeDef.label} — ${uploadFile.name}`,
        url: (result.parsed?.pdfUrl as string) ?? result.imageUrl ?? uploadFile.name,
        category: docTypeDef.cat,
      })
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })

      // Auto-apply immediately — no need for a separate button click
      const fieldCount = Object.keys(result.parsed).filter(k => k !== 'pdfUrl').length
      if (fieldCount > 0 && !result.isImage) {
        await doApply(result.parsed, docType)
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        ?? (e as Error)?.message ?? 'Error desconocido'
      setExtractError(msg)
    } finally {
      setExtracting(false)
    }
  }

  function handleApply() {
    if (!extractResult) return
    void doApply(extractResult.parsed, docType)
  }

  const extractedEntries = extractResult
    ? Object.entries(extractResult.parsed).filter(([k]) => k !== 'pdfUrl')
    : []

  // Obtener info del proyecto para enriquecer compartidos por email/whatsapp
  const { data: project } = useQuery<{ name: string; address: string } | null>({
    queryKey: ['project-info', projectId],
    queryFn: () => projectsApi.get(projectId),
  })

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando archivos...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Repositorio de Archivos</h1>

      {/* === CHECKLIST DOCUMENTAL (nueva sección destacada) === */}
      <DocumentChecklist
        projectId={projectId}
        projectName={project?.name}
        projectAddress={project?.address}
      />

      {/* ── Smart PDF Upload ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#C8922A]/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Upload className="w-4 h-4 text-[var(--brand-gold)]" />
          <span className="text-sm font-semibold text-slate-800">Cargar documento y extraer datos</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tipo de documento</label>
              <select value={docType} onChange={e => { setDocType(e.target.value); setExtractResult(null); setApplyStatus(null) }}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Archivo</label>
              <label className="flex items-center gap-2 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-[var(--brand-gold)] transition-colors">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm truncate text-slate-600">{uploadFile ? uploadFile.name : 'Seleccionar PDF...'}</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                  onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setExtractResult(null); setApplyStatus(null) }} />
              </label>
            </div>
          </div>

          <button onClick={handleExtract} disabled={!uploadFile || extracting}
            className="flex items-center gap-2 bg-[var(--brand-gold)] hover:bg-[#E0AD4F] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
            {extracting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Extrayendo datos...</>
            ) : (
              <><Upload className="w-4 h-4" />Cargar y extraer datos</>
            )}
          </button>

          {extractError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {extractError}
            </div>
          )}

          {extractResult && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-800">
                    {extractedEntries.length > 0 ? `${extractedEntries.length} campos extraídos` : 'Archivo guardado'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {extractResult.preview && (
                    <button onClick={() => setShowPreview(v => !v)}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition-colors">
                      {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Ver texto
                    </button>
                  )}
                  <button onClick={() => { setExtractResult(null); setUploadFile(null); setApplyStatus(null) }}
                    className="text-slate-300 hover:text-slate-500"><X className="w-4 h-4" /></button>
                </div>
              </div>

              {extractedEntries.length > 0 && (
                <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2">
                  {extractedEntries.map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between gap-4 text-sm py-1 border-b border-slate-100">
                      <span className="text-slate-500 text-xs">{FIELD_LABELS[key] ?? key}</span>
                      <span className="font-mono font-semibold text-slate-800 text-xs">{formatExtracted(key, val)}</span>
                    </div>
                  ))}
                </div>
              )}

              {showPreview && extractResult.preview && (
                <div className="px-4 pb-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-[10px] font-mono text-slate-500 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {extractResult.preview}
                  </div>
                </div>
              )}

              {extractedEntries.length > 0 && docType !== 'GENERAL' && (
                <div className="px-4 pb-4 flex items-center gap-3">
                  {applyStatus && (
                    <span className={`text-xs font-medium ${applyStatus.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {applyStatus}
                    </span>
                  )}
                  <button onClick={handleApply} disabled={applying}
                    className="flex items-center gap-2 bg-[var(--brand-teal)] hover:bg-[#3A5F68] disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                    {applying ? 'Aplicando...' : '↺ Re-aplicar'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Manual URL reference ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Agregar referencia manual (URL)</div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <input placeholder="Nombre del documento *" value={name} onChange={e => setName(e.target.value)}
            className="bg-slate-50 text-slate-800 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[var(--brand-gold)]" />
          <input placeholder="URL o path del archivo *" value={url} onChange={e => setUrl(e.target.value)}
            className="bg-slate-50 text-slate-800 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[var(--brand-gold)]" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="bg-slate-50 text-slate-800 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[var(--brand-gold)]">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={() => name && url && createMut.mutate()} disabled={!name || !url}
          className="flex items-center gap-2 bg-[var(--brand-teal)] hover:bg-[#3A5F68] disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Agregar referencia
        </button>
      </div>

      {/* ── Filter tabs ───────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${filterCat === c ? 'bg-[var(--brand-teal)] text-white' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200'}`}>
            {c === 'ALL' ? 'Todos' : c}
          </button>
        ))}
      </div>

      {/* ── File list ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase">Documento</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-28">Categoría</th>
              <th className="px-4 py-3 text-left text-[10px] text-slate-400 uppercase w-28">Fecha</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(file => (
              <tr key={file.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-300" />
                    <span className="text-sm text-slate-800">{file.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 ml-6 mt-0.5 truncate max-w-md">{file.url}</div>
                </td>
                <td className="px-4 py-3">
                  {file.category && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{file.category}</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{formatDate(file.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end items-center">
                    {file.url.startsWith('http') ? (
                      <>
                        <a href={`/api/download?url=${encodeURIComponent(file.url)}&inline=1`}
                          target="_blank" rel="noopener noreferrer"
                          title="Ver documento"
                          className="text-slate-300 hover:text-[var(--brand-gold)] transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <a href={`/api/download?url=${encodeURIComponent(file.url)}`}
                          download
                          title="Descargar"
                          className="text-slate-300 hover:text-[var(--brand-teal)] transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </a>
                      </>
                    ) : (
                      <span title="Almacenamiento no configurado — configure Cloudinary para habilitar enlaces"
                        className="text-[10px] text-slate-300 italic">sin URL</span>
                    )}
                    <button onClick={() => deleteMut.mutate(file.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">Sin archivos en esta categoría.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
