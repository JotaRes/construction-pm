import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { API } from "../lib/api";
import { usd, cls } from "../lib/format";
import { Modal } from "../components/Modal";
import {
  Wallet, Building2, Edit3, Check, X, Plus, Trash2,
  TrendingUp, TrendingDown, Hash, MapPin, Landmark, ChevronRight,
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

  if (!data) return <div style={{ color: 'var(--brand-teal)' }}>Cargando…</div>;

  // Panel superior — totales globales (saldo CALCULADO desde movimientos)
  const totalComputed = data.reduce((s: number, a: any) => s + (a.computedBalance || 0), 0);
  const allMovs: any[] = movData?.movements || [];
  const totalIngresos = allMovs.filter((m) => m.type === "Ingreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
  const totalEgresos = allMovs.filter((m) => m.type === "Egreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
  const variacion = totalIngresos - totalEgresos;

  const startEdit = (a: any) => {
    setEditingId(a.id);
    setEditForm({
      initialBalance: a.initialBalance || 0,
      accountNumber: a.accountNumber || "",
      routingNumber: a.routingNumber || "",
      address: a.address || "",
      name: a.name,
      bank: a.bank,
    });
  };

  return (
    <div className="space-y-5 page-content">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Cuentas bancarias</h1>
          <p className="text-sm" style={{ color: 'var(--brand-teal2)' }}>{data.length} cuentas · Saldos calculados automáticamente desde movimientos</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <Plus size={14} /> Nueva cuenta
        </button>
      </div>

      {/* Panel superior — Cashflow + Variación */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card kpi-card-gold">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Cashflow disponible</span>
            <Wallet size={14} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className={cls("text-2xl font-bold font-mono", totalComputed >= 0 ? "text-emerald-600" : "text-red-600")}>
            {usd(totalComputed, { compact: true })}
          </div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--brand-teal2)' }}>Suma calculada de todas las cuentas</div>
        </div>
        <div className="kpi-card kpi-card-green">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Ingresos totales</span>
            <TrendingUp size={14} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{usd(totalIngresos, { compact: true })}</div>
        </div>
        <div className="kpi-card kpi-card-red">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Egresos totales</span>
            <TrendingDown size={14} className="text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-600">{usd(totalEgresos, { compact: true })}</div>
        </div>
        <div className={cls("kpi-card", variacion >= 0 ? "kpi-card-green" : "kpi-card-red")}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Variación neta</span>
          </div>
          <div className={cls("text-2xl font-bold font-mono", variacion >= 0 ? "text-emerald-600" : "text-red-600")}>
            {usd(variacion, { compact: true, sign: true })}
          </div>
        </div>
      </div>

      {/* Estado vacío */}
      {data.length === 0 && (
        <div className="card p-12 text-center">
          <Building2 size={48} className="mx-auto mb-3" style={{ color: 'rgba(45,75,82,0.3)' }} />
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--brand-teal)' }}>No hay cuentas bancarias registradas</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>Crea tu primera cuenta para comenzar a registrar movimientos.</p>
          <button onClick={() => setCreateOpen(true)} className="btn-primary mx-auto">
            <Plus size={14} /> Crear primera cuenta
          </button>
        </div>
      )}

      {/* Tarjetas por cuenta */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((a: any) => {
          const isEditing = editingId === a.id;
          const computedBalance = a.computedBalance || 0;
          const movCount = a._count?.movementsFrom || 0;

          return (
            <div
              key={a.id}
              className="card overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Barra superior dorada con tipo */}
              <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-gold) 100%)' }} />

              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(200,146,42,0.12)', color: 'var(--brand-gold)' }}
                    >
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      {isEditing ? (
                        <input className="input w-full text-sm font-semibold" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      ) : (
                        <h3 className="font-bold text-base truncate" style={{ color: 'var(--brand-teal)' }} title={a.name}>{a.name}</h3>
                      )}
                      <div className="text-[10px] font-mono uppercase tracking-wide" style={{ color: 'var(--brand-teal2)' }}>{a.code}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!isEditing ? (
                      <>
                        <Link to={`/finance/accounts/${a.id}`} className="btn-ghost p-1.5" title="Ver movimientos"><ChevronRight size={14} /></Link>
                        <button onClick={() => startEdit(a)} className="btn-ghost p-1.5" title="Editar"><Edit3 size={13} /></button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar cuenta "${a.name}"? Solo se permite si no tiene movimientos.`)) {
                              deleteMut.mutate(a.id);
                            }
                          }}
                          className="btn-ghost p-1.5 text-red-600" title="Eliminar"
                        ><Trash2 size={13} /></button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => updateMut.mutate({ id: a.id, data: editForm })}
                          className="btn-ghost p-1.5 text-emerald-600" disabled={updateMut.isPending}
                        ><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="btn-ghost p-1.5 text-red-600"><X size={14} /></button>
                      </>
                    )}
                  </div>
                </div>

                {/* Banco */}
                <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: 'var(--brand-teal2)' }}>
                  <Landmark size={12} />
                  {isEditing ? (
                    <input className="input flex-1 text-xs py-1" value={editForm.bank} onChange={(e) => setEditForm({ ...editForm, bank: e.target.value })} />
                  ) : (
                    <span className="font-medium">{a.bank}{a.spv?.code ? ` · ${a.spv.code}` : ""}</span>
                  )}
                </div>

                {/* Saldo calculado destacado */}
                <Link to={`/finance/accounts/${a.id}`} className="block">
                  <div
                    className="rounded-xl px-4 py-4 mb-3 transition-all hover:shadow-md cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, var(--brand-cream2) 0%, #ffffff 100%)',
                      border: '1px solid rgba(45,75,82,0.1)',
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>Saldo actual</div>
                    {isEditing ? (
                      <>
                        <div className="text-[10px] mb-1" style={{ color: 'var(--brand-teal2)' }}>Saldo inicial:</div>
                        <input
                          type="number" step="0.01"
                          className="input w-full text-xl font-mono font-semibold"
                          value={editForm.initialBalance}
                          onChange={(e) => setEditForm({ ...editForm, initialBalance: +e.target.value })}
                        />
                      </>
                    ) : (
                      <>
                        <div className={cls("text-3xl font-mono font-bold",
                          computedBalance >= 0 ? "text-emerald-600" : "text-red-600"
                        )}>
                          {usd(computedBalance)}
                        </div>
                        <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>
                          Calculado: saldo inicial + ingresos − egresos
                        </div>
                      </>
                    )}
                  </div>
                </Link>

                {/* Detalles bancarios — claros y bien visibles */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'rgba(45,75,82,0.04)' }}>
                    <Hash size={13} style={{ color: 'var(--brand-gold)' }} className="flex-shrink-0" />
                    <span className="text-xs font-semibold min-w-[70px]" style={{ color: 'var(--brand-teal2)' }}># Cuenta</span>
                    {isEditing ? (
                      <input className="input flex-1 text-xs py-1 font-mono" value={editForm.accountNumber} onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })} placeholder="****1234" />
                    ) : (
                      <span className="font-mono text-sm font-semibold flex-1 text-right" style={{ color: 'var(--brand-teal)' }}>
                        {a.accountNumber || <span className="opacity-50">No registrada</span>}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'rgba(45,75,82,0.04)' }}>
                    <Hash size={13} style={{ color: 'var(--brand-gold)' }} className="flex-shrink-0" />
                    <span className="text-xs font-semibold min-w-[70px]" style={{ color: 'var(--brand-teal2)' }}>Routing</span>
                    {isEditing ? (
                      <input className="input flex-1 text-xs py-1 font-mono" value={editForm.routingNumber} onChange={(e) => setEditForm({ ...editForm, routingNumber: e.target.value })} placeholder="9 dígitos" />
                    ) : (
                      <span className="font-mono text-sm font-semibold flex-1 text-right" style={{ color: 'var(--brand-teal)' }}>
                        {a.routingNumber || <span className="opacity-50">No registrado</span>}
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 px-2 py-1.5 rounded" style={{ background: 'rgba(45,75,82,0.04)' }}>
                    <MapPin size={13} style={{ color: 'var(--brand-gold)' }} className="flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold min-w-[70px] mt-0.5" style={{ color: 'var(--brand-teal2)' }}>Dirección</span>
                    {isEditing ? (
                      <input className="input flex-1 text-xs py-1" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Dirección sucursal" />
                    ) : (
                      <span className="text-xs flex-1 text-right break-words font-medium" style={{ color: 'var(--brand-teal)' }}>
                        {a.address || <span className="opacity-50">No registrada</span>}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid rgba(45,75,82,0.08)', color: 'var(--brand-teal2)' }}>
                  <span>{movCount} movimiento{movCount !== 1 ? "s" : ""}</span>
                  <Link to={`/finance/accounts/${a.id}`} className="font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--brand-gold)' }}>
                    Ver movimientos <ChevronRight size={12} />
                  </Link>
                </div>
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
    initialBalance: 0,
    type: "operativa",
    active: true,
    notes: "",
  });

  const mut = useMutation({
    mutationFn: (data: any) => API.createAccount(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["catalogs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Cuenta creada");
      onClose();
      setForm({ code: "", name: "", bank: "", accountNumber: "", routingNumber: "", address: "", initialBalance: 0, type: "operativa", active: true, notes: "" });
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
          <label className="label">Nombre completo *</label>
          <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="OB Holding Ocean Bank" />
        </div>
        <div>
          <label className="label">Banco *</label>
          <input className="input w-full" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} required placeholder="Ocean Bank" />
        </div>
        <div>
          <label className="label">Saldo inicial USD</label>
          <input type="number" step="0.01" className="input w-full" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: +e.target.value })} />
        </div>
        <div>
          <label className="label"># Cuenta</label>
          <input className="input w-full font-mono" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="********1234" />
        </div>
        <div>
          <label className="label">Routing # (ABA)</label>
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
        <div className="md:col-span-2 flex justify-end gap-2 mt-2 pt-3" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>{mut.isPending ? "Creando…" : "Crear cuenta"}</button>
        </div>
      </form>
    </Modal>
  );
}
