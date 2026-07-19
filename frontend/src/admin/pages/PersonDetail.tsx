import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, User, Pencil, Trash2, Save, X, Upload, FileText, ExternalLink,
  Mail, MessageCircle, Download, AlertTriangle, CheckCircle2, Clock, HelpCircle,
  ListChecks, Plus, FolderPlus, Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import { AdminAPI, PERSON_ROLE_LABELS, shareByEmail, shareByWhatsApp, absoluteShareUrl } from "../lib/api";
import { cls, date as fmtDate } from "../../finance/lib/format";
import { useConfirm } from "../../components/ConfirmDialog";
import { downloadAuthed } from "../../lib/api";

const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  OK:         { label: "Al día",     color: "#22c55e", bg: "rgba(34,197,94,0.12)",  Icon: CheckCircle2 },
  POR_VENCER: { label: "Por vencer", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", Icon: Clock },
  VENCIDO:    { label: "Vencido",    color: "#ef4444", bg: "rgba(239,68,68,0.12)",  Icon: AlertTriangle },
  FALTANTE:   { label: "Faltante",   color: "#94a3b8", bg: "rgba(148,163,184,0.12)", Icon: HelpCircle },
};

const FIELDS: { k: string; label: string; ph?: string }[] = [
  { k: "name", label: "Nombre *" },
  { k: "position", label: "Cargo" },
  { k: "email", label: "Email" },
  { k: "phone", label: "Teléfono" },
  { k: "idNumber", label: "Identificación" },
];

