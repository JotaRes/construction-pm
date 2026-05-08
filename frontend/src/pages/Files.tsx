import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi, drawsApi, projectsApi, drawParseApi, docParseApi } from '../lib/api'
import { formatDate, formatUSD } from '../lib/calculations'
import type { ProjectFile, Draw } from '../lib/types'
import { Plus, ExternalLink, Trash2, Upload, FileText, CheckCircle, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

const CATEGORIES = ['Contrato', 'Permiso', 'Plano', 'Seguro', 'Draw', 'HOA', 'Legal', 'Inspección', 'Otro']

const DOC_TYPES = [
  { value: 'DRAW', label: 'Draw / Inspección Trinity' },
  { value: 'HUD', label: 'HUD-1 / Closing Disclosure' },
  { value: 'BUDGET', label: 'Construction Budget (PDF)' },
  { value: 'GENERAL', label: 'Otro (solo guardar)' },
]

const FIELD_LABELS: Record<string, string> = {
  drawNumber: 'Nº de Draw',
  fechaSolicitud: 'Fecha solicitud',
  fechaInspeccion: 'Fecha inspección',
  fechaWire: 'Fecha wire',
  montoSolicitado: 'Monto solicitado',
  elegibleTrinity: 'Elegible Trinity',
  netWire: 'Net wire',
  porcentajeFunded: '% fundado',
  loanAmount: 'Monto del préstamo',
  cashAtSettlement: 'Cash al cierre',
  closingCosts: 'Costos de cierre',
  interestRate: 'Tasa de interés',
  loanTermMonths: 'Plazo (meses)',
  settlementDate: 'Fecha de cierre',
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

  async function handleExtract() {
    if (!uploadFile) return
    setExtracting(true)
    setExtractResult(null)
    setExtractError(null)
    setApplyStatus(null)
    try {
      const fd = new FormData()
      fd.append('pdf', uploadFile)
      let result: ExtractResult
      if (docType === 'DRAW') {
        result = await drawParseApi.parsePdf(projectId, uploadFile)
      } else if (docType === 'HUD') {
        result = await docParseApi.parsePdf(projectId, uploadFile, 'HUD')
      } else if (docType === 'BUDGET') {
        const r = await api.post(
          `/projects/${projectId}/construction-budget/parse-pdf`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        result = r.data.data
      } else {
        // GENERAL — just save reference, no parsing
        const fileUrl = URL.createObjectURL(uploadFile)
        await filesApi.create(projectId, { name: uploadFile.name, url: fileUrl, category: 'Otro' })
        queryClient.invalidateQueries({ queryKey: ['files', projectId] })
        setUploadFile(null)
        setExtracting(false)
        return
      }
      setExtractResult(result)
      // Auto-save file reference
      const fileLabel = `${docType} — ${uploadFile.name}`
      await filesApi.create(projectId, {
        name: fileLabel,
        url: (result.parsed?.pdfUrl as string) ?? result.imageUrl ?? uploadFile.name,
        category: docType === 'DRAW' ? 'Draw' : docType === 'HUD' ? 'Legal' : 'Otro',
      })
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        ?? (e as Error)?.message ?? 'Error desconocido'
      setExtractError(msg)
    } finally {
      setExtracting(false)
    }
  }

  async function handleApply() {
    if (!extractResult) return
    const p = extractResult.parsed
    setApplying(true)
    setApplyStatus(null)
    try {
      if (docType === 'DRAW') {
        const drawNum = p.drawNumber as number | undefined
        if (!drawNum) { setApplyStatus('⚠ No se detectó número de draw'); setApplying(false); return }
        const draw = draws.find(d => d.drawNumber === drawNum)
        if (!draw) { setApplyStatus(`⚠ Draw #${drawNum} no encontrado`); setApplying(false); return }
        const update: Record<string, unknown> = {}
        if (p.fechaSolicitud !== undefined) update.fechaSolicitud = p.fechaSolicitud
        if (p.fechaInspeccion !== undefined) update.fechaInspeccion = p.fechaInspeccion
        if (p.fechaWire !== undefined) update.fechaWire = p.fechaWire
        if (p.montoSolicitado !== undefined) update.montoSolicitado = p.montoSolicitado
        if (p.elegibleTrinity !== undefined) update.elegibleTrinity = p.elegibleTrinity
        if (p.netWire !== undefined) update.netWire = p.netWire
        if (p.porcentajeFunded !== undefined) update.porcentajeFunded = p.porcentajeFunded
        if (p.pdfUrl !== undefined) update.pdfUrl = p.pdfUrl
        await drawsApi.patch(draw.id, update)
        queryClient.invalidateQueries({ queryKey: ['draws', projectId] })
        setApplyStatus(`✓ Draw #${drawNum} actualizado`)
      } else if (docType === 'HUD') {
        const update: Record<string, unknown> = {}
        const hudFields = ['loanAmount', 'cashAtSettlement', 'closingCosts', 'interestRate', 'loanTermMonths', 'settlementDate']
        hudFields.forEach(k => { if (p[k] !== undefined) update[k] = p[k] })
        await projectsApi.patch(projectId, update)
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        setApplyStatus('✓ Datos del proyecto actualizados')
      } else if (docType === 'BUDGET') {
        setApplyStatus('✓ Budget extraído — ver "Const. Budget" para aplicar línea por línea')
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        ?? (e as Error)?.message ?? 'Error'
      setApplyStatus(`✗ Error: ${msg}`)
    } finally {
      setApplying(false)
    }
  }

  const extractedEntries = extractResult
    ? Object.entries(extractResult.parsed).filter(([k]) => k !== 'pdfUrl')
    : []

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">Cargando archivos...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Repositorio de Archivos</h1>

      {/* ── Smart PDF Upload ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#C8922A]/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Upload className="w-4 h-4 text-[#C8922A]" />
          <span className="text-sm font-semibold text-slate-800">Cargar documento y extraer datos</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tipo de documento</label>
              <select value={docType} onChange={e => { setDocType(e.target.value); setExtractResult(null); setApplyStatus(null) }}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[#C8922A]">
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Archivo</label>
              <label className="flex items-center gap-2 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-[#C8922A] transition-colors">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm truncate text-slate-600">{uploadFile ? uploadFile.name : 'Seleccionar PDF...'}</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                  onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setExtractResult(null); setApplyStatus(null) }} />
              </label>
            </div>
          </div>

          <button onClick={handleExtract} disabled={!uploadFile || extracting}
            className="flex items-center gap-2 bg-[#C8922A] hover:bg-[#E0AD4F] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
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
                  <button onClick={handleApply} disabled={applying || !!applyStatus?.startsWith('✓')}
                    className="flex items-center gap-2 bg-[#2D4B52] hover:bg-[#3A5F68] disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                    {applying ? 'Aplicando...' : '✓ Aplicar datos al proyecto'}
                  </button>
                  {applyStatus && (
                    <span className={`text-xs font-medium ${applyStatus.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {applyStatus}
                    </span>
                  )}
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
            className="bg-slate-50 text-slate-800 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#C8922A]" />
          <input placeholder="URL o path del archivo *" value={url} onChange={e => setUrl(e.target.value)}
            className="bg-slate-50 text-slate-800 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#C8922A]" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="bg-slate-50 text-slate-800 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#C8922A]">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={() => name && url && createMut.mutate()} disabled={!name || !url}
          className="flex items-center gap-2 bg-[#2D4B52] hover:bg-[#3A5F68] disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Agregar referencia
        </button>
      </div>

      {/* ── Filter tabs ───────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${filterCat === c ? 'bg-[#2D4B52] text-white' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200'}`}>
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
                  <div className="flex gap-2 justify-end">
                    {file.url.startsWith('/') || file.url.startsWith('http') ? (
                      <a href={file.url} target="_blank" rel="noopener noreferrer"
                        className="text-slate-300 hover:text-[#C8922A] transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : null}
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
