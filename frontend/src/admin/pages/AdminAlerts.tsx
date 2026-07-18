import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, HelpCircle, CheckSquare, Building2, ShieldCheck } from "lucide-react";
import { AdminAPI } from "../lib/api";

const SEVERITY_META: Record<string, { label: string; card: string; color: string }> = {
  critica: { label: "Crítica", card: "alert-card-critical", color: "#ef4444" },
  alta:    { label: "Alta",    card: "alert-card-warning",  color: "#f59e0b" },
  media:   { label: "Media",   card: "alert-card-info",     color: "#7A93A6" },
};

const KIND_ICON: Record<string, typeof AlertTriangle> = {
  DOC_VENCIDO: AlertTriangle,
  DOC_POR_VENCER: Clock,
  DOC_FALTANTE: HelpCircle,
  TAREA_VENCIDA: CheckSquare,
};

export default function AdminAlerts() {
  const dashQ = useQuery({ queryKey: ["adm-dashboard"], queryFn: AdminAPI.getDashboard });
  const alertsQ = useQuery({ queryKey: ["adm-alerts"], queryFn: AdminAPI.getAlerts });

  const dash = dashQ.data;
  const alerts = alertsQ.data ?? [];

  const kpis = dash ? [
    { label: "Cumplimiento global", value: `${dash.globalCompliancePct}%`, tone: dash.globalCompliancePct >= 85 ? "#22c55e" : dash.globalCompliancePct >= 60 ? "#f59e0b" : "#ef4444" },
    { label: "Empresas", value: dash.totalCompanies, tone: "#3E5A70" },
    { label: "Documentos", value: dash.totalDocuments, tone: "var(--text-primary)" },
    { label: "Tareas pendientes", value: dash.pendingTasks, tone: "#f59e0b" },
    { label: "Alertas críticas", value: dash.alertCounts?.criticas ?? 0, tone: "#ef4444" },
  ] : [];

  return (
    <div className="space-y-5">
      <div>
        <div className="fin-page-title">Alertas de cumplimiento</div>
        <div className="fin-page-sub">Documentos vencidos, por vencer, faltantes y tareas atrasadas · en tiempo real</div>
      </div>

      {/* KPIs */}
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="fin-kpi-v2">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{k.label}</div>
              <div className="text-2xl font-bold font-mono" style={{ color: k.tone as string }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cumplimiento por empresa */}
      {dash?.perCompany?.length > 0 && (
        <div className="fin-cpanel">
          <div className="fin-cpanel-body">
            <div className="fin-tb-title mb-3 flex items-center gap-2"><ShieldCheck size={15} /> Cumplimiento por empresa</div>
            <div className="space-y-2">
              {dash.perCompany.map((c: any) => {
                const tone = c.vencidos > 0 ? "#ef4444" : c.compliancePct >= 85 ? "#22c55e" : "#f59e0b";
                return (
                  <Link key={c.id} to={`/admin/companies/${c.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)" }}>
                    <Building2 size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="flex-1 min-w-0 truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                    <div className="flex-1 max-w-[220px] h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div style={{ width: `${c.compliancePct}%`, height: "100%", background: tone }} />
                    </div>
                    <span className="font-mono text-[12px] font-semibold w-10 text-right" style={{ color: tone }}>{c.compliancePct}%</span>
                    <span className="text-[10px] w-24 text-right" style={{ color: "var(--text-muted)" }}>
                      {c.vencidos > 0 && <span style={{ color: "#ef4444" }}>{c.vencidos} venc. </span>}
                      {c.faltantes > 0 && <span>{c.faltantes} falt.</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lista de alertas */}
      <div className="fin-cpanel">
        <div className="fin-cpanel-body">
          <div className="fin-tb-title mb-3">Alertas activas ({alerts.length})</div>
          {alertsQ.isLoading ? (
            <div className="fin-page-sub">Cargando alertas…</div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center gap-2 fin-page-sub"><ShieldCheck size={16} color="#22c55e" /> Todo al día — sin alertas activas.</div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a: any, i: number) => {
                const meta = SEVERITY_META[a.severity] ?? SEVERITY_META.media;
                const Icon = KIND_ICON[a.kind] ?? AlertTriangle;
                return (
                  <Link key={i} to={`/admin/companies/${a.companyId}`} className={`${meta.card} flex items-start gap-3 px-4 py-3`}>
                    <Icon size={16} color={meta.color} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{a.title}</div>
                      <div className="text-[11.5px]" style={{ color: "var(--text-secondary)" }}>{a.detail}</div>
                      <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>{a.companyName}</div>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
