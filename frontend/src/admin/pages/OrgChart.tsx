import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus, DownloadCloud, Landmark, Building2, FileText, AlertTriangle, X,
  HardHat, Home, KeyRound, ListChecks, Briefcase,
} from "lucide-react";
import { AdminAPI, ROLE_LABELS } from "../lib/api";

// ============================================================
// Sistema visual por ROL — paleta corporativa fija (petróleo/oro/marfil).
// Cada rol tiene color, icono y descripción de su función en el grupo,
// para que el organigrama responda "qué empresa hace qué" de un vistazo.
// ============================================================
const ROLE_META: Record<string, {
  Icon: typeof Building2;
  desc: string;
  chipBg: string;
  chipColor: string;
  iconBg: string;
  iconColor: string;
  accentBar: string;
}> = {
  HOLDING: {
    Icon: Landmark,
    desc: "Matriz del grupo — consolida y controla",
    chipBg: "rgba(217,174,82,0.18)", chipColor: "#D9AE52",
    iconBg: "rgba(217,174,82,0.16)", iconColor: "#D9AE52",
    accentBar: "#C6952F",
  },
  PROPERTY_MANAGER: {
    Icon: KeyRound,
    desc: "Administra propiedades y rentas",
    chipBg: "rgba(62,90,112,0.12)", chipColor: "#3E5A70",
    iconBg: "rgba(62,90,112,0.12)", iconColor: "#3E5A70",
    accentBar: "#3E5A70",
  },
  SUBSIDIARY_OWNER: {
    Icon: Home,
    desc: "Propietaria de casa / proyecto",
    chipBg: "rgba(51,73,92,0.10)", chipColor: "#33495C",
    iconBg: "rgba(51,73,92,0.10)", iconColor: "#33495C",
    accentBar: "#86868B",
  },
  OTHER: {
    Icon: Briefcase,
    desc: "Función especial del grupo",
    chipBg: "rgba(72,72,74,0.10)", chipColor: "#48484A",
    iconBg: "rgba(72,72,74,0.08)", iconColor: "#48484A",
    accentBar: "#D2D2D7",
  },
};

// Semáforo de cumplimiento — colores semánticos del design system
const OK = "#1D9A57", WARN = "#C9820B", ERR = "#D93025";
function complianceColor(pct: number, vencidos: number): string {
  if (vencidos > 0 || pct < 50) return ERR;
  if (pct < 85) return WARN;
  return OK;
}

