import { ArrowLeftRight } from 'lucide-react'
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { API } from "../lib/api";
import { usd, dateShort, cls } from "../lib/format";
import { Modal } from "../components/Modal";
import {
  Plus, Search, Sparkles, ChevronRight, Trash2, FileCheck,
  AlertCircle, ArrowDownLeft, ArrowUpRight, Repeat, CheckCircle2, X,
  Calendar, Building2, Tag, Users, Briefcase, Banknote, TrendingUp,
  SlidersHorizontal,
} from "lucide-react";
import { useConfirm } from "../../components/ConfirmDialog";
import toast from "react-hot-toast";

const TYPE_BADGE: Record<string, { color: string; icon: any; label: string }> = {
  Ingreso:       { color: "text-positive bg-positive/10 border-positive/30",     icon: ArrowDownLeft, label: "Ingreso" },
  Egreso:        { color: "text-negative bg-negative/10 border-negative/30",     icon: ArrowUpRight,  label: "Egreso" },
  Interbancario: { color: "text-accent bg-accent/10 border-accent/30",            icon: Repeat,        label: "Transferencia" },
};

// Visualización del matchStatus contra extractos:
//   matched      → verde (✓)
//   manual_only  → amarillo (movimiento manual sin línea de extracto)
//   pending      → gris (aún no se cargó extracto del período)
const MATCH_BADGE: Record<string, { color: string; label: string; icon: any }> = {
  matched:      { color: "text-positive bg-positive/15 border-positive/40", label: "Coincide",    icon: CheckCircle2 },
  manual_only:  { color: "text-warn bg-warn/15 border-warn/40",             label: "Sin extracto", icon: AlertCircle },
  pending:      { color: "text-slate-400 bg-slate-700/20 border-slate-600",  label: "Pendiente",   icon: AlertCircle },
};