// ── Fila del checklist personal con subida de archivo ─────────────────────
function ChecklistRow({ item, personId, onChanged }: { item: any; personId: number; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[item.status] ?? STATUS_META.FALTANTE;

  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requirementId", String(item.requirementId));
      if (issueDate) fd.append("issueDate", issueDate);
      if (expiryDate) fd.append("expiryDate", expiryDate);
      return AdminAPI.uploadPersonDocument(personId, fd);
    },
    onSuccess: () => {
      toast.success(`"${item.name}" cargado`);
      setOpen(false); setIssueDate(""); setExpiryDate("");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeReq = async () => {
    const ok = await confirm({
      title: "Quitar del checklist",
      message: `¿Quitar "${item.name}" de los documentos requeridos?`,
      detail: "Los archivos ya cargados NO se borran; quedan en la carpeta general de la persona.",
      destructive: true,
      confirmText: "Sí, quitar",
    });
    if (!ok) return;
    try {
      await AdminAPI.deletePersonRequirement(item.requirementId);
      toast.success("Requisito eliminado");
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="rounded-lg" style={{ border: "1px solid var(--border)", background: "var(--bg-panel, #fff)" }}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
          <meta.Icon size={14} color={meta.color} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.name}</div>
          <div className="text-[10.5px] flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
            {item.document?.expiryDate && (
              <span>· vence {fmtDate(item.document.expiryDate)}{typeof item.daysToExpiry === "number" ? ` (${item.daysToExpiry}d)` : ""}</span>
            )}
          </div>
        </div>
        {item.document && !item.document.url?.startsWith("local:") && (
          <button
            className="fin-btn-icon" title="Ver documento"
            onClick={() => downloadAuthed(`/api/download?url=${encodeURIComponent(item.document.url)}&name=${encodeURIComponent(item.document.filename)}&inline=1`, item.document.filename).catch(() => window.open(item.document.url, "_blank"))}
          >
            <ExternalLink size={13} />
          </button>
        )}
        <button className="fin-btn-icon" title="Subir / actualizar" onClick={() => setOpen((o) => !o)}>
          <Upload size={13} />
        </button>
        <button className="fin-btn-icon" title="Quitar del checklist" style={{ color: "#ef4444" }} onClick={removeReq}>
          <X size={13} />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 flex flex-wrap items-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <label className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            Emisión
            <input type="date" className="input-base block mt-0.5" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <label className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            Vencimiento
            <input type="date" className="input-base block mt-0.5" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </label>
          <input
            ref={fileRef} type="file" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMut.mutate(f); e.currentTarget.value = ""; }}
          />
          <button className="fin-btn-cta" style={{ height: 34 }} disabled={uploadMut.isPending} onClick={() => fileRef.current?.click()}>
            {uploadMut.isPending ? "Subiendo…" : "Seleccionar archivo"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PersonDetail() {
  const { id } = useParams();
  const personId = Number(id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const confirm = useConfirm();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);

  // Agregar requisito nuevo (nombre + categoría libre + vencimiento)
  const [addingReq, setAddingReq] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqCategory, setReqCategory] = useState("");
  const [reqHasExpiry, setReqHasExpiry] = useState(false);

  // Tarea rápida para esta persona
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskPriority, setTaskPriority] = useState("media");

  const personQ = useQuery({ queryKey: ["adm-person", personId], queryFn: () => AdminAPI.getPerson(personId) });
  const checklistQ = useQuery({ queryKey: ["adm-person-checklist", personId], queryFn: () => AdminAPI.getPersonChecklist(personId) });
  const docsQ = useQuery({ queryKey: ["adm-person-docs", personId], queryFn: () => AdminAPI.getPersonDocuments(personId) });
  const tasksQ = useQuery({ queryKey: ["adm-person-tasks", personId], queryFn: () => AdminAPI.getTasks({ personId }) });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["adm-person", personId] });
    qc.invalidateQueries({ queryKey: ["adm-person-checklist", personId] });
    qc.invalidateQueries({ queryKey: ["adm-person-docs", personId] });
    qc.invalidateQueries({ queryKey: ["adm-person-tasks", personId] });
    qc.invalidateQueries({ queryKey: ["adm-persons"] });
    qc.invalidateQueries({ queryKey: ["adm-dashboard"] });
    qc.invalidateQueries({ queryKey: ["adm-task-summary"] });
  };

  const updateMut = useMutation({
    mutationFn: (data: any) => AdminAPI.updatePerson(personId, data),
    onSuccess: () => { toast.success("Persona actualizada"); setEditing(false); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addReqMut = useMutation({
    mutationFn: () => AdminAPI.createPersonRequirement(personId, {
      name: reqName.trim(),
      category: reqCategory.trim() || "GENERAL",
      hasExpiry: reqHasExpiry,
    }),
    onSuccess: () => {
      toast.success("Documento agregado al checklist");
      setReqName(""); setReqCategory(""); setReqHasExpiry(false); setAddingReq(false);
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addTaskMut = useMutation({
    mutationFn: () => AdminAPI.createTask({
      title: taskTitle.trim(),
      personId,
      priority: taskPriority,
      dueDate: taskDue || null,
    }),
    onSuccess: () => { toast.success("Tarea creada"); setTaskTitle(""); setTaskDue(""); setTaskPriority("media"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleTaskMut = useMutation({
    mutationFn: ({ tid, status }: { tid: number; status: string }) => AdminAPI.updateTask(tid, { status }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDocMut = useMutation({
    mutationFn: (docId: number) => AdminAPI.deletePersonDocument(docId),
    onSuccess: () => { toast.success("Documento eliminado"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const p = personQ.data;
  const checklist = checklistQ.data;
  const docs = docsQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  if (personQ.isLoading || !p) return <div className="fin-page-sub">Cargando carpeta personal…</div>;

  const startEdit = () => {
    setForm({
      name: p.name ?? "", role: p.role ?? "SOCIO", position: p.position ?? "",
      email: p.email ?? "", phone: p.phone ?? "", idNumber: p.idNumber ?? "",
      status: p.status ?? "ACTIVO", notes: p.notes ?? "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    if (!form.name?.trim()) { toast.error("El nombre es obligatorio"); return; }
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    updateMut.mutate(payload);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Suprimir persona",
      message: `¿Eliminar a "${p.name}"?`,
      detail: "Se borrará su carpeta completa (documentos incluidos) y sus tareas. Esta acción no se puede deshacer.",
      destructive: true,
      confirmText: "Sí, suprimir",
    });
    if (!ok) return;
    try {
      await AdminAPI.deletePerson(personId);
      toast.success("Persona suprimida");
      qc.invalidateQueries({ queryKey: ["adm-persons"] });
      nav("/admin/persons");
    } catch (e: any) { toast.error(e.message); }
  };

  const shareDoc = async (docId: number, via: "email" | "whatsapp") => {
    try {
      const info = await AdminAPI.getPersonShareInfo(docId);
      const url = absoluteShareUrl(info.sharePath);
      if (via === "email") shareByEmail(info.filename, info.personName, url);
      else shareByWhatsApp(info.filename, info.personName, url);
    } catch (e: any) { toast.error(e.message); }
  };

  const groups = Object.entries(
    (checklist?.items ?? []).reduce((acc: Record<string, any[]>, it: any) => {
      (acc[it.category] ||= []).push(it); return acc;
    }, {})
  ) as [string, any[]][];
  const existingCategories: string[] = Array.from(new Set<string>((checklist?.items ?? []).map((i: any) => String(i.category))));
  const pendingTasks = tasks.filter((t: any) => t.status !== "completada");

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Link to="/admin/persons" className="fin-btn-icon mt-1" title="Volver al directorio"><ArrowLeft size={14} /></Link>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: p.role === "SOCIO" ? "linear-gradient(135deg,#33495C,#3E5A70)" : "rgba(62,90,112,0.12)" }}>
            <User size={20} color={p.role === "SOCIO" ? "#D9AE52" : "#3E5A70"} />
          </div>
          <div className="min-w-0">
            <div className="fin-page-title truncate">{p.name}</div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="badge-active" style={{ fontSize: 10 }}>{PERSON_ROLE_LABELS[p.role] ?? p.role}</span>
              {p.position && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.position}</span>}
              {p.status !== "ACTIVO" && <span className="text-[11px]" style={{ color: "#ef4444" }}>Inactivo</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && <button className="fin-btn-icon flex items-center gap-2 px-3" style={{ width: "auto", fontSize: 11.5, fontWeight: 600 }} onClick={startEdit}><Pencil size={12} /> Editar</button>}
          <button className="fin-btn-icon" title="Suprimir persona" style={{ color: "#ef4444" }} onClick={handleDelete}><Trash2 size={13} /></button>
        </div>
      </div>

      {/* ── Edición del perfil ── */}
      {editing && form && (
        <div className="fin-cpanel">
          <div className="fin-cpanel-body space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <label key={f.k} className="block">
                  <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                  <input className="input-base w-full mt-1" placeholder={f.ph} value={form[f.k] ?? ""} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
                </label>
              ))}
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Rol</span>
                <select className="input-base w-full mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="SOCIO">Socio</option>
                  <option value="COLABORADOR">Colaborador</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Estado</span>
                <select className="input-base w-full mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Notas</span>
              <textarea className="input-base w-full mt-1" rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <div className="flex items-center gap-2">
              <button className="fin-btn-cta flex items-center gap-2" disabled={updateMut.isPending} onClick={saveEdit}><Save size={13} /> {updateMut.isPending ? "Guardando…" : "Guardar cambios"}</button>
              <button className="fin-btn-icon flex items-center gap-2 px-3" style={{ width: "auto", fontSize: 11.5 }} onClick={() => setEditing(false)}><X size={13} /> Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ficha (lectura) ── */}
      {!editing && (
        <div className="fin-cpanel">
          <div className="fin-cpanel-body grid md:grid-cols-3 gap-y-3 gap-x-6">
            {[["Email", p.email], ["Teléfono", p.phone], ["Identificación", p.idNumber]].map(([label, val]) => (
              <div key={label as string}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</div>
                <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>{(val as string) || "—"}</div>
              </div>
            ))}
          </div>
          {p.notes && <div className="fin-cpanel-body pt-0 text-[12px]" style={{ color: "var(--text-secondary)" }}>{p.notes}</div>}
        </div>
      )}

      {/* ── Semáforo ── */}
      {checklist && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Cumplimiento", value: `${checklist.compliancePct}%`, tone: checklist.vencidos > 0 ? "#ef4444" : checklist.compliancePct >= 85 ? "#22c55e" : "#f59e0b" },
            { label: "Al día", value: checklist.ok, tone: "#22c55e" },
            { label: "Por vencer", value: checklist.porVencer, tone: "#f59e0b" },
            { label: "Vencidos", value: checklist.vencidos, tone: "#ef4444" },
            { label: "Faltantes", value: checklist.faltantes, tone: "#94a3b8" },
          ].map((k) => (
            <div key={k.label} className="fin-kpi-v2">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{k.label}</div>
              <div className="text-2xl font-bold font-mono" style={{ color: k.tone }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Checklist documental por categorías ── */}
      <div className="fin-cpanel">
        <div className="fin-cpanel-body">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="fin-tb-title flex items-center gap-2"><ListChecks size={15} /> Carpeta documental</div>
            <button className="fin-btn-icon flex items-center gap-1.5 px-3" style={{ width: "auto", fontSize: 11, fontWeight: 600 }} onClick={() => setAddingReq((a) => !a)}>
              {addingReq ? <><X size={12} /> Cancelar</> : <><FolderPlus size={12} /> Agregar documento / categoría</>}
            </button>
          </div>

          {addingReq && (
            <div className="rounded-lg p-3 mb-3 flex flex-wrap items-end gap-2" style={{ border: "1px dashed var(--border)", background: "var(--bg-base)" }}>
              <label className="text-[10px] font-semibold flex-1 min-w-[180px]" style={{ color: "var(--text-secondary)" }}>
                Nombre del documento *
                <input className="input-base block w-full mt-0.5" placeholder="Ej: Licencia de conducción" value={reqName} onChange={(e) => setReqName(e.target.value)} />
              </label>
              <label className="text-[10px] font-semibold min-w-[160px]" style={{ color: "var(--text-secondary)" }}>
                Categoría (existente o nueva)
                <input className="input-base block w-full mt-0.5" placeholder="Ej: LEGAL" list={`cats-${personId}`} value={reqCategory} onChange={(e) => setReqCategory(e.target.value)} />
                <datalist id={`cats-${personId}`}>
                  {existingCategories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>
              <label className="flex items-center gap-1.5 text-[11px] pb-2" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={reqHasExpiry} onChange={(e) => setReqHasExpiry(e.target.checked)} /> Tiene vencimiento
              </label>
              <button className="fin-btn-cta" style={{ height: 34 }} disabled={!reqName.trim() || addReqMut.isPending} onClick={() => addReqMut.mutate()}>
                {addReqMut.isPending ? "Agregando…" : "Agregar"}
              </button>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="fin-page-sub">Sin documentos requeridos. Agrega el primero con "Agregar documento / categoría".</div>
          ) : (
            <div className="space-y-4">
              {groups.map(([cat, items]) => (
                <div key={cat}>
                  <div className="fin-nav-grp" style={{ paddingLeft: 0 }}>{cat}</div>
                  <div className="grid gap-2">
                    {items.map((it) => <ChecklistRow key={it.requirementId} item={it} personId={personId} onChanged={invalidateAll} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Todos los archivos cargados ── */}
      <div className="fin-cpanel">
        <div className="fin-cpanel-body">
          <div className="fin-tb-title mb-3 flex items-center gap-2"><FileText size={15} /> Archivos cargados ({docs.length})</div>
          {docs.length === 0 ? (
            <div className="fin-page-sub">Aún no hay archivos en la carpeta.</div>
          ) : (
            <div className="space-y-1.5">
              {docs.map((d: any) => {
                const local = d.url?.startsWith("local:");
                return (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)" }}>
                    <FileText size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{d.filename}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {d.requirement?.name ?? "Sin clasificar"}
                        {d.expiryDate ? ` · vence ${fmtDate(d.expiryDate)}` : ""}
                      </div>
                    </div>
                    {!local && (
                      <>
                        <button className="fin-btn-icon" title="Descargar" onClick={() => downloadAuthed(`/api/download?url=${encodeURIComponent(d.url)}&name=${encodeURIComponent(d.filename)}`, d.filename).catch(() => window.open(d.url, "_blank"))}><Download size={13} /></button>
                        <button className="fin-btn-icon" title="Compartir por correo" onClick={() => shareDoc(d.id, "email")}><Mail size={13} /></button>
                        <button className="fin-btn-icon" title="Compartir por WhatsApp" onClick={() => shareDoc(d.id, "whatsapp")} style={{ color: "#22c55e" }}><MessageCircle size={13} /></button>
                      </>
                    )}
                    {local && <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>solo local</span>}
                    <button className="fin-btn-icon" title="Eliminar" style={{ color: "#ef4444" }} onClick={() => deleteDocMut.mutate(d.id)}><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Tareas / pendientes de la persona ── */}
      <div className="fin-cpanel">
        <div className="fin-cpanel-body">
          <div className="flex items-center justify-between mb-3">
            <div className="fin-tb-title flex items-center gap-2"><ListChecks size={15} /> Pendientes ({pendingTasks.length})</div>
            <Link to="/admin/tasks" className="fin-btn-icon flex items-center gap-1.5 px-3" style={{ width: "auto", fontSize: 11, fontWeight: 600 }}>Ver todas</Link>
          </div>

          {/* Alta rápida */}
          <div className="flex flex-wrap items-end gap-2 mb-3 rounded-lg p-3" style={{ border: "1px dashed var(--border)", background: "var(--bg-base)" }}>
            <label className="text-[10px] font-semibold flex-1 min-w-[200px]" style={{ color: "var(--text-secondary)" }}>
              Nueva tarea para {p.name.split(" ")[0]}
              <input className="input-base block w-full mt-0.5" placeholder="Ej: Renovar visa, firmar operating agreement…" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && taskTitle.trim()) addTaskMut.mutate(); }} />
            </label>
            <label className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              Fecha límite
              <input type="date" className="input-base block mt-0.5" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            </label>
            <label className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              Prioridad
              <select className="input-base block mt-0.5" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </label>
            <button className="fin-btn-cta flex items-center gap-1.5" style={{ height: 34 }} disabled={!taskTitle.trim() || addTaskMut.isPending} onClick={() => addTaskMut.mutate()}>
              <Plus size={12} /> Agregar
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="fin-page-sub">Sin pendientes para esta persona.</div>
          ) : (
            <div className="space-y-1">
              {tasks.map((t: any) => {
                const overdue = t.status !== "completada" && t.dueDate && new Date(t.dueDate) < new Date();
                const done = t.status === "completada";
                return (
                  <div key={t.id} className={cls("flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px]")} style={{ background: overdue ? "rgba(239,68,68,0.06)" : undefined }}>
                    <button title={done ? "Reabrir" : "Marcar completada"} onClick={() => toggleTaskMut.mutate({ tid: t.id, status: done ? "pendiente" : "completada" })}>
                      <CheckCircle2 size={15} color={done ? "#22c55e" : overdue ? "#ef4444" : "var(--text-muted)"} />
                    </button>
                    <span className="flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)", textDecoration: done ? "line-through" : undefined }}>{t.title}</span>
                    {t.priority === "alta" && !done && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>Alta</span>}
                    {t.dueDate && <span className="flex items-center gap-1 text-[10px]" style={{ color: overdue ? "#ef4444" : "var(--text-muted)" }}><Calendar size={10} />{overdue ? "VENCIDA · " : ""}{fmtDate(t.dueDate)}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