function CompanyCard({ c, isHolding = false }: { c: any; isHolding?: boolean }) {
  const comp = c.compliance;
  const pct = comp?.compliancePct ?? 100;
  const color = complianceColor(pct, comp?.vencidos ?? 0);
  const meta = ROLE_META[c.role] ?? ROLE_META.OTHER;
  const Icon = meta.Icon;
  const techProjects: any[] = c.techProjects ?? [];
  const finProjects: any[] = c.finProjects ?? [];
  const overdue = c.overdueTasks ?? 0;
  const pending = c.pendingTasks ?? 0;
  const hasAlerts = (comp?.vencidos ?? 0) > 0 || (comp?.faltantes ?? 0) > 0 || overdue > 0;

  return (
    <Link
      to={`/admin/companies/${c.id}`}
      className="block rounded-2xl transition-all duration-200 hover:-translate-y-0.5 overflow-hidden"
      style={{
        background: isHolding
          ? "linear-gradient(135deg, #33495C 0%, #3E5A70 100%)"
          : "var(--bg-panel, #ffffff)",
        border: `1px solid ${isHolding ? "rgba(217,174,82,0.35)" : "var(--border)"}`,
        boxShadow: "0 4px 14px rgba(29,29,31,0.08)",
        minWidth: 230,
        textDecoration: "none",
      }}
    >
      {/* Barra de acento por rol (firma visual de la jerarquía) */}
      <div style={{ height: 3, background: meta.accentBar, opacity: isHolding ? 1 : 0.8 }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: isHolding ? "rgba(217,174,82,0.16)" : meta.iconBg }}
            >
              <Icon size={16} color={isHolding ? "#D9AE52" : meta.iconColor} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: isHolding ? "#fff" : "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {c.name}
              </div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: isHolding ? "#D9AE52" : meta.chipColor }}>
                {ROLE_LABELS[c.role] ?? c.role}
                {c.finSpv ? ` · SPV ${c.finSpv.code}` : ""}
              </div>
            </div>
          </div>
          {/* Semáforo de cumplimiento */}
          <div className="flex items-center gap-1 flex-shrink-0" title={`Cumplimiento documental: ${pct}%`}>
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[11px] font-semibold" style={{ fontVariantNumeric: "tabular-nums", color: isHolding ? "#F5F5F7" : "var(--text-secondary)" }}>{pct}%</span>
          </div>
        </div>

        {/* Qué hace esta empresa */}
        <div className="text-[11px] mb-2.5" style={{ color: isHolding ? "rgba(244,241,235,0.75)" : "var(--text-muted)" }}>
          {meta.desc}
        </div>

        {/* Barra de cumplimiento */}
        <div className="h-1 rounded-full overflow-hidden mb-2.5" style={{ background: isHolding ? "rgba(255,255,255,0.15)" : "var(--border)" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 200ms ease-out" }} />
        </div>

        {/* Proyectos / propiedades a cargo — carga operativa de la LLC */}
        {(techProjects.length > 0 || finProjects.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {techProjects.slice(0, 2).map((p: any) => (
              <span key={p.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold"
                style={{ background: isHolding ? "rgba(255,255,255,0.12)" : "rgba(62,90,112,0.10)", color: isHolding ? "#F5F5F7" : "#3E5A70" }}
                title={`Obra a cargo: ${p.name}`}>
                <HardHat size={9} /> {p.name.length > 16 ? p.name.slice(0, 16) + "…" : p.name}
              </span>
            ))}
            {techProjects.length > 2 && (
              <span className="text-[9.5px]" style={{ color: isHolding ? "rgba(244,241,235,0.7)" : "var(--text-muted)" }}>+{techProjects.length - 2} obra(s)</span>
            )}
            {finProjects.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold"
                style={{ background: isHolding ? "rgba(217,174,82,0.18)" : "rgba(198,149,47,0.12)", color: isHolding ? "#D9AE52" : "#8a6a1f" }}
                title={finProjects.map((p: any) => p.name).join(", ")}>
                <Home size={9} /> {finProjects.length} propiedad(es)
              </span>
            )}
          </div>
        )}

        {/* Alertas a la vista: docs vencidos/faltantes + tareas */}
        <div className="flex items-center gap-3 text-[10.5px] flex-wrap" style={{ color: isHolding ? "rgba(244,241,235,0.7)" : "var(--text-muted)" }}>
          <span className="flex items-center gap-1"><FileText size={11} /> {c._count?.documents ?? 0} docs</span>
          {(comp?.vencidos ?? 0) > 0 && (
            <span className="flex items-center gap-1 font-semibold" style={{ color: isHolding ? "#FF8A80" : ERR }}>
              <AlertTriangle size={11} /> {comp.vencidos} vencido(s)
            </span>
          )}
          {(comp?.faltantes ?? 0) > 0 && (
            <span className="font-medium" style={{ color: isHolding ? "rgba(244,241,235,0.85)" : WARN }}>{comp.faltantes} faltante(s)</span>
          )}
          {pending > 0 && (
            <span className="flex items-center gap-1 font-medium" style={{ color: overdue > 0 ? (isHolding ? "#FF8A80" : ERR) : (isHolding ? "rgba(244,241,235,0.85)" : WARN) }}>
              <ListChecks size={11} /> {pending} tarea(s){overdue > 0 ? ` · ${overdue} VENCIDA(S)` : ""}
            </span>
          )}
          {!hasAlerts && (comp?.totalRequired ?? 0) > 0 && pct === 100 && (
            <span className="font-medium" style={{ color: isHolding ? "#9CDBB4" : OK }}>Al día</span>
          )}
        </div>
      </div>
    </Link>
  );
}

