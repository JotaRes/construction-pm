import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { API } from "../lib/api";
import { usd, pct, dateShort, cls } from "../lib/format";
import { Modal } from "../components/Modal";
import {
  Plus, Trash2, Banknote, Activity, AlertTriangle, Info,
  TrendingDown, Calendar, Building2, Link2,
} from "lucide-react";
import { useConfirm } from "../../components/ConfirmDialog";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import toast from "react-hot-toast";

const CLASS_COLOR: Record<string, string> = {
  competitiva: "var(--ok)",
  razonable: "var(--inf)",
  cara: "var(--warn)",
  agresiva: "var(--accent)",
  peligrosa: "var(--err)",
  "sin clasificar": "var(--text-muted)",
};

const CLASS_BADGE: Record<string, string> = {
  competitiva: "bg-emerald-50 text-emerald-700 border-emerald-200",
  razonable: "bg-teal-50 text-teal-700 border-teal-200",
  cara: "bg-amber-50 text-amber-700 border-amber-200",
  agresiva: "bg-orange-50 text-orange-700 border-orange-200",
  peligrosa: "bg-red-50 text-red-700 border-red-200",
  "sin clasificar": "bg-stone-100 text-stone-600 border-stone-200",
};

export default function Debt() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: loans } = useQuery({ queryKey: ["loans"], queryFn: API.getLoans });
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const [open, setOpen] = useState(false);

  const deleteMut = useMutation({
    mutationFn: (id: number) => API.deleteLoan(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); toast.success("Préstamo eliminado"); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al eliminar"),
  });

  if (!loans) return <div style={{ color: 'var(--brand-teal)' }}>Cargando…</div>;

  const total = loans.reduce((s: number, l: any) => s + l.amount, 0);
  const outstanding = loans.reduce((s: number, l: any) => s + (l.outstanding || 0), 0);
  const repaid = loans.reduce((s: number, l: any) => s + (l.totalRepaid || 0), 0);
  const avgRate = loans.length > 0
    ? loans.filter((l: any) => l.interestRate != null).reduce((s: number, l: any) => s + (l.interestRate || 0), 0) /
      Math.max(1, loans.filter((l: any) => l.interestRate != null).length)
    : 0;
  const dangerous = loans.filter((l: any) => ["peligrosa", "agresiva"].includes(l.classification)).length;

  // Data para gráficos
  const byLender = new Map<string, number>();
  for (const l of loans) {
    const name = l.lender?.name || "Sin lender";
    byLender.set(name, (byLender.get(name) || 0) + l.amount);
  }
  const lenderData = Array.from(byLender.entries()).map(([name, value]) => ({ name, value }));

  const byClass = new Map<string, number>();
  for (const l of loans) {
    const c = l.classification || "sin clasificar";
    byClass.set(c, (byClass.get(c) || 0) + l.amount);
  }
  const classData = Array.from(byClass.entries()).map(([name, value]) => ({ name, value }));

  const autoSyncCount = loans.filter((l: any) => l.sourceMovementId).length;

  return (
    <div className="space-y-5 page-content">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Deuda y préstamos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>
            {loans.length} préstamos · {autoSyncCount} sincronizados automáticamente desde movimientos
          </p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={14} /> Nuevo préstamo manual</button>
      </div>

      {/* Info de interconexión */}
      <div className="card p-4 flex items-start gap-3" style={{ background: 'var(--brand-cream2)' }}>
        <Info size={18} style={{ color: 'var(--brand-gold)', flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm" style={{ color: 'var(--brand-teal)' }}>
          <strong>Auto-sincronización con Movimientos:</strong> cuando registres un <strong>Ingreso</strong> con origen "Préstamo" y un <strong>Lender</strong>, el préstamo se creará aquí automáticamente. Los <strong>Egresos</strong> categorizados como "Pago de deuda" sumarán al <em>Devuelto</em>.
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Deuda total recibida</span>
            <Banknote size={14} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(total, { compact: true })}</div>
        </div>
        <div className="kpi-card kpi-card-red">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Deuda viva</span>
            <TrendingDown size={14} className="text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-600">{usd(outstanding, { compact: true })}</div>
        </div>
        <div className="kpi-card kpi-card-green">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Devuelto</span>
            <Activity size={14} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{usd(repaid, { compact: true })}</div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Tasa promedio</span>
            <Activity size={14} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{pct(avgRate / 100, 2)}</div>
        </div>
        <div className={cls("kpi-card", dangerous > 0 ? "kpi-card-red" : "")}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Préstamos riesgosos</span>
            <AlertTriangle size={14} className={dangerous > 0 ? "text-red-600" : ""} style={dangerous === 0 ? { color: 'var(--brand-gold)' } : {}} />
          </div>
          <div className={cls("text-2xl font-bold font-mono", dangerous > 0 ? "text-red-600" : "")} style={dangerous === 0 ? { color: 'var(--brand-teal)' } : {}}>{dangerous}</div>
        </div>
      </div>

      {/* Gráficos */}
      {loans.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
              <Building2 size={14} style={{ color: 'var(--brand-gold)' }} /> Deuda por lender
            </h2>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={lenderData} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--brand-teal3)" }} tickFormatter={(v) => usd(v, { compact: true })} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "var(--inf)" }} width={140} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                  <Bar dataKey="value" fill="var(--accent)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--brand-gold)' }} /> Distribución por clasificación
            </h2>
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={classData} dataKey="value" nameKey="name" outerRadius={80} label={(d) => usd(d.value as number, { compact: true })}>
                    {classData.map((d, i) => <Cell key={i} fill={CLASS_COLOR[d.name] || "var(--text-muted)"} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'var(--brand-cream2)' }}>
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
            <Banknote size={15} style={{ color: 'var(--brand-gold)' }} /> Listado de préstamos
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(45,75,82,0.04)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                <th className="px-3 py-3 text-left font-semibold">Lender</th>
                <th className="px-3 py-3 text-left font-semibold">Concepto</th>
                <th className="px-3 py-3 text-left font-semibold">Proyecto</th>
                <th className="px-3 py-3 text-right font-semibold">Monto</th>
                <th className="px-3 py-3 text-right font-semibold">Tasa</th>
                <th className="px-3 py-3 text-right font-semibold">Plazo</th>
                <th className="px-3 py-3 text-right font-semibold">Devuelto</th>
                <th className="px-3 py-3 text-right font-semibold">Saldo</th>
                <th className="px-3 py-3 text-center font-semibold">Clasificación</th>
                <th className="px-3 py-3 text-center font-semibold">Fuente</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center" style={{ color: 'var(--brand-teal2)' }}>
                    Sin préstamos registrados. Crea uno manualmente o registra un <Link to="/finance/movements" className="font-semibold hover:underline" style={{ color: 'var(--brand-gold)' }}>movimiento de ingreso con origen "Préstamo"</Link>.
                  </td>
                </tr>
              ) : loans.map((l: any) => (
                <tr key={l.id} className="table-row" style={{ borderBottom: '1px solid rgba(45,75,82,0.06)' }}>
                  <td className="px-3 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--brand-teal2)' }}>
                    <Calendar size={11} className="inline mr-1" /> {dateShort(l.date)}
                  </td>
                  <td className="px-3 py-3 font-semibold" style={{ color: 'var(--brand-teal)' }}>{l.lender?.name}</td>
                  <td className="px-3 py-3 text-xs max-w-[200px] truncate" style={{ color: 'var(--brand-teal)' }} title={l.concept}>{l.concept}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--brand-teal2)' }}>{l.project?.code || "—"}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>{usd(l.amount, { compact: true })}</td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: 'var(--brand-teal)' }}>{l.interestRate != null ? `${l.interestRate}%` : "—"}</td>
                  <td className="px-3 py-3 text-right text-xs" style={{ color: 'var(--brand-teal2)' }}>{l.termMonths ? `${l.termMonths} m` : "—"}</td>
                  <td className="px-3 py-3 text-right font-mono text-emerald-600">{usd(l.totalRepaid || 0, { compact: true })}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-red-600">{usd(l.outstanding || l.amount, { compact: true })}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cls("badge border text-[10px]", CLASS_BADGE[l.classification] || CLASS_BADGE["sin clasificar"])}>
                      {l.classification || "sin clasificar"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {l.sourceMovementId ? (
                      <Link to={`/finance/movements/${l.sourceMovementId}`} title="Creado automáticamente desde un movimiento" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(200,146,42,0.12)', color: 'var(--brand-gold)' }}>
                        <Link2 size={10} /> Auto
                      </Link>
                    ) : (
                      <span className="text-[10px]" style={{ color: 'var(--brand-teal2)' }}>Manual</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Eliminar préstamo',
                          message: `¿Seguro que quieres eliminar el préstamo de ${l.lender?.name}?`,
                          detail: `Monto: ${usd(l.amount ?? 0)} · Saldo: ${usd((l.outstanding ?? l.amount) ?? 0)}. Esta acción no se puede deshacer.`,
                          destructive: true,
                          confirmText: 'Sí, eliminar',
                        })
                        if (ok) deleteMut.mutate(l.id);
                      }}
                      className="btn-ghost text-red-600 p-1"
                      title={l.sourceMovementId ? "Este préstamo se creó desde un movimiento. Eliminar el movimiento también eliminará el préstamo." : "Eliminar préstamo"}
                    ><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LoanModal open={open} onClose={() => setOpen(false)} catalogs={catalogs} />
    </div>
  );
}

