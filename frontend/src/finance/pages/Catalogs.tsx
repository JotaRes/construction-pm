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
import { useI18n, type TranslationKey } from '../../i18n'
import { dataLabel, ACCOUNT_TYPE_LABELS, PROVIDER_TYPE_LABELS } from '../../i18n/dataLabels'

// Definición rica de campos por categoría
type FieldDef = {
  name: string;
  labelKey: TranslationKey;
  type?: "text" | "number" | "checkbox" | "email" | "textarea" | "select";
  required?: boolean;
  placeholderKey?: TranslationKey;
  placeholder?: string;
  options?: string[];
  group?: string;
};

const TAB_CONFIG: Record<string, {
  labelKey: TranslationKey;
  /** Nombre en singular y minúscula: "Agregar socio" / "Add partner". */
  singularKey: TranslationKey;
  icon: any;
  columns: { key: string; labelKey: TranslationKey }[];
  fields: FieldDef[];
}> = {
  spvs: {
    labelKey: 'fin.cat.spvsSubsidiarias',
    singularKey: 'fin.cat.sing.spv',
    icon: Layers,
    columns: [
      { key: "code", labelKey: 'fin.cat.codigo' },
      { key: "name", labelKey: 'fin.cat.nombre' },
    ],
    fields: [
      { name: "code", labelKey: 'common.codigo', required: true, placeholderKey: 'fin.cat.spv001' },
      { name: "name", labelKey: 'common.nombreCompleto', required: true, placeholderKey: 'fin.cat.scDesarrolloResidencialLlc' },
      { name: "notes", labelKey: 'common.notas', type: "textarea" },
    ],
  },
  accounts: {
    labelKey: 'common.cuentasBancarias',
    singularKey: 'fin.cat.sing.account',
    icon: Building,
    columns: [
      { key: "code", labelKey: 'fin.cat.codigo' },
      { key: "name", labelKey: 'fin.cat.nombre' },
      { key: "bank", labelKey: 'fin.cat.banco' },
    ],
    fields: [
      { name: "code", labelKey: 'common.codigo', required: true, placeholderKey: 'fin.accts.obHolding' },
      { name: "name", labelKey: 'fin.cat.nombreCuenta', required: true, placeholderKey: 'fin.accts.obHoldingOceanBank' },
      { name: "bank", labelKey: 'fin.accts.banco', required: true, placeholderKey: 'fin.accts.oceanBank' },
      { name: "type", labelKey: 'common.tipo', type: "select", options: ["operativa", "proyecto", "personal", "ahorro"] },
      { name: "accountNumber", labelKey: 'common.cuenta', placeholder: "********1234" },
      { name: "routingNumber", labelKey: 'common.routingAba', placeholder: "063100277" },
      { name: "address", labelKey: 'common.direccionSucursal', placeholderKey: 'fin.accts.780Nw42ndAveMiamiFl' },
      { name: "initialBalance", labelKey: 'fin.accts.saldoInicialUsd', type: "number" },
      { name: "notes", labelKey: 'common.notas', type: "textarea" },
    ],
  },
  partners: {
    labelKey: 'fin.cat.socios',
    singularKey: 'fin.cat.sing.partner',
    icon: Users,
    columns: [
      { key: "code", labelKey: 'fin.cat.codigo' },
      { key: "fullName", labelKey: 'fin.cat.nombreCompleto' },
    ],
    fields: [
      { name: "code", labelKey: 'common.codigo', required: true, placeholderKey: 'fin.cat.ra01' },
      { name: "fullName", labelKey: 'common.nombreCompleto', required: true, placeholderKey: 'fin.cat.juanRestrepoAvila' },
      { name: "email", labelKey: 'common.email', type: "email", placeholderKey: 'fin.cat.socioExampleCom' },
      { name: "notes", labelKey: 'common.notas', type: "textarea" },
    ],
  },
  lenders: {
    labelKey: 'fin.cat.prestamistasLenders',
    singularKey: 'fin.cat.sing.lender',
    icon: Banknote,
    columns: [
      { key: "name", labelKey: 'fin.cat.nombre' },
      { key: "type", labelKey: 'common.tipo' },
    ],
    fields: [
      { name: "name", labelKey: 'common.nombre', required: true, placeholderKey: 'fin.cat.kiaviLlc' },
      { name: "type", labelKey: 'common.tipo', type: "select", options: ["FinLender", "Bank", "Hard Money", "Private", "Friend/Family"] },
      { name: "contactName", labelKey: 'fin.cat.personaDeContacto' },
      { name: "email", labelKey: 'common.email', type: "email" },
      { name: "phone", labelKey: 'common.telefono' },
      { name: "notes", labelKey: 'common.notas', type: "textarea" },
    ],
  },
  providers: {
    labelKey: 'fin.cat.proveedoresTerceros',
    singularKey: 'fin.cat.sing.provider',
    icon: Briefcase,
    columns: [
      { key: "name", labelKey: 'fin.cat.nombre' },
      { key: "type", labelKey: 'common.tipo' },
    ],
    fields: [
      { name: "name", labelKey: 'common.nombre', required: true, placeholderKey: 'fin.cat.homeDepot' },
      { name: "type", labelKey: 'common.tipo', type: "select", options: ["Materiales", "Servicios", "Mano de obra", "Profesional", "Permisos", "Otros"] },
      { name: "contactName", labelKey: 'fin.cat.personaDeContacto' },
      { name: "email", labelKey: 'common.email', type: "email" },
      { name: "phone", labelKey: 'common.telefono' },
      { name: "notes", labelKey: 'common.notas', type: "textarea" },
    ],
  },
  categories: {
    labelKey: 'fin.cat.categoriasDeGasto',
    singularKey: 'fin.cat.sing.category',
    icon: TrendingDown,
    columns: [
      { key: "code", labelKey: 'fin.cat.codigo' },
      { key: "name", labelKey: 'fin.cat.nombre' },
      { key: "group", labelKey: 'fin.cat.grupo' },
    ],
    fields: [
      { name: "code", labelKey: 'common.codigo', required: true, placeholderKey: 'fin.cat.mat01' },
      { name: "name", labelKey: 'common.nombre', required: true, placeholderKey: 'fin.cat.materialesConstruccion' },
      { name: "group", labelKey: 'fin.cat.grupo', placeholderKey: 'fin.cat.construccionOperacionCorporativo' },
      { name: "isCorporate", labelKey: 'fin.cat.esGastoCorporativoNoPorProyecto', type: "checkbox" },
      { name: "notes", labelKey: 'common.notas', type: "textarea" },
    ],
  },
  origins: {
    labelKey: 'fin.cat.origenesDeIngreso',
    singularKey: 'fin.cat.sing.origin',
    icon: TrendingUp,
    columns: [
      { key: "code", labelKey: 'fin.cat.codigo' },
      { key: "name", labelKey: 'fin.cat.nombre' },
    ],
    fields: [
      { name: "code", labelKey: 'common.codigo', required: true, placeholderKey: 'fin.cat.eqSoc' },
      { name: "name", labelKey: 'common.nombre', required: true, placeholderKey: 'fin.cat.equitySocio' },
      { name: "notes", labelKey: 'common.notas', type: "textarea" },
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
  const { t } = useI18n()
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<string>("spvs");
  const { data } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const delMut = useMutation({
    mutationFn: ({ key, id }: { key: string; id: number }) => API_MAP[key].delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["catalogs"] }); toast.success(t('fin.cat.eliminado')); },
    onError: (e: any) => toast.error(e.response?.data?.error || t('fin.cat.noSePudoEliminar')),
  });

  const current = TAB_CONFIG[tab];
  const rows: any[] = data?.[tab] || [];

  const tabKeys = Object.keys(TAB_CONFIG);

  return (
    <div className="space-y-4 page-content">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><BookOpen className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('fin.cat.catalogos')}</span></h1>
          <p className="text-sm" style={{ color: 'var(--brand-teal2)' }}>
            {t('fin.cat.listasMaestrasCuentasSociosPrestamistasCat')}
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={14} /> {t('common.agregar')} {t(current.singularKey)}
        </button>
      </div>

      <div className="card overflow-hidden">
        {/* Tabs */}
        <div className="px-2 py-2 flex gap-1 overflow-x-auto" style={{ borderBottom: '1px solid rgba(29,29,31,0.1)', background: 'var(--brand-cream2)' }}>
          {tabKeys.map((key) => {
            const cfg = TAB_CONFIG[key];
            const Icon = cfg.icon;
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
                <Icon size={13} /> {t(cfg.labelKey)}
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
                {current.columns.map((c) => <th key={c.key} className="px-4 py-3 text-left font-semibold">{t(c.labelKey)}</th>)}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={current.columns.length + 1} className="px-4 py-12 text-center" style={{ color: 'var(--brand-teal2)' }}>
                  <FileText size={32} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                  {t('fin.cat.noHayRegistrosEn')} {t(current.labelKey).toLowerCase()}{t('fin.cat.usaElBotonAgregarArribaPara')}
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
                      <button onClick={() => { setEditing(row); setOpen(true); }} className="btn-ghost p-1" title={t('common.editar')}><Edit3 size={14} /></button>
                      <button
                        onClick={async () => {
                          const label = row.name || row.fullName || row.code;
                          const ok = await confirm({
                            title: t('fin.cat.deleteTitle', { entity: t(current.singularKey) }),
                            message: t('fin.cat.deleteMessage', { name: label }),
                            detail: t('fin.cat.deleteDetail'),
                            destructive: true,
                            confirmText: t('common.yesDelete'),
                          })
                          if (ok) delMut.mutate({ key: tab, id: row.id });
                        }}
                        className="btn-ghost p-1 text-red-600"
                        title={t('common.eliminar')}
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
  config: { labelKey: TranslationKey; singularKey: TranslationKey; fields: FieldDef[] };
}) {
  const { t } = useI18n()
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
      toast.success(editing ? t('common.updated') : t('common.created'));
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || t('common.saveError')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validar campos requeridos
    const missing = config.fields.filter((f) => f.required && !String(form[f.name] ?? "").trim());
    if (missing.length > 0) {
      return toast.error(t('fin.cat.camposRequeridosV0', { v0: missing.map((f) => t(f.labelKey).replace(" *", "")).join(", ") }));
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
      title={editing ? t('fin.cat.editEntity', { entity: t(config.singularKey) }) : t('fin.cat.newEntity', { entity: t(config.singularKey) })}
      size="md"
    >
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        {config.fields.map((f) => (
          <div key={f.name} className={f.type === "textarea" ? "md:col-span-2" : ""}>
            <label className="label">{t(f.labelKey)}</label>
            {f.type === "checkbox" ? (
              <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer" style={{ background: 'var(--brand-cream2)' }}>
                <input
                  type="checkbox"
                  checked={!!form[f.name]}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm" style={{ color: 'var(--brand-teal)' }}>{t('fin.cat.si')}</span>
              </label>
            ) : f.type === "select" ? (
              <select
                className="select w-full"
                value={form[f.name] ?? ""}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              >
                <option value="">{t('fin.cat.seleccionar')}</option>
                {f.options?.map((o) => <option key={o} value={o}>{dataLabel({ ...ACCOUNT_TYPE_LABELS, ...PROVIDER_TYPE_LABELS }, o, t)}</option>)}
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
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancelar')}</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>
            {mut.isPending ? t('common.guardando') : editing ? t('common.guardarCambios') : t('common.crear')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
