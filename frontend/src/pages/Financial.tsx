import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { projectsApi, drawsApi, docParseApi, constructionBudgetApi } from '../lib/api'
import { formatUSD, formatPct, formatDate } from '../lib/calculations'
import type { Project, Draw } from '../lib/types'

interface BudgetLine {
  id: string
  itemCode: string
  description: string
  valorInicial: number
  valorPresentado: number
  valorAprobado: number
}
import { Upload, CheckCircle, X, AlertTriangle, FileText, FileSignature, Receipt, Building2, FileQuestion, Calendar, TrendingUp, Activity, DollarSign, Mail, MessageCircle, Download, BarChart3 } from 'lucide-react'

function Row({ label, value, highlight = false, sub, warn = false }: {
  label: string; value: string; highlight?: boolean; sub?: string; warn?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-200">
      <div>
        <span className="text-sm text-slate-500">{label}</span>
        {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
      </div>
      <span className={`text-sm font-mono ${
        warn ? 'text-red-500 font-semibold' :
        highlight ? 'text-emerald-500 font-semibold' :
        'text-slate-800'}`}>{value}</span>
    </div>
  )
}

// Botones de share (email, WhatsApp, descarga)
function ShareButtons({ url, label }: { url: string; label: string }) {
  const subject = encodeURIComponent(`Documento: ${label}`)
  const body    = encodeURIComponent(`Documento "${label}":\n\n${url}`)
  const wa      = encodeURIComponent(`Documento "${label}":\n${url}`)
  return (
    <div className="flex items-center gap-1">
      <a href={url} download target="_blank" rel="noreferrer" title="Descargar"
        className="text-slate-400 hover:text-[var(--brand-teal)] p-1 rounded transition-colors">
        <Download className="w-3.5 h-3.5" />
      </a>
      <a href={`mailto:?subject=${subject}&body=${body}`} title="Enviar por email"
        className="text-slate-400 hover:text-[var(--brand-gold)] p-1 rounded transition-colors">
        <Mail className="w-3.5 h-3.5" />
      </a>
      <a href={`https://wa.me/?text=${wa}`} target="_blank" rel="noreferrer" title="Compartir WhatsApp"
        className="text-slate-400 hover:text-green-600 p-1 rounded transition-colors">
        <MessageCircle className="w-3.5 h-3.5" />
      </a>
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
  contractSalesPrice: 'Precio de compra',
  holdback: 'Holdback (construction funds)',
}

const LOAN_LABELS: Record<string, string> = {
  lender: 'Lender (Prestamista)',
  loanNumber: 'Número de préstamo',
  loanAmount: 'Loan Amount (monto)',
  interestRate: 'Tasa de Interés',
  loanTermMonths: 'Plazo (meses)',
  holdback: 'Holdback (retención)',
  day1Disbursement: 'Day 1 Disbursement',
  interestReserve: 'Interest Reserve',
  settlementDate: 'Fecha Settlement',
}

const LOI_LABELS: Record<string, string> = {
  loiSalePrice: 'Precio ofertado',
  loiOfferDate: 'Fecha de oferta',
  loiExpectedClose: 'Cierre esperado',
  loiEarnestMoney: 'Earnest money',
}

interface ParsePanelConfig {
  title: string
  subtitle: string
  docType: 'HUD' | 'LOAN' | 'LOI' | 'OTROS'
  applyFields: string[]
  labels: Record<string, string>
  /** Cómo se nombran las URL+name al persistir en el proyecto */
  urlKey: 'hudUrl' | 'approvalLetterUrl' | 'loiUrl' | 'otrosFinancieroUrl'
  nameKey: 'hudName' | 'approvalLetterName' | 'loiName' | 'otrosFinancieroName'
}

const HUD_CFG: ParsePanelConfig = {
  title: 'Cargar HUD-1 / Closing Disclosure',
  subtitle: 'Extrae automáticamente los datos del cierre del préstamo',
  docType: 'HUD',
  applyFields: ['settlementDate', 'loanAmount', 'cashAtSettlement', 'closingCosts', 'interestRate', 'loanTermMonths', 'contractSalesPrice', 'holdback'],
  labels: HUD_LABELS,
  urlKey: 'hudUrl', nameKey: 'hudName',
}
const LOAN_CFG: ParsePanelConfig = {
  title: 'Cargar carta de aprobación del lender',
  subtitle: 'Commitment letter — extrae monto, tasa, plazo, holdback',
  docType: 'LOAN',
  applyFields: ['lender', 'loanNumber', 'loanAmount', 'interestRate', 'loanTermMonths', 'holdback', 'day1Disbursement', 'interestReserve', 'settlementDate'],
  labels: LOAN_LABELS,
  urlKey: 'approvalLetterUrl', nameKey: 'approvalLetterName',
}
const LOI_CFG: ParsePanelConfig = {
  title: 'Cargar LOI / Letter of Intent',
  subtitle: 'Carta de oferta — extrae precio, fecha de oferta, cierre esperado',
  docType: 'LOI',
  applyFields: ['loiSalePrice', 'loiOfferDate', 'loiExpectedClose', 'loiEarnestMoney'],
  labels: LOI_LABELS,
  urlKey: 'loiUrl', nameKey: 'loiName',
}
const OTROS_CFG: ParsePanelConfig = {
  title: 'Subir otro documento financiero',
  subtitle: 'Cualquier otro documento que quieras almacenar (term sheet, modificaciones, etc.)',
  docType: 'OTROS',
  applyFields: [],
  labels: {},
  urlKey: 'otrosFinancieroUrl', nameKey: 'otrosFinancieroName',
}

function ParsePanel({ projectId, cfg, onClose, onApply }: {
  projectId: string
  cfg: ParsePanelConfig
  onClose: () => void
  onApply: (data: Record<string, unknown>) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const handleParse = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const result = await docParseApi.parsePdf(projectId, file, cfg.docType)
      const fields = Object.keys(result.parsed ?? {}).filter(k => k !== 'pdfUrl')
      if (fields.length === 0 && cfg.docType !== 'OTROS') {
        setError('No se extrajeron campos. Revisa que el PDF sea legible (no escaneado) y vea el texto extraído abajo. Aún puedes guardarlo solo como archivo.')
      }
      setParsed(result.parsed ?? {})
      setPreview(result.preview ?? '')
      // El backend además diligenció ítems de la sección Ejecución (no destructivo).
      // Refrescamos esas vistas y avisamos qué gastos/asuntos se cargaron.
      const execApplied: Array<{ itemCode: string; activity: string; applied: string[] }> = result.executionApplied ?? []
      if (execApplied.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['phases', projectId] })
        const conValor = execApplied.filter(e => e.applied.includes('valor ejecutado')).length
        toast.success(
          `✓ Ejecución diligenciada: ${execApplied.length} ítem(s) de financiamiento` +
          (conValor > 0 ? ` (${conValor} con monto de gasto)` : ''),
          { duration: 9000 },
        )
      }
    } catch {
      setError('Error procesando el archivo.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    const data: Record<string, unknown> = {}
    if (parsed) {
      cfg.applyFields.forEach(f => { if (parsed[f] !== undefined && parsed[f] !== null) data[f] = parsed[f] })
      if (parsed.pdfUrl) {
        data[cfg.urlKey] = parsed.pdfUrl
        data[cfg.nameKey] = file?.name ?? null
      }
    }
    onApply(data)
    onClose()
  }

  const fmtValue = (k: string, v: unknown) => {
    if (k === 'settlementDate' || k === 'loiOfferDate' || k === 'loiExpectedClose') return formatDate(v as string)
    if (k === 'interestRate') return `${((v as number) * 100).toFixed(3)}%`
    if (k === 'loanTermMonths') return `${v} meses`
    if (k === 'lender' || k === 'loanNumber') return String(v)
    if (typeof v === 'number') return formatUSD(v as number)
    return String(v)
  }

  const applyable = parsed ? Object.entries(parsed).filter(([k]) => k !== 'pdfUrl') : []
  const hasFile = !!parsed?.pdfUrl

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/40 sticky top-0 bg-slate-50 z-10">
          <div>
            <div className="text-sm font-semibold text-slate-900">{cfg.title}</div>
            <div className="text-xs text-slate-400 mt-0.5">{cfg.subtitle}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-[#3E5A70]/40 text-slate-700 text-sm rounded-xl transition-all">
              <Upload className="w-4 h-4" />{file ? file.name : 'Seleccionar PDF / imagen'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setParsed(null) }} />
            {file && (
              <button onClick={handleParse} disabled={loading}
                className="px-4 py-2.5 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                {loading ? 'Procesando...' : cfg.docType === 'OTROS' ? 'Subir archivo' : 'Extraer datos'}
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <span className="text-xs text-amber-700">{error}</span>
            </div>
          )}

          {parsed && applyable.length > 0 && (
            <div className="bg-white border border-emerald-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold text-slate-700">Datos extraídos del documento</span>
              </div>
              <div className="space-y-1.5">
                {applyable.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-[10px] text-slate-500 uppercase">{cfg.labels[k] ?? k}</span>
                    <span className="text-xs font-mono text-[var(--brand-teal)] font-semibold">{fmtValue(k, v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed && hasFile && (
            <button onClick={handleApply}
              className="w-full py-2.5 bg-[var(--brand-teal)] hover:bg-[#48484A] text-white text-sm font-semibold rounded-xl transition-colors">
              Guardar en el proyecto {applyable.length > 0 ? `(${applyable.length} datos + archivo)` : '(solo archivo)'}
            </button>
          )}

          {preview && (
            <details className="text-[10px] text-slate-400 font-mono">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-600 transition-colors">
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

// Slot visual para cada doc requerido (LOI/Approval/HUD/Otros) con alerta si falta
function DocStatus({ label, icon: Icon, url, name, onUpload }: {
  label: string
  icon: React.FC<{ className?: string }>
  url: string | null
  name: string | null
  onUpload: () => void
}) {
  const missing = !url
  return (
    <div className={`rounded-xl border p-3 ${missing ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${missing ? 'text-red-500' : 'text-emerald-600'}`} />
        <div className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider flex-1">{label}</div>
        {missing
          ? <span className="text-[9px] text-red-700 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />FALTA</span>
          : <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" />OK</span>}
      </div>
      {url ? (
        <div className="space-y-1.5">
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-slate-700 hover:text-[var(--brand-gold)] truncate block">
            {name || 'Documento cargado'}
          </a>
          <div className="flex items-center justify-between">
            <ShareButtons url={url} label={label} />
            <button onClick={onUpload} className="text-[10px] text-slate-400 hover:text-[var(--brand-gold)]">Reemplazar</button>
          </div>
        </div>
      ) : (
        <button onClick={onUpload} className="w-full text-xs text-red-700 border border-dashed border-red-300 px-2 py-1.5 rounded hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
          <Upload className="w-3 h-3" />Subir documento
        </button>
      )}
    </div>
  )
}

// ── Sales projections ────────────────────────────────────────────────────────
// Director Constructivo view: rentabilidad por escenario de venta, basado en
// gastos EJECUTADOS (lo que el lender ya aprobó vía draws) + interés acumulado
// hasta hoy + costos futuros hasta la venta proyectada.
//
// Toda variable de entrada se toma del estado del proyecto:
//   - executedSpend = Σ valorAprobado del construction budget (= lo que el
//     lender ha reconocido en los draws). Si está en 0, fallback a
//     project.constructionBudget para no quedar ciegos.
//   - cashInvested = cashAtSettlement + closingCosts (equity de bolsillo)
//   - daysToSale = days hasta targetCompletionDate+60, o loan maturity, o 180
//   - interest hoy = UPB × dailyRate × diasDesde
//   - interest futuro = UPB × dailyRate × daysToSale
interface SalesProjectionInputs {
  pricePerSqft: number       // user-controlled
  sfHeated: number
  upb: number
  dailyRate: number
  interestSoFar: number
  executedSpend: number      // lender-approved costs to date
  remainingBudget: number    // budget pending to complete (so total cost includes finishing)
  closingCosts: number
  commissionPct: number      // listing + buyer
  cashInvested: number       // out-of-pocket equity (cash at settlement + closing)
  daysToSale: number         // from today to projected sale
}
interface ScenarioResult {
  label: string
  bandPct: number
  pricePerSqft: number
  saleValue: number
  realtorFees: number
  interestSoFar: number      // already accrued
  interestFuture: number     // interest from today → sale date
  executedSpend: number
  remainingBudget: number
  closingCosts: number
  totalCost: number
  netProfit: number
  roi: number                // net / cash invested
  margin: number             // net / sale value
}

function computeScenario(label: string, bandPct: number, i: SalesProjectionInputs): ScenarioResult {
  const adjustedPpsf = Math.max(0, i.pricePerSqft * (1 + bandPct))
  const saleValue = adjustedPpsf * i.sfHeated
  const realtorFees = saleValue * i.commissionPct
  const interestFuture = i.upb * i.dailyRate * i.daysToSale
  const totalCost = i.executedSpend + i.remainingBudget + i.closingCosts + i.interestSoFar + interestFuture + realtorFees
  const netProfit = saleValue - totalCost
  const roi = i.cashInvested > 0 ? (netProfit / i.cashInvested) * 100 : 0
  const margin = saleValue > 0 ? (netProfit / saleValue) * 100 : 0
  return {
    label, bandPct,
    pricePerSqft: adjustedPpsf,
    saleValue, realtorFees,
    interestSoFar: i.interestSoFar,
    interestFuture,
    executedSpend: i.executedSpend,
    remainingBudget: i.remainingBudget,
    closingCosts: i.closingCosts,
    totalCost, netProfit, roi, margin,
  }
}

function breakevenPricePerSqft(i: SalesProjectionInputs): number {
  const fixedCosts = i.executedSpend + i.remainingBudget + i.closingCosts + i.interestSoFar + (i.upb * i.dailyRate * i.daysToSale)
  if (i.sfHeated <= 0) return 0
  const denom = Math.max(0.001, 1 - i.commissionPct)
  return (fixedCosts / denom) / i.sfHeated
}

function ScenarioCard({ s, breakeven, accent }: { s: ScenarioResult; breakeven: number; accent: 'pessimist' | 'base' | 'optimist' }) {
  const profitable = s.netProfit > 0
  const beatsBreakeven = s.pricePerSqft >= breakeven
  const accentBg = accent === 'optimist' ? 'from-emerald-50 to-white border-emerald-200'
    : accent === 'pessimist' ? 'from-red-50 to-white border-red-200'
    : 'from-slate-50 to-white border-slate-200'
  const accentLabel = accent === 'optimist' ? 'text-emerald-700' : accent === 'pessimist' ? 'text-red-700' : 'text-slate-700'
  return (
    <div className={`rounded-xl border bg-gradient-to-b ${accentBg} p-4 space-y-2`}>
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-[10px] uppercase font-bold tracking-wider ${accentLabel}`}>{s.label}</div>
          <div className="text-[10px] text-slate-500">{s.bandPct === 0 ? 'precio base' : `${(s.bandPct * 100).toFixed(0)}% vs base`}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 uppercase">$/sqft</div>
          <div className="font-mono font-bold text-sm text-slate-800">${s.pricePerSqft.toFixed(0)}</div>
        </div>
      </div>

      <div className="border-t border-slate-200/60 pt-2 space-y-0.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Sale value</span>
          <span className="font-mono font-bold text-slate-800">{formatUSD(s.saleValue)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400">− Gastos ejecutados (lender)</span>
          <span className="font-mono text-slate-600">−{formatUSD(s.executedSpend)}</span>
        </div>
        {s.remainingBudget > 0 && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">− Falta por ejecutar (budget)</span>
            <span className="font-mono text-slate-600">−{formatUSD(s.remainingBudget)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400">− Closing costs</span>
          <span className="font-mono text-slate-600">−{formatUSD(s.closingCosts)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400">− Interés acumulado a hoy</span>
          <span className="font-mono text-slate-600">−{formatUSD(s.interestSoFar)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400">− Interés futuro hasta venta</span>
          <span className="font-mono text-slate-600">−{formatUSD(s.interestFuture)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400">− Realtor fees</span>
          <span className="font-mono text-slate-600">−{formatUSD(s.realtorFees)}</span>
        </div>
      </div>

      <div className="border-t border-slate-300 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-700">NET PROFIT</span>
          <span className={`font-mono text-base font-bold ${profitable ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatUSD(s.netProfit)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="text-[10px] text-slate-500">
            ROI cash: <span className={`font-mono font-bold ${s.roi > 15 ? 'text-emerald-600' : s.roi > 0 ? 'text-slate-700' : 'text-red-600'}`}>{s.roi.toFixed(1)}%</span>
          </div>
          <div className="text-[10px] text-slate-500 text-right">
            Margen: <span className={`font-mono font-bold ${s.margin > 15 ? 'text-emerald-600' : s.margin > 0 ? 'text-slate-700' : 'text-red-600'}`}>{s.margin.toFixed(1)}%</span>
          </div>
        </div>
        {breakeven > 0 && !beatsBreakeven && (
          <div className="mt-1 text-[10px] text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />Bajo breakeven (${breakeven.toFixed(0)}/sqft)
          </div>
        )}
      </div>
    </div>
  )
}

// Small inline editable field — saves on blur.
function InlineNum({ value, onSave, placeholder, suffix }: {
  value: number; onSave: (v: number) => void; placeholder?: string; suffix?: string
}) {
  const [text, setText] = useState<string>(value > 0 ? String(value) : '')
  return (
    <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1">
      <input
        type="number"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, parseFloat(text) || 0)
          if (n !== value) onSave(n)
        }}
        placeholder={placeholder ?? '0'}
        className="w-20 bg-transparent text-right font-mono text-xs text-slate-800 focus:outline-none"
      />
      {suffix && <span className="text-[10px] text-slate-400 ml-0.5">{suffix}</span>}
    </div>
  )
}

function SalesProjections({ project, upb, dailyRate, interestSoFar, projectId, budgetLines }: {
  project: Project
  upb: number
  dailyRate: number
  interestSoFar: number
  projectId: string
  budgetLines: BudgetLine[]
}) {
  const queryClient = useQueryClient()

  // Real executed spend = sum of approved budget lines (the lender's official
  // recognition of completed work via the draw approvals). Falls back to the
  // project's constructionBudget header if no lines have been initialized.
  const executedSpend = budgetLines.reduce((s, l) => s + (l.valorAprobado || 0), 0)
  const totalBudget = budgetLines.reduce((s, l) => s + (l.valorInicial || 0), 0) || (project.constructionBudget ?? 0)
  const remainingBudget = Math.max(0, totalBudget - executedSpend)

  // Bootstrap manual input from saved value, falling back to ARV/sfHeated
  const savedPpsf = project.expectedPricePerSqft || 0
  const fallbackPpsf = project.sfHeated > 0 && project.arv > 0 ? Math.round(project.arv / project.sfHeated) : 0
  const [pricePerSqft, setPricePerSqft] = useState<number>(savedPpsf > 0 ? savedPpsf : fallbackPpsf)
  // When the saved value upstream changes (e.g. another tab or after a save), pull it in.
  useEffect(() => {
    if (savedPpsf > 0 && Math.abs(savedPpsf - pricePerSqft) > 0.005) setPricePerSqft(savedPpsf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPpsf])

  // Days until projected sale.
  const today = new Date()
  let daysToSale = 180
  if (project.targetCompletionDate) {
    const targetSale = new Date(new Date(project.targetCompletionDate).getTime() + 60 * 86400000)
    daysToSale = Math.max(30, Math.ceil((targetSale.getTime() - today.getTime()) / 86400000))
  } else if (project.settlementDate) {
    const maturity = new Date(new Date(project.settlementDate).getTime() + project.loanTermMonths * 30 * 86400000)
    if (maturity.getTime() > today.getTime()) {
      daysToSale = Math.ceil((maturity.getTime() - today.getTime()) / 86400000)
    }
  }

  const commissionPct = (project.listingCommission ?? 0) + (project.buyerCommission ?? 0)
  const cashInvested = (project.cashAtSettlement ?? 0) + (project.closingCosts ?? 0)

  const inputs: SalesProjectionInputs = {
    pricePerSqft,
    sfHeated: project.sfHeated || 0,
    upb,
    dailyRate,
    interestSoFar,
    executedSpend,
    remainingBudget,
    closingCosts: project.closingCosts || 0,
    commissionPct,
    cashInvested,
    daysToSale,
  }

  const scenarios = [
    computeScenario('Pesimista', -0.10, inputs),
    computeScenario('Conservador', 0, inputs),
    computeScenario('Optimista', +0.10, inputs),
  ]
  const breakeven = breakevenPricePerSqft(inputs)

  // Sell-today snapshot — uses pricePerSqft × sfHeated with zero future interest.
  const sellToday: ScenarioResult = computeScenario('Si vendo HOY', 0, { ...inputs, daysToSale: 0 })

  const savePpsf = useMutation({
    mutationFn: (v: number) => projectsApi.patch(projectId, { expectedPricePerSqft: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  })
  const saveSf = useMutation({
    mutationFn: (v: number) => projectsApi.patch(projectId, { sfHeated: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  })

  const missingSf = (project.sfHeated || 0) === 0
  const missingPpsf = pricePerSqft === 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--brand-gold)]" />
            Proyecciones de Venta — Escenarios de salida
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5 max-w-2xl">
            Costos en cada escenario = gastos YA ejecutados (aprobados por el lender vía draws) +
            faltante por ejecutar + closing + interés acumulado + interés futuro hasta venta + comisiones.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">SF Heated</label>
            <InlineNum value={project.sfHeated || 0} onSave={v => saveSf.mutate(v)} suffix="sf" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Precio esperado</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-slate-400 text-xs">$</span>
              <input
                type="number"
                value={pricePerSqft || ''}
                onChange={e => setPricePerSqft(Math.max(0, parseFloat(e.target.value) || 0))}
                onBlur={() => { if (Math.abs(pricePerSqft - (project.expectedPricePerSqft || 0)) > 0.005) savePpsf.mutate(pricePerSqft) }}
                placeholder="0"
                className="w-20 bg-transparent text-right font-mono text-xs text-slate-800 focus:outline-none"
              />
              <span className="text-slate-400 text-[10px] ml-0.5">/sqft</span>
            </div>
          </div>
        </div>
      </div>

      {(missingSf || missingPpsf) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {missingSf && missingPpsf
            ? 'Define SF Heated y precio esperado $/sqft para ver las proyecciones.'
            : missingSf
              ? 'Define los SF Heated del proyecto.'
              : 'Ingresa un precio esperado $/sqft.'}
        </div>
      )}

      {!missingSf && !missingPpsf && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ScenarioCard s={scenarios[0]} breakeven={breakeven} accent="pessimist" />
            <ScenarioCard s={scenarios[1]} breakeven={breakeven} accent="base" />
            <ScenarioCard s={scenarios[2]} breakeven={breakeven} accent="optimist" />
          </div>

          {/* "Si vendo HOY" — snapshot a precio base */}
          <div className="bg-gradient-to-r from-[#1D1D1F]/10 to-[#3E5A70]/10 border border-[#1D1D1F]/20 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <div>
              <div className="text-slate-500 uppercase text-[9px]">Si vendo HOY (sin esperar)</div>
              <div className="font-mono font-bold text-sm text-slate-800">{formatUSD(sellToday.saleValue)}</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase text-[9px]">Net si vendo HOY</div>
              <div className={`font-mono font-bold text-sm ${sellToday.netProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatUSD(sellToday.netProfit)}</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase text-[9px]">Costo de esperar a venta proyectada</div>
              <div className="font-mono font-bold text-sm text-[var(--brand-gold)]">−{formatUSD(scenarios[1].interestFuture)}</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase text-[9px]">Net en escenario base</div>
              <div className={`font-mono font-bold text-sm ${scenarios[1].netProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatUSD(scenarios[1].netProfit)}</div>
            </div>
          </div>

          {/* Diagnostic strip: inputs that drive the scenarios */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 md:grid-cols-6 gap-3 text-[10px]">
            <div>
              <div className="text-slate-400 uppercase">SF Heated</div>
              <div className="font-mono font-bold text-slate-700">{project.sfHeated} sf</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase">Días a venta</div>
              <div className="font-mono font-bold text-slate-700">{daysToSale}d</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase">UPB hoy</div>
              <div className="font-mono font-bold text-slate-700">{formatUSD(upb)}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase">Ejecutado (lender)</div>
              <div className="font-mono font-bold text-emerald-700">{formatUSD(executedSpend)}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase">Falta ejecutar</div>
              <div className="font-mono font-bold text-slate-700">{formatUSD(remainingBudget)}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase">Breakeven $/sqft</div>
              <div className="font-mono font-bold text-[var(--brand-gold)]">${breakeven.toFixed(0)}</div>
            </div>
          </div>

          {/* Director-level read */}
          <div className="bg-[#1D1D1F]/5 border border-[#1D1D1F]/15 rounded-lg p-3 text-[11px] text-slate-700">
            <strong className="text-[var(--brand-teal)]">Lectura del director: </strong>
            {scenarios[0].netProfit > 0 ? (
              <>Incluso en el pesimista (${scenarios[0].pricePerSqft.toFixed(0)}/sqft) el proyecto deja {formatUSD(scenarios[0].netProfit)} —
              la decisión es de timing y velocidad, no de viabilidad.</>
            ) : scenarios[1].netProfit > 0 ? (
              <>El conservador da {formatUSD(scenarios[1].netProfit)} pero el pesimista entra en pérdida.
              Cualquier retraso quema utilidad: cada día cuesta {formatUSD(upb * dailyRate)} en interés. Vigila tiempo y costos.</>
            ) : breakeven > 0 ? (
              <>Incluso el conservador da pérdida ({formatUSD(scenarios[1].netProfit)}). Necesitas vender sobre ${breakeven.toFixed(0)}/sqft para cubrir costos,
              o reducir el faltante por ejecutar y/o acelerar la venta para bajar carrying.</>
            ) : (
              <>Falta información para evaluar — completa precio $/sqft y SF Heated.</>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function Financial({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [activePanel, setActivePanel] = useState<ParsePanelConfig | null>(null)

  const { data: project, isLoading: loadingP } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  })
  const { data: draws = [] } = useQuery<Draw[]>({
    queryKey: ['draws', projectId],
    queryFn: () => drawsApi.list(projectId),
  })
  const { data: budgetLines = [] } = useQuery<BudgetLine[]>({
    queryKey: ['construction-budget', projectId],
    queryFn: () => constructionBudgetApi.list(projectId),
  })

  const patchProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.patch(projectId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  })

  if (loadingP || !project) return <div className="text-slate-500 text-sm animate-pulse">Cargando modelo financiero...</div>

  const today = new Date()
  // Count every draw that actually moved money (netWire > 0), regardless of
  // whether the user has flipped its estado from PENDING to WIRED — netWire
  // is what's already left the lender, and that's what accrues interest.
  const disbursedDraws = draws.filter(d => d.netWire > 0 && d.estado !== 'EMPTY')
  const totalDrawn = disbursedDraws.reduce((s, d) => s + d.netWire, 0)
  const upb = totalDrawn

  // startDate falls back to settlementDate (loan funding date) when the
  // construction start hasn't been entered yet — so the dashboard begins
  // showing real numbers as soon as the HUD is uploaded.
  const startDate = project.startDate ? new Date(project.startDate)
    : project.settlementDate ? new Date(project.settlementDate)
    : new Date()
  const diasDesde = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / 86400000))
  const dailyRate = project.interestRate / 365
  const interestSoFar = upb * dailyRate * diasDesde
  const plazoTarget = project.loanTermMonths * 30
  const interestTotal = upb * dailyRate * plazoTarget
  const dailyBurn = upb * dailyRate

  const commissions = project.arv * (project.listingCommission + project.buyerCommission)
  const gananciaBreve = project.arv - project.constructionBudget - project.closingCosts - commissions - interestTotal
  const roi = project.constructionBudget > 0 ? (gananciaBreve / project.constructionBudget) * 100 : 0
  const margen = project.arv > 0 ? (gananciaBreve / project.arv) * 100 : 0

  const saldoHoldback = project.holdback - totalDrawn

  // CFO Analytics
  const diasTotalLoan = project.loanTermMonths * 30
  const diasRestantes = Math.max(0, diasTotalLoan - diasDesde)
  const consumoLoanPct = diasTotalLoan > 0 ? (diasDesde / diasTotalLoan) * 100 : 0
  const targetCompletionDate = project.targetCompletionDate ? new Date(project.targetCompletionDate) : null
  const diasParaTarget = targetCompletionDate
    ? Math.ceil((targetCompletionDate.getTime() - today.getTime()) / 86400000)
    : null
  // ¿Cuándo expira el plazo del lender?
  const loanExpiresOn = project.settlementDate
    ? new Date(new Date(project.settlementDate).getTime() + diasTotalLoan * 86400000)
    : null

  // LOI gap analysis
  const loiVsArv = project.loiSalePrice && project.arv ? project.loiSalePrice - project.arv : null
  const loiClosedAlready = project.loiExpectedClose ? new Date(project.loiExpectedClose) < today : null

  // Validación de documentos requeridos
  const missingDocs: string[] = []
  if (!project.loiUrl) missingDocs.push('LOI')
  if (!project.approvalLetterUrl) missingDocs.push('Aprobación del lender')
  if (!project.hudUrl) missingDocs.push('HUD / Closing Disclosure')
  // "Otros" no es obligatorio

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><BarChart3 className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>Modelo Financiero CFO</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">Non-Dutch daily accrual · Análisis de timing & rate para toma de decisión</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setActivePanel(LOI_CFG)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-[#3E5A70]/40 text-slate-700 text-xs font-medium rounded-xl transition-colors">
            <FileSignature className="w-3.5 h-3.5" />LOI
          </button>
          <button onClick={() => setActivePanel(LOAN_CFG)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-[#3E5A70]/40 text-slate-700 text-xs font-medium rounded-xl transition-colors">
            <Building2 className="w-3.5 h-3.5" />Aprobación lender
          </button>
          <button onClick={() => setActivePanel(HUD_CFG)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-[#3E5A70]/40 text-slate-700 text-xs font-medium rounded-xl transition-colors">
            <Receipt className="w-3.5 h-3.5" />HUD
          </button>
          <button onClick={() => setActivePanel(OTROS_CFG)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-[#3E5A70]/40 text-slate-700 text-xs font-medium rounded-xl transition-colors">
            <FileQuestion className="w-3.5 h-3.5" />Otros
          </button>
        </div>
      </div>

      {/* Validación de documentos requeridos */}
      {missingDocs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-800">
                Faltan {missingDocs.length} documento(s) financieros requerido(s)
              </div>
              <div className="text-xs text-red-700 mt-0.5">
                Para que el CFO dashboard refleje la realidad, sube: <strong>{missingDocs.join(', ')}</strong>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repositorio de documentos financieros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DocStatus label="LOI / Letter of Intent" icon={FileSignature}
          url={project.loiUrl} name={project.loiName}
          onUpload={() => setActivePanel(LOI_CFG)} />
        <DocStatus label="Aprobación lender" icon={Building2}
          url={project.approvalLetterUrl} name={project.approvalLetterName}
          onUpload={() => setActivePanel(LOAN_CFG)} />
        <DocStatus label="HUD / Closing" icon={Receipt}
          url={project.hudUrl} name={project.hudName}
          onUpload={() => setActivePanel(HUD_CFG)} />
        <DocStatus label="Otros (term sheet, mod, etc.)" icon={FileQuestion}
          url={project.otrosFinancieroUrl} name={project.otrosFinancieroName}
          onUpload={() => setActivePanel(OTROS_CFG)} />
      </div>

      {/* ── CFO DASHBOARD ─ Timing & Rate Decision Analysis ──────────────────────── */}
      <div className="bg-white border border-black/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[var(--brand-gold)]" />
          <h2 className="text-sm font-bold uppercase tracking-wider">CFO Dashboard — Análisis para toma de decisión</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-800">
          <div className="bg-[#F4F1EB] rounded-xl p-3">
            <div className="text-[10px] uppercase opacity-60 mb-1">Burn rate / día</div>
            <div className="text-lg font-bold font-mono text-[#4A6880]">{formatUSD(dailyBurn)}</div>
            <div className="text-[10px] opacity-50 mt-1">UPB × tasa diaria</div>
          </div>
          <div className="bg-[#F4F1EB] rounded-xl p-3">
            <div className="text-[10px] uppercase opacity-60 mb-1">Días del préstamo consumidos</div>
            <div className={`text-lg font-bold font-mono ${consumoLoanPct > 80 ? 'text-red-600' : consumoLoanPct > 60 ? 'text-[#4A6880]' : 'text-emerald-600'}`}>
              {consumoLoanPct.toFixed(0)}%
            </div>
            <div className="text-[10px] opacity-50 mt-1">{diasDesde}d de {diasTotalLoan}d</div>
          </div>
          <div className="bg-[#F4F1EB] rounded-xl p-3">
            <div className="text-[10px] uppercase opacity-60 mb-1">Días restantes loan</div>
            <div className={`text-lg font-bold font-mono ${diasRestantes < 60 ? 'text-red-600' : diasRestantes < 120 ? 'text-[#4A6880]' : 'text-slate-900'}`}>
              {diasRestantes}d
            </div>
            {loanExpiresOn && (
              <div className="text-[10px] opacity-50 mt-1">Vence {formatDate(loanExpiresOn.toISOString())}</div>
            )}
          </div>
          <div className="bg-[#F4F1EB] rounded-xl p-3">
            <div className="text-[10px] uppercase opacity-60 mb-1">Días al target completion</div>
            <div className={`text-lg font-bold font-mono ${
              diasParaTarget == null ? 'text-slate-400' :
              diasParaTarget < 0 ? 'text-red-600' :
              diasParaTarget < 30 ? 'text-[#4A6880]' : 'text-emerald-600'
            }`}>
              {diasParaTarget == null ? '—' : `${diasParaTarget}d`}
            </div>
            <div className="text-[10px] opacity-50 mt-1">
              {targetCompletionDate ? formatDate(targetCompletionDate.toISOString()) : 'Sin fecha objetivo'}
            </div>
          </div>
        </div>

        {/* Decisión: ¿extender vs vender vs refinanciar? */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#F4F1EB] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-[var(--brand-gold)]" />
              <div className="text-[10px] uppercase opacity-60">Costo total de espera (estimado a expiración)</div>
            </div>
            <div className="text-lg font-bold font-mono text-[#4A6880]">{formatUSD(dailyBurn * diasRestantes)}</div>
            <div className="text-[10px] opacity-50 mt-1">Si nadie compra antes</div>
          </div>
          <div className="bg-[#F4F1EB] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <div className="text-[10px] uppercase opacity-60">Si vendo HOY (estimado)</div>
            </div>
            <div className={`text-lg font-bold font-mono ${gananciaBreve > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatUSD(gananciaBreve)}
            </div>
            <div className="text-[10px] opacity-50 mt-1">ROI {roi.toFixed(1)}% · Margen {margen.toFixed(1)}%</div>
          </div>
          <div className="bg-[#F4F1EB] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-[var(--brand-gold)]" />
              <div className="text-[10px] uppercase opacity-60">LOI activo</div>
            </div>
            {project.loiSalePrice ? (
              <>
                <div className="text-lg font-bold font-mono text-slate-900">{formatUSD(project.loiSalePrice)}</div>
                <div className="text-[10px] opacity-50 mt-1">
                  {loiVsArv != null
                    ? `vs ARV: ${loiVsArv >= 0 ? '+' : ''}${formatUSD(loiVsArv)}`
                    : 'Sin ARV de referencia'}
                  {loiClosedAlready === true && ' · ⚠ ya pasó la fecha'}
                </div>
              </>
            ) : (
              <div className="text-xs opacity-60">Sin LOI cargado</div>
            )}
          </div>
        </div>
      </div>

      {/* Sales projections — 3 escenarios + breakeven */}
      <SalesProjections
        project={project}
        upb={upb}
        dailyRate={dailyRate}
        interestSoFar={interestSoFar}
        projectId={projectId}
        budgetLines={budgetLines}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Loan */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Estructura del Préstamo</h2>
          <Row label="Lender" value={project.lender || '—'} />
          <Row label="Loan Number" value={project.loanNumber || '—'} />
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
          <Row label="Saldo holdback" value={formatUSD(saldoHoldback)} warn={saldoHoldback < 50000} />
          <Row label="Días desde settlement" value={`${diasDesde}d`} />
          <Row label="Interés acumulado a hoy" value={formatUSD(interestSoFar)} sub="UPB × tasa diaria × días" />
          <Row label="Interés estimado total" value={formatUSD(interestTotal)} sub={`Proyectado a ${project.loanTermMonths} meses`} />
          <Row label="Costo diario actual" value={formatUSD(dailyBurn)} sub="Por día de UPB actual" />
        </div>

        {/* LOI Snapshot */}
        {(project.loiSalePrice || project.loiOfferDate) && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-[var(--brand-gold)]" />Letter of Intent (LOI)
            </h2>
            <Row label="Precio ofertado" value={project.loiSalePrice ? formatUSD(project.loiSalePrice) : '—'} highlight />
            <Row label="vs ARV" value={loiVsArv != null ? `${loiVsArv >= 0 ? '+' : ''}${formatUSD(loiVsArv)}` : '—'} />
            <Row label="Fecha de oferta" value={formatDate(project.loiOfferDate)} />
            <Row label="Cierre esperado" value={formatDate(project.loiExpectedClose)} warn={loiClosedAlready === true} />
            <Row label="Earnest money" value={project.loiEarnestMoney ? formatUSD(project.loiEarnestMoney) : '—'} />
          </div>
        )}

        {/* Valoración */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Valoración y Rentabilidad</h2>
          <Row label="ARV (Appraisal)" value={formatUSD(project.arv)} />
          <Row label="ARV $/SF" value={project.sfHeated > 0 ? `$${(project.arv / project.sfHeated).toFixed(0)}/SF` : '—'} />
          <Row label="Construction Budget" value={formatUSD(project.constructionBudget)} />
          <Row label="Closing Costs" value={formatUSD(project.closingCosts)} />
          <Row label="Comisiones venta" value={formatUSD(commissions)} sub={`${((project.listingCommission + project.buyerCommission) * 100).toFixed(1)}% de ARV`} />
          <Row label="Interés total estimado" value={formatUSD(interestTotal)} />
          <div className="mt-2 pt-2 border-t border-slate-200">
            <Row label="GANANCIA BRUTA ESPERADA" value={formatUSD(gananciaBreve)} highlight={gananciaBreve > 0} warn={gananciaBreve <= 0} />
            <Row label="ROI" value={`${roi.toFixed(1)}%`} highlight={roi > 15} />
            <Row label="Margen sobre ARV" value={`${margen.toFixed(1)}%`} highlight={margen >= project.targetMarginPct * 100} />
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
              highlight={margen >= project.targetMarginPct * 100}
              warn={margen < project.targetMarginPct * 100 - 5} />
          </div>
        </div>
      </div>

      {activePanel && (
        <ParsePanel
          projectId={projectId}
          cfg={activePanel}
          onClose={() => setActivePanel(null)}
          onApply={data => patchProject.mutate(data)}
        />
      )}
    </div>
  )
}
