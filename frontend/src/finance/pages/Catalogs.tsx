import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { API } from "../lib/api";
import { Modal } from "../components/Modal";
import { Plus, Trash2, Edit3, Building, Users, Banknote, Briefcase, TrendingDown, TrendingUp, Layers } from "lucide-react";
import toast from "react-hot-toast";

const TABS = [
  { key: "spvs", label: "SPVs", icon: Layers, columns: ["code", "name"] },
  { key: "accounts", label: "Cuentas", icon: Building, columns: ["code", "name", "bank"] },
  { key: "partners", label: "Socios", icon: Users, columns: ["code", "fullName"] },
  { key: "lenders", label: "Lenders", icon: Banknote, columns: ["name", "type"] },
  { key: "providers", label: "Proveedores", icon: Briefcase, columns: ["name", "type"] },
  { key: "categories", label: "Categorías", icon: TrendingDown, columns: ["code", "name", "group"] },
  { key: "origins", label: "Orígenes", icon: TrendingUp, columns: ["code", "name"] },
];

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
  const [tab, setTab] = useState("spvs");
  const { data } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const delMut = useMutation({
    mutationFn: ({ key, id }: { key: string; id: number }) => API_MAP[key].delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["catalogs"] }); toast.success("Eliminado"); },
  });

  const current = TABS.find((t) => t.key === tab)!;
  const rows: any[] = data?.[tab] || [];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Catálogos</h1>
          <p className="text-sm text-slate-400">Listas maestras: cuentas, socios, lenders, categorías y proveedores</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={14} /> Agregar</button>
      </div>

      <div className="card">
        <div className="border-b border-line p-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`btn-ghost text-xs ${tab === t.key ? "bg-bg-hover text-accent" : ""}`}
              >
                <Icon size={12} /> {t.label}
                <span className="ml-1 text-slate-500 text-[10px]">({(data?.[t.key] || []).length})</span>
              </button>
            );
          })}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-xs text-slate-400 uppercase">
            <tr>
              {current.columns.map((c) => <th key={c} className="px-3 py-2 text-left">{c}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.id} className="border-b border-line/50 table-row">
                {current.columns.map((c) => <td key={c} className="px-3 py-2">{row[c]}</td>)}
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => { setEditing(row); setOpen(true); }} className="btn-ghost p-1"><Edit3 size={14} /></button>
                    <button onClick={() => { if (confirm("¿Eliminar?")) delMut.mutate({ key: tab, id: row.id }); }} className="btn-ghost text-negative p-1"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CatalogModal
        open={open}
        onClose={() => setOpen(false)}
        tab={tab}
        editing={editing}
        columns={current.columns}
      />
    </div>
  );
}

function CatalogModal({ open, onClose, tab, editing, columns }: { open: boolean; onClose: () => void; tab: string; editing: any; columns: string[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});

  // reset form when modal opens
  useState(() => editing ? setForm(editing) : setForm({}));

  const mut = useMutation({
    mutationFn: (data: any) =>
      editing ? API_MAP[tab].update(editing.id, data) : API_MAP[tab].create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["catalogs"] }); toast.success("Guardado"); onClose(); },
  });

  // Default fields based on tab
  const extraFields: Record<string, { name: string; label: string; type?: string }[]> = {
    accounts: [{ name: "initialBalance", label: "Saldo inicial", type: "number" }, { name: "yearsActive", label: "Años" }],
    partners: [{ name: "email", label: "Email" }],
    categories: [{ name: "group", label: "Grupo" }, { name: "isCorporate", label: "¿Corporativo?", type: "checkbox" }],
  };

  const fields: { name: string; label: string; type?: string }[] = [
    ...columns.map((c) => ({ name: c, label: c })),
    ...(extraFields[tab] || []),
  ];

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar registro" : "Nuevo registro"} size="md">
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(form); }} className="space-y-3">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="label">{f.label}</label>
            {f.type === "checkbox" ? (
              <input type="checkbox" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
            ) : (
              <input
                type={f.type || "text"}
                className="input w-full"
                value={form[f.name] ?? ""}
                onChange={(e) => setForm({ ...form, [f.name]: f.type === "number" ? +e.target.value : e.target.value })}
              />
            )}
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