const EMPTY_FORM = { name: "", legalName: "", role: "SUBSIDIARY_OWNER", stateOfFormation: "", ein: "", registeredAgent: "", address: "", notes: "" };

// Conectores del árbol: neutros, finos, sin color decorativo
const LINE = "var(--border-strong, #D2D2D7)";

export default function OrgChart() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["adm-orgchart"], queryFn: AdminAPI.getOrgChart });
  const { data: dash } = useQuery({ queryKey: ["adm-dashboard"], queryFn: AdminAPI.getDashboard });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [error, setError] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["adm-orgchart"] });

  const importMut = useMutation({
    mutationFn: AdminAPI.importSPVs,
    onSuccess: (r) => {
      invalidate();
      window.alert(`Importación completa: ${r.imported} empresa(s) creadas desde los SPVs del módulo financiero, ${r.skipped} ya existían.`);
    },
    onError: (e: any) => window.alert(e.message),
  });

  const createMut = useMutation({
    mutationFn: (payload: any) => AdminAPI.createCompany(payload),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(EMPTY_FORM); setError(""); },
    onError: (e: any) => setError(e.message),
  });

  if (isLoading) return <div className="fin-page-sub">Cargando organigrama…</div>;

  const holding = data?.holding;
  const subsidiaries = data?.subsidiaries ?? [];
  const orphans = (data?.all ?? []).filter(
    (c: any) => c.role !== "HOLDING" && !subsidiaries.some((s: any) => s.id === c.id)
  );

  const submit = () => {
    if (!form.name.trim()) { setError("El nombre es obligatorio"); return; }
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    // Las subsidiarias nuevas se cuelgan automáticamente de la holding
    if (holding && payload.role !== "HOLDING") payload.parentId = holding.id;
    createMut.mutate(payload);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="fin-page-title">Estructura del grupo</div>
          <div className="fin-page-sub">Quién es quién, qué tiene a cargo y cómo está su cumplimiento</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="fin-btn-icon flex items-center gap-2 px-3"
            style={{ width: "auto", fontSize: 11.5, fontWeight: 600 }}
            onClick={() => importMut.mutate()}
            disabled={importMut.isPending}
            title="Crear empresas desde los SPVs registrados en el módulo financiero"
          >
            <DownloadCloud size={13} />
            {importMut.isPending ? "Importando…" : "Importar desde SPVs"}
          </button>
          <button className="fin-btn-cta flex items-center gap-2" onClick={() => setShowForm(true)}>
            <Plus size={13} /> Crear empresa
          </button>
        </div>
      </div>

      {/* Banda de KPIs de cumplimiento */}
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          {[
            { label: "Cumplimiento global", value: `${dash.globalCompliancePct}%`, tone: dash.globalCompliancePct >= 85 ? OK : dash.globalCompliancePct >= 60 ? WARN : ERR },
            { label: "Empresas", value: dash.totalCompanies, tone: "#3E5A70" },
            { label: "Socios / colab.", value: dash.totalPersons ?? 0, tone: "#3E5A70" },
            { label: "Documentos", value: (dash.totalDocuments ?? 0) + (dash.totalPersonDocuments ?? 0), tone: "var(--text-primary)" },
            { label: "Tareas pendientes", value: dash.pendingTasks, tone: (dash.overdueTasks ?? 0) > 0 ? ERR : WARN },
            { label: "Alertas críticas", value: dash.alertCounts?.criticas ?? 0, tone: ERR },
          ].map((k) => (
            <Link key={k.label} to="/admin/alerts" className="fin-kpi-v2" style={{ textDecoration: "none" }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{k.label}</div>
              <div className="text-2xl font-bold" style={{ fontVariantNumeric: "tabular-nums", color: k.tone as string }}>{k.value}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Leyenda de roles — qué significa cada color */}
      <div className="flex items-center gap-4 flex-wrap mb-5 px-1">
        {Object.entries(ROLE_META).map(([role, m]) => (
          <span key={role} className="inline-flex items-center gap-1.5 text-[10.5px]" style={{ color: "var(--text-muted)" }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: m.accentBar }} />
            {ROLE_LABELS[role] ?? role} — {m.desc}
          </span>
        ))}
      </div>

      {/* Organigrama */}
      {!holding && subsidiaries.length === 0 ? (
        <div className="fin-cpanel">
          <div className="fin-cpanel-body text-center py-10">
            <div className="fin-page-sub mb-3">Aún no hay empresas registradas.</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Usa <b>Importar desde SPVs</b> para traer las empresas ya registradas en el módulo financiero,
              o crea la holding manualmente con <b>Crear empresa</b>.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {/* Nivel 1: Holding */}
          {holding && (
            <div className="mb-0" style={{ minWidth: 320 }}>
              <CompanyCard c={holding} isHolding />
            </div>
          )}

          {/* Conector vertical */}
          {holding && subsidiaries.length > 0 && (
            <div style={{ width: 1.5, height: 28, background: LINE }} />
          )}

          {/* Conector horizontal + nivel 2 */}
          {subsidiaries.length > 0 && (
            <div className="w-full flex flex-col items-center">
              {subsidiaries.length > 1 && (
                <div
                  className="hidden md:block"
                  style={{ height: 1.5, background: LINE, width: `calc(${((subsidiaries.length - 1) / subsidiaries.length) * 100}% )`, maxWidth: 900 }}
                />
              )}
              <div className="grid gap-4 mt-0 md:mt-0 w-full justify-center" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 280px))", marginTop: subsidiaries.length > 1 ? 0 : undefined }}>
                {subsidiaries.map((s: any) => (
                  <div key={s.id} className="flex flex-col items-center">
                    <div className="hidden md:block" style={{ width: 1.5, height: 20, background: LINE }} />
                    <div className="w-full"><CompanyCard c={s} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empresas sin vincular al organigrama */}
          {orphans.length > 0 && (
            <div className="w-full mt-8">
              <div className="fin-nav-grp" style={{ paddingLeft: 0 }}>Sin vincular a la holding</div>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 280px))" }}>
                {orphans.map((c: any) => <CompanyCard key={c.id} c={c} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal crear empresa */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 overflow-y-auto" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowForm(false)}>
          <div
            className="rounded-2xl p-6 w-full max-w-lg my-auto"
            style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="fin-tb-title">Nueva empresa</div>
              <button className="fin-btn-icon" onClick={() => setShowForm(false)}><X size={13} /></button>
            </div>
            <div className="grid gap-3">
              {[
                { k: "name", label: "Nombre *", ph: "Ej: RA Property Management LLC" },
                { k: "legalName", label: "Razón social completa", ph: "" },
                { k: "ein", label: "EIN", ph: "XX-XXXXXXX" },
                { k: "stateOfFormation", label: "Estado de constitución", ph: "South Carolina" },
                { k: "registeredAgent", label: "Registered Agent", ph: "" },
                { k: "address", label: "Dirección", ph: "" },
              ].map((f) => (
                <label key={f.k} className="block">
                  <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                  <input
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--bg-panel, #fff)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    placeholder={f.ph}
                    value={form[f.k] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Rol en el grupo</span>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-panel, #fff)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="HOLDING">Holding (matriz)</option>
                  <option value="PROPERTY_MANAGER">Property Manager (administradora)</option>
                  <option value="SUBSIDIARY_OWNER">Propietaria de casa/proyecto</option>
                  <option value="OTHER">Otra</option>
                </select>
              </label>
              {error && <div className="text-xs" style={{ color: ERR }}>{error}</div>}
              <button className="fin-btn-cta mt-1" onClick={submit} disabled={createMut.isPending}>
                {createMut.isPending ? "Creando…" : "Crear empresa"}
              </button>
              <div className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                Al crearla se le aplican automáticamente los requisitos del due diligence corporativo.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
