import { BookOpen } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { API } from "../lib/api";
import { Modal } from "../components/Modal";
import {
  Plus, Trash2, Edit3, Building, Users, Banknote, Briefcase,
  TrendingDown, TrendingUp, Layers, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { useConfirm } from "../../components/ConfirmDialog";

// Definición rica de campos por categoría
type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "checkbox" | "email" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  group?: string;
};

const TAB_CONFIG: Record<string, {
  label: string;
  icon: any;
  columns: { key: string; label: string }[];
  fields: FieldDef[];
}> = {
  spvs: {
    label: "SPVs / Subsidiarias",
    icon: Layers,
    columns: [
      { key: "code", label: "Código" },
      { key: "name", label: "Nombre" },
    ],
    fields: [
      { name: "code", label: "Código *", required: true, placeholder: "SPV-001" },
      { name: "name", label: "Nombre completo *", required: true, placeholder: "SC Desarrollo Residencial LLC" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
  accounts: {
    label: "Cuentas bancarias",
    icon: Building,
    columns: [
      { key: "code", label: "Código" },
      { key: "name", label: "Nombre" },
      { key: "bank", label: "Banco" },
    ],
    fields: [
      { name: "code", label: "Código *", required: true, placeholder: "OB HOLDING" },
      { name: "name", label: "Nombre cuenta *", required: true, placeholder: "OB Holding Ocean Bank" },
      { name: "bank", label: "Banco *", required: true, placeholder: "Ocean Bank" },
      { name: "type", label: "Tipo", type: "select", options: ["operativa", "proyecto", "personal", "ahorro"] },
      { name: "accountNumber", label: "# Cuenta", placeholder: "********1234" },
      { name: "routingNumber", label: "Routing # (ABA)", placeholder: "063100277" },
      { name: "address", label: "Dirección sucursal", placeholder: "780 NW 42nd Ave, Miami, FL" },
      { name: "initialBalance", label: "Saldo inicial USD", type: "number" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
  partners: {
    label: "Socios",
    icon: Users,
    columns: [
      { key: "code", label: "Código" },
      { key: "fullName", label: "Nombre completo" },
    ],
    fields: [
      { name: "code", label: "Código *", required: true, placeholder: "RA-01" },
      { name: "fullName", label: "Nombre completo *", required: true, placeholder: "Juan Restrepo Avila" },
      { name: "email", label: "Email", type: "email", placeholder: "socio@example.com" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
  lenders: {
    label: "Prestamistas (Lenders)",
    icon: Banknote,
    columns: [
      { key: "name", label: "Nombre" },
      { key: "type", label: "Tipo" },
    ],
    fields: [
      { name: "name", label: "Nombre *", required: true, placeholder: "Kiavi LLC" },
      { name: "type", label: "Tipo", type: "select", options: ["FinLender", "Bank", "Hard Money", "Private", "Friend/Family"] },
      { name: "contactName", label: "Persona de contacto" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Teléfono" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
  providers: {
    label: "Proveedores / Terceros",
    icon: Briefcase,
    columns: [
      { key: "name", label: "Nombre" },
      { key: "type", label: "Tipo" },
    ],
    fields: [
      { name: "name", label: "Nombre *", required: true, placeholder: "Home Depot" },
      { name: "type", label: "Tipo", type: "select", options: ["Materiales", "Servicios", "Mano de obra", "Profesional", "Permisos", "Otros"] },
      { name: "contactName", label: "Persona de contacto" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Teléfono" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
  categories: {
    label: "Categorías de gasto",
    icon: TrendingDown,
    columns: [
      { key: "code", label: "Código" },
      { key: "name", label: "Nombre" },
      { key: "group", label: "Grupo" },
    ],
    fields: [
      { name: "code", label: "Código *", required: true, placeholder: "MAT-01" },
      { name: "name", label: "Nombre *", required: true, placeholder: "Materiales construcción" },
      { name: "group", label: "Grupo", placeholder: "Construcción / Operación / Corporativo" },
      { name: "isCorporate", label: "Es gasto corporativo (no por proyecto)", type: "checkbox" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
  origins: {
    label: "Orígenes de ingreso",
    icon: TrendingUp,
    columns: [
      { key: "code", label: "Código" },
      { key: "name", label: "Nombre" },
    ],
    fields: [
      { name: "code", label: "Código *", required: true, placeholder: "EQ-SOC" },
      { name: "name", label: "Nombre *", required: true, placeholder: "Equity socio" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
};

const API_MAP: Record<string, any> = {
  spvs: { create: API.createSPV, update: API.updateSPV, delete: API.deleteSPV },
  accounts: { create: API.createAccount, update: API.updateAccount, delete: API.deleteAccount },
  partners: { create: API.createPartner, update: API.updatePartner, delete: API.deletePartner },
  lenders: { create: API.createLender, update: API.updateLender, delete: API.deleteLender },
  providers: { create: API.createProvider, update: API.updateProvider, delete: API.deleteProvider },
  categories: { create: API.createCategory, update: API.updateCategory, delete: API.deleteCategory },
  origins: { create: API.createOrigin, update: API.updateOrigin, delete: API.deleteOrigin },
};

export default function Catalogs() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<string>("spvs");
  const { data } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const delMut = useMutation({
    mutationFn: ({ key, id }: { key: string; id: number }) => API_MAP[key].delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["catalogs"] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.response?.data?.error || "No se pudo eliminar"),
  });

  const current = TAB_CONFIG[tab];
  const rows: any[] = data?.[tab] || [];

  const tabKeys = Object.keys(TAB_CONFIG);

  return (
    <div className="space-y-4 page-content">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><BookOpen className="w-[22px] h-[22px]" strokeWidth={2.2} /></span><span>Catálogos</span></h1>
          <p className="text-sm" style={{ color: 'var(--brand-teal2)' }}>
            Listas maestras: cuentas, socios, prestamistas, categorías, proveedores y orígenes
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={14} /> Agregar {current.label.toLowerCase().replace(/s$/, "")}
        </button>
      </div>

      <div className="card overflow-hidden">
        {/* Tabs */}
        <div className="px-2 py-2 flex gap-1 overflow-x-auto" style={{ borderBottom: '1px solid rgba(29,29,31,0.1)', background: 'var(--brand-cream2)' }}>
          {tabKeys.map((key) => {
            const t = TAB_CONFIG[key];
            const Icon = t.icon;
            const active = tab === key;
            const count = (data?.[key] || []).length;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-all whitespace-nowrap"
                style={
                  active
                    ? { background: 'var(--brand-teal)', color: 'white' }
                    : { color: 'var(--brand-teal2)' }
                }
              >
                <Icon size={13} /> {t.label}
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                  background: active ? 'rgba(255,255,255,0.2)' : 'rgba(29,29,31,0.08)',
                  color: active ? 'rgba(255,255,255,0.85)' : 'var(--brand-teal2)',
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(29,29,31,0.04)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                {current.columns.map((c) => <th key={c.key} className="px-4 py-3 text-left font-semibold">{c.label}</th>)}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={current.columns.length + 1} className="px-4 py-12 text-center" style={{ color: 'var(--brand-teal2)' }}>
                  <FileText size={32} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                  No hay registros en {current.label.toLowerCase()}. Usa el botón "Agregar" arriba para crear el primero.
                </td></tr>
              ) : rows.map((row: any) => (
                <tr key={row.id} className="table-row" style={{ borderBottom: '1px solid rgba(29,29,31,0.06)' }}>
                  {current.columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 font-medium" style={{ color: 'var(--brand-teal)' }}>
                      {row[c.key] ?? <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => { setEditing(row); setOpen(true); }} className="btn-ghost p-1" title="Editar"><Edit3 size={14} /></button>
                      <button
                        onClick={async () => {
                          const label = row.name || row.fullName || row.code;
                          const ok = await confirm({
                            title: `Eliminar ${current.label.toLowerCase()}`,
                            message: `¿Seguro que quieres eliminar "${label}"?`,
                            detail: 'Si este registro está referenciado por movimientos u otros datos, la eliminación puede fallar.',
                            destructive: true,
                            confirmText: 'Sí, eliminar',
                          })
                          if (ok) delMut.mutate({ key: tab, id: row.id });
                        }}
                        className="btn-ghost p-1 text-red-600"
                        title="Eliminar"
                      ><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CatalogModal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        tab={tab}
        editing={editing}
        config={current}
      />
    </div>
  );
}

function CatalogModal({
  open, onClose, tab, editing, config,
}: {
  open: boolean;
  onClose: () => void;
  tab: string;
  editing: any;
  config: { label: string; fields: FieldDef[] };
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});

  // Resetear el form cuando se abre el modal o cambia el editing
  useEffect(() => {
    if (open) {
      setForm(editing ? { ...editing } : {});
    }
  }, [open, editing, tab]);

  const mut = useMutation({
    mutationFn: (data: any) =>
      editing ? API_MAP[tab].update(editing.id, data) : API_MAP[tab].create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogs"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Actualizado" : "Creado");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al guardar"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validar campos requeridos
    const missing = config.fields.filter((f) => f.required && !String(form[f.name] ?? "").trim());
    if (missing.length > 0) {
      return toast.error(`Campos requeridos: ${missing.map((f) => f.label.replace(" *", "")).join(", ")}`);
    }
    // Limpiar relations / fields irrelevantes
    const payload: any = {};
    for (const f of config.fields) {
      const v = form[f.name];
      if (f.type === "number") payload[f.name] = v != null && v !== "" ? Number(v) : 0;
      else if (f.type === "checkbox") payload[f.name] = !!v;
      else if (v != null && v !== "") payload[f.name] = v;
      else payload[f.name] = null;
    }
    mut.mutate(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${config.label.toLowerCase().replace(/s$/, "")}` : `Nuevo ${config.label.toLowerCase().replace(/s$/, "")}`}
      size="md"
    >
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        {config.fields.map((f) => (
          <div key={f.name} className={f.type === "textarea" ? "md:col-span-2" : ""}>
            <label className="label">{f.label}</label>
            {f.type === "checkbox" ? (
              <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer" style={{ background: 'var(--brand-cream2)' }}>
                <input
                  type="checkbox"
                  checked={!!form[f.name]}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm" style={{ color: 'var(--brand-teal)' }}>Sí</span>
              </label>
            ) : f.type === "select" ? (
              <select
                className="select w-full"
                value={form[f.name] ?? ""}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                className="input w-full"
                rows={2}
                value={form[f.name] ?? ""}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                placeholder={f.placeholder}
              />
            ) : (
              <input
                type={f.type || "text"}
                className="input w-full"
                value={form[f.name] ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [f.name]: f.type === "number" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value,
                  })
                }
                placeholder={f.placeholder}
                required={f.required}
              />
            )}
          </div>
        ))}
        <div className="md:col-span-2 flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.1)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>
            {mut.isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
