import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Trash2, Calendar, Building2, AlertCircle, CheckCircle2, Circle, Clock, User } from "lucide-react";
import toast from "react-hot-toast";
import { AdminAPI } from "../lib/api";
import { cls, date as fmtDate } from "../../finance/lib/format";
import { useConfirm } from "../../components/ConfirmDialog";
import { useI18n } from '../../i18n'

const PRIORITIES = [
  { value: "alta", labelKey: 'common.alta', color: "#ef4444" },
  { value: "media", labelKey: 'common.media', color: "#f59e0b" },
  { value: "baja", labelKey: 'common.baja', color: "#94a3b8" },
] as const;

const STATUSES = [
  { value: "pendiente", labelKey: 'common.pendiente', Icon: Circle, color: "#f59e0b" },
  { value: "en_progreso", labelKey: 'adm.tasks.enProgreso', Icon: Clock, color: "#7A93A6" },
  { value: "completada", labelKey: 'adm.tasks.completada', Icon: CheckCircle2, color: "#22c55e" },
] as const;

function priColor(p: string) { return PRIORITIES.find((x) => x.value === p)?.color ?? "#94a3b8"; }
function isOverdue(t: any) { return t.status !== "completada" && t.dueDate && new Date(t.dueDate) < new Date(); }

export default function AdminTasks() {
  const { t } = useI18n()
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
    onSuccess: () => { toast.success(t('common.tareaCreada')); setTitle(""); setDescription(""); setDueDate(""); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => AdminAPI.updateTask(id, data),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => AdminAPI.deleteTask(id),
    onSuccess: () => { toast.success(t('adm.tasks.tareaEliminada')); invalidate(); },
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

  const del = async (id: number, title: string) => {
    const ok = await confirm({ title: t('adm.tasks.eliminarTarea'), message: t('adm.tasks.confirmDelete', { title }), destructive: true, confirmText: t('common.yesDelete') });
    if (ok) deleteMut.mutate(id);
  };

  const Row = ({ task }: { task: any }) => {
    const { t } = useI18n()
    const overdue = isOverdue(task);
    const next = task.status === "pendiente" ? "en_progreso" : task.status === "en_progreso" ? "completada" : "pendiente";
    const st = STATUSES.find((s) => s.value === task.status) ?? STATUSES[0];
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ border: "1px solid var(--border)", background: overdue ? "rgba(239,68,68,0.05)" : "var(--bg-panel, #fff)" }}>
        <button title={`Marcar: ${next}`} onClick={() => updateMut.mutate({ id: task.id, data: { status: next } })}>
          <st.Icon size={16} color={st.color} />
        </button>
        <span className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: priColor(task.priority) }} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)", textDecoration: task.status === "completada" ? "line-through" : undefined }}>{task.title}</div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {task.company && <Link to={`/admin/companies/${task.company.id}`} className="flex items-center gap-1 text-[10px]" style={{ color: "#3E5A70" }}><Building2 size={10} /> {task.company.name}</Link>}
            {task.person && <Link to={`/admin/persons/${task.person.id}`} className="flex items-center gap-1 text-[10px]" style={{ color: "#3E5A70" }}><User size={10} /> {task.person.name}</Link>}
            {task.dueDate && <span className={cls("flex items-center gap-1 text-[10px]")} style={{ color: overdue ? "#ef4444" : "var(--text-muted)" }}><Calendar size={10} />{overdue ? t('common.vencida') : ""}{fmtDate(task.dueDate)}</span>}
            {task.description && <span className="text-[10px] truncate max-w-[280px]" style={{ color: "var(--text-muted)" }}>{task.description}</span>}
          </div>
        </div>
        <select className="input-base" style={{ height: 28, fontSize: 11, width: "auto" }} value={task.priority} onChange={(e) => updateMut.mutate({ id: task.id, data: { priority: e.target.value } })}>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{t(p.labelKey)}</option>)}
        </select>
        <button className="fin-btn-icon" title={t('common.eliminar')} style={{ color: "#ef4444" }} onClick={() => del(task.id, task.title)}><Trash2 size={13} /></button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="fin-page-title">{t('adm.tasks.tareasAdministrativas')}</div>
          <div className="fin-page-sub">{pending.length} {t('common.pendientes')}{overdueCount > 0 && <span style={{ color: "#ef4444", fontWeight: 600 }}> · {overdueCount} {t('adm.tasks.vencidas')}</span>}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input-base" style={{ width: "auto", height: 34 }} value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
            <option value="">{t('adm.tasks.todasLasEmpresas')}</option>
            {companies.map((co: any) => <option key={co.id} value={co.id}>{co.name}</option>)}
          </select>
          <select className="input-base" style={{ width: "auto", height: 34 }} value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
            <option value="">{t('adm.tasks.todasLasPersonas')}</option>
            {persons.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input-base" style={{ width: "auto", height: 34 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">{t('adm.tasks.todosLosEstados')}</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
          </select>
        </div>
      </div>

      {/* Crear tarea */}
      <form onSubmit={submit} className="fin-cpanel">
        <div className="fin-cpanel-body space-y-3">
          <input className="input-base w-full" placeholder={t('adm.tasks.nuevaTareaEjRenovarAnnualReport')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid md:grid-cols-4 gap-2">
            <select className="input-base w-full" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">{t('adm.tasks.sinEmpresaGeneral')}</option>
              {companies.map((co: any) => <option key={co.id} value={co.id}>{co.name}</option>)}
            </select>
            <select className="input-base w-full" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">{t('adm.tasks.sinPersonaAsignada')}</option>
              {persons.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="input-base w-full" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{t('common.prioridad')} {t(p.labelKey)}</option>)}
            </select>
            <input type="date" className="input-base w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <textarea className="input-base w-full" rows={2} placeholder={t('adm.tasks.detalleOpcional')} value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="submit" className="fin-btn-cta flex items-center gap-2" disabled={!title.trim() || createMut.isPending}><Plus size={13} /> {t('adm.tasks.agregarTarea')}</button>
        </div>
      </form>

      {overdueCount > 0 && (
        <div className="alert-card-critical flex items-center gap-2 px-4 py-3">
          <AlertCircle size={16} color="#ef4444" />
          <span className="text-[13px] font-medium" style={{ color: "#b91c1c" }}>{overdueCount} {t('adm.tasks.tareaSVencidaSRequierenAtencion')}</span>
        </div>
      )}

      {tasksQ.isLoading ? (
        <div className="fin-page-sub">{t('adm.tasks.cargandoTareas')}</div>
      ) : (
        <>
          <div className="space-y-1.5">
            {pending.length === 0 ? <div className="fin-page-sub">{t('adm.tasks.sinPendientesTodoAlDia')}</div> : pending.map((task: any) => <Row key={task.id} task={task} />)}
          </div>
          {done.length > 0 && (
            <div>
              <div className="fin-nav-grp" style={{ paddingLeft: 0 }}>{t('adm.tasks.completadas')}{done.length})</div>
              <div className="space-y-1.5 opacity-70">{done.map((task: any) => <Row key={task.id} task={task} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