export default function Movements() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const { data, isLoading } = useQuery({
    queryKey: ["movements", filters, q],
    queryFn: () => {
      const params: Record<string, any> = { ...filters, q: q || undefined, limit: 1000 };
      // Use involvingAccountId so transfers received (destAccountId) also appear
      if (params.accountId) {
        params.involvingAccountId = params.accountId;
        delete params.accountId;
      }
      return API.listMovements(params);
    },
  });

  // Líneas de extracto sin contraparte manual → alertas ROJAS
  const { data: unreconciledLines = [] } = useQuery<any[]>({
    queryKey: ["unreconciledLines", filters.accountId || ""],
    queryFn: () => API.getUnreconciledLines(filters.accountId ? +filters.accountId : undefined),
  });

  const movements: any[] = data?.movements || [];
  // When filtering by a specific account, we know the perspective
  const selectedAccountId = filters.accountId ? +filters.accountId : null;

  const totals = useMemo(() => {
    const ing = movements.filter((m) => m.type === "Ingreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
    const egr = movements.filter((m) => m.type === "Egreso" && !m.isIntercompany).reduce((s, m) => s + m.amount, 0);
    // When a specific account is selected, include transfers in the flow totals
    const incomingXfer = selectedAccountId
      ? movements.filter((m) => m.type === "Interbancario" && m.destAccountId === selectedAccountId).reduce((s, m) => s + m.amount, 0)
      : 0;
    const outgoingXfer = selectedAccountId
      ? movements.filter((m) => m.type === "Interbancario" && m.accountId === selectedAccountId).reduce((s, m) => s + m.amount, 0)
      : 0;
    return { ing: ing + incomingXfer, egr: egr + outgoingXfer, neto: ing + incomingXfer - egr - outgoingXfer };
  }, [movements, selectedAccountId]);

  const matchCounts = useMemo(() => ({
    matched: movements.filter((m) => m.matchStatus === "matched").length,
    manual_only: movements.filter((m) => m.matchStatus === "manual_only").length,
    extract_only: unreconciledLines.length,
  }), [movements, unreconciledLines]);

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
      qc.invalidateQueries({ queryKey: ["movements-by-account"] });
      qc.invalidateQueries({ queryKey: ["capital"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-detail"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // Registrar un movimiento directamente desde una línea de extracto no conciliada.
  // Cierra la omisión con un clic: crea el FinMovement con los datos de la línea
  // y lo marca conciliado, sin salir de Movimientos.
  const registerFromLine = useMutation({
    mutationFn: (lineId: number) => API.createMovementFromLine(lineId),
    onSuccess: () => {
      toast.success("Movimiento registrado desde el extracto");
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["unreconciledLines"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-detail"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.message || "Error al registrar"),
  });

  const clearFilters = () => { setFilters({}); setQ(""); };
  const hasActiveFilters = Object.values(filters).some(Boolean) || q;

  return (
    <div className="space-y-4 page-content">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><ArrowLeftRight className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>Movimientos</span></h1>
          <p className="text-sm" style={{ color: 'var(--brand-teal2)' }}>
            {data?.total || 0} registros · <span className="text-emerald-600 font-semibold">{usd(totals.ing, { compact: true })}</span> ingresos · <span className="text-red-600 font-semibold">{usd(totals.egr, { compact: true })}</span> egresos · Neto <span className={cls("font-semibold", totals.neto >= 0 ? "text-emerald-600" : "text-red-600")}>{usd(totals.neto, { compact: true })}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending} title="Vincula automáticamente transferencias entre cuentas propias para evitar contarlas como ingresos o egresos en el dashboard">
            <Sparkles size={14} /> {detectMutation.isPending ? "Vinculando…" : "Vincular transferencias internas"}
          </button>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> Nuevo movimiento
          </button>
        </div>
      </div>

      {/* Banda de matching status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-positive/15 text-positive flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Coinciden con extracto</div>
            <div className="text-lg font-semibold text-positive">{matchCounts.matched}</div>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-warn/15 text-warn flex items-center justify-center">
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Manual sin extracto</div>
            <div className="text-lg font-semibold text-warn">{matchCounts.manual_only}</div>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-negative/15 text-negative flex items-center justify-center">
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">En extracto, falta registrar</div>
            <div className="text-lg font-semibold text-negative">{matchCounts.extract_only}</div>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-700/30 text-slate-400 flex items-center justify-center">
            <Repeat size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Total movimientos</div>
            <div className="text-lg font-semibold">{movements.length}</div>
          </div>
        </div>
      </div>

      {/* === FILTROS REDISEÑADOS === */}
      <div className="card overflow-hidden">
        {/* Fila principal: búsqueda destacada + toggle de filtros avanzados */}
        <div className="p-4" style={{ background: 'linear-gradient(135deg, var(--brand-cream2) 0%, #ffffff 100%)' }}>
          <div className="flex flex-wrap items-center gap-3">
            {/* Búsqueda principal — destacada */}
            <div className="flex-1 min-w-[240px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--brand-gold)' }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por concepto, notas, monto…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all"
                style={{
                  background: '#ffffff',
                  border: '1.5px solid rgba(29,29,31,0.15)',
                  color: 'var(--brand-teal)',
                  outline: 'none',
                  boxShadow: '0 1px 3px rgba(29,29,31,0.05)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(29,29,31,0.15)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(29,29,31,0.05)'; }}
              />
            </div>

            {/* Chips de filtros rápidos: Tipo */}
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#ffffff', border: '1px solid rgba(29,29,31,0.1)' }}>
              {[
                { val: "", label: "Todos", icon: null },
                { val: "Ingreso", label: "Ingreso", icon: ArrowDownLeft, color: '#059669' },
                { val: "Egreso", label: "Egreso", icon: ArrowUpRight, color: '#dc2626' },
                { val: "Interbancario", label: "Transfer.", icon: Repeat, color: 'var(--brand-gold)' },
              ].map((t) => {
                const active = (filters.type || "") === t.val;
                const Icon = t.icon;
                return (
                  <button
                    key={t.val}
                    onClick={() => setFilters({ ...filters, type: t.val })}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 whitespace-nowrap"
                    style={
                      active
                        ? { background: t.color || 'var(--brand-teal)', color: 'white', boxShadow: '0 2px 8px rgba(29,29,31,0.15)' }
                        : { background: 'transparent', color: 'var(--brand-teal2)' }
                    }
                  >
                    {Icon && <Icon size={11} />}
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Botón toggle de filtros avanzados */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={
                filtersOpen
                  ? { background: 'var(--brand-teal)', color: 'white' }
                  : { background: '#ffffff', color: 'var(--brand-teal)', border: '1.5px solid rgba(29,29,31,0.15)' }
              }
            >
              <SlidersHorizontal size={14} />
              Filtros avanzados
              {Object.keys(filters).filter(k => filters[k] && k !== 'type').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{
                  background: filtersOpen ? 'rgba(255,255,255,0.25)' : 'var(--brand-gold)',
                  color: filtersOpen ? '#ffffff' : '#ffffff',
                }}>
                  {Object.keys(filters).filter(k => filters[k] && k !== 'type').length}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Filtros avanzados — colapsables */}
        {filtersOpen && (
          <div className="p-4 grid md:grid-cols-2 lg:grid-cols-4 gap-3" style={{ borderTop: '1px solid rgba(29,29,31,0.08)', background: '#ffffff' }}>
            <FilterField icon={<Calendar size={13} />} label="Desde">
              <input
                type="date"
                className="input w-full text-sm"
                value={filters.from || ""}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </FilterField>
            <FilterField icon={<Calendar size={13} />} label="Hasta">
              <input
                type="date"
                className="input w-full text-sm"
                value={filters.to || ""}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </FilterField>
            <FilterField icon={<Building2 size={13} />} label="Cuenta bancaria">
              <select className="select w-full text-sm" value={filters.accountId || ""} onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}>
                <option value="">Todas las cuentas</option>
                {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Briefcase size={13} />} label="Proyecto">
              <select className="select w-full text-sm" value={filters.projectId || ""} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}>
                <option value="">Todos los proyectos</option>
                {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Tag size={13} />} label="Categoría">
              <select className="select w-full text-sm" value={filters.categoryId || ""} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}>
                <option value="">Todas las categorías</option>
                {catalogs?.categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Briefcase size={13} />} label="Proveedor">
              <select className="select w-full text-sm" value={filters.providerId || ""} onChange={(e) => setFilters({ ...filters, providerId: e.target.value })}>
                <option value="">Todos los proveedores</option>
                {catalogs?.providers?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Users size={13} />} label="Socio">
              <select className="select w-full text-sm" value={filters.partnerId || ""} onChange={(e) => setFilters({ ...filters, partnerId: e.target.value })}>
                <option value="">Todos los socios</option>
                {catalogs?.partners?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<TrendingUp size={13} />} label="Origen ingreso">
              <select className="select w-full text-sm" value={filters.originId || ""} onChange={(e) => setFilters({ ...filters, originId: e.target.value })}>
                <option value="">Todos los orígenes</option>
                {catalogs?.origins?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Banknote size={13} />} label="Lender (Prestamista)">
              <select className="select w-full text-sm" value={filters.lenderId || ""} onChange={(e) => setFilters({ ...filters, lenderId: e.target.value })}>
                <option value="">Todos los lenders</option>
                {catalogs?.lenders?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FilterField>
          </div>
        )}
      </div>

      {/* Alertas rojas: líneas de extracto sin registrar */}
      {unreconciledLines.length > 0 && (
        <div className="card p-3 bg-negative/5 border-negative/30">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-negative">
              <AlertCircle size={16} />
              <span className="text-sm font-semibold">
                {unreconciledLines.length} {unreconciledLines.length === 1 ? "línea" : "líneas"} de extracto sin registrar manualmente
              </span>
            </div>
            <Link to="/finance/accounts" className="text-xs hover:underline font-semibold" style={{ color: 'var(--brand-gold)' }}>Ir a Cuentas →</Link>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {unreconciledLines.slice(0, 6).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-xs bg-bg-card rounded px-2 py-1.5 border border-line">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-slate-500">{dateShort(l.date)}</span>
                  <span className="truncate" title={l.description}>{l.description}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cls("font-mono", l.type === "credit" ? "text-positive" : "text-negative")}>{l.type === "credit" ? "+" : "-"}{usd(l.amount)}</span>
                  <button
                    onClick={() => registerFromLine.mutate(l.id)}
                    disabled={registerFromLine.isPending}
                    title="Registrar este movimiento del banco que no estaba inscrito"
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-negative/15 text-negative hover:bg-negative/25 disabled:opacity-40 whitespace-nowrap"
                  >
                    + Registrar
                  </button>
                </div>
              </div>
            ))}
          </div>
          {unreconciledLines.length > 6 && (
            <div className="text-xs text-slate-500 mt-1">+ {unreconciledLines.length - 6} más…</div>
          )}
        </div>
      )}

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
              <th className="px-3 py-2 text-center">Comparación</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-4 text-center text-slate-500">Cargando…</td></tr>}
            {!isLoading && movements.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-slate-500">Sin movimientos. Importa el Excel desde Importar / Backup o crea uno nuevo.</td></tr>
            )}
            {movements.map((m) => {
              const tb = TYPE_BADGE[m.type] || { color: "text-slate-300 bg-bg-hover border-line", icon: ArrowDownLeft, label: m.type };
              const Icon = tb.icon;
              const mb = MATCH_BADGE[m.matchStatus || "pending"] || MATCH_BADGE.pending;
              const MIcon = mb.icon;
              return (
                <tr key={m.id} className={cls("border-b border-line/50 table-row",
                  m.matchStatus === "matched" && "bg-positive/[0.03]",
                  m.matchStatus === "manual_only" && "bg-warn/[0.03]",
                )}>
                  <td className="px-3 py-2 text-xs font-mono text-slate-300 whitespace-nowrap">{dateShort(m.date)}</td>
                  <td className="px-3 py-2">
                    <span className={cls("badge border", tb.color)}>
                      <Icon size={10} className="mr-1" /> {tb.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {m.type === "Interbancario" && m.destAccount ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-slate-400">{m.account?.name?.replace("OB ", "") || "—"}</span>
                        <span style={{ color: 'var(--brand-gold)' }}>→</span>
                        <span style={{ color: 'var(--brand-teal)' }} className="font-medium">{m.destAccount.name.replace("OB ", "")}</span>
                      </span>
                    ) : (
                      m.account?.name?.replace("OB ", "") || "—"
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[260px] truncate" title={m.concept}>
                    <div className="flex items-center gap-1">
                      {m.concept}
                      {m.hasSupport && <FileCheck size={12} className="text-positive flex-shrink-0" />}
                      {m.isIntercompany && <Repeat size={12} className="text-accent flex-shrink-0" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {m.category?.name || m.origin?.name || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {m.project && <span className="badge bg-bg-hover text-slate-300 mr-1">{m.project.code}</span>}
                    {m.partner && <span className="badge bg-accent/10 text-accent">{m.partner.code}</span>}
                  </td>
                  <td className={cls("px-3 py-2 text-right font-mono",
                    m.type === "Ingreso" ? "text-positive"
                    : m.type === "Egreso" ? "text-negative"
                    : m.type === "Interbancario" && selectedAccountId && m.destAccountId === selectedAccountId ? "text-positive"
                    : m.type === "Interbancario" && selectedAccountId && m.accountId === selectedAccountId ? "text-negative"
                    : "text-accent"
                  )}>
                    {m.type === "Interbancario" && selectedAccountId
                      ? (m.destAccountId === selectedAccountId ? "+" : "−") + usd(m.amount).replace(/^-/, "")
                      : usd(m.amount)
                    }
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cls("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border", mb.color)}>
                      <MIcon size={10} /> {mb.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Link to={`/finance/movements/${m.id}`} className="btn-ghost p-1" title="Ver detalle / editar"><ChevronRight size={14} /></Link>
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Eliminar movimiento',
                            message: `¿Seguro que quieres eliminar el movimiento "${m.concept}"?`,
                            detail: `Monto: ${usd(m.amount ?? 0)} · ${m.type} · ${m.account?.name || 'sin cuenta'}`,
                            confirmText: 'Sí, eliminar',
                            destructive: true,
                          })
                          if (ok) deleteMutation.mutate(m.id)
                        }}
                        className="btn-ghost p-1 text-negative"
                      ><Trash2 size={14} /></button>
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

// =============================================================================
// MODAL — Cascada por TIPO de movimiento.
// =============================================================================
function MovementModal({ open, onClose, catalogs }: { open: boolean; onClose: () => void; catalogs: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    date: new Date().toISOString().slice(0, 10),
    type: "Egreso",
    amount: "",
    concept: "",
    accountId: "",
    destAccountId: "",
    categoryId: "",
    originId: "",
    providerId: "",
    partnerId: "",
    lenderId: "",
    projectId: "",
    notes: "",
  });

  const update = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: (data: any) => API.createMovement(data),
    onSuccess: () => {
      toast.success("Movimiento creado");
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["movements-by-account"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["capital"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-detail"] });
      onClose();
      // Reset
      setForm({
        date: new Date().toISOString().slice(0, 10),
        type: "Egreso", amount: "", concept: "",
        accountId: "", destAccountId: "", categoryId: "", originId: "",
        providerId: "", partnerId: "", lenderId: "", projectId: "", notes: "",
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al crear"),
  });

  // Determinar si el origen seleccionado es "Equity socio" / "Aporte socios"
  // Estrategia robusta: matchear por código (31xx = equity, 32xx = deuda) Y por nombre.
  const selectedOrigin = catalogs?.origins?.find((o: any) => String(o.id) === String(form.originId));
  const isEquityOrigin = !!(selectedOrigin && (
    /^31\d+/.test(selectedOrigin.code || "") ||
    /equity|aporte|capital(?:izaci[oó]n)?|invers[ií]on\s*socio/i.test(selectedOrigin.name || "")
  ));
  const isLoanOrigin = !!(selectedOrigin && (
    /^320[12]/.test(selectedOrigin.code || "") ||  // 3201 (Préstamo Socio), 3202 (Préstamo Bancario)
    /pr[ée]stamo|loan|deuda/i.test(selectedOrigin.name || "")
  ));

  // Determinar si la categoría seleccionada es "Pago de deuda"
  const selectedCategory = catalogs?.categories?.find((c: any) => String(c.id) === String(form.categoryId));
  const isDebtPayment = !!(selectedCategory && /pago.*(deuda|pr[ée]stamo)|debt.*pay|amortizaci[oó]n/i.test(selectedCategory.name || ""));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validación cascada
    if (!form.accountId) return toast.error("Selecciona la cuenta");
    if (!form.amount || +form.amount <= 0) return toast.error("Ingresa un monto válido");
    if (!form.concept.trim()) return toast.error("Concepto es obligatorio");
    if (form.type === "Ingreso" && !form.originId) return toast.error("Selecciona el origen del ingreso");
    if (form.type === "Ingreso" && isEquityOrigin && !form.partnerId) return toast.error("Para aportes de socio, selecciona QUÉ socio está aportando");
    if (form.type === "Ingreso" && isLoanOrigin && !form.lenderId) return toast.error("Para un préstamo, selecciona QUIÉN te está prestando (lender)");
    if (form.type === "Egreso" && !form.categoryId) return toast.error("Selecciona la categoría del egreso");
    // Nota: un egreso PUEDE no estar asociado a proyecto (ej. fee bancario, gasto corporativo).
    // Solo validamos lender cuando la categoría es pago de deuda.
    if (form.type === "Egreso" && isDebtPayment && !form.lenderId) return toast.error("Para pago de deuda, selecciona el lender");
    if (form.type === "Interbancario" && !form.destAccountId) return toast.error("Selecciona la cuenta destino");
    if (form.type === "Interbancario" && form.accountId === form.destAccountId) return toast.error("Origen y destino deben ser distintos");

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
    mutation.mutate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo movimiento" size="lg">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        {/* Tipo (cascada) — sección destacada */}
        <div className="md:col-span-2 p-3 bg-bg-soft rounded-lg border border-line">
          <label className="label">Tipo de movimiento</label>
          <div className="grid grid-cols-3 gap-2">
            {(["Ingreso", "Egreso", "Interbancario"] as const).map((t) => {
              const tb = TYPE_BADGE[t];
              const Icon = tb.icon;
              const active = form.type === t;
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => update({
                    type: t,
                    // Reset campos no aplicables al nuevo tipo
                    originId: t === "Ingreso" ? form.originId : "",
                    categoryId: t === "Egreso" ? form.categoryId : "",
                    providerId: t === "Egreso" ? form.providerId : "",
                    destAccountId: t === "Interbancario" ? form.destAccountId : "",
                    partnerId: t === "Ingreso" ? form.partnerId : "",
                    lenderId: (t === "Ingreso" || t === "Egreso") ? form.lenderId : "",
                  })}
                  className={cls(
                    "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    active
                      ? cls("ring-2 ring-offset-1 ring-offset-bg-soft", tb.color, "ring-current")
                      : "border-line text-slate-400 hover:bg-bg-hover"
                  )}
                >
                  <Icon size={14} />
                  {t === "Interbancario" ? "Transferencia" : t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Campos básicos siempre visibles */}
        <div>
          <label className="label">Fecha *</label>
          <input type="date" className="input w-full" value={form.date} onChange={(e) => update({ date: e.target.value })} required />
        </div>
        <div>
          <label className="label">Monto USD *</label>
          <input type="number" step="0.01" min="0.01" className="input w-full" value={form.amount} onChange={(e) => update({ amount: e.target.value })} required />
        </div>
        <div>
          <label className="label">
            {form.type === "Interbancario" ? "Cuenta origen *" : "Cuenta *"}
          </label>
          <select className="select w-full" value={form.accountId} onChange={(e) => update({ accountId: e.target.value })} required>
            <option value="">— seleccionar —</option>
            {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name} · {a.bank}</option>)}
          </select>
        </div>
        {form.type === "Interbancario" && (
          <div>
            <label className="label">Cuenta destino *</label>
            <select className="select w-full" value={form.destAccountId} onChange={(e) => update({ destAccountId: e.target.value })} required>
              <option value="">— seleccionar —</option>
              {catalogs?.accounts?.filter((a: any) => String(a.id) !== form.accountId).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} · {a.bank}</option>
              ))}
            </select>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="label">Concepto *</label>
          <input className="input w-full" value={form.concept} onChange={(e) => update({ concept: e.target.value })} required placeholder="Descripción del movimiento" />
        </div>

        {/* Cascada: Egreso → Categoría + Proveedor + Proyecto */}
        {form.type === "Egreso" && (
          <>
            <div>
              <label className="label">Categoría *</label>
              <select className="select w-full" value={form.categoryId} onChange={(e) => update({ categoryId: e.target.value })} required>
                <option value="">— seleccionar categoría —</option>
                {catalogs?.categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Proveedor / Tercero</label>
              <select className="select w-full" value={form.providerId} onChange={(e) => update({ providerId: e.target.value })}>
                <option value="">— ninguno —</option>
                {catalogs?.providers?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Proyecto asociado <span className="text-[11px] font-normal" style={{ color: 'var(--brand-teal2)' }}>(opcional — usar "No asociado" para gastos corporativos como fees bancarios)</span></label>
              <select className="select w-full" value={form.projectId} onChange={(e) => update({ projectId: e.target.value })}>
                <option value="">— No asociado a proyecto (gasto corporativo / fee bancario) —</option>
                {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
              {!form.projectId && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--brand-gold)' }}>
                  Este egreso se registrará como gasto corporativo (sin proyecto asociado).
                </p>
              )}
            </div>
            {isDebtPayment && (
              <div className="md:col-span-2">
                <label className="label">Lender (acreedor de la deuda) *</label>
                <select className="select w-full" value={form.lenderId} onChange={(e) => update({ lenderId: e.target.value })} required>
                  <option value="">— seleccionar lender —</option>
                  {catalogs?.lenders?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Este pago se reflejará en Deuda & Préstamos.</p>
              </div>
            )}
          </>
        )}

        {/* Cascada: Ingreso → Origen + (Socio si Equity | Lender si Préstamo) */}
        {form.type === "Ingreso" && (
          <>
            <div className="md:col-span-2">
              <label className="label">Origen del capital *</label>
              <select className="select w-full" value={form.originId} onChange={(e) => update({ originId: e.target.value, partnerId: "", lenderId: "" })} required>
                <option value="">— seleccionar origen —</option>
                {catalogs?.origins?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            {isEquityOrigin && (
              <div>
                <label className="label">Socio que aporta *</label>
                <select className="select w-full" value={form.partnerId} onChange={(e) => update({ partnerId: e.target.value })} required>
                  <option value="">— seleccionar socio —</option>
                  {catalogs?.partners?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Se registrará automáticamente en Capital Aportado.</p>
              </div>
            )}
            {isLoanOrigin && (
              <div>
                <label className="label">Lender (prestamista) *</label>
                <select className="select w-full" value={form.lenderId} onChange={(e) => update({ lenderId: e.target.value })} required>
                  <option value="">— seleccionar lender —</option>
                  {catalogs?.lenders?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Proyecto asociado <span className="text-slate-500 text-[11px]">(opcional)</span></label>
              <select className="select w-full" value={form.projectId} onChange={(e) => update({ projectId: e.target.value })}>
                <option value="">— corporativo —</option>
                {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="md:col-span-2">
          <label className="label">Notas</label>
          <textarea className="input w-full" rows={2} value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
        </div>

        <div className="md:col-span-2 flex justify-end gap-2 mt-2 pt-3 border-t border-line">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Crear movimiento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Campo de filtro con label icono — usado en panel de filtros avanzados
function FilterField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--brand-teal2)' }}>
        <span style={{ color: 'var(--brand-gold)' }}>{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}
