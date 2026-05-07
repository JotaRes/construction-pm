import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, drawsApi, docParseApi } from '../lib/api'
import { formatUSD, formatPct, formatDate } from '../lib/calculations'
import type { Project, Draw } from '../lib/types'
import { Upload, CheckCircle, X, AlertTriangle, FileText } from 'lucide-react'

function Row({ label, value, highlight = false, sub }: { label: string; value: string; highlight?: boolean; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-200">
      <div>
        <span className="text-sm text-slate-500">{label}</span>
        {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
      </div>
      <span className={`text-sm font-mono ${highlight ? 'text-emerald-400 font-semibold' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}

const HUD_LABELS: Record<string, string> = {
  settlementDate: 'Fecha Settlement',
  loanAmount: 'Loan Amount',
  cashAtSettlement: 'Cash at Settlement',
  closingCosts: 'Total Closing Costs',
  interestRate: 'Tasa de Interés',
  loanTermMonths: 'Plazo (meses)',
}

function HudParsePanel({ projectId, onClose, onApply }: {
  projectId: string
  onClose: () => void
  onApply: (data: Record<string, unknown>) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleParse = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const result = await docParseApi.parsePdf(projectId, file, 'HUD')
      if (!result.parsed || Object.keys(result.parsed).filter(k => k !== 'pdfUrl').length === 0) {
        setError('No se encontraron datos en el PDF. Asegúrate de que sea un Closing Disclosure o HUD-1 válido. Revisa el texto extraído abajo.')
      }
      setParsed(result.parsed ?? {})
      setPreview(result.preview ?? '')
    } catch {
      setError('Error procesando el archivo. Verifica que sea un PDF válido.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!parsed) return
    const fields = ['settlementDate', 'loanAmount', 'cashAtSettlement', 'closingCosts', 'interestRate', 'loanTermMonths']
    const data: Record<string, unknown> = {}
    fields.forEach(f => { if (parsed[f] !== undefined && parsed[f] !== null) data[f] = parsed[f] })
    onApply(data)
    onClose()
  }

  const fmtValue = (k: string, v: unknown) => {
    if (k === 'settlementDate') return formatDate(v as string)
    if (k === 'interestRate') return `${((v as number) * 100).toFixed(3)}%`
    if (k === 'loanTermMonths') return `${v} meses`
    if (typeof v === 'number') return formatUSD(v as number)
    return String(v)
  }

  const applyableFields = parsed ? Object.entries(parsed).filter(([k]) => k !== 'pdfUrl') : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/40">
          <div>
            <div className="text-sm font-semibold text-slate-900">Cargar Closing Disclosure / HUD-1</div>
            <div className="text-xs text-slate-400 mt-0.5">El sistema extrae automáticamente los datos del cierre del préstamo</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-[#C8922A]/40 text-slate-700 text-sm rounded-xl transition-all">
                <Upload className="w-4 h-4" />
                {file ? file.name : 'Seleccionar PDF'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => { setFile(e.target.files?.[0] ?? null); setParsed(null) }} />
              {file && (
                <button onClick={handleParse} disabled={loading}
                  className="px-4 py-2.5 bg-[#C8922A] hover:bg-[#E0AD4F] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                  {loading ? 'Extrayendo...' : 'Extraer datos'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400">Soporta Closing Disclosure (CD) y HUD-1 · hasta 50 MB</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          {parsed && applyableFields.length > 0 && (
            <>
              <div className="bg-white/60 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-700">Datos extraídos del documento</span>
                </div>
                <div className="space-y-1.5">
                  {applyableFields.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between bg-slate-50/60 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-slate-400 uppercase">{HUD_LABELS[k] ?? k}</span>
                      <span className="text-xs font-mono text-[#2D4B52] font-semibold">{fmtValue(k, v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleApply}
                className="w-full py-2.5 bg-[#2D4B52] hover:bg-[#3A5F68] text-white text-sm font-semibold rounded-xl transition-colors">
                Guardar en el proyecto
              </button>
            </>
          )}

          {parsed && applyableFields.length === 0 && !error && (
            <div className="text-xs text-slate-400 text-center py-2">
              No se extrajeron campos reconocibles. Revisa el texto del PDF abajo.
            </div>
          )}

          {preview && (
            <details className="text-[10px] text-slate-400 font-mono">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-500 transition-colors">
                <FileText className="w-3 h-3 inline mr-1" />Ver texto extraído del PDF
              </summary>
              <pre className="mt-2 bg-slate-100 rounded-lg p-3 overflow-x-auto max-h-48 text-slate-600 whitespace-pre-wrap">{preview}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Financial({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showHud, setShowHud] = useState(false)

  const { data: project, isLoading: loadingP } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  })
  const { data: draws = [] } = useQuery<Draw[]>({
    queryKey: ['draws', projectId],
    queryFn: () => drawsApi.list(projectId),
  })

  const patchProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.patch(projectId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  })

  if (loadingP || !project) return <div className="text-slate-500 text-sm animate-pulse">Cargando modelo financiero...</div>

  const today = new Date()
  const wiredDraws = draws.filter(d => d.estado === 'WIRED')
  const totalDrawn = wiredDraws.reduce((s, d) => s + d.netWire, 0)
  const upb = totalDrawn

  const startDate = project.startDate ? new Date(project.startDate) : new Date()
  const diasDesde = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / 86400000))
  const dailyRate = project.interestRate / 365
  const interestSoFar = upb * dailyRate * diasDesde
  const plazoTarget = project.loanTermMonths * 30
  const interestTotal = upb * dailyRate * plazoTarget

  const commissions = project.arv * (project.listingCommission + project.buyerCommission)
  const gananciaBreve = project.arv - project.constructionBudget - project.closingCosts - commissions - interestTotal
  const roi = project.constructionBudget > 0 ? (gananciaBreve / project.constructionBudget) * 100 : 0
  const margen = project.arv > 0 ? (gananciaBreve / project.arv) * 100 : 0

  const saldoHoldback = project.holdback - totalDrawn

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Modelo Financiero</h1>
          <p className="text-sm text-slate-500 mt-0.5">Non-Dutch daily accrual · Tasa 8.5% anual · Hera Holdings LLC</p>
        </div>
        <button onClick={() => setShowHud(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2D4B52] hover:bg-[#3A5F68] text-white text-sm font-medium rounded-xl transition-colors">
          <Upload className="w-4 h-4" />
          Cargar HUD / Closing Disclosure
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Loan */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Estructura del Préstamo</h2>
          <Row label="Loan Amount" value={formatUSD(project.loanAmount)} />
          <Row label="Day 1 Disbursement" value={formatUSD(project.day1Disbursement)} />
          <Row label="Interest Reserve" value={formatUSD(project.interestReserve)} />
          <Row label="Holdback disponible" value={formatUSD(project.holdback)} />
          <Row label="Tasa anual" value={formatPct(project.interestRate * 100, 2)} />
          <Row label="Tasa diaria" value={`${(dailyRate * 100).toFixed(5)}%`} />
          <Row label="Plazo" value={`${project.loanTermMonths} meses`} />
          <Row label="Settlement date" value={formatDate(project.settlementDate)} />
          <Row label="Cash at Settlement" value={formatUSD(project.cashAtSettlement)} />
          <Row label="Total closing costs" value={formatUSD(project.closingCosts)} />
        </div>

        {/* Estado actual */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Estado Actual del Préstamo</h2>
          <Row label="UPB actual (saldo)" value={formatUSD(upb)} />
          <Row label="Total drawns (wired)" value={formatUSD(totalDrawn)} />
          <Row label="Saldo holdback" value={formatUSD(saldoHoldback)} />
          <Row label="Días desde settlement" value={`${diasDesde}d`} />
          <Row label="Interés acumulado a hoy" value={formatUSD(interestSoFar)} sub="UPB × tasa diaria × días" />
          <Row label="Interés estimado total" value={formatUSD(interestTotal)} sub={`Proyectado a ${project.loanTermMonths} meses`} />
          <Row label="Costo diario actual" value={formatUSD(upb * dailyRate)} sub="Por día de UPB actual" />
        </div>

        {/* Valoración */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Valoración y Rentabilidad</h2>
          <Row label="ARV (Appraisal)" value={formatUSD(project.arv)} />
          <Row label="ARV $/SF" value={`$${(project.arv / project.sfHeated).toFixed(0)}/SF`} />
          <Row label="Construction Budget" value={formatUSD(project.constructionBudget)} />
          <Row label="Closing Costs" value={formatUSD(project.closingCosts)} />
          <Row label="Comisiones venta" value={formatUSD(commissions)} sub={`${((project.listingCommission + project.buyerCommission) * 100).toFixed(1)}% de ARV`} />
          <Row label="Interés total estimado" value={formatUSD(interestTotal)} />
          <div className="mt-2 pt-2 border-t border-slate-200">
            <Row label="GANANCIA BRUTA ESPERADA" value={formatUSD(gananciaBreve)} highlight />
            <Row label="ROI" value={`${roi.toFixed(1)}%`} />
            <Row label="Margen sobre ARV" value={`${margen.toFixed(1)}%`} />
          </div>
        </div>

        {/* Benchmark */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Benchmarks y Controles</h2>
          <Row label="SF Heated (living area)" value={`${project.sfHeated} SF`} />
          <Row label="SF Garage" value={`${project.sfGarage} SF`} />
          <Row label="SF Porches" value={`${project.sfPorches} SF`} />
          <Row label="SF Total bruto" value={`${project.sfHeated + project.sfGarage + project.sfPorches} SF`} />
          <div className="mt-3 pt-3 border-t border-slate-200">
            <Row label="Benchmark $/SF target" value={`$${project.benchmarkSfTarget}/SF`} />
            <Row label="Target margin bruto" value={formatPct(project.targetMarginPct * 100)} />
            <Row label="% Contingencia" value={formatPct(project.contingencyPct * 100)} />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200">
            <Row label="Margen real vs target" value={`${margen.toFixed(1)}% vs ${(project.targetMarginPct * 100).toFixed(0)}%`}
              highlight={margen >= project.targetMarginPct * 100} />
          </div>
        </div>
      </div>

      {showHud && (
        <HudParsePanel
          projectId={projectId}
          onClose={() => setShowHud(false)}
          onApply={data => patchProject.mutate(data)}
        />
      )}
    </div>
  )
}
