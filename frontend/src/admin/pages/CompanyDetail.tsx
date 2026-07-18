import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, Landmark, Pencil, Trash2, Save, X, Upload, FileText,
  ExternalLink, Mail, MessageCircle, Download, AlertTriangle, CheckCircle2,
  Clock, HelpCircle, Wallet, ListChecks, Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  AdminAPI, ROLE_LABELS, STATUS_LABELS, shareByEmail, shareByWhatsApp, absoluteShareUrl,
} from "../lib/api";
import { cls, date as fmtDate } from "../../finance/lib/format";
import { useConfirm } from "../../components/ConfirmDialog";
import { downloadAuthed } from "../../lib/api";

// ── Semáforo de cumplimiento por requisito ────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  OK:         { label: "Al día",     color: "#22c55e", bg: "rgba(34,197,94,0.12)",  Icon: CheckCircle2 },
  POR_VENCER: { label: "Por vencer", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", Icon: Clock },
  VENCIDO:    { label: "Vencido",    color: "#ef4444", bg: "rgba(239,68,68,0.12)",  Icon: AlertTriangle },
  FALTANTE:   { label: "Faltante",   color: "#94a3b8", bg: "rgba(148,163,184,0.12)", Icon: HelpCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  FORMACION: "Formación / Corporativo",
  FISCAL: "Fiscal",
  BANCARIO: "Bancario",
  SEGUROS: "Seguros",
  PROPIEDAD: "Propiedad",
  LEGAL: "Legal",
  PERSONAL: "Personal / RR.HH.",
  CUMPLIMIENTO: "Cumplimiento",
  OTRO: "Otros",
};

const LEGAL_FIELDS: { k: string; label: string; ph?: string }[] = [
  { k: "name", label: "Nombre *" },
  { k: "legalName", label: "Razón social completa" },
  { k: "ein", label: "EIN", ph: "XX-XXXXXXX" },
  { k: "stateOfFormation", label: "Estado de constitución", ph: "South Carolina" },
  { k: "registeredAgent", label: "Registered Agent" },
  { k: "address", label: "Dirección" },
];

// ── Fila del checklist con acción de subir documento ──────────────────────
function ChecklistRow({ item, companyId, onUploaded }: { item: any; companyId: number; onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[item.status] ?? STATUS_META.FALTANTE;

  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("docTypeId", String(item.docTypeId));
      if (issueDate) fd.append("issueDate", issueDate);
      if (expiryDate) fd.append("expiryDate", expiryDate);
      return AdminAPI.uploadDocument(companyId, fd);
    },
    onSuccess: () => {
      toast.success(`"${item.name}" cargado`);
      setOpen(false); setIssueDate(""); setExpiryDate("");
      onUploaded();
    },
    onError: (e: any) => toast.error(e.message),
  });

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

