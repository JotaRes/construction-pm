import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, DownloadCloud, Landmark, Building2, FileText, AlertTriangle, X } from "lucide-react";
import { AdminAPI, ROLE_LABELS } from "../lib/api";

// Semáforo de cumplimiento: color según % y vencidos
function complianceColor(pct: number, vencidos: number): string {
  if (vencidos > 0 || pct < 50) return "#ef4444";
  if (pct < 85) return "#f59e0b";
  return "#22c55e";
}

function CompanyCard({ c, isHolding = false }: { c: any; isHolding?: boolean }) {
  const comp = c.compliance;
  const pct = comp?.compliancePct ?? 100;
  const color = complianceColor(pct, comp?.vencidos ?? 0);
  return (
    <Link
      to={`/admin/companies/${c.id}`}
      className="block rounded-xl p-4 transition-all hover:-translate-y-0.5"
      style={{
        background: isHolding
          ? "linear-gradient(135deg, #2A1E3F 0%, #3E2C5C 100%)"
          : "var(--bg-panel, rgba(255,255,255,0.7))",
        border: `1px solid ${isHolding ? "rgba(196,181,253,0.35)" : "var(--border)"}`,
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
        minWidth: 220,
        textDecoration: "none",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: isHolding ? "rgba(196,181,253,0.15)" : "rgba(139,92,246,0.12)" }}
          >
            {isHolding ? <Landmark size={15} color="#c4b5fd" /> : <Building2 size={15} color="#8b5cf6" />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: isHolding ? "#fff" : "var(--text-primary)" }}>
              {c.name}
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: isHolding ? "#c4b5fd" : "var(--text-muted)" }}>
              {ROLE_LABELS[c.role] ?? c.role}
              {c.finSpv ? ` · SPV ${c.finSpv.code}` : ""}
            </div>
          </div>
        </div>
        {/* Semáforo */}
        <div className="flex items-center gap-1 flex-shrink-0" title={`Cumplimiento documental: ${pct}%`}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="text-[11px] font-mono font-semibold" style={{ color: isHolding ? "#e9e2f7" : "var(--text-secondary)" }}>{pct}%</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10.5px]" style={{ color: isHolding ? "rgba(233,226,247,0.75)" : "var(--text-muted)" }}>
        <span className="flex items-center gap-1"><FileText size={11} /> {c._count?.documents ?? 0} docs</span>
        {(comp?.vencidos ?? 0) > 0 && (
          <span className="flex items-center gap-1" style={{ color: "#ef4444" }}>
            <AlertTriangle size={11} /> {comp.vencidos} vencido(s)
          </span>
        )}
        {(comp?.faltantes ?? 0) > 0 && <span>{comp.faltantes} faltante(s)</span>}
      </div>
    </Link>
  );
}

const EMPTY_FORM = { name: "", legalName: "", role: "SUBSIDIARY_OWNER", stateOfFormation: "", ein: "", registeredAgent: "", address: "", notes: "" };

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
          <div className="fin-page-sub">Holding y subsidiarias · semáforo de cumplimiento documental</div>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Cumplimiento global", value: `${dash.globalCompliancePct}%`, tone: dash.globalCompliancePct >= 85 ? "#22c55e" : dash.globalCompliancePct >= 60 ? "#f59e0b" : "#ef4444" },
            { label: "Empresas", value: dash.totalCompanies, tone: "#8b5cf6" },
            { label: "Documentos", value: dash.totalDocuments, tone: "var(--text-primary)" },
            { label: "Tareas pendientes", value: dash.pendingTasks, tone: "#f59e0b" },
            { label: "Alertas críticas", value: dash.alertCounts?.criticas ?? 0, tone: "#ef4444" },
          ].map((k) => (
            <Link key={k.label} to="/admin/alerts" className="fin-kpi-v2" style={{ textDecoration: "none" }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{k.label}</div>
              <div className="text-2xl font-bold font-mono" style={{ color: k.tone }}>{k.value}</div>
            </Link>
          ))}
        </div>
      )}

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
            <div className="mb-0" style={{ minWidth: 300 }}>
              <CompanyCard c={holding} isHolding />
            </div>
          )}

          {/* Conector vertical */}
          {holding && subsidiaries.length > 0 && (
            <div style={{ width: 2, height: 28, background: "var(--border-strong, #b9a8d8)" }} />
          )}

          {/* Conector horizontal + nivel 2 */}
          {subsidiaries.length > 0 && (
            <div className="w-full flex flex-col items-center">
              {subsidiaries.length > 1 && (
                <div
                  className="hidden md:block"
                  style={{ height: 2, background: "var(--border-strong, #b9a8d8)", width: `calc(${((subsidiaries.length - 1) / subsidiaries.length) * 100}% )`, maxWidth: 900 }}
                />
              )}
              <div className="grid gap-4 mt-0 md:mt-0 w-full justify-center" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 260px))", marginTop: subsidiaries.length > 1 ? 0 : undefined }}>
                {subsidiaries.map((s: any) => (
                  <div key={s.id} className="flex flex-col items-center">
                    <div className="hidden md:block" style={{ width: 2, height: 20, background: "var(--border-strong, #b9a8d8)" }} />
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
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 260px))" }}>
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
              {error && <div className="text-xs" style={{ color: "#ef4444" }}>{error}</div>}
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
