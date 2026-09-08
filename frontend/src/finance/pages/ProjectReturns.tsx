import { useQuery } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd } from "../lib/format";
import { Briefcase } from "lucide-react";
import { useI18n } from '../../i18n'

function marginColor(pct: number) {
  if (pct > 20) return "var(--ok)";
  if (pct >= 10) return "var(--warn)";
  return "var(--err)";
}

export default function ProjectReturns() {
  const { t } = useI18n()
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["project-returns"],
    queryFn: () => API.getProjectReturns(),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--brand-teal)" }}>
          {t('fin.returns.retornoPorProyecto')}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--brand-teal2)" }}>
          {t('fin.returns.roiMargenDeUtilidadYApalancamiento')}
        </p>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface-2)" }}>
          <Briefcase size={15} style={{ color: "var(--brand-gold)" }} />
          <h2 className="text-sm font-bold" style={{ color: "var(--brand-teal)" }}>{t('fin.returns.ratiosDeRentabilidad')}</h2>
        </div>
        {isLoading ? (
          <p className="text-sm py-12 text-center" style={{ color: "var(--brand-teal2)" }}>{t('common.cargando2')}</p>
        ) : data.length === 0 ? (
          <p className="text-sm py-12 text-center" style={{ color: "var(--brand-teal2)" }}>
            {t('fin.returns.aunNoHayProyectosCargadosEn')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--text-secondary)", background: "var(--bg-surface-2)" }} className="text-left">
                  {[t('fin.table.project'), "ARV", "Costo real", "Ingreso", "Profit", "Margen", "ROI", "Deuda/Equity"].map(h => (
                    <th key={h} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-4 py-2.5" style={{ color: "var(--text-primary)" }}>
                      <div className="font-medium">{p.name}</div>
                      {p.code && <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{p.code}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-secondary)" }}>{usd(p.arv || 0)}</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-secondary)" }}>{usd(p.totalInverted)}</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-secondary)" }}>{usd(p.totalIncome)}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: p.grossProfit >= 0 ? "var(--ok)" : "var(--err)" }}>{usd(p.grossProfit)}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: marginColor(p.profitMarginPct) }}>{p.profitMarginPct}%</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-primary)" }}>{p.roi}%</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-secondary)" }}>{p.debtEquityRatio ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