export default function CompanyDetail() {
  const { id } = useParams();
  const companyId = Number(id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const confirm = useConfirm();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);

  const companyQ = useQuery({ queryKey: ["adm-company", companyId], queryFn: () => AdminAPI.getCompany(companyId) });
  const checklistQ = useQuery({ queryKey: ["adm-checklist", companyId], queryFn: () => AdminAPI.getChecklist(companyId) });
  const docsQ = useQuery({ queryKey: ["adm-docs", companyId], queryFn: () => AdminAPI.getDocuments(companyId) });
  const tasksQ = useQuery({ queryKey: ["adm-tasks", companyId], queryFn: () => AdminAPI.getTasks({ companyId }) });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["adm-company", companyId] });
    qc.invalidateQueries({ queryKey: ["adm-checklist", companyId] });
    qc.invalidateQueries({ queryKey: ["adm-docs", companyId] });
    qc.invalidateQueries({ queryKey: ["adm-orgchart"] });
    qc.invalidateQueries({ queryKey: ["adm-dashboard"] });
  };

  const updateMut = useMutation({
    mutationFn: (data: any) => AdminAPI.updateCompany(companyId, data),
    onSuccess: () => { toast.success("Empresa actualizada"); setEditing(false); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDocMut = useMutation({
    mutationFn: (docId: number) => AdminAPI.deleteDocument(docId),
    onSuccess: () => { toast.success("Documento eliminado"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const c = companyQ.data;
  const checklist = checklistQ.data;
  const docs = docsQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  if (companyQ.isLoading || !c) return <div className="fin-page-sub">Cargando expediente…</div>;

  const startEdit = () => {
    setForm({
      name: c.name ?? "", legalName: c.legalName ?? "", role: c.role ?? "SUBSIDIARY_OWNER",
      ein: c.ein ?? "", stateOfFormation: c.stateOfFormation ?? "", registeredAgent: c.registeredAgent ?? "",
      address: c.address ?? "", status: c.status ?? "ACTIVE", notes: c.notes ?? "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    if (!form.name?.trim()) { toast.error("El nombre es obligatorio"); return; }
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    updateMut.mutate(payload);
  };

  const handleDeleteCompany = async () => {
    const ok = await confirm({
      title: "Suprimir empresa",
      message: `¿Eliminar "${c.name}" del organigrama?`,
      detail: "Se borrará su expediente (documentos, requisitos y tareas). El SPV financiero vinculado NO se toca. Esta acción no se puede deshacer.",
      destructive: true,
      confirmText: "Sí, suprimir",
    });
    if (!ok) return;
    try {
      await AdminAPI.deleteCompany(companyId);
      toast.success("Empresa suprimida");
      qc.invalidateQueries({ queryKey: ["adm-orgchart"] });
      nav("/admin/orgchart");
    } catch (e: any) { toast.error(e.message); }
  };

  const shareDoc = async (docId: number, via: "email" | "whatsapp") => {
    try {
      const info = await AdminAPI.getShareInfo(docId);
      const url = absoluteShareUrl(info.sharePath);
      if (via === "email") shareByEmail(info.filename, info.companyName, url);
      else shareByWhatsApp(info.filename, info.companyName, url);
    } catch (e: any) { toast.error(e.message); }
  };

  const isHolding = c.role === "HOLDING";
  const groups = Object.entries(
    (checklist?.items ?? []).reduce((acc: Record<string, any[]>, it: any) => {
      (acc[it.category] ||= []).push(it); return acc;
    }, {})
  ) as [string, any[]][];

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Link to="/admin/orgchart" className="fin-btn-icon mt-1" title="Volver al organigrama"><ArrowLeft size={14} /></Link>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: isHolding ? "linear-gradient(135deg,#2A1E3F,#3E2C5C)" : "rgba(139,92,246,0.12)" }}>
            {isHolding ? <Landmark size={20} color="#C6952F" /> : <Building2 size={20} color="#3E5A70" />}
          </div>
          <div className="min-w-0">
            <div className="fin-page-title truncate">{c.name}</div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="badge-active" style={{ fontSize: 10 }}>{ROLE_LABELS[c.role] ?? c.role}</span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{STATUS_LABELS[c.status] ?? c.status}</span>
              {c.finSpv && (
                <Link to="/finance" className="flex items-center gap-1 text-[11px]" style={{ color: "#3E5A70" }} title="Ver en el módulo financiero">
                  <Wallet size={11} /> SPV {c.finSpv.code}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && <button className="fin-btn-icon flex items-center gap-2 px-3" style={{ width: "auto", fontSize: 11.5, fontWeight: 600 }} onClick={startEdit}><Pencil size={12} /> Editar</button>}
          <button className="fin-btn-icon" title="Suprimir empresa" style={{ color: "#ef4444" }} onClick={handleDeleteCompany}><Trash2 size={13} /></button>
        </div>
      </div>

      {/* ── Datos legales (edición) ── */}
      {editing && form && (
        <div className="fin-cpanel">
          <div className="fin-cpanel-body space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              {LEGAL_FIELDS.map((f) => (
                <label key={f.k} className="block">
                  <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                  <input className="input-base w-full mt-1" placeholder={f.ph} value={form[f.k] ?? ""} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
                </label>
              ))}
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Rol en el grupo</span>
                <select className="input-base w-full mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="HOLDING">Holding (matriz)</option>
                  <option value="PROPERTY_MANAGER">Property Manager (administradora)</option>
                  <option value="SUBSIDIARY_OWNER">Propietaria de casa/proyecto</option>
                  <option value="OTHER">Otra</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Estado</span>
                <select className="input-base w-full mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ACTIVE">Activa</option>
                  <option value="INACTIVE">Inactiva</option>
                  <option value="DISSOLVED">Disuelta</option>
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

      {/* ── Ficha de datos (lectura) ── */}
      {!editing && (
        <div className="fin-cpanel">
          <div className="fin-cpanel-body grid md:grid-cols-3 gap-y-3 gap-x-6">
            {[
              ["Razón social", c.legalName], ["EIN", c.ein], ["Estado de constitución", c.stateOfFormation],
              ["Registered Agent", c.registeredAgent], ["Dirección", c.address],
              ["Constituida", c.formationDate ? fmtDate(c.formationDate) : null],
            ].map(([label, val]) => (
              <div key={label as string}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</div>
                <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>{(val as string) || "—"}</div>
              </div>
            ))}
          </div>
          {c.notes && <div className="fin-cpanel-body pt-0 text-[12px]" style={{ color: "var(--text-secondary)" }}>{c.notes}</div>}
        </div>
      )}

      {/* ── Semáforo de cumplimiento ── */}
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

      {/* ── Checklist due diligence agrupado ── */}
      <div className="fin-cpanel">
        <div className="fin-cpanel-body">
          <div className="fin-tb-title mb-3 flex items-center gap-2"><ListChecks size={15} /> Expediente documental (due diligence)</div>
          {groups.length === 0 ? (
            <div className="fin-page-sub">Sin requisitos configurados para esta empresa.</div>
          ) : (
            <div className="space-y-4">
              {groups.map(([cat, items]) => (
                <div key={cat}>
                  <div className="fin-nav-grp" style={{ paddingLeft: 0 }}>{CATEGORY_LABELS[cat] ?? cat}</div>
                  <div className="grid gap-2">
                    {items.map((it) => <ChecklistRow key={it.docTypeId} item={it} companyId={companyId} onUploaded={invalidateAll} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Todos los documentos cargados ── */}
      <div className="fin-cpanel">
        <div className="fin-cpanel-body">
          <div className="fin-tb-title mb-3 flex items-center gap-2"><FileText size={15} /> Documentos cargados ({docs.length})</div>
          {docs.length === 0 ? (
            <div className="fin-page-sub">Aún no hay documentos en el expediente.</div>
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
                        {d.docType?.name ?? "Sin clasificar"}
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

      {/* ── Tareas de la empresa ── */}
      <div className="fin-cpanel">
        <div className="fin-cpanel-body">
          <div className="flex items-center justify-between mb-3">
            <div className="fin-tb-title flex items-center gap-2"><ListChecks size={15} /> Tareas ({tasks.filter((t: any) => t.status !== "completada").length} pendientes)</div>
            <Link to="/admin/tasks" className="fin-btn-icon flex items-center gap-1.5 px-3" style={{ width: "auto", fontSize: 11, fontWeight: 600 }}><Plus size={12} /> Gestionar</Link>
          </div>
          {tasks.length === 0 ? (
            <div className="fin-page-sub">Sin tareas para esta empresa. Créalas desde <Link to="/admin/tasks" className="underline">Tareas</Link>.</div>
          ) : (
            <div className="space-y-1">
              {tasks.slice(0, 6).map((t: any) => {
                const overdue = t.status !== "completada" && t.dueDate && new Date(t.dueDate) < new Date();
                return (
                  <div key={t.id} className={cls("flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px]")} style={{ background: overdue ? "rgba(239,68,68,0.06)" : undefined }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.status === "completada" ? "#22c55e" : overdue ? "#ef4444" : "#f59e0b" }} />
                    <span className="flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)", textDecoration: t.status === "completada" ? "line-through" : undefined }}>{t.title}</span>
                    {t.dueDate && <span className="text-[10px]" style={{ color: overdue ? "#ef4444" : "var(--text-muted)" }}>{fmtDate(t.dueDate)}</span>}
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
