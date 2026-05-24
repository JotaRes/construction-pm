import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { API } from "../lib/api";
import { usd, dateShort } from "../lib/format";
import { Modal } from "../components/Modal";
import {
  Users, Plus, Trash2, TrendingUp, Banknote, Zap, HandCoins,
  Info, ArrowRight, Calendar,
} from "lucide-react";
import { useConfirm } from "../../components/ConfirmDialog";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import toast from "react-hot-toast";

const PARTNER_COLORS = ["#2D4B52", "#C8922A", "#059669", "#3A5F68", "#E0AD4F", "#0d9488"];

export default function Capital() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data } = useQuery({ queryKey: ["capital"], queryFn: API.getCapital });
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const [openNonBank, setOpenNonBank] = useState(false);

  const deleteNonBank = useMutation({
    mutationFn: (id: number) => API.deleteNonBank(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["capital"] }); toast.success("Aporte no-bancarizado eliminado"); },
  });

  if (!data) return <div style={{ color: 'var(--brand-teal)' }}>Cargando…</div>;

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

  const totalBank = data.contribs.reduce((s: number, c: any) => s + c.amount, 0);
  const totalNonBank = data.nonBank.reduce((s: number, c: any) => s + c.amount, 0);
  const totalEquity = totalBank + totalNonBank;

  return (
    <div className="space-y-5 page-content">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Capital aportado</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>
            Equity por socio · {data.contribs.length} aportes bancarizados (auto) + {data.nonBank.length} no-bancarizados
          </p>
        </div>
        <button className="btn-primary" onClick={() => setOpenNonBank(true)}>
          <Plus size={14} /> Aporte NO-bancarizado
        </button>
      </div>

      {/* Banner explicativo */}
      <div className="card p-4 flex items-start gap-3" style={{ background: 'var(--brand-cream2)' }}>
        <Info size={18} style={{ color: 'var(--brand-gold)', flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm" style={{ color: 'var(--brand-teal)' }}>
          <strong>¿Cómo se nutre esta sección?</strong>
          <ul className="mt-1.5 ml-4 space-y-0.5 text-xs list-disc" style={{ color: 'var(--brand-teal2)' }}>
            <li><strong>Aportes bancarizados (automáticos):</strong> registra en <Link to="/finance/movements" className="font-semibold hover:underline" style={{ color: 'var(--brand-gold)' }}>Movimientos</Link> un Ingreso con origen "Aporte Socios" / "Capital Inicial" / "Inversión Socio Extranjero" / "Capitalización Holding" y el socio. Aparece aquí automáticamente con badge <Zap size={10} className="inline" /> auto.</li>
            <li><strong>Aportes NO-bancarizados (manuales):</strong> usa el botón arriba. Para pagos en especie, gastos directos, aportes no canalizados por banco.</li>
          </ul>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card kpi-card-green">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Equity total</span>
            <Users size={14} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{usd(totalEquity, { compact: true })}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>{partners.length} socios activos</div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Bancarizado (auto)</span>
            <Zap size={14} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(totalBank, { compact: true })}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>{data.contribs.length} aportes sincronizados</div>
        </div>
        <div className="kpi-card kpi-card-gold">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>No-bancarizado</span>
            <HandCoins size={14} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(totalNonBank, { compact: true })}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>{data.nonBank.length} aportes manuales</div>
        </div>
        <div className="kpi-card kpi-card-amber">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Deuda viva</span>
            <Banknote size={14} className="text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600">{usd(data.kpis.outstandingDebt, { compact: true })}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>de {usd(data.kpis.totalLoans, { compact: true })} recibidos</div>
        </div>
      </div>

      {/* Por socio + acumulado */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
            <Users size={14} style={{ color: 'var(--brand-gold)' }} /> Aporte por socio (bancarizado vs no-bancarizado)
          </h2>
          {partners.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm" style={{ color: 'var(--brand-teal2)' }}>
              Sin aportes registrados aún.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={partners.map((p: any) => ({
                  name: p.partner.fullName.split(" ").slice(0, 2).join(" "),
                  Bancarizado: p.bankContrib,
                  "No-bancarizado": p.nonBankContrib,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,75,82,0.1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#2D4B52" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#3A5F68" }} tickFormatter={(v) => usd(v, { compact: true })} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Bancarizado" stackId="a" fill="#2D4B52" />
                  <Bar dataKey="No-bancarizado" stackId="a" fill="#C8922A" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-teal)' }}>
            <TrendingUp size={14} style={{ color: 'var(--brand-gold)' }} /> Acumulado en el tiempo
          </h2>
          {series.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm" style={{ color: 'var(--brand-teal2)' }}>
              Sin movimientos aún.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,75,82,0.1)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#3A5F68" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#3A5F68" }} tickFormatter={(v) => usd(v, { compact: true })} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(45,75,82,0.15)", borderRadius: 8 }} formatter={(v: any) => usd(v as number)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {partners.map((p: any, i: number) => (
                    <Line key={p.partner.id} type="monotone" dataKey={p.partner.code} stroke={PARTNER_COLORS[i % PARTNER_COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Resumen por socio (tabla) */}
      {partners.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'var(--brand-cream2)' }}>
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
              <Users size={15} style={{ color: 'var(--brand-gold)' }} /> Totales por socio
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(45,75,82,0.04)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                <th className="px-4 py-3 text-left font-semibold">Socio</th>
                <th className="px-4 py-3 text-right font-semibold">Bancarizado</th>
                <th className="px-4 py-3 text-right font-semibold">No-bancarizado</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">% del total</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p: any) => {
                const totalP = p.bankContrib + p.nonBankContrib;
                const pct = totalEquity > 0 ? (totalP / totalEquity) * 100 : 0;
                return (
                  <tr key={p.partner.id} className="table-row" style={{ borderBottom: '1px solid rgba(45,75,82,0.06)' }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>{p.partner.fullName}</div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--brand-teal2)' }}>{p.partner.code}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(p.bankContrib)}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--brand-gold)' }}>{usd(p.nonBankContrib)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{usd(totalP)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lista de aportes bancarizados (todo auto) */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'var(--brand-cream2)' }}>
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
            <Zap size={15} style={{ color: 'var(--brand-gold)' }} /> Aportes bancarizados (auto desde Movimientos)
          </h2>
          <Link to="/finance/movements" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--brand-gold)' }}>
            Crear movimiento <ArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(45,75,82,0.04)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                <th className="px-3 py-3 text-left font-semibold">Socio</th>
                <th className="px-3 py-3 text-left font-semibold">Concepto</th>
                <th className="px-3 py-3 text-left font-semibold">Proyecto</th>
                <th className="px-3 py-3 text-right font-semibold">Monto</th>
                <th className="px-3 py-3 text-center font-semibold">Movimiento</th>
              </tr>
            </thead>
            <tbody>
              {data.contribs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center" style={{ color: 'var(--brand-teal2)' }}>
                  Sin aportes bancarizados. Ve a <Link to="/finance/movements" className="font-semibold hover:underline" style={{ color: 'var(--brand-gold)' }}>Movimientos</Link> y crea un Ingreso con origen "Aporte Socios" → aparecerá aquí automáticamente.
                </td></tr>
              ) : data.contribs.map((c: any) => (
                <tr key={c.id} className="table-row" style={{ borderBottom: '1px solid rgba(45,75,82,0.06)' }}>
                  <td className="px-3 py-3 text-xs font-mono" style={{ color: 'var(--brand-teal2)' }}>
                    <Calendar size={11} className="inline mr-1" /> {dateShort(c.date)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-sm" style={{ color: 'var(--brand-teal)' }}>{c.partner?.fullName}</div>
                    <div className="text-[10px] font-mono" style={{ color: 'var(--brand-teal2)' }}>{c.partner?.code}</div>
                  </td>
                  <td className="px-3 py-3 text-xs max-w-[280px] truncate" style={{ color: 'var(--brand-teal)' }} title={c.concept}>{c.concept}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--brand-teal2)' }}>
                    {c.project ? (
                      <Link to={`/finance/projects/${c.project.id}`} className="font-mono font-semibold hover:underline" style={{ color: 'var(--brand-gold)' }}>{c.project.code}</Link>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600">{usd(c.amount)}</td>
                  <td className="px-3 py-3 text-center">
                    {c.sourceMovementId ? (
                      <Link to={`/finance/movements/${c.sourceMovementId}`} className="text-[10px] font-semibold hover:underline inline-flex items-center gap-1" style={{ color: 'var(--brand-gold)' }}>
                        <Zap size={10} /> auto
                      </Link>
                    ) : (
                      <span className="text-[10px]" style={{ color: 'var(--brand-teal2)' }}>manual</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista de aportes no-bancarizados */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'var(--brand-cream2)' }}>
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
            <HandCoins size={15} style={{ color: 'var(--brand-gold)' }} /> Aportes NO-bancarizados (manuales)
          </h2>
          <span className="text-[11px]" style={{ color: 'var(--brand-teal2)' }}>Pagos directos en especie, gastos no canalizados por cuenta</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(45,75,82,0.04)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                <th className="px-3 py-3 text-left font-semibold">Socio</th>
                <th className="px-3 py-3 text-left font-semibold">Concepto</th>
                <th className="px-3 py-3 text-left font-semibold">Proyecto</th>
                <th className="px-3 py-3 text-right font-semibold">Monto</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.nonBank.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center" style={{ color: 'var(--brand-teal2)' }}>
                  Sin aportes no-bancarizados. Usa el botón <strong>"Aporte NO-bancarizado"</strong> arriba para registrar pagos directos o gastos en especie.
                </td></tr>
              ) : data.nonBank.map((c: any) => (
                <tr key={c.id} className="table-row" style={{ borderBottom: '1px solid rgba(45,75,82,0.06)' }}>
                  <td className="px-3 py-3 text-xs font-mono" style={{ color: 'var(--brand-teal2)' }}>{dateShort(c.date)}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-sm" style={{ color: 'var(--brand-teal)' }}>{c.partner?.fullName}</div>
                    <div className="text-[10px] font-mono" style={{ color: 'var(--brand-teal2)' }}>{c.partner?.code}</div>
                  </td>
                  <td className="px-3 py-3 text-xs max-w-[280px] truncate" style={{ color: 'var(--brand-teal)' }}>{c.concept}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--brand-teal2)' }}>{c.project?.code || "—"}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold" style={{ color: 'var(--brand-gold)' }}>{usd(c.amount)}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Eliminar aporte no-bancarizado',
                          message: `¿Seguro que quieres eliminar el aporte de ${c.partner?.fullName}?`,
                          detail: `Concepto: "${c.concept}" · Monto: $${c.amount?.toLocaleString()}. Esta acción no se puede deshacer.`,
                          destructive: true,
                          confirmText: 'Sí, eliminar',
                        })
                        if (ok) deleteNonBank.mutate(c.id);
                      }}
                      className="btn-ghost text-red-600 p-1"
                    ><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NonBankModal open={openNonBank} onClose={() => setOpenNonBank(false)} catalogs={catalogs} />
    </div>
  );
}

function NonBankModal({ open, onClose, catalogs }: { open: boolean; onClose: () => void; catalogs: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    concept: "",
    partnerId: "",
    projectId: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => API.createNonBank(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capital"] });
      toast.success("Aporte no-bancarizado registrado");
      onClose();
      setForm({ date: new Date().toISOString().slice(0, 10), amount: 0, concept: "", partnerId: "", projectId: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al registrar"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partnerId) return toast.error("Selecciona el socio que está aportando");
    if (!form.amount || +form.amount <= 0) return toast.error("Monto debe ser mayor a 0");
    if (!form.concept.trim()) return toast.error("Concepto es obligatorio");
    mutation.mutate({
      date: new Date(form.date),
      amount: Number(form.amount),
      concept: form.concept.trim(),
      partnerId: Number(form.partnerId),
      projectId: form.projectId ? Number(form.projectId) : null,
      notes: form.notes || null,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo aporte NO-bancarizado" size="md">
      <div className="mb-3 p-3 rounded-lg flex items-start gap-2" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.1)' }}>
        <Info size={14} style={{ color: 'var(--brand-gold)', flexShrink: 0, marginTop: 2 }} />
        <div className="text-xs" style={{ color: 'var(--brand-teal)' }}>
          Solo registra aquí <strong>aportes que NO pasaron por cuenta bancaria</strong> (especie, pagos directos a terceros, gastos cubiertos personalmente). Los bancarizados se sincronizan automáticamente desde la sección <Link to="/finance/movements" className="font-semibold hover:underline" style={{ color: 'var(--brand-gold)' }}>Movimientos</Link>.
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Fecha *</label>
            <input type="date" className="input w-full" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label className="label">Monto USD *</label>
            <input type="number" step="0.01" className="input w-full" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
        </div>
        <div>
          <label className="label">Socio que aporta *</label>
          <select className="select w-full" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })} required>
            <option value="">— seleccionar socio —</option>
            {catalogs?.partners?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Concepto *</label>
          <input className="input w-full" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} required placeholder="ej. Pago directo de notario en lote Carolina" />
        </div>
        <div>
          <label className="label">Proyecto (opcional)</label>
          <select className="select w-full" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">— ninguno (corporativo) —</option>
            {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Notas</label>
          <textarea className="input w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>{mutation.isPending ? "Guardando…" : "Registrar aporte"}</button>
        </div>
      </form>
    </Modal>
  );
}
