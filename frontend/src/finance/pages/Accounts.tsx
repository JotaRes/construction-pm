import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, cls } from "../lib/format";
import { KPI } from "../components/KPI";
import { Wallet, Building2, Edit3, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";

export default function Accounts() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["accounts"], queryFn: API.getAccounts });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; data: any }) => API.updateAccountBalances(vars.id, vars.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Actualizado"); setEditingId(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error"),
  });

  if (!data) return <div className="text-slate-400">Cargando…</div>;

  const totalCurrent = data.reduce((s: number, a: any) => s + (a.currentBalance || 0), 0);
  const totalInitial = data.reduce((s: number, a: any) => s + a.initialBalance, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Cuentas bancarias</h1>
        <p className="text-sm text-slate-400">{data.length} cuentas · saldos calculados desde movimientos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Liquidez actual" value={usd(totalCurrent, { compact: true })} tone="accent" icon={<Wallet size={14} />} />
        <KPI label="Saldo inicial total" value={usd(totalInitial, { compact: true })} />
        <KPI label="Variación" value={usd(totalCurrent - totalInitial, { compact: true, sign: true })} tone={totalCurrent - totalInitial >= 0 ? "positive" : "negative"} />
        <KPI label="Cuentas activas" value={String(data.filter((a: any) => a.active).length)} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((a: any) => {
          const isEditing = editingId === a.id;
          return (
            <div key={a.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-accent" />
                  <span className="text-xs font-mono text-slate-400">{a.code}</span>
                </div>
                {!isEditing ? (
                  <button onClick={() => { setEditingId(a.id); setEditForm({ initialBalance: a.initialBalance, reportedBalance: a.reportedBalance }); }} className="btn-ghost p-1">
                    <Edit3 size={14} />
                  </button>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={() => { updateMut.mutate({ id: a.id, data: editForm }); }} className="btn-ghost p-1 text-positive" disabled={updateMut.isPending}>
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost p-1 text-negative">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-sm">{a.name}</h3>
              <div className="text-xs text-slate-500 mb-3">{a.bank} · {a.spv?.code || "Sin SPV"}</div>

              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div>
                  <span className="text-slate-500">Saldo inicial</span>
                  {isEditing ? (
                    <input type="number" step="0.01" value={editForm.initialBalance || 0} onChange={(e) => setEditForm({ ...editForm, initialBalance: +e.target.value })} className="input w-full mt-1" />
                  ) : (
                    <div className="font-mono">{usd(a.initialBalance)}</div>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Saldo banco</span>
                  {isEditing ? (
                    <input type="number" step="0.01" value={editForm.reportedBalance || 0} onChange={(e) => setEditForm({ ...editForm, reportedBalance: +e.target.value })} className="input w-full mt-1" />
                  ) : (
                    <div className="font-mono">{usd(a.reportedBalance)}</div>
                  )}
                </div>
                <div className="col-span-2 border-t border-line pt-2 mt-1">
                  <span className="text-slate-500">Saldo calculado</span>
                  <div className={cls("text-xl font-mono font-semibold",
                    (a.currentBalance || 0) >= 0 ? "text-positive" : "text-negative"
                  )}>{usd(a.currentBalance || 0)}</div>
                </div>
                {Math.abs(a.balanceDiff || 0) > 0.01 && (
                  <div className="col-span-2 text-warn">
                    Diferencia vs banco: {usd(a.balanceDiff || 0, { sign: true })}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-line text-xs text-slate-500">
                {a._count?.movementsFrom || 0} movimientos · {a.yearsActive || "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
