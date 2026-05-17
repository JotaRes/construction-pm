import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { API } from "../lib/api";
import { usd, pct, dateShort, cls } from "../lib/format";
import { KPI } from "../components/KPI";
import { Modal } from "../components/Modal";
import { Plus, Trash2, Banknote, Activity, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

const CLASS_BADGE: Record<string, string> = {
  competitiva: "bg-positive/10 text-positive border-positive/30",
  razonable: "bg-accent/10 text-accent border-accent/30",
  cara: "bg-warn/10 text-warn border-warn/30",
  agresiva: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  peligrosa: "bg-negative/10 text-negative border-negative/30",
  "sin clasificar": "bg-bg-hover text-slate-400 border-line",
};

export default function Debt() {
  const qc = useQueryClient();
  const { data: loans } = useQuery({ queryKey: ["loans"], queryFn: API.getLoans });
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const [open, setOpen] = useState(false);

  const deleteMut = useMutation({
    mutationFn: (id: number) => API.deleteLoan(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); toast.success("Eliminado"); },
  });

  if (!loans) return <div className="text-slate-400">Cargando…</div>;

  const total = loans.reduce((s: number, l: any) => s + l.amount, 0);
  const outstanding = loans.reduce((s: number, l: any) => s + (l.outstanding || 0), 0);
  const repaid = loans.reduce((s: number, l: any) => s + (l.totalRepaid || 0), 0);
  const avgRate = loans.length > 0 ? loans.reduce((s: number, l: any) => s + (l.interestRate || 0), 0) / loans.length : 0;
  const dangerous = loans.filter((l: any) => ["peligrosa", "agresiva"].includes(l.classification)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deuda y préstamos</h1>
          <p className="text-sm text-slate-400">{loans.length} préstamos · clasificación automática por tasa</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={14} /> Nuevo préstamo</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Deuda total recibida" value={usd(total, { compact: true })} icon={<Banknote size={14} />} />
        <KPI label="Deuda viva" value={usd(outstanding, { compact: true })} tone={outstanding > 0 ? "negative" : "default"} />
        <KPI label="Devuelto" value={usd(repaid, { compact: true })} tone="positive" />
        <KPI label="Tasa promedio" value={pct(avgRate / 100, 2)} icon={<Activity size={14} />} />
        <KPI label="Préstamos riesgosos" value={String(dangerous)} icon={<AlertTriangle size={14} />} tone={dangerous > 0 ? "negative" : "default"} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Lender</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Proyecto</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-right">Tasa</th>
              <th className="px-3 py-2 text-right">Plazo</th>
              <th className="px-3 py-2 text-right">Devuelto</th>
              <th className="px-3 py-2 text-right">Saldo</th>
              <th className="px-3 py-2">Clasificación</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l: any) => (
              <tr key={l.id} className="border-b border-line/50 table-row">
                <td className="px-3 py-2 text-xs font-mono">{dateShort(l.date)}</td>
                <td className="px-3 py-2">{l.lender?.name}</td>
                <td className="px-3 py-2 text-xs">{l.concept}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{l.project?.code || "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{usd(l.amount, { compact: true })}</td>
                <td className="px-3 py-2 text-right font-mono">{l.interestRate ? `${l.interestRate}%` : "—"}</td>
                <td className="px-3 py-2 text-right text-xs">{l.termMonths ? `${l.termMonths} m` : "—"}</td>
                <td className="px-3 py-2 text-right text-positive font-mono">{usd(l.totalRepaid || 0, { compact: true })}</td>
                <td className="px-3 py-2 text-right text-negative font-mono">{usd(l.outstanding || l.amount, { compact: true })}</td>
                <td className="px-3 py-2"><span className={cls("badge border", CLASS_BADGE[l.classification] || CLASS_BADGE["sin clasificar"])}>{l.classification || "sin clasificar"}</span></td>
                <td className="px-3 py-2 text-right"><button onClick={() => deleteMut.mutate(l.id)} className="btn-ghost text-negative p-1"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); toast.success("Préstamo creado"); onClose(); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({
      date: new Date(form.date),
      amount: Number(form.amount),
      concept: form.concept,
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
    <Modal open={open} onClose={onClose} title="Nuevo préstamo" size="lg">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <div><label className="label">Fecha de desembolso</label><input type="date" className="input w-full" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
        <div><label className="label">Monto USD</label><input type="number" step="0.01" className="input w-full" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
        <div className="md:col-span-2"><label className="label">Concepto</label><input className="input w-full" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} required /></div>
        <div><label className="label">Lender</label>
          <select className="select w-full" value={form.lenderId} onChange={(e) => setForm({ ...form, lenderId: e.target.value })} required>
            <option value="">— seleccionar —</option>
            {catalogs?.lenders?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div><label className="label">Proyecto</label>
          <select className="select w-full" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">— ninguno —</option>
            {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
        <div><label className="label">Tasa anual (%)</label><input type="number" step="0.01" className="input w-full" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} placeholder="ej. 10.5" /></div>
        <div><label className="label">Plazo (meses)</label><input type="number" className="input w-full" value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} /></div>
        <div><label className="label">Inicio</label><input type="date" className="input w-full" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
        <div><label className="label">Vencimiento</label><input type="date" className="input w-full" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
        <div className="md:col-span-2"><label className="label">Notas</label><textarea className="input w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>{mut.isPending ? "Guardando…" : "Crear"}</button>
        </div>
      </form>
    </Modal>
  );
}
