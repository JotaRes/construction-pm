import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { API } from "../lib/api";
import { usd, dateShort } from "../lib/format";
import { KPI } from "../components/KPI";
import { Modal } from "../components/Modal";
import { Users, Plus, Trash2, TrendingUp, Banknote, Wallet } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, CartesianGrid,
} from "recharts";
import toast from "react-hot-toast";

export default function Capital() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["capital"], queryFn: API.getCapital });
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const [openContrib, setOpenContrib] = useState(false);
  const [openNonBank, setOpenNonBank] = useState(false);

  const deleteContrib = useMutation({
    mutationFn: (id: number) => API.deleteContribution(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["capital"] }); toast.success("Eliminado"); },
  });

  if (!data) return <div className="text-slate-400">Cargando…</div>;

  // Acumulado mensual por socio
  const allDates = [...data.contribs.map((c: any) => c.date), ...data.nonBank.map((c: any) => c.date)]
    .map((d) => new Date(d).toISOString().slice(0, 7))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();
  const partners: any[] = data.byPartner;
  const series = allDates.map((ym) => {
    const row: any = { month: ym };
    partners.forEach((p) => {
      const contribs = data.contribs
        .filter((c: any) => c.partnerId === p.partner.id && new Date(c.date).toISOString().slice(0, 7) <= ym)
        .reduce((s: number, c: any) => s + c.amount, 0);
      const nb = data.nonBank
        .filter((c: any) => c.partnerId === p.partner.id && new Date(c.date).toISOString().slice(0, 7) <= ym)
        .reduce((s: number, c: any) => s + c.amount, 0);
      row[p.partner.code] = contribs + nb;
    });
    return row;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Capital aportado</h1>
          <p className="text-sm text-slate-400">Equity por socio · Bancarizado y no-bancarizado · Acumulado y línea de tiempo</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setOpenNonBank(true)}><Plus size={14} /> Aporte no-bancarizado</button>
          <button className="btn-primary" onClick={() => setOpenContrib(true)}><Plus size={14} /> Aporte bancarizado</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Equity total" value={usd(data.kpis.totalEquity, { compact: true })} icon={<Users size={14} />} tone="positive" />
        <KPI label="Préstamos recibidos" value={usd(data.kpis.totalLoans, { compact: true })} icon={<Banknote size={14} />} tone="warn" />
        <KPI label="Devuelto" value={usd(data.kpis.totalRepaid, { compact: true })} icon={<Wallet size={14} />} />
        <KPI label="Deuda viva" value={usd(data.kpis.outstandingDebt, { compact: true })} icon={<TrendingUp size={14} />} tone={data.kpis.outstandingDebt > 0 ? "negative" : "default"} />
      </div>

      {/* Por socio */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Aporte por socio</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={partners.map((p: any) => ({ name: p.partner.fullName, Bancarizado: p.bankContrib, "No-bancarizado": p.nonBankContrib }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2230" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#cbd5e1" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <Tooltip contentStyle={{ background: "#161b24", border: "1px solid #222a37", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Bancarizado" stackId="a" fill="#22c55e" />
                <Bar dataKey="No-bancarizado" stackId="a" fill="#5eead4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Acumulado en el tiempo</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2230" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <Tooltip contentStyle={{ background: "#161b24", border: "1px solid #222a37", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {partners.map((p: any, i: number) => (
                  <Line key={p.partner.id} type="monotone" dataKey={p.partner.code} stroke={["#22c55e", "#5eead4", "#3b82f6", "#f59e0b"][i % 4]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lista de aportes bancarizados */}
      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold">Aportes bancarizados</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Socio</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Proyecto</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.contribs.map((c: any) => (
              <tr key={c.id} className="border-b border-line/50 table-row">
                <td className="px-3 py-2 text-xs font-mono">{dateShort(c.date)}</td>
                <td className="px-3 py-2">{c.partner?.code} · {c.partner?.fullName}</td>
                <td className="px-3 py-2 text-xs">{c.concept}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{c.project?.code || "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-positive">{usd(c.amount)}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => deleteContrib.mutate(c.id)} className="btn-ghost text-negative p-1"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ContribModal open={openContrib} onClose={() => setOpenContrib(false)} catalogs={catalogs} type="bank" />
      <ContribModal open={openNonBank} onClose={() => setOpenNonBank(false)} catalogs={catalogs} type="nonbank" />
    </div>
  );
}

function ContribModal({ open, onClose, catalogs, type }: { open: boolean; onClose: () => void; catalogs: any; type: "bank" | "nonbank" }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    concept: "",
    partnerId: "",
    projectId: "",
    origin: "Equity Socio",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => type === "bank" ? API.createContribution(data) : API.createNonBank(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capital"] });
      toast.success("Aporte registrado");
      onClose();
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      date: new Date(form.date),
      amount: Number(form.amount),
      concept: form.concept,
      partnerId: Number(form.partnerId),
      projectId: form.projectId ? Number(form.projectId) : null,
      ...(type === "bank" ? { origin: form.origin } : {}),
      notes: form.notes || null,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={type === "bank" ? "Nuevo aporte bancarizado" : "Aporte no-bancarizado"} size="md">
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Fecha</label><input type="date" className="input w-full" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
        <div><label className="label">Monto USD</label><input type="number" step="0.01" className="input w-full" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
        <div><label className="label">Concepto</label><input className="input w-full" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} required /></div>
        <div><label className="label">Socio</label>
          <select className="select w-full" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })} required>
            <option value="">— seleccionar —</option>
            {catalogs?.partners?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}
          </select>
        </div>
        <div><label className="label">Proyecto (opcional)</label>
          <select className="select w-full" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">— ninguno —</option>
            {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
        <div><label className="label">Notas</label><textarea className="input w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
