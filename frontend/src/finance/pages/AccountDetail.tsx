import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { API } from "../lib/api";
import { usd, dateShort, cls } from "../lib/format";
import {
  ArrowLeft, Building2, Hash, MapPin, Landmark, Wallet,
  ArrowDownLeft, ArrowUpRight, Repeat, TrendingUp, TrendingDown,
  FileSpreadsheet, Calendar,
} from "lucide-react";

export default function AccountDetail() {
  const { id } = useParams();
  const aid = +(id || 0);
  const { data: account } = useQuery({
    queryKey: ["account-detail", aid],
    queryFn: () => API.getAccountDetail(aid),
    enabled: !!aid,
  });
  const { data: allAccounts } = useQuery({ queryKey: ["accounts"], queryFn: API.getAccounts });
  // Query con involvingAccountId — trae TODOS los movimientos donde esta cuenta es
  // origen O destino. Incluye transferencias recibidas.
  const { data: movData } = useQuery({
    queryKey: ["movements-by-account", aid],
    queryFn: () => API.listMovements({ involvingAccountId: String(aid), limit: 5000 }),
    enabled: !!aid,
  });

  if (!account) return <div style={{ color: 'var(--brand-teal)' }}>Cargando…</div>;

  // Saldo calculado de esta cuenta (de allAccounts)
  const computedBalance = allAccounts?.find((a: any) => a.id === aid)?.computedBalance ?? 0;
  const allMovements: any[] = movData?.movements || [];

  // Separar: movimientos donde esta cuenta es origen vs donde es destino (transferencias entrantes)
  const outgoingMovements = allMovements.filter((m: any) => m.accountId === aid);
  const incomingTransfers = allMovements.filter(
    (m: any) => m.destAccountId === aid && m.accountId !== aid
  );

  // Calcular ingresos/egresos sobre la cuenta
  const ingresos = outgoingMovements.filter((m: any) => m.type === "Ingreso").reduce((s, m) => s + m.amount, 0);
  const egresos = outgoingMovements.filter((m: any) => m.type === "Egreso").reduce((s, m) => s + m.amount, 0);
  const transferOut = outgoingMovements.filter((m: any) => m.type === "Interbancario").reduce((s, m) => s + m.amount, 0);
  const transferIn = incomingTransfers.reduce((s: number, m: any) => s + m.amount, 0);

  return (
    <div className="space-y-5 page-content">
      <Link to="/finance/accounts" className="btn-ghost text-sm inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Cuentas bancarias
      </Link>

      {/* Header con info principal */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: 'linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-gold) 100%)' }} />
        <div className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(200,146,42,0.12)', color: 'var(--brand-gold)' }}
              >
                <Building2 size={28} />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--brand-teal2)' }}>{account.code}</div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>{account.name}</h1>
                <div className="flex items-center gap-2 text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>
                  <Landmark size={14} /> {account.bank}
                  {account.spv?.name && <span>· {account.spv.name}</span>}
                  <span className="badge ml-2" style={{ background: 'rgba(200,146,42,0.12)', color: 'var(--brand-gold)', border: '1px solid rgba(200,146,42,0.3)' }}>{account.type}</span>
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

          {/* Detalles bancarios */}
          <div className="grid md:grid-cols-3 gap-3 mt-6 pt-6" style={{ borderTop: '1px solid rgba(45,75,82,0.1)' }}>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--brand-cream2)' }}>
              <Hash size={16} style={{ color: 'var(--brand-gold)' }} />
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}># Cuenta</div>
                <div className="font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>
                  {account.accountNumber || <span className="opacity-50">No registrado</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--brand-cream2)' }}>
              <Hash size={16} style={{ color: 'var(--brand-gold)' }} />
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Routing # (ABA)</div>
                <div className="font-mono font-semibold" style={{ color: 'var(--brand-teal)' }}>
                  {account.routingNumber || <span className="opacity-50">No registrado</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--brand-cream2)' }}>
              <MapPin size={16} style={{ color: 'var(--brand-gold)' }} />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>Dirección sucursal</div>
                <div className="text-sm font-medium truncate" style={{ color: 'var(--brand-teal)' }} title={account.address}>
                  {account.address || <span className="opacity-50">No registrada</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs de movimientos */}
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

      {/* Todos los movimientos (incluye transferencias recibidas) */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'linear-gradient(135deg, var(--brand-cream2) 0%, #ffffff 100%)' }}>
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
            <Wallet size={16} style={{ color: 'var(--brand-gold)' }} /> Movimientos de la cuenta
          </h2>
          <span className="text-xs font-semibold" style={{ color: 'var(--brand-teal2)' }}>
            {outgoingMovements.length + incomingTransfers.length} movimientos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--brand-cream2)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--brand-teal2)' }}>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                <th className="px-4 py-3 text-left font-semibold">Categoría / Proyecto</th>
                <th className="px-4 py-3 text-right font-semibold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {outgoingMovements.length === 0 && incomingTransfers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--brand-teal2)' }}>
                    Sin movimientos registrados en esta cuenta.
                  </td>
                </tr>
              ) : (
                // Combinar y ordenar todos los movimientos
                [...outgoingMovements, ...incomingTransfers.map((m: any) => ({ ...m, _isIncoming: true }))]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((m: any) => {
                    const isIngreso = m.type === "Ingreso" || m._isIncoming;
                    const isEgreso = m.type === "Egreso";
                    const isTransfer = m.type === "Interbancario" && !m._isIncoming;
                    const Icon = isIngreso ? ArrowDownLeft : isEgreso ? ArrowUpRight : Repeat;

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
                          )} style={isTransfer ? { background: 'rgba(200,146,42,0.1)', color: 'var(--brand-gold)' } : {}}>
                            <Icon size={10} className="mr-1" />
                            {m._isIncoming ? "Transf. recibida" : m.type === "Interbancario" ? "Transf. enviada" : m.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[280px] truncate" style={{ color: 'var(--brand-teal)' }}>
                          <Link to={`/finance/movements/${m.id}`} className="hover:underline font-medium" title={m.concept}>
                            {m.concept}
                          </Link>
                          {m._isIncoming && m.account && (
                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                              ← desde {m.account.name}
                            </div>
                          )}
                          {isTransfer && m.destAccount && (
                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                              → hacia {m.destAccount.name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--brand-teal2)' }}>
                          <div>{m.category?.name || m.origin?.name || "—"}</div>
                          {m.project && (
                            <div className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--brand-gold)' }}>{m.project.code}</div>
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
      </div>

      {/* Extractos bancarios subidos */}
      {account.statements && account.statements.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'var(--brand-cream2)' }}>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>
              <FileSpreadsheet size={16} style={{ color: 'var(--brand-gold)' }} /> Extractos subidos
            </h2>
          </div>
          <div className="p-5 space-y-2">
            {account.statements.map((s: any) => (
              <Link key={s.id} to={`/finance/statements/${s.id}`} className="flex items-center justify-between p-3 rounded-lg hover:shadow-sm transition-shadow" style={{ background: 'var(--brand-cream2)' }}>
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={16} style={{ color: 'var(--brand-gold)' }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--brand-teal)' }}>{s.filename}</div>
                    <div className="text-xs" style={{ color: 'var(--brand-teal2)' }}>
                      {dateShort(s.periodStart)} → {dateShort(s.periodEnd)}
                    </div>
                  </div>
                </div>
                <ArrowLeft size={14} style={{ color: 'var(--brand-teal2)', transform: 'rotate(180deg)' }} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
