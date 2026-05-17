import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { API } from "../lib/api";
import { usd, dateShort, cls } from "../lib/format";
import { Modal } from "../components/Modal";
import {
  Plus, Search, Sparkles, ChevronRight, Trash2, FileCheck,
  AlertCircle, ArrowDownLeft, ArrowUpRight, Repeat
} from "lucide-react";
import toast from "react-hot-toast";

const TYPE_BADGE: Record<string, { color: string; icon: any; label: string }> = {
  Ingreso: { color: "text-positive bg-positive/10 border-positive/30", icon: ArrowDownLeft, label: "Ingreso" },
  Egreso: { color: "text-negative bg-negative/10 border-negative/30", icon: ArrowUpRight, label: "Egreso" },
  Interbancario: { color: "text-accent bg-accent/10 border-accent/30", icon: Repeat, label: "Inter" },
};

export default function Movements() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const { data, isLoading } = useQuery({
    queryKey: ["movements", filters, q],
    queryFn: () => API.listMovements({ ...filters, q: q || undefined, limit: 1000 }),
  });

  const movements: any[] = data?.movements || [];

  const totals = useMemo(() => {
    const ing = movements.filter((m) => m.type === "Ingreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
    const egr = movements.filter((m) => m.type === "Egreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
    return { ing, egr, neto: ing - egr };
  }, [movements]);

  const detectMutation = useMutation({
    mutationFn: API.detectIntercompany,
    onSuccess: (r) => {
      toast.success(`${r.linked} pares intercompany vinculados`);
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => API.deleteMovement(id),
    onSuccess: () => {
      toast.success("Movimiento eliminado");
      qc.invalidateQueries({ queryKey: ["movements"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Movimientos</h1>
          <p className="text-sm text-slate-400">{data?.total || 0} movimientos registrados · {usd(totals.ing, { compact: true })} ingresos · {usd(totals.egr, { compact: true })} egresos · Neto {usd(totals.neto, { compact: true })}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending}>
            <Sparkles size={14} /> {detectMutation.isPending ? "Detectando…" : "Detectar intercompany"}
          </button>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> Nuevo movimiento
          </button>
        </div>
      </div>

      <div className="card p-3 grid md:grid-cols-7 gap-2">
        <div className="md:col-span-2 flex items-center gap-2 input">
          <Search size={14} className="text-slate-500" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por concepto o notas…"
            className="bg-transparent outline-none flex-1 text-sm"
          />
        </div>
        <select className="select" value={filters.accountId || ""} onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}>
          <option value="">Todas las cuentas</option>
          {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="select" value={filters.type || ""} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Todos los tipos</option>
          <option>Ingreso</option><option>Egreso</option><option>Interbancario</option>
        </select>
        <select className="select" value={filters.projectId || ""} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}>
          <option value="">Todos los proyectos</option>
          {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>
        <select className="select" value={filters.categoryId || ""} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}>
          <option value="">Todas las categorías</option>
          {catalogs?.categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" value={filters.partnerId || ""} onChange={(e) => setFilters({ ...filters, partnerId: e.target.value })}>
          <option value="">Todos los socios</option>
          {catalogs?.partners?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft border-b border-line text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Cuenta</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Categoría / Origen</th>
              <th className="px-3 py-2 text-left">Proyecto / Socio</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-center">Flags</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-4 text-center text-slate-500">Cargando…</td></tr>}
            {!isLoading && movements.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-slate-500">Sin movimientos. Importa el Excel desde Importar / Backup.</td></tr>
            )}
            {movements.map((m) => {
              const tb = TYPE_BADGE[m.type] || { color: "text-slate-300 bg-bg-hover border-line", icon: ArrowDownLeft, label: m.type };
              const Icon = tb.icon;
              return (
                <tr key={m.id} className={cls("border-b border-line/50 table-row", m.needsReview && "bg-red-500/5")}>
                  <td className="px-3 py-2 text-xs font-mono text-slate-300 whitespace-nowrap">{dateShort(m.date)}</td>
                  <td className="px-3 py-2">
                    <span className={cls("badge border", tb.color)}>
                      <Icon size={10} className="mr-1" /> {tb.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{m.account?.name?.replace("OB ", "") || "—"}</td>
                  <td className="px-3 py-2 max-w-[260px] truncate" title={m.concept}>{m.concept}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {m.category?.name || m.origin?.name || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {m.project && <span className="badge bg-bg-hover text-slate-300 mr-1">{m.project.code}</span>}
                    {m.partner && <span className="badge bg-accent/10 text-accent">{m.partner.code}</span>}
                  </td>
                  <td className={cls("px-3 py-2 text-right font-mono",
                    m.type === "Ingreso" ? "text-positive" : m.type === "Egreso" ? "text-negative" : "text-accent"
                  )}>{usd(m.amount)}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      {m.isIntercompany && <span title="Intercompany" className="text-accent"><Repeat size={12} /></span>}
                      {m.hasSupport && <span title="Con soporte" className="text-positive"><FileCheck size={12} /></span>}
                      {m.needsReview && <span title="Por revisar" className="text-warn"><AlertCircle size={12} /></span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Link to={`/movements/${m.id}`} className="btn-ghost p-1"><ChevronRight size={14} /></Link>
                      <button onClick={() => { if (confirm("¿Eliminar movimiento?")) deleteMutation.mutate(m.id); }} className="btn-ghost p-1 text-negative"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MovementModal open={modalOpen} onClose={() => setModalOpen(false)} catalogs={catalogs} />
    </div>
  );
}

function MovementModal({ open, onClose, catalogs }: { open: boolean; onClose: () => void; catalogs: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    date: new Date().toISOString().slice(0, 10),
    type: "Egreso",
    amount: 0,
    concept: "",
    accountId: "",
    destAccountId: "",
    categoryId: "",
    originId: "",
    providerId: "",
    partnerId: "",
    lenderId: "",
    projectId: "",
    isEquity: false,
    isLoan: false,
    isLoanRepayment: false,
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => API.createMovement(data),
    onSuccess: () => {
      toast.success("Movimiento creado");
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      date: new Date(form.date),
      type: form.type,
      amount: Number(form.amount),
      concept: form.concept,
      notes: form.notes || null,
      accountId: Number(form.accountId),
      destAccountId: form.destAccountId ? Number(form.destAccountId) : null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      originId: form.originId ? Number(form.originId) : null,
      providerId: form.providerId ? Number(form.providerId) : null,
      partnerId: form.partnerId ? Number(form.partnerId) : null,
      lenderId: form.lenderId ? Number(form.lenderId) : null,
      projectId: form.projectId ? Number(form.projectId) : null,
      isEquity: !!form.isEquity,
      isLoan: !!form.isLoan,
      isLoanRepayment: !!form.isLoanRepayment,
      isIntercompany: form.type === "Interbancario",
    };
    mutation.mutate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo movimiento" size="lg">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <div><label className="label">Fecha</label><input type="date" className="input w-full" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
        <div><label className="label">Tipo</label>
          <select className="select w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option>Ingreso</option><option>Egreso</option><option>Interbancario</option>
          </select>
        </div>
        <div><label className="label">Cuenta origen *</label>
          <select className="select w-full" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} required>
            <option value="">— seleccionar —</option>
            {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {form.type === "Interbancario" && (
          <div><label className="label">Cuenta destino *</label>
            <select className="select w-full" value={form.destAccountId} onChange={(e) => setForm({ ...form, destAccountId: e.target.value })} required>
              <option value="">— seleccionar —</option>
              {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="label">Monto USD *</label><input type="number" step="0.01" className="input w-full" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
        <div className="md:col-span-2"><label className="label">Concepto *</label><input className="input w-full" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} required /></div>
        {form.type === "Egreso" && (
          <>
            <div><label className="label">Categoría</label>
              <select className="select w-full" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">— ninguna —</option>
                {catalogs?.categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Proveedor / Tercero</label>
              <select className="select w-full" value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
                <option value="">— ninguno —</option>
                {catalogs?.providers?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </>
        )}
        {form.type === "Ingreso" && (
          <div className="md:col-span-2"><label className="label">Origen</label>
            <select className="select w-full" value={form.originId} onChange={(e) => setForm({ ...form, originId: e.target.value })}>
              <option value="">— ninguno —</option>
              {catalogs?.origins?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="label">Proyecto asociado</label>
          <select className="select w-full" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">— ninguno (corporativo) —</option>
            {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
        <div><label className="label">Socio (si equity)</label>
          <select className="select w-full" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value, isEquity: !!e.target.value })}>
            <option value="">— ninguno —</option>
            {catalogs?.partners?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}
          </select>
        </div>
        <div><label className="label">Lender (si préstamo)</label>
          <select className="select w-full" value={form.lenderId} onChange={(e) => setForm({ ...form, lenderId: e.target.value, isLoan: !!e.target.value })}>
            <option value="">— ninguno —</option>
            {catalogs?.lenders?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2"><label className="label">Notas</label><textarea className="input w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>{mutation.isPending ? "Guardando…" : "Crear"}</button>
        </div>
      </form>
    </Modal>
  );
}
