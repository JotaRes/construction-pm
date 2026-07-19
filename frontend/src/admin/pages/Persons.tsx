import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, X, User, ShieldCheck, AlertTriangle, ListChecks, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { AdminAPI, PERSON_ROLE_LABELS } from "../lib/api";

// ── Directorio de socios y colaboradores ──────────────────────────────────
// Cada tarjeta muestra el semáforo documental (derivado en tiempo real) y
// las tareas pendientes de la persona. El detalle vive en /admin/persons/:id
export default function Persons() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", role: "SOCIO", position: "", email: "", phone: "", idNumber: "" });

  const personsQ = useQuery({ queryKey: ["adm-persons"], queryFn: AdminAPI.getPersons });

  const createMut = useMutation({
    mutationFn: (data: any) => AdminAPI.createPerson(data),
    onSuccess: () => {
      toast.success("Persona creada con su checklist documental inicial");
      setCreating(false);
      setForm({ name: "", role: "SOCIO", position: "", email: "", phone: "", idNumber: "" });
      qc.invalidateQueries({ queryKey: ["adm-persons"] });
      qc.invalidateQueries({ queryKey: ["adm-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const persons = personsQ.data ?? [];
  const socios = persons.filter((p: any) => p.role === "SOCIO");
  const others = persons.filter((p: any) => p.role !== "SOCIO");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    createMut.mutate(payload);
  };

  const Card = ({ p }: { p: any }) => {
    const comp = p.compliance;
    const tone = comp
      ? comp.vencidos > 0 ? "#ef4444" : comp.compliancePct >= 85 ? "#22c55e" : "#f59e0b"
      : "#94a3b8";
    return (
      <Link to={`/admin/persons/${p.id}`} className="fin-cpanel block hover:shadow-md transition-shadow" style={{ textDecoration: "none" }}>
        <div className="fin-cpanel-body">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: p.role === "SOCIO" ? "linear-gradient(135deg,#33495C,#3E5A70)" : "rgba(62,90,112,0.12)" }}>
              <User size={18} color={p.role === "SOCIO" ? "#D9AE52" : "#3E5A70"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{p.name}</div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {PERSON_ROLE_LABELS[p.role] ?? p.role}{p.position ? ` · ${p.position}` : ""}
                {p.status !== "ACTIVO" && <span style={{ color: "#ef4444" }}> · Inactivo</span>}
              </div>
            </div>
            <span className="font-mono text-[13px] font-bold" style={{ color: tone }}>{comp ? `${comp.compliancePct}%` : "—"}</span>
          </div>

          {comp && (
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div style={{ width: `${comp.compliancePct}%`, height: "100%", background: tone }} />
            </div>
          )}

          <div className="mt-3 flex items-center gap-4 text-[10.5px]" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1"><FileText size={11} /> {p._count?.documents ?? 0} docs</span>
            <span className="flex items-center gap-1"><ListChecks size={11} /> {p.pendingTasks ?? 0} tareas pend.</span>
            {comp && comp.vencidos > 0 && (
              <span className="flex items-center gap-1" style={{ color: "#ef4444", fontWeight: 600 }}>
                <AlertTriangle size={11} /> {comp.vencidos} vencido(s)
              </span>
            )}
            {comp && comp.faltantes > 0 && <span>{comp.faltantes} faltante(s)</span>}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="fin-page-title flex items-center gap-2"><Users size={18} /> Socios y colaboradores</div>
          <div className="fin-page-sub">Carpeta documental personal, cumplimiento y pendientes de cada persona</div>
        </div>
        <button className="fin-btn-cta flex items-center gap-2" onClick={() => setCreating((c) => !c)}>
          {creating ? <><X size={13} /> Cancelar</> : <><Plus size={13} /> Nueva persona</>}
        </button>
      </div>

      {creating && (
        <form onSubmit={submit} className="fin-cpanel">
          <div className="fin-cpanel-body space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <label className="block md:col-span-2">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Nombre completo *</span>
                <input className="input-base w-full mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Rol</span>
                <select className="input-base w-full mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="SOCIO">Socio</option>
                  <option value="COLABORADOR">Colaborador</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Cargo</span>
                <input className="input-base w-full mt-1" placeholder="Managing Director" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Email</span>
                <input className="input-base w-full mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Teléfono</span>
                <input className="input-base w-full mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Identificación (cédula / pasaporte)</span>
                <input className="input-base w-full mt-1" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
              </label>
            </div>
            <div className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <ShieldCheck size={12} /> Al crearla se genera su checklist documental inicial (identidad, migratorio, fiscal, personal) — luego puedes agregar categorías y documentos propios.
            </div>
            <button type="submit" className="fin-btn-cta flex items-center gap-2" disabled={createMut.isPending}>
              <Plus size={13} /> {createMut.isPending ? "Creando…" : "Crear persona"}
            </button>
          </div>
        </form>
      )}

      {personsQ.isLoading ? (
        <div className="fin-page-sub">Cargando personas…</div>
      ) : persons.length === 0 ? (
        <div className="fin-cpanel"><div className="fin-cpanel-body fin-page-sub">
          Aún no hay socios ni colaboradores. Crea el primero con "Nueva persona" — cada uno tendrá su carpeta documental completa y sus tareas.
        </div></div>
      ) : (
        <>
          {socios.length > 0 && (
            <div>
              <div className="fin-nav-grp" style={{ paddingLeft: 0 }}>Socios ({socios.length})</div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{socios.map((p: any) => <Card key={p.id} p={p} />)}</div>
            </div>
          )}
          {others.length > 0 && (
            <div>
              <div className="fin-nav-grp" style={{ paddingLeft: 0 }}>Colaboradores y otros ({others.length})</div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{others.map((p: any) => <Card key={p.id} p={p} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