function LoanModal({ open, onClose, catalogs }: { open: boolean; onClose: () => void; catalogs: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    concept: "",
    lenderId: "",
    projectId: "",
    interestRate: "",
    termMonths: "",
    startDate: "",
    endDate: "",
    notes: "",
  });

  const mut = useMutation({
    mutationFn: (data: any) => API.createLoan(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Préstamo creado");
      onClose();
      setForm({ date: new Date().toISOString().slice(0, 10), amount: 0, concept: "", lenderId: "", projectId: "", interestRate: "", termMonths: "", startDate: "", endDate: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al crear"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lenderId) return toast.error("Selecciona un lender");
    if (!form.amount || +form.amount <= 0) return toast.error("Monto debe ser mayor a 0");
    if (!form.concept.trim()) return toast.error("Concepto es obligatorio");
    mut.mutate({
      date: new Date(form.date),
      amount: Number(form.amount),
      concept: form.concept.trim(),
      lenderId: Number(form.lenderId),
      projectId: form.projectId ? Number(form.projectId) : null,
      interestRate: form.interestRate ? Number(form.interestRate) : null,
      termMonths: form.termMonths ? Number(form.termMonths) : null,
      startDate: form.startDate ? new Date(form.startDate) : null,
      endDate: form.endDate ? new Date(form.endDate) : null,
      notes: form.notes || null,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo préstamo manual" size="lg">
      <div className="mb-3 p-3 rounded-lg flex items-start gap-2" style={{ background: 'rgba(200,146,42,0.08)', border: '1px solid rgba(200,146,42,0.25)' }}>
        <Info size={14} style={{ color: 'var(--brand-gold)', flexShrink: 0, marginTop: 2 }} />
        <div className="text-xs" style={{ color: 'var(--brand-teal)' }}>
          <strong>Recomendado:</strong> registra el préstamo desde Movimientos (Ingreso + origen "Préstamo" + Lender). Se creará aquí automáticamente y quedará vinculado al movimiento bancario.
        </div>
      </div>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <div><label className="label">Fecha de desembolso *</label><input type="date" className="input w-full" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
        <div><label className="label">Monto USD *</label><input type="number" step="0.01" className="input w-full" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
        <div className="md:col-span-2"><label className="label">Concepto *</label><input className="input w-full" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} required /></div>
        <div>
          <label className="label">Lender *</label>
          <select className="select w-full" value={form.lenderId} onChange={(e) => setForm({ ...form, lenderId: e.target.value })} required>
            <option value="">— seleccionar —</option>
            {catalogs?.lenders?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Proyecto</label>
          <select className="select w-full" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">— ninguno —</option>
            {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
        <div><label className="label">Tasa anual (%)</label><input type="number" step="0.01" className="input w-full" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} placeholder="10.5" /></div>
        <div><label className="label">Plazo (meses)</label><input type="number" className="input w-full" value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} /></div>
        <div><label className="label">Inicio</label><input type="date" className="input w-full" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
        <div><label className="label">Vencimiento</label><input type="date" className="input w-full" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
        <div className="md:col-span-2"><label className="label">Notas</label><textarea className="input w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="md:col-span-2 flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>{mut.isPending ? "Guardando…" : "Crear préstamo"}</button>
        </div>
      </form>
    </Modal>
  );
}
