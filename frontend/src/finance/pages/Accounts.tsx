import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, cls } from "../lib/format";
import { KPI } from "../components/KPI";
import { Modal } from "../components/Modal";
import {
  Wallet, Building2, Edit3, Check, X, Plus, Trash2,
  TrendingUp, TrendingDown, Hash, MapPin, Landmark,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Accounts() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["accounts"], queryFn: API.getAccounts });
  // Totales globales de movimientos para el panel superior
  const { data: movData } = useQuery({
    queryKey: ["movements-totals"],
    queryFn: () => API.listMovements({ limit: 5000 }),
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [createOpen, setCreateOpen] = useState(false);

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; data: any }) => API.updateAccountBalances(vars.id, vars.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Cuenta actualizada"); setEditingId(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => API.deleteAccount(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Cuenta eliminada"); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al eliminar"),
  });

  if (!data) return <div className="text-slate-400">Cargando…</div>;

  // Panel superior — totales globales
  const totalManual = data.reduce((s: number, a: any) => s + (a.currentBalance || a.reportedBalance || 0), 0);
  const totalComputed = data.reduce((s: number, a: any) => s + (a.computedBalance || 0), 0);
  const allMovs: any[] = movData?.movements || [];
  const totalIngresos = allMovs.filter((m) => m.type === "Ingreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
  const totalEgresos = allMovs.filter((m) => m.type === "Egreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
  const variacion = totalIngresos - totalEgresos;

  const startEdit = (a: any) => {
    setEditingId(a.id);
    setEditForm({
      currentBalance: a.currentBalance || a.reportedBalance || 0,
      accountNumber: a.accountNumber || "",
      routingNumber: a.routingNumber || "",
      address: a.address || "",
      name: a.name,
      bank: a.bank,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cuentas bancarias</h1>
          <p className="text-sm text-slate-400">{data.length} cuentas · saldo manual ingresado por el usuario</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <Plus size={14} /> Nueva cuenta
        </button>
      </div>

      {/* Panel superior — Cashflow + Variación */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Cashflow disponible" value={usd(totalManual, { compact: true })} tone="accent" icon={<Wallet size={14} />} />
        <KPI label="Ingresos totales" value={usd(totalIngresos, { compact: true })} tone="positive" icon={<TrendingUp size={14} />} />
        <KPI label="Egresos totales" value={usd(totalEgresos, { compact: true })} tone="negative" icon={<TrendingDown size={14} />} />
        <KPI
          label="Variación neta"
          value={usd(variacion, { compact: true, sign: true })}
          tone={variacion >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* Indicador de descuadre */}
      {Math.abs(totalManual - totalComputed) > 1 && (
        <div className="card p-3 bg-warn/5 border-warn/30 flex items-center gap-3">
          <div className="text-warn">
            <Landmark size={18} />
          </div>
          <div className="flex-1 text-sm">
            <span className="font-semibold text-warn">Descuadre detectado: </span>
            <span className="text-slate-300">
              Saldo manual {usd(totalManual)} vs cálculo desde movimientos {usd(totalComputed)}.
              Diferencia: <span className={variacion >= 0 ? "text-positive" : "text-negative"}>{usd(totalManual - totalComputed, { sign: true })}</span>
            </span>
          </div>
        </div>
      )}

      {/* Tarjetas por cuenta */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((a: any) => {
          const isEditing = editingId === a.id;
          const manualBalance = a.currentBalance || a.reportedBalance || 0;
          const diff = (a.computedBalance || 0) - manualBalance;
          const hasDiff = Math.abs(diff) > 0.01;

          return (
            <div key={a.id} className="card p-4 hover:border-accent/30 transition-colors">
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0">
                    {isEditing ? (
                      <input className="input w-full text-sm font-semibold" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    ) : (
                      <h3 className="font-semibold text-sm truncate" title={a.name}>{a.name}</h3>
                    )}
                    <div className="text-[11px] font-mono text-slate-500">{a.code}</div>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!isEditing ? (
                    <>
                      <button onClick={() => startEdit(a)} className="btn-ghost p-1.5" title="Editar"><Edit3 size={13} /></button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar cuenta "${a.name}"? Solo se permite si no tiene movimientos.`)) {
                            deleteMut.mutate(a.id);
                          }
                        }}
                        className="btn-ghost p-1.5 text-negative" title="Eliminar"
                      ><Trash2 size={13} /></button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => updateMut.mutate({ id: a.id, data: editForm })}
                        className="btn-ghost p-1.5 text-positive" disabled={updateMut.isPending}
                      ><Check size={13} /></button>
                      <button onClick={() => setEditingId(null)} className="btn-ghost p-1.5 text-negative"><X size={13} /></button>
                    </>
                  )}
                </div>
              </div>

              {/* Banco */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                <Landmark size={12} />
                {isEditing ? (
                  <input className="input flex-1 text-xs py-1" value={editForm.bank} onChange={(e) => setEditForm({ ...editForm, bank: e.target.value })} />
                ) : (
                  <span>{a.bank}{a.spv?.code ? ` · ${a.spv.code}` : ""}</span>
                )}
              </div>

              {/* Saldo manual destacado */}
              <div className="bg-bg-soft rounded-lg px-3 py-3 mb-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Saldo actual (manual)</div>
                {isEditing ? (
                  <input
                    type="number" step="0.01"
                    className="input w-full text-xl font-mono font-semibold"
                    value={editForm.currentBalance}
                    onChange={(e) => setEditForm({ ...editForm, currentBalance: +e.target.value })}
                  />
                ) : (
                  <div className={cls("text-2xl font-mono font-bold",
                    manualBalance >= 0 ? "text-positive" : "text-negative"
                  )}>
                    {usd(manualBalance)}
                  </div>
                )}
                {hasDiff && !isEditing && (
                  <div className="text-[11px] text-warn mt-1">
                    Cálculo desde movimientos: {usd(a.computedBalance)} ({usd(diff, { sign: true })})
                  </div>
                )}
              </div>

              {/* Detalles bancarios */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Hash size={11} className="text-slate-500 flex-shrink-0" />
                  <span className="text-slate-500 min-w-[50px]"># cuenta</span>
                  {isEditing ? (
                    <input className="input flex-1 text-xs py-1 font-mono" value={editForm.accountNumber} onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })} placeholder="****1234" />
                  ) : (
                    <span className="font-mono text-slate-300">{a.accountNumber || "—"}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Hash size={11} className="text-slate-500 flex-shrink-0" />
                  <span className="text-slate-500 min-w-[50px]">Routing</span>
                  {isEditing ? (
                    <input className="input flex-1 text-xs py-1 font-mono" value={editForm.routingNumber} onChange={(e) => setEditForm({ ...editForm, routingNumber: e.target.value })} placeholder="9 dígitos" />
                  ) : (
                    <span className="font-mono text-slate-300">{a.routingNumber || "—"}</span>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={11} className="text-slate-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500 min-w-[50px]">Dirección</span>
                  {isEditing ? (
                    <input className="input flex-1 text-xs py-1" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Dirección sucursal" />
                  ) : (
                    <span className="text-slate-300 text-[11px] flex-1 break-words">{a.address || "—"}</span>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-slate-500">
                <span>{a._count?.movementsFrom || 0} movimientos</span>
                <span className={cls("badge",
                  a.active ? "bg-positive/10 text-positive" : "bg-slate-700/30 text-slate-500"
                )}>{a.active ? "Activa" : "Inactiva"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <CreateAccountModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: "",
    name: "",
    bank: "",
    accountNumber: "",
    routingNumber: "",
    address: "",
    currentBalance: 0,
    type: "operativa",
    active: true,
    notes: "",
  });

  const mut = useMutation({
    mutationFn: (data: any) => API.createAccount(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["catalogs"] });
      toast.success("Cuenta creada");
      onClose();
      setForm({ code: "", name: "", bank: "", accountNumber: "", routingNumber: "", address: "", currentBalance: 0, type: "operativa", active: true, notes: "" });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al crear"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.bank.trim()) {
      return toast.error("Código, nombre y banco son obligatorios");
    }
    mut.mutate(form);
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva cuenta bancaria" size="md">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">Código *</label>
          <input className="input w-full font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="OB HOLDING" />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="select w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="operativa">Operativa</option>
            <option value="proyecto">Proyecto</option>
            <option value="personal">Personal</option>
            <option value="ahorro">Ahorro</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Nombre *</label>
          <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="OB Holding Ocean Bank" />
        </div>
        <div>
          <label className="label">Banco *</label>
          <input className="input w-full" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} required placeholder="Ocean Bank" />
        </div>
        <div>
          <label className="label">Saldo inicial USD</label>
          <input type="number" step="0.01" className="input w-full" value={form.currentBalance} onChange={(e) => setForm({ ...form, currentBalance: +e.target.value })} />
        </div>
        <div>
          <label className="label"># Cuenta</label>
          <input className="input w-full font-mono" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="********1234" />
        </div>
        <div>
          <label className="label">Routing #</label>
          <input className="input w-full font-mono" value={form.routingNumber} onChange={(e) => setForm({ ...form, routingNumber: e.target.value })} placeholder="063100277" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Dirección sucursal</label>
          <input className="input w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="780 NW 42nd Ave, Miami, FL" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Notas</label>
          <textarea className="input w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="md:col-span-2 flex justify-end gap-2 mt-2 pt-3 border-t border-line">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>{mut.isPending ? "Creando…" : "Crear cuenta"}</button>
        </div>
      </form>
    </Modal>
  );
}
