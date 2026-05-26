import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, dateShort, cls } from "../lib/format";
import {
  ArrowLeft, FileText, Upload, Trash2, Link2, Unlink, AlertCircle, FileCheck,
  Edit3, Save, X, Calendar, Building2, Tag, Briefcase, Users, Banknote, TrendingUp,
  ArrowDownLeft, ArrowUpRight, Repeat,
} from "lucide-react";
import toast from "react-hot-toast";

const TYPE_COLOR: Record<string, { bg: string; text: string; icon: any }> = {
  Ingreso:       { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: ArrowDownLeft },
  Egreso:        { bg: "bg-red-50 border-red-200",         text: "text-red-700",     icon: ArrowUpRight },
  Interbancario: { bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",   icon: Repeat },
};

export default function MovementDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const mid = +(id || 0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: m, isLoading, isError, error } = useQuery({
    queryKey: ["movement", mid],
    queryFn: () => API.getMovement(mid),
    enabled: !!mid,
  });
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });

  useEffect(() => {
    if (m && !editing) {
      setForm({
        date: m.date ? new Date(m.date).toISOString().slice(0, 10) : "",
        type: m.type,
        amount: m.amount,
        concept: m.concept || "",
        accountId: m.accountId ? String(m.accountId) : "",
        destAccountId: m.destAccountId ? String(m.destAccountId) : "",
        categoryId: m.categoryId ? String(m.categoryId) : "",
        originId: m.originId ? String(m.originId) : "",
        providerId: m.providerId ? String(m.providerId) : "",
        partnerId: m.partnerId ? String(m.partnerId) : "",
        lenderId: m.lenderId ? String(m.lenderId) : "",
        projectId: m.projectId ? String(m.projectId) : "",
        notes: m.notes || "",
      });
    }
  }, [m, editing]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => API.updateMovement(mid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movement", mid] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["movements-by-account"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["capital"] });
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-detail"] });
      toast.success("Movimiento actualizado");
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al actualizar"),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => API.uploadMovementDoc(mid, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movement", mid] });
      toast.success("Soporte cargado");
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al subir"),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => API.deleteMovementDoc(mid, docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movement", mid] });
      toast.success("Soporte eliminado");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => API.unlinkMovement(mid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movement", mid] }),
  });

  // Lógica equity/loan también en edición
  const selectedOrigin = catalogs?.origins?.find((o: any) => String(o.id) === String(form.originId));
  const isEquityOrigin = !!(selectedOrigin && (
    /^31\d+/.test(selectedOrigin.code || "") ||
    /equity|aporte|capital(?:izaci[oó]n)?|invers[ií]on\s*socio/i.test(selectedOrigin.name || "")
  ));
  const isLoanOrigin = !!(selectedOrigin && (
    /^320[12]/.test(selectedOrigin.code || "") ||
    /pr[ée]stamo|loan|deuda/i.test(selectedOrigin.name || "")
  ));
  const selectedCategory = catalogs?.categories?.find((c: any) => String(c.id) === String(form.categoryId));
  const isDebtPayment = !!(selectedCategory && /pago.*(deuda|pr[ée]stamo)|debt.*pay|amortizaci[oó]n/i.test(selectedCategory.name || ""));

  const handleSave = () => {
    if (!form.amount || +form.amount <= 0) return toast.error("Monto debe ser mayor a 0");
    if (!form.concept.trim()) return toast.error("Concepto es obligatorio");
    if (form.type === "Ingreso" && !form.originId) return toast.error("Selecciona el origen del ingreso");
    if (form.type === "Ingreso" && isEquityOrigin && !form.partnerId) return toast.error("Para aporte de socio, selecciona el socio");
    if (form.type === "Ingreso" && isLoanOrigin && !form.lenderId) return toast.error("Para un préstamo, selecciona el lender");
    if (form.type === "Egreso" && !form.categoryId) return toast.error("Selecciona la categoría");

    const payload: any = {
      date: new Date(form.date),
      type: form.type,
      amount: Number(form.amount),
      concept: form.concept.trim(),
      notes: form.notes || null,
      accountId: Number(form.accountId),
      destAccountId: form.destAccountId ? Number(form.destAccountId) : null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      originId: form.originId ? Number(form.originId) : null,
      providerId: form.providerId ? Number(form.providerId) : null,
      partnerId: form.partnerId ? Number(form.partnerId) : null,
      lenderId: form.lenderId ? Number(form.lenderId) : null,
      projectId: form.projectId ? Number(form.projectId) : null,
      isEquity: !!(form.type === "Ingreso" && isEquityOrigin && form.partnerId),
      isLoan: !!(form.type === "Ingreso" && isLoanOrigin && form.lenderId),
      isLoanRepayment: !!(form.type === "Egreso" && isDebtPayment && form.lenderId),
      isIntercompany: form.type === "Interbancario",
    };
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 page-content">
        <Link to="/finance/movements" className="btn-ghost inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Movimientos
        </Link>
        <div className="card p-12 text-center" style={{ color: 'var(--brand-teal)' }}>Cargando movimiento…</div>
      </div>
    );
  }

  if (isError || !m) {
    return (
      <div className="space-y-4 page-content">
        <Link to="/finance/movements" className="btn-ghost inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Movimientos
        </Link>
        <div className="card p-8 text-center bg-red-50 border-red-200" style={{ color: 'var(--brand-teal)' }}>
          <AlertCircle size={32} className="mx-auto mb-2 text-red-600" />
          <div className="text-red-700 font-semibold mb-2">No se pudo cargar el movimiento</div>
          <div className="text-xs text-red-600">{(error as any)?.message || "ID inválido o el movimiento fue eliminado"}</div>
        </div>
      </div>
    );
  }

  const tc = TYPE_COLOR[m.type] || TYPE_COLOR.Egreso;
  const TypeIcon = tc.icon;

  return (
    <div className="space-y-4 page-content">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/finance/movements" className="btn-ghost inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Movimientos
        </Link>
        <div className="flex gap-2 flex-wrap">
          {!editing ? (
            <>
              <button
                className={cls("btn-secondary text-sm", m.needsReview && "ring-2 ring-amber-300")}
                onClick={() => updateMutation.mutate({ needsReview: !m.needsReview })}
                disabled={updateMutation.isPending}
              >
                <AlertCircle size={14} /> {m.needsReview ? "Quitar marca revisar" : "Marcar por revisar"}
              </button>
              <button
                className={cls("btn-secondary text-sm", m.isReconciled && "ring-2 ring-emerald-300")}
                onClick={() => updateMutation.mutate({ isReconciled: !m.isReconciled })}
                disabled={updateMutation.isPending}
              >
                <FileCheck size={14} /> {m.isReconciled ? "Conciliado ✓" : "Marcar conciliado"}
              </button>
              <button
                className="btn-primary text-sm"
                onClick={() => setEditing(true)}
              >
                <Edit3 size={14} /> Editar movimiento
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary text-sm" onClick={() => setEditing(false)}>
                <X size={14} /> Cancelar
              </button>
              <button className="btn-primary text-sm" onClick={handleSave} disabled={updateMutation.isPending}>
                <Save size={14} /> {updateMutation.isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* === HEADER === */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: 'linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-gold) 100%)' }} />
        <div className="p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <div className={cls("w-12 h-12 rounded-xl flex items-center justify-center border", tc.bg, tc.text)}>
                <TypeIcon size={22} />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  Movimiento #{m.id}
                </div>
                {editing ? (
                  <input
                    className="input text-lg font-semibold w-full"
                    value={form.concept}
                    onChange={(e) => setForm({ ...form, concept: e.target.value })}
                    placeholder="Concepto"
                  />
                ) : (
                  <h1 className="text-xl font-bold" style={{ color: 'var(--brand-teal)' }}>{m.concept}</h1>
                )}
                <div className="flex items-center gap-2 text-xs mt-1 flex-wrap" style={{ color: 'var(--brand-teal2)' }}>
                  <Calendar size={12} /> {editing ? (
                    <input type="date" className="input text-xs py-0.5" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  ) : dateShort(m.date)}
                  <span>·</span>
                  <span className={cls("badge border text-[10px]", tc.bg, tc.text)}>{m.type}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>Monto</div>
              {editing ? (
                <input
                  type="number" step="0.01"
                  className="input text-2xl font-mono font-bold text-right w-40"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              ) : (
                <div className={cls(
                  "text-3xl font-mono font-bold",
                  m.type === "Ingreso" ? "text-emerald-600" :
                  m.type === "Egreso" ? "text-red-600" : ""
                )} style={m.type === "Interbancario" ? { color: 'var(--brand-gold)' } : {}}>
                  {usd(m.amount)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* === CAMPOS === */}
      <div className="card p-5">
        <div className="grid md:grid-cols-2 gap-4">
          <Field icon={<Building2 size={13} />} label={form.type === "Interbancario" ? "Cuenta origen" : "Cuenta"}>
            {editing ? (
              <select className="select w-full" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">— ninguna —</option>
                {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <Link to={`/finance/accounts/${m.account?.id}`} className="font-semibold hover:underline" style={{ color: 'var(--brand-teal)' }}>
                {m.account?.name || "—"}
              </Link>
            )}
          </Field>

          {(form.type === "Interbancario" || m.destAccount) && (
            <Field icon={<Repeat size={13} />} label="Cuenta destino">
              {editing && form.type === "Interbancario" ? (
                <select className="select w-full" value={form.destAccountId} onChange={(e) => setForm({ ...form, destAccountId: e.target.value })}>
                  <option value="">— ninguna —</option>
                  {catalogs?.accounts?.filter((a: any) => String(a.id) !== form.accountId).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : (
                m.destAccount ? (
                  <Link to={`/finance/accounts/${m.destAccount?.id}`} className="font-semibold hover:underline" style={{ color: 'var(--brand-teal)' }}>
                    {m.destAccount?.name}
                  </Link>
                ) : <span style={{ color: 'var(--brand-teal2)', opacity: 0.5 }}>—</span>
              )}
            </Field>
          )}

          {(form.type === "Egreso" || m.category) && (
            <Field icon={<Tag size={13} />} label="Categoría">
              {editing && form.type === "Egreso" ? (
                <select className="select w-full" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">— seleccionar —</option>
                  {catalogs?.categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <div style={{ color: 'var(--brand-teal)' }}>{m.category?.name || <span style={{ opacity: 0.5 }}>—</span>}</div>
              )}
            </Field>
          )}

          {(form.type === "Ingreso" || m.origin) && (
            <Field icon={<TrendingUp size={13} />} label="Origen del ingreso">
              {editing && form.type === "Ingreso" ? (
                <select className="select w-full" value={form.originId} onChange={(e) => setForm({ ...form, originId: e.target.value, partnerId: "", lenderId: "" })}>
                  <option value="">— seleccionar —</option>
                  {catalogs?.origins?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : (
                <div style={{ color: 'var(--brand-teal)' }}>{m.origin?.name || <span style={{ opacity: 0.5 }}>—</span>}</div>
              )}
            </Field>
          )}

          {(form.type === "Egreso" || m.provider) && (
            <Field icon={<Briefcase size={13} />} label="Proveedor">
              {editing && form.type === "Egreso" ? (
                <select className="select w-full" value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
                  <option value="">— ninguno —</option>
                  {catalogs?.providers?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <div style={{ color: 'var(--brand-teal)' }}>{m.provider?.name || <span style={{ opacity: 0.5 }}>—</span>}</div>
              )}
            </Field>
          )}

          <Field icon={<Briefcase size={13} />} label="Proyecto asociado">
            {editing ? (
              <select className="select w-full" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">— corporativo (sin proyecto) —</option>
                {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            ) : (
              m.project ? (
                <Link to={`/finance/projects/${m.project.id}`} className="font-semibold hover:underline" style={{ color: 'var(--brand-teal)' }}>
                  {m.project.code} · {m.project.name}
                </Link>
              ) : <span style={{ color: 'var(--brand-teal2)', opacity: 0.5 }}>Corporativo (sin proyecto)</span>
            )}
          </Field>

          {(isEquityOrigin || m.partner) && form.type === "Ingreso" && (
            <Field icon={<Users size={13} />} label="Socio que aporta *">
              {editing ? (
                <select className="select w-full" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })} required>
                  <option value="">— seleccionar socio —</option>
                  {catalogs?.partners?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}
                </select>
              ) : (
                m.partner ? (
                  <div style={{ color: 'var(--brand-teal)' }}>{m.partner.code} · {m.partner.fullName}</div>
                ) : <span style={{ color: 'var(--brand-teal2)', opacity: 0.5 }}>—</span>
              )}
            </Field>
          )}

          {(isLoanOrigin || isDebtPayment || m.lender) && (
            <Field icon={<Banknote size={13} />} label="Lender (prestamista)">
              {editing ? (
                <select className="select w-full" value={form.lenderId} onChange={(e) => setForm({ ...form, lenderId: e.target.value })}>
                  <option value="">— ninguno —</option>
                  {catalogs?.lenders?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : (
                m.lender ? (
                  <div style={{ color: 'var(--brand-teal)' }}>{m.lender.name}</div>
                ) : <span style={{ color: 'var(--brand-teal2)', opacity: 0.5 }}>—</span>
              )}
            </Field>
          )}

          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--brand-teal2)' }}>
              <FileText size={13} style={{ color: 'var(--brand-gold)' }} /> Notas
            </label>
            {editing ? (
              <textarea className="input w-full" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            ) : (
              <div className="text-sm" style={{ color: 'var(--brand-teal)' }}>{m.notes || <span style={{ opacity: 0.5 }}>Sin notas</span>}</div>
            )}
          </div>
        </div>

        {/* Flags / badges */}
        <div className="mt-5 pt-4 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
          {m.isIntercompany && (
            <span className="badge bg-amber-50 text-amber-700 border border-amber-200 text-xs">
              <Link2 size={11} className="mr-1" /> Intercompany
              {m.linkedMovementId && (
                <Link to={`/finance/movements/${m.linkedMovementId}`} className="ml-2 underline">→ ver par</Link>
              )}
            </span>
          )}
          {m.isEquity && (
            <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
              💼 Aporte de socio — refleja en Capital
            </span>
          )}
          {m.isLoan && (
            <span className="badge bg-amber-50 text-amber-700 border border-amber-200 text-xs">
              🏦 Préstamo recibido — refleja en Deuda
            </span>
          )}
          {m.isLoanRepayment && (
            <span className="badge bg-stone-100 text-stone-700 border border-stone-200 text-xs">
              💳 Pago de deuda — descuenta del Saldo
            </span>
          )}
          {m.isIntercompany && (
            <button onClick={() => unlinkMutation.mutate()} className="btn-ghost text-xs text-red-600">
              <Unlink size={12} /> Desvincular
            </button>
          )}
          {m.matchStatus === "matched" && (
            <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
              <FileCheck size={11} className="mr-1" /> Coincide con extracto
            </span>
          )}
        </div>
      </div>

      {/* === SOPORTES === */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
            <FileText size={16} style={{ color: 'var(--brand-gold)' }} /> Soportes documentales
          </h2>
          <label className="btn-primary cursor-pointer text-xs">
            <Upload size={13} /> Subir archivo
            <input
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); e.target.value = ""; }}
            />
          </label>
        </div>
        {!m.documents || m.documents.length === 0 ? (
          <p className="text-sm py-3" style={{ color: 'var(--brand-teal2)' }}>
            Sin soportes. Adjunta facturas, recibos o evidencia (PDF, imagen).
          </p>
        ) : (
          <ul className="space-y-2">
            {m.documents.map((d: any) => (
              <li key={d.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--brand-cream2)' }}>
                <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:underline font-medium" style={{ color: 'var(--brand-teal)' }}>
                  <FileText size={14} style={{ color: 'var(--brand-gold)' }} /> {d.filename}
                  <span className="text-[10px]" style={{ color: 'var(--brand-teal2)' }}>· {(d.size / 1024).toFixed(0)} KB</span>
                </a>
                <button onClick={() => deleteDocMutation.mutate(d.id)} className="btn-ghost text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--brand-teal2)' }}>
        <span style={{ color: 'var(--brand-gold)' }}>{icon}</span>
        {label}
      </label>
      <div className="text-sm">{children}</div>
    </div>
  );
}
