import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Trash2, Calendar, Building2, AlertCircle, CheckCircle2, Circle, Clock, User } from "lucide-react";
import toast from "react-hot-toast";
import { AdminAPI } from "../lib/api";
import { cls, date as fmtDate } from "../../finance/lib/format";
import { useConfirm } from "../../components/ConfirmDialog";

const PRIORITIES = [
  { value: "alta", label: "Alta", color: "#ef4444" },
  { value: "media", label: "Media", color: "#f59e0b" },
  { value: "baja", label: "Baja", color: "#94a3b8" },
] as const;

const STATUSES = [
  { value: "pendiente", label: "Pendiente", Icon: Circle, color: "#f59e0b" },
  { value: "en_progreso", label: "En progreso", Icon: Clock, color: "#7A93A6" },
  { value: "completada", label: "Completada", Icon: CheckCircle2, color: "#22c55e" },
] as const;

function priColor(p: string) { return PRIORITIES.find((x) => x.value === p)?.color ?? "#94a3b8"; }
function isOverdue(t: any) { return t.status !== "completada" && t.dueDate && new Date(t.dueDate) < new Date(); }

export default function AdminTasks() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterPerson, setFilterPerson] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [personId, setPersonId] = useState<string>("");
  const [priority, setPriority] = useState<string>("media");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  const companiesQ = useQuery({ queryKey: ["adm-companies"], queryFn: AdminAPI.getCompanies });
  const personsQ = useQuery({ queryKey: ["adm-persons"], queryFn: AdminAPI.getPersons });
  const tasksQ = useQuery({
    queryKey: ["adm-tasks-all", filterCompany, filterPerson, filterStatus],
    queryFn: () => AdminAPI.getTasks({
      companyId: filterCompany ? Number(filterCompany) : undefined,
      personId: filterPerson ? Number(filterPerson) : undefined,
      status: filterStatus || undefined,
    }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["adm-tasks-all"] });
    qc.invalidateQueries({ queryKey: ["adm-dashboard"] });
    qc.invalidateQueries({ queryKey: ["adm-alerts"] });
    qc.invalidateQueries({ queryKey: ["adm-task-summary"] });
    qc.invalidateQueries({ queryKey: ["adm-persons"] });
  };

  const createMut = useMutation({
    mutationFn: (data: any) => AdminAPI.createTask(data),
    onSuccess: () => { toast.success("Tarea creada"); setTitle(""); setDescription(""); setDueDate(""); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => AdminAPI.updateTask(id, data),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => AdminAPI.deleteTask(id),
    onSuccess: () => { toast.success("Tarea eliminada"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const companies = companiesQ.data ?? [];
  const persons = personsQ.data ?? [];
  const tasks = tasksQ.data ?? [];
  const pending = tasks.filter((t: any) => t.status !== "completada");
  const done = tasks.filter((t: any) => t.status === "completada");
  const overdueCount = tasks.filter(isOverdue).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMut.mutate({
      title: title.trim(),
      description: description || null,
      companyId: companyId ? Number(companyId) : null,
      personId: personId ? Number(personId) : null,
      priority,
      dueDate: dueDate || null,
    });
  };

  const del = async (id: number, t: string) => {
    const ok = await confirm({ title: "Eliminar tarea", message: `¿Eliminar "${t}"?`, destructive: true, confirmText: "Sí, eliminar" });
    if (ok) deleteMut.mutate(id);
  };

  const Row = ({ t }: { t: any }) => {
    const overdue = isOverdue(t);
    const next = t.status === "pendiente" ? "en_progreso" : t.status === "en_progreso" ? "completada" : "pendiente";
    const st = STATUSES.find((s) => s.value === t.status) ?? STATUSES[0];
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ border: "1px solid var(--border)", background: overdue ? "rgba(239,68,68,0.05)" : "var(--bg-panel, #fff)" }}>
        <button title={`Marcar: ${next}`} onClick={() => updateMut.mutate({ id: t.id, data: { status: next } })}>
          <st.Icon size={16} color={st.color} />
        </button>
        <span className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: priColor(t.priority) }} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)", textDecoration: t.status === "completada" ? "line-through" : undefined }}>{t.title}</div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {t.company && <Link to={`/admin/companies/${t.company.id}`} className="flex items-center gap-1 text-[10px]" style={{ color: "#3E5A70" }}><Building2 size={10} /> {t.company.name}</Link>}
            {t.person && <Link to={`/admin/persons/${t.person.id}`} className="flex items-center gap-1 text-[10px]" style={{ color: "#3E5A70" }}><User size={10} /> {t.person.name}</Link>}
            {t.dueDate && <span className={cls("flex items-center gap-1 text-[10px]")} style={{ color: overdue ? "#ef4444" : "var(--text-muted)" }}><Calendar size={10} />{overdue ? "VENCIDA · " : ""}{fmtDate(t.dueDate)}</span>}
            {t.description && <span className="text-[10px] truncate max-w-[280px]" style={{ color: "var(--text-muted)" }}>{t.description}</span>}
          </div>
        </div>
        <select className="input-base" style={{ height: 28, fontSize: 11, width: "auto" }} value={t.priority} onChange={(e) => updateMut.mutate({ id: t.id, data: { priority: e.target.value } })}>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button className="fin-btn-icon" title="Eliminar" style={{ color: "#ef4444" }} onClick={() => del(t.id, t.title)}><Trash2 size={13} /></button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="fin-page-title">Tareas administrativas</div>
          <div className="fin-page-sub">{pending.length} pendientes{overdueCount > 0 && <span style={{ color: "#ef4444", fontWeight: 600 }}> · {overdueCount} vencidas</span>}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input-base" style={{ width: "auto", height: 34 }} value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
            <option value="">Todas las empresas</option>
            {companies.map((co: any) => <option key={co.id} value={co.id}>{co.name}</option>)}
          </select>
          <select className="input-base" style={{ width: "auto", height: 34 }} value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
            <option value="">Todas las personas</option>
            {persons.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input-base" style={{ width: "auto", height: 34 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Crear tarea */}
      <form onSubmit={submit} className="fin-cpanel">
        <div className="fin-cpanel-body space-y-3">
          <input className="input-base w-full" placeholder="Nueva tarea… (ej. Renovar Annual Report de la holding)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid md:grid-cols-4 gap-2">
            <select className="input-base w-full" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Sin empresa (general)</option>
              {companies.map((co: any) => <option key={co.id} value={co.id}>{co.name}</option>)}
            </select>
            <select className="input-base w-full" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Sin persona asignada</option>
              {persons.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="input-base w-full" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>Prioridad {p.label}</option>)}
            </select>
            <input type="date" className="input-base w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <textarea className="input-base w-full" rows={2} placeholder="Detalle (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="submit" className="fin-btn-cta flex items-center gap-2" disabled={!title.trim() || createMut.isPending}><Plus size={13} /> Agregar tarea</button>
        </div>
      </form>

      {overdueCount > 0 && (
        <div className="alert-card-critical flex items-center gap-2 px-4 py-3">
          <AlertCircle size={16} color="#ef4444" />
          <span className="text-[13px] font-medium" style={{ color: "#b91c1c" }}>{overdueCount} tarea(s) vencida(s) — requieren atención</span>
        </div>
      )}

      {tasksQ.isLoading ? (
        <div className="fin-page-sub">Cargando tareas…</div>
      ) : (
        <>
          <div className="space-y-1.5">
            {pending.length === 0 ? <div className="fin-page-sub">Sin pendientes — todo al día.</div> : pending.map((t: any) => <Row key={t.id} t={t} />)}
          </div>
          {done.length > 0 && (
            <div>
              <div className="fin-nav-grp" style={{ paddingLeft: 0 }}>Completadas ({done.length})</div>
              <div className="space-y-1.5 opacity-70">{done.map((t: any) => <Row key={t.id} t={t} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
