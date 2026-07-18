import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, dateShort, cls } from "../lib/format";
import {
  ArrowLeft, Building2, Hash, MapPin, Landmark, Wallet,
  ArrowDownLeft, ArrowUpRight, Repeat, TrendingUp, TrendingDown,
  FileSpreadsheet, Calendar, Upload, AlertCircle, CheckCircle2,
  FileText, Trash2, Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { useConfirm } from "../../components/ConfirmDialog";

export default function AccountDetail() {
  const { id } = useParams();
  const aid = +(id || 0);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [tab, setTab] = useState<"movements" | "reconciliation">("movements");

  const { data: account } = useQuery({
    queryKey: ["account-detail", aid],
    queryFn: () => API.getAccountDetail(aid),
    enabled: !!aid,
  });
  const { data: allAccounts } = useQuery({ queryKey: ["accounts"], queryFn: API.getAccounts });
  const { data: movData } = useQuery({
    queryKey: ["movements-by-account", aid],
    queryFn: () => API.listMovements({ involvingAccountId: String(aid), limit: 5000 }),
    enabled: !!aid,
  });
  const { data: reconData } = useQuery({
    queryKey: ["account-reconciliation", aid],
    queryFn: () => API.getAccountReconciliation(aid),
    enabled: !!aid,
  });

  const deleteStatementMut = useMutation({
    mutationFn: (id: number) => API.deleteStatement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-detail", aid] });
      qc.invalidateQueries({ queryKey: ["account-reconciliation", aid] });
      toast.success("Extracto eliminado");
    },
  });

  if (!account) return <div style={{ color: 'var(--brand-teal)' }}>Cargando…</div>;

  const computedBalance = allAccounts?.find((a: any) => a.id === aid)?.computedBalance ?? 0;
  const allMovements: any[] = movData?.movements || [];
  const outgoingMovements = allMovements.filter((m: any) => m.accountId === aid);
  const incomingTransfers = allMovements.filter(
    (m: any) => m.destAccountId === aid && m.accountId !== aid
  );
  // Excluir intercompany de Ingresos/Egresos para no duplicar con las transferencias
  const ingresos = outgoingMovements.filter((m: any) => m.type === "Ingreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
  const egresos = outgoingMovements.filter((m: any) => m.type === "Egreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
  const transferOut = outgoingMovements.filter((m: any) => m.type === "Interbancario").reduce((s, m) => s + m.amount, 0);
  const transferIn = incomingTransfers.reduce((s: number, m: any) => s + m.amount, 0);

  async function handleStatementUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await API.uploadStatementToAccount(aid, f);
      const lineCount = res.statement.lines?.length || 0;
      const matched = res.reconciliation?.matched || 0;
      toast.success(`Extracto procesado: ${lineCount} líneas, ${matched} conciliadas con movimientos existentes`);
      setUploadResult({ ok: true, message: `${lineCount} líneas extraídas, ${matched} ya conciliadas con movimientos manuales` });
      qc.invalidateQueries({ queryKey: ["account-detail", aid] });
      qc.invalidateQueries({ queryKey: ["account-reconciliation", aid] });
      qc.invalidateQueries({ queryKey: ["movements-by-account", aid] });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Error al subir extracto";
      toast.error(msg, { duration: 6000 });
      setUploadResult({ ok: false, message: msg });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-5 page-content">
      <Link to="/finance/accounts" className="btn-ghost text-sm inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Cuentas bancarias
      </Link>

      {/* === HEADER === */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: 'linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-gold) 100%)' }} />
        <div className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'rgba(62,107,133,0.12)', color: 'var(--brand-gold)' }}>
                <Building2 size={28} />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--brand-teal2)' }}>{account.code}</div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>{account.name}</h1>
                <div className="flex items-center gap-2 text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>
                  <Landmark size={14} /> {account.bank}
                  {account.spv?.name && <span>· {account.spv.name}</span>}
                  <span className="badge ml-2" style={{ background: 'rgba(62,107,133,0.12)', color: 'var(--brand-gold)', border: '1px solid rgba(62,107,133,0.3)' }}>{account.type}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--brand-teal2)' }}>Saldo actual</div>
              <div className={cls("text-4xl font-bold font-mono", computedBalance >= 0 ? "text-emerald-600" : "text-red-600")}>
                {usd(computedBalance)}
              </div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--brand-teal2)' }}>
                Inicial: {usd(account.initialBalance || 0, { compact: true })}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-6 pt-6" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--brand-cream2)' }}>
              <Hash size={16} style={{ color: 'var(--brand-gold)' }} />
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}># Cuenta</div>
                <div className="font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>{account.accountNumber || <span className="opacity-50">No registrado</span>}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--brand-cream2)' }}>
              <Hash size={16} style={{ color: 'var(--brand-gold)' }} />
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Routing # (ABA)</div>
                <div className="font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>{account.routingNumber || <span className="opacity-50">No registrado</span>}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--brand-cream2)' }}>
              <MapPin size={16} style={{ color: 'var(--brand-gold)' }} />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Dirección sucursal</div>
                <div className="text-sm font-medium truncate" style={{ color: 'var(--brand-teal)' }} title={account.address}>{account.address || <span className="opacity-50">No registrada</span>}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === KPIs === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card kpi-card-green">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Ingresos</span>
            <TrendingUp size={14} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{usd(ingresos, { compact: true })}</div>
        </div>
        <div className="kpi-card kpi-card-red">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Egresos</span>
            <TrendingDown size={14} className="text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-600">{usd(egresos, { compact: true })}</div>
        </div>
        <div className="kpi-card kpi-card-gold">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Transferencias enviadas</span>
            <Repeat size={14} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(transferOut, { compact: true })}</div>
        </div>
        <div className="kpi-card kpi-card-gold">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Transferencias recibidas</span>
            <Repeat size={14} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--brand-teal)' }}>{usd(transferIn, { compact: true })}</div>
        </div>
      </div>

      {/* === PANEL EXTRACTOS BANCARIOS (integrado) === */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'linear-gradient(135deg, var(--brand-cream2) 0%, #ffffff 100%)' }}>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
              <FileSpreadsheet size={16} style={{ color: 'var(--brand-gold)' }} /> Extractos bancarios de esta cuenta
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
              Sube tu extracto en PDF/Excel/CSV. El sistema lo concilia con los movimientos para detectar omisiones.
            </p>
          </div>
          <label className={cls("btn-primary cursor-pointer text-sm", uploading && "opacity-60 pointer-events-none")}>
            <Upload size={14} />
            {uploading ? "Procesando..." : "Subir extracto"}
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.pdf"
              onChange={handleStatementUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Feedback de la última subida */}
        {uploadResult && (
          <div className={cls(
            "px-5 py-3 flex items-start gap-2",
            uploadResult.ok ? "bg-emerald-50" : "bg-red-50"
          )} style={{ borderBottom: '1px solid rgba(45,75,82,0.08)' }}>
            {uploadResult.ok ? (
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <span className={cls("text-sm", uploadResult.ok ? "text-emerald-700" : "text-red-700")}>
              {uploadResult.message}
            </span>
          </div>
        )}

        {/* Lista de extractos cargados */}
        <div className="px-5 py-4">
          {!account.statements || account.statements.length === 0 ? (
            <div className="text-center py-6">
              <FileText size={32} className="mx-auto mb-2" style={{ color: 'rgba(45,75,82,0.3)' }} />
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--brand-teal)' }}>Aún no has subido extractos para esta cuenta</p>
              <p className="text-xs" style={{ color: 'var(--brand-teal2)' }}>
                Soporta CSV · Excel (.xlsx, .xls) · PDF. Compatible con Ocean Bank, Chase, BoA, Wells Fargo.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-2">
              {account.statements.map((s: any) => (
                <div key={s.id} className="p-3 rounded-lg flex items-center justify-between gap-3" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.08)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet size={16} style={{ color: 'var(--brand-gold)' }} className="flex-shrink-0" />
                    <div className="min-w-0">
                      <Link to={`/finance/statements/${s.id}`} className="text-sm font-semibold truncate hover:underline block" style={{ color: 'var(--brand-teal)' }} title={s.filename}>
                        {s.filename}
                      </Link>
                      <div className="text-[11px]" style={{ color: 'var(--brand-teal2)' }}>
                        {dateShort(s.periodStart)} → {dateShort(s.periodEnd)} · {s._count?.lines || 0} líneas
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Eliminar extracto bancario',
                        message: `¿Seguro que quieres eliminar el extracto "${s.filename}"?`,
                        detail: 'Se eliminarán también todas las líneas del extracto.',
                        destructive: true,
                        confirmText: 'Sí, eliminar',
                      })
                      if (ok) deleteStatementMut.mutate(s.id);
                    }}
                    className="btn-ghost p-1 text-red-600 flex-shrink-0"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* === Resumen de conciliación === */}
        {reconData && reconData.counts.totalLines > 0 && (
          <div className="px-5 pb-5">
            <div className="rounded-xl p-4" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.08)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Info size={15} style={{ color: 'var(--brand-gold)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--brand-teal)' }}>Resumen de conciliación</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 size={16} className="mx-auto mb-1 text-emerald-600" />
                  <div className="text-2xl font-bold font-mono text-emerald-600">{reconData.counts.matched}</div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 mt-1">Conciliados</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle size={16} className="mx-auto mb-1 text-amber-600" />
                  <div className="text-2xl font-bold font-mono text-amber-600">{reconData.counts.bookOnly}</div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 mt-1">Movs sin extracto</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle size={16} className="mx-auto mb-1 text-red-600" />
                  <div className="text-2xl font-bold font-mono text-red-600">{reconData.counts.bankOnly}</div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-red-700 mt-1">Faltan registrar</div>
                </div>
              </div>

              {reconData.counts.bankOnly > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-xs font-bold text-red-700 mb-2">⚠ Movimientos en el extracto que NO has registrado manualmente:</div>
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {reconData.bankOnly.slice(0, 15).map((l: any) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-white">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px]" style={{ color: 'var(--brand-teal2)' }}>{dateShort(l.date)}</span>
                          <span className="truncate" style={{ color: 'var(--brand-teal)' }} title={l.description}>{l.description}</span>
                        </div>
                        <span className={cls("font-mono font-semibold", l.type === "credit" ? "text-emerald-600" : "text-red-600")}>
                          {l.type === "credit" ? "+" : "−"}{usd(l.amount, { compact: true })}
                        </span>
                      </li>
                    ))}
                    {reconData.bankOnly.length > 15 && (
                      <li className="text-[10px] text-center pt-1" style={{ color: 'var(--brand-teal2)' }}>
                        + {reconData.bankOnly.length - 15} más…
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* === TABS: Movimientos / Comparativa === */}
      <div className="card overflow-hidden">
        <div className="flex" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'var(--brand-cream2)' }}>
          <button
            onClick={() => setTab("movements")}
            className="px-5 py-3 text-sm font-bold transition-all"
            style={
              tab === "movements"
                ? { background: '#ffffff', color: 'var(--brand-teal)', borderBottom: '2px solid var(--brand-gold)' }
                : { color: 'var(--brand-teal2)' }
            }
          >
            <Wallet size={14} className="inline mr-1.5" />
            Movimientos de la cuenta
          </button>
          {reconData && reconData.counts.totalLines > 0 && (
            <button
              onClick={() => setTab("reconciliation")}
              className="px-5 py-3 text-sm font-bold transition-all"
              style={
                tab === "reconciliation"
                  ? { background: '#ffffff', color: 'var(--brand-teal)', borderBottom: '2px solid var(--brand-gold)' }
                  : { color: 'var(--brand-teal2)' }
              }
            >
              <FileSpreadsheet size={14} className="inline mr-1.5" />
              Comparativa vs extracto
            </button>
          )}
        </div>

        {tab === "movements" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'rgba(45,75,82,0.04)' }}>
                <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                  <th className="px-4 py-3 text-left font-semibold">Categoría / Proyecto</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {outgoingMovements.length === 0 && incomingTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--brand-teal2)' }}>
                      Sin movimientos registrados en esta cuenta.
                    </td>
                  </tr>
                ) : (
                  [...outgoingMovements, ...incomingTransfers.map((m: any) => ({ ...m, _isIncoming: true }))]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((m: any) => {
                      const isIngreso = m.type === "Ingreso" || m._isIncoming;
                      const isEgreso = m.type === "Egreso";
                      const isTransfer = m.type === "Interbancario" && !m._isIncoming;
                      const Icon = isIngreso ? ArrowDownLeft : isEgreso ? ArrowUpRight : Repeat;
                      const isMatched = m.matchStatus === "matched";

                      return (
                        <tr key={`${m.id}-${m._isIncoming ? 'in' : 'out'}`} className="table-row" style={{ borderBottom: '1px solid rgba(45,75,82,0.06)' }}>
                          <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--brand-teal2)' }}>
                            <div className="flex items-center gap-1">
                              <Calendar size={11} /> {dateShort(m.date)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cls(
                              "badge border",
                              isIngreso && "bg-emerald-50 text-emerald-700 border-emerald-200",
                              isEgreso && "bg-red-50 text-red-700 border-red-200",
                              isTransfer && "border-amber-200",
                            )} style={isTransfer ? { background: 'rgba(62,107,133,0.1)', color: 'var(--brand-gold)' } : {}}>
                              <Icon size={10} className="mr-1" />
                              {m._isIncoming ? "Transf. recibida" : m.type === "Interbancario" ? "Transf. enviada" : m.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[280px] truncate" style={{ color: 'var(--brand-teal)' }}>
                            <Link to={`/finance/movements/${m.id}`} className="hover:underline font-medium" title={m.concept}>
                              {m.concept}
                            </Link>
                            {m._isIncoming && m.account && (
                              <div className="text-[10px] mt-0.5" style={{ color: 'var(--brand-teal2)' }}>← desde {m.account.name}</div>
                            )}
                            {isTransfer && m.destAccount && (
                              <div className="text-[10px] mt-0.5" style={{ color: 'var(--brand-teal2)' }}>→ hacia {m.destAccount.name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--brand-teal2)' }}>
                            <div>{m.category?.name || m.origin?.name || "—"}</div>
                            {m.project && (
                              <div className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--brand-gold)' }}>{m.project.code}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isMatched ? (
                              <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                                <CheckCircle2 size={10} className="mr-0.5" /> Conciliado
                              </span>
                            ) : (
                              <span className="badge bg-stone-50 text-stone-500 border border-stone-200 text-[10px]">Sin conciliar</span>
                            )}
                          </td>
                          <td className={cls(
                            "px-4 py-3 text-right font-mono font-semibold",
                            isIngreso ? "text-emerald-600" : isEgreso ? "text-red-600" : ""
                          )} style={isTransfer ? { color: 'var(--brand-gold)' } : {}}>
                            {isIngreso ? "+" : isEgreso ? "−" : "↔"} {usd(m.amount)}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // === TAB: Comparativa vs extracto ===
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'rgba(45,75,82,0.04)' }}>
                <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Descripción extracto</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {!reconData || reconData.counts.totalLines === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--brand-teal2)' }}>
                      Sube un extracto bancario para ver la comparativa.
                    </td>
                  </tr>
                ) : (
                  // Mostrar todas las líneas del extracto y su estado
                  [...reconData.bankOnly.map((l: any) => ({ ...l, _status: 'unmatched' })),
                   ...reconData.matched.map((m: any) => ({
                     id: `m${m.id}`,
                     date: m.date,
                     description: m.concept,
                     amount: m.amount,
                     type: m.type === "Ingreso" ? "credit" : "debit",
                     _status: 'matched'
                   }))]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((l: any) => (
                      <tr key={l.id} className="table-row" style={{ borderBottom: '1px solid rgba(45,75,82,0.06)' }}>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--brand-teal2)' }}>{dateShort(l.date)}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--brand-teal)' }}>{l.description}</td>
                        <td className="px-4 py-3 text-center">
                          {l._status === 'matched' ? (
                            <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                              <CheckCircle2 size={10} className="mr-0.5" /> Conciliado
                            </span>
                          ) : (
                            <span className="badge bg-red-50 text-red-700 border border-red-200 text-[10px]">
                              <AlertCircle size={10} className="mr-0.5" /> Falta registrar
                            </span>
                          )}
                        </td>
                        <td className={cls(
                          "px-4 py-3 text-right font-mono font-semibold",
                          l.type === "credit" ? "text-emerald-600" : "text-red-600"
                        )}>
                          {l.type === "credit" ? "+" : "−"} {usd(l.amount)}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
