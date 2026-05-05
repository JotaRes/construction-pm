import { useQuery } from '@tanstack/react-query'
import { projectsApi, drawsApi } from '../lib/api'
import { formatUSD, formatPct, formatDate } from '../lib/calculations'
import type { Project, Draw } from '../lib/types'

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

export default function Financial({ projectId }: { projectId: string }) {
  const { data: project, isLoading: loadingP } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  })
  const { data: draws = [] } = useQuery<Draw[]>({
    queryKey: ['draws', projectId],
    queryFn: () => drawsApi.list(projectId),
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
      <div>
        <h1 className="text-xl font-bold text-slate-900">Modelo Financiero</h1>
        <p className="text-sm text-slate-500 mt-0.5">Non-Dutch daily accrual · Tasa 8.5% anual · Hera Holdings LLC</p>
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
    </div>
  )
}
