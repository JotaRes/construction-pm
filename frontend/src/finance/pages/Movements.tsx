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
  SlidersHorizontal, HardHat,
} from "lucide-react";
import { useConfirm } from "../../components/ConfirmDialog";
import toast from "react-hot-toast";
import { TechAssociate, TechSel, EMPTY_TECH_SEL, techSelReady, resolveTechLink } from "../components/TechAssociate";
import { useI18n, type TranslationKey } from '../../i18n'

const TYPE_BADGE: Record<string, { color: string; icon: any; labelKey: TranslationKey }> = {
  Ingreso:       { color: "text-positive bg-positive/10 border-positive/30",     icon: ArrowDownLeft, labelKey: 'common.ingreso' },
  Egreso:        { color: "text-negative bg-negative/10 border-negative/30",     icon: ArrowUpRight,  labelKey: 'common.egreso' },
  Interbancario: { color: "text-accent bg-accent/10 border-accent/30",            icon: Repeat,        labelKey: 'fin.movs.transferencia' },
};

// Visualización del matchStatus contra extractos:
//   matched      → verde (✓)
//   manual_only  → amarillo (movimiento manual sin línea de extracto)
//   pending      → gris (aún no se cargó extracto del período)
const MATCH_BADGE: Record<string, { color: string; labelKey: TranslationKey; icon: any }> = {
  matched:      { color: "text-positive bg-positive/15 border-positive/40", labelKey: 'fin.movs.coincide',    icon: CheckCircle2 },
  manual_only:  { color: "text-warn bg-warn/15 border-warn/40",             labelKey: 'fin.movs.sinExtracto', icon: AlertCircle },
  pending:      { color: "text-slate-400 bg-slate-700/20 border-slate-600",  labelKey: 'common.pendiente',   icon: AlertCircle },
};

export default function Movements() {
  const { t } = useI18n()
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Asociación rápida a obra desde la fila (movimientos ya registrados/conciliados)
  const [quickAssign, setQuickAssign] = useState<any | null>(null);

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
      toast.success(t('fin.movs.v0ParesIntercompanyVinculados', { v0: r.linked }));
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => API.deleteMovement(id),
    onSuccess: () => {
      toast.success(t('fin.movs.movimientoEliminado'));
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
      toast.success(t('fin.movs.movimientoRegistradoDesdeElExtracto'));
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["unreconciledLines"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-detail"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.message || t('fin.capital.errorAlRegistrar')),
  });

  const clearFilters = () => { setFilters({}); setQ(""); };
  const hasActiveFilters = Object.values(filters).some(Boolean) || q;

  return (
    <div className="space-y-4 page-content">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><ArrowLeftRight className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('common.movimientos')}</span></h1>
          <p className="text-sm" style={{ color: 'var(--brand-teal2)' }}>
            {data?.total || 0} {t('fin.movs.registros')} <span className="text-emerald-600 font-semibold">{usd(totals.ing, { compact: true })}</span> {t('fin.movs.ingresos')} <span className="text-red-600 font-semibold">{usd(totals.egr, { compact: true })}</span> {t('fin.movs.egresosNeto')} <span className={cls("font-semibold", totals.neto >= 0 ? "text-emerald-600" : "text-red-600")}>{usd(totals.neto, { compact: true })}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending} title={t('fin.movs.vinculaAutomaticamenteTransferenciasEntreC')}>
            <Sparkles size={14} /> {detectMutation.isPending ? t('fin.movs.vinculando') : t('fin.movs.vincularTransferenciasInternas')}
          </button>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> {t('fin.movs.nuevoMovimiento')}
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
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{t('fin.movs.coincidenConExtracto')}</div>
            <div className="text-lg font-semibold text-positive">{matchCounts.matched}</div>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-warn/15 text-warn flex items-center justify-center">
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{t('fin.movs.manualSinExtracto')}</div>
            <div className="text-lg font-semibold text-warn">{matchCounts.manual_only}</div>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-negative/15 text-negative flex items-center justify-center">
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{t('fin.movs.enExtractoFaltaRegistrar')}</div>
            <div className="text-lg font-semibold text-negative">{matchCounts.extract_only}</div>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-700/30 text-slate-400 flex items-center justify-center">
            <Repeat size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{t('fin.movs.totalMovimientos')}</div>
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
                placeholder={t('fin.movs.buscarPorConceptoNotasMonto')}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all"
                style={{
                  background: '#ffffff',
                  border: '1.5px solid rgba(29,29,31,0.15)',
                  color: 'var(--brand-teal)',
                  outline: 'none',
                  boxShadow: '0 1px 3px rgba(29,29,31,0.05)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(62,90,112,0.15)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(29,29,31,0.15)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(29,29,31,0.05)'; }}
              />
            </div>

            {/* Chips de filtros rápidos: Tipo */}
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#ffffff', border: '1px solid rgba(29,29,31,0.1)' }}>
              {[
                { val: "", label: t('fin.movs.todos'), icon: null },
                { val: "Ingreso", label: t('common.ingreso'), icon: ArrowDownLeft, color: '#059669' },
                { val: "Egreso", label: t('common.egreso'), icon: ArrowUpRight, color: '#dc2626' },
                { val: "Interbancario", label: t('fin.movs.transfer'), icon: Repeat, color: 'var(--brand-gold)' },
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
              {t('fin.movs.filtrosAvanzados')}
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
                <X size={12} /> {t('fin.movs.limpiar')}
              </button>
            )}
          </div>
        </div>

        {/* Filtros avanzados — colapsables */}
        {filtersOpen && (
          <div className="p-4 grid md:grid-cols-2 lg:grid-cols-4 gap-3" style={{ borderTop: '1px solid rgba(29,29,31,0.08)', background: '#ffffff' }}>
            <FilterField icon={<Calendar size={13} />} label={t('fin.movs.desde')}>
              <input
                type="date"
                className="input w-full text-sm"
                value={filters.from || ""}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </FilterField>
            <FilterField icon={<Calendar size={13} />} label={t('fin.movs.hasta')}>
              <input
                type="date"
                className="input w-full text-sm"
                value={filters.to || ""}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </FilterField>
            <FilterField icon={<Building2 size={13} />} label={t('fin.movs.cuentaBancaria')}>
              <select className="select w-full text-sm" value={filters.accountId || ""} onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}>
                <option value="">{t('fin.movs.todasLasCuentas')}</option>
                {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Briefcase size={13} />} label={t('common.proyecto')}>
              <select className="select w-full text-sm" value={filters.projectId || ""} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}>
                <option value="">{t('fin.movs.todosLosProyectos')}</option>
                {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Tag size={13} />} label={t('common.categoria')}>
              <select className="select w-full text-sm" value={filters.categoryId || ""} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}>
                <option value="">{t('fin.movs.todasLasCategorias')}</option>
                {catalogs?.categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Briefcase size={13} />} label={t('common.proveedor')}>
              <select className="select w-full text-sm" value={filters.providerId || ""} onChange={(e) => setFilters({ ...filters, providerId: e.target.value })}>
                <option value="">{t('fin.movs.todosLosProveedores')}</option>
                {catalogs?.providers?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Users size={13} />} label={t('common.socio')}>
              <select className="select w-full text-sm" value={filters.partnerId || ""} onChange={(e) => setFilters({ ...filters, partnerId: e.target.value })}>
                <option value="">{t('fin.movs.todosLosSocios')}</option>
                {catalogs?.partners?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<TrendingUp size={13} />} label={t('fin.movs.origenIngreso')}>
              <select className="select w-full text-sm" value={filters.originId || ""} onChange={(e) => setFilters({ ...filters, originId: e.target.value })}>
                <option value="">{t('fin.movs.todosLosOrigenes')}</option>
                {catalogs?.origins?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </FilterField>
            <FilterField icon={<Banknote size={13} />} label={t('fin.movs.lenderPrestamista')}>
              <select className="select w-full text-sm" value={filters.lenderId || ""} onChange={(e) => setFilters({ ...filters, lenderId: e.target.value })}>
                <option value="">{t('fin.movs.todosLosLenders')}</option>
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
                {unreconciledLines.length} {unreconciledLines.length === 1 ? t('fin.movs.linea') : t('fin.acctDet.lineas')} {t('fin.movs.deExtractoSinRegistrarManualmente')}
              </span>
            </div>
            <Link to="/finance/accounts" className="text-xs hover:underline font-semibold" style={{ color: 'var(--brand-gold)' }}>{t('fin.movs.irACuentas')}</Link>
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
                    title={t('fin.movs.registrarEsteMovimientoDelBancoQue')}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-negative/15 text-negative hover:bg-negative/25 disabled:opacity-40 whitespace-nowrap"
                  >
                    {t('fin.movs.registrar')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {unreconciledLines.length > 6 && (
            <div className="text-xs text-slate-500 mt-1">+ {unreconciledLines.length - 6} {t('fin.acctDet.mas')}</div>
          )}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft border-b border-line text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">{t('common.fecha')}</th>
              <th className="px-3 py-2 text-left">{t('common.tipo')}</th>
              <th className="px-3 py-2 text-left">{t('common.cuenta2')}</th>
              <th className="px-3 py-2 text-left">{t('common.concepto')}</th>
              <th className="px-3 py-2 text-left">{t('fin.movs.categoriaOrigen')}</th>
              <th className="px-3 py-2 text-left">{t('fin.movs.proyectoSocio')}</th>
              <th className="px-3 py-2 text-right">{t('common.monto')}</th>
              <th className="px-3 py-2 text-center">{t('fin.movs.comparacion')}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-4 text-center text-slate-500">{t('common.cargando')}</td></tr>}
            {!isLoading && movements.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-slate-500">{t('fin.movs.sinMovimientosImportaElExcelDesde')}</td></tr>
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
                      <Icon size={10} className="mr-1" /> {t(tb.labelKey)}
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
                    {m.techItem && (
                      <span
                        className="badge inline-flex items-center gap-1 mr-1"
                        style={{ background: 'rgba(198,149,47,0.12)', color: '#8a6a1f', border: '1px solid rgba(198,149,47,0.35)' }}
                        title={t('fin.movs.obraV0V1V2EsteGasto', { v0: m.techItem.phase?.project?.name ?? '', v1: m.techItem.phase?.name ?? '', v2: m.techItem.activity })}
                      >
                        <HardHat size={10} /> {m.techItem.itemCode}
                      </span>
                    )}
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
                      <MIcon size={10} /> {t(mb.labelKey)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      {m.type === "Egreso" && (
                        <button
                          onClick={() => setQuickAssign(m)}
                          className="btn-ghost p-1"
                          style={{ color: m.techItem ? '#8a6a1f' : undefined }}
                          title={m.techItem ? t('fin.movs.asociadoAObraV0V1Clic', { v0: m.techItem.itemCode, v1: m.techItem.activity }) : t('fin.movs.asociarEsteGastoAUnaFase')}
                        >
                          <HardHat size={14} />
                        </button>
                      )}
                      <Link to={`/finance/movements/${m.id}`} className="btn-ghost p-1" title={t('fin.movs.verDetalleEditar')}><ChevronRight size={14} /></Link>
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: t('fin.movs.eliminarMovimiento'),
                            message: t('fin.movs.seguroQueQuieresEliminarElMovimiento', { v0: m.concept }),
                            detail: t('fin.movs.montoV0V1V2', { v0: usd(m.amount ?? 0), v1: m.type, v2: m.account?.name || 'sin cuenta' }),
                            confirmText: t('tech.projects.siEliminar'),
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
      <QuickTechAssignModal movement={quickAssign} onClose={() => setQuickAssign(null)} />
    </div>
  );
}

// =============================================================================
// MODAL de asociación rápida a obra — para movimientos YA registrados
// (incluidos los conciliados con extracto). No toca ningún otro campo.
// =============================================================================
function QuickTechAssignModal({ movement, onClose }: { movement: any | null; onClose: () => void }) {
  const { t } = useI18n()
  const qc = useQueryClient();
  const [sel, setSel] = useState<TechSel>(EMPTY_TECH_SEL);
  const open = !!movement;

  const saveMut = useMutation({
    mutationFn: async () => {
      const link = await resolveTechLink(sel);
      return API.updateMovement(movement.id, link);
    },
    onSuccess: () => {
      toast.success(t('fin.movs.gastoAsociadoALaObraEjecucion'));
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["fin-tech-tree"] });
      setSel(EMPTY_TECH_SEL);
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.message || t('fin.movDet.errorAlAsociar')),
  });

  const removeMut = useMutation({
    mutationFn: () => API.updateMovement(movement.id, { techItemId: null, techSubActivityId: null }),
    onSuccess: () => {
      toast.success(t('fin.movs.asociacionRetirada'));
      qc.invalidateQueries({ queryKey: ["movements"] });
      setSel(EMPTY_TECH_SEL);
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t('fin.movs.errorAlDesvincular')),
  });

  if (!open) return null;
  return (
    <Modal open={open} onClose={() => { setSel(EMPTY_TECH_SEL); onClose(); }} title={t('fin.movs.asociarGastoALaObra')} size="lg">
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-bg-soft border border-line text-sm">
          <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>{movement.concept}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {dateShort(movement.date)} · {usd(movement.amount)} · {movement.account?.name || "—"}
            {movement.matchStatus === "matched" ? t('fin.movs.conciliadoConExtracto') : ""}
          </div>
          {movement.techItem && (
            <div className="text-xs mt-1" style={{ color: '#8a6a1f' }}>
              {t('fin.movs.asociadoActualmenteA')} {movement.techItem.itemCode} · {movement.techItem.activity}
            </div>
          )}
        </div>

        <TechAssociate sel={sel} onChange={setSel} enabled={open} />

        <div className="flex justify-between gap-2 pt-3 border-t border-line">
          {movement.techItem ? (
            <button className="btn-ghost text-xs text-red-600" disabled={removeMut.isPending} onClick={() => removeMut.mutate()}>
              {t('fin.movs.quitarAsociacionActual')}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => { setSel(EMPTY_TECH_SEL); onClose(); }}>{t('common.cancelar')}</button>
            <button className="btn-primary" disabled={!techSelReady(sel) || saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? t('fin.movDet.asociando') : t('fin.movs.asociarALaObra')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// MODAL — Cascada por TIPO de movimiento.
// =============================================================================
function MovementModal({ open, onClose, catalogs }: { open: boolean; onClose: () => void; catalogs: any }) {
  const { t } = useI18n()
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
  // Engranaje con la obra (módulo técnico): cascada proyecto → fase → actividad → subactividad
  const [techSel, setTechSel] = useState<TechSel>(EMPTY_TECH_SEL);

  const update = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: (data: any) => API.createMovement(data),
    onSuccess: () => {
      toast.success(t('fin.movs.movimientoCreado'));
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
      setTechSel(EMPTY_TECH_SEL);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || t('fin.accts.errorAlCrear')),
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validación cascada
    if (!form.accountId) return toast.error(t('fin.movs.seleccionaLaCuenta'));
    if (!form.amount || +form.amount <= 0) return toast.error(t('fin.movs.ingresaUnMontoValido'));
    if (!form.concept.trim()) return toast.error(t('common.conceptoEsObligatorio'));
    if (form.type === "Ingreso" && !form.originId) return toast.error(t('fin.movDet.seleccionaElOrigenDelIngreso'));
    if (form.type === "Ingreso" && isEquityOrigin && !form.partnerId) return toast.error(t('fin.movs.paraAportesDeSocioSeleccionaQue'));
    if (form.type === "Ingreso" && isLoanOrigin && !form.lenderId) return toast.error(t('fin.movs.paraUnPrestamoSeleccionaQuienTe'));
    if (form.type === "Egreso" && !form.categoryId) return toast.error(t('fin.movs.seleccionaLaCategoriaDelEgreso'));
    // Nota: un egreso PUEDE no estar asociado a proyecto (ej. fee bancario, gasto corporativo).
    // Solo validamos lender cuando la categoría es pago de deuda.
    if (form.type === "Egreso" && isDebtPayment && !form.lenderId) return toast.error(t('fin.movs.paraPagoDeDeudaSeleccionaEl'));
    if (form.type === "Interbancario" && !form.destAccountId) return toast.error(t('fin.movs.seleccionaLaCuentaDestino'));
    if (form.type === "Interbancario" && form.accountId === form.destAccountId) return toast.error(t('fin.movs.origenYDestinoDebenSerDistintos'));

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
    // Engranaje con la obra: resolver la asociación (crea la actividad si es nueva)
    if (form.type === "Egreso" && techSelReady(techSel)) {
      try {
        const link = await resolveTechLink(techSel);
        payload.techItemId = link.techItemId;
        payload.techSubActivityId = link.techSubActivityId;
      } catch (err: any) {
        toast.error(err?.response?.data?.error || t('fin.movs.noSePudoCrearLaActividad'));
        return;
      }
    }
    mutation.mutate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('fin.movs.nuevoMovimiento')} size="lg">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        {/* Tipo (cascada) — sección destacada */}
        <div className="md:col-span-2 p-3 bg-bg-soft rounded-lg border border-line">
          <label className="label">{t('fin.movs.tipoDeMovimiento')}</label>
          <div className="grid grid-cols-3 gap-2">
            {(["Ingreso", "Egreso", "Interbancario"] as const).map((mtype) => {
              const tb = TYPE_BADGE[mtype];
              const Icon = tb.icon;
              const active = form.type === mtype;
              return (
                <button
                  type="button"
                  key={mtype}
                  onClick={() => update({
                    type: mtype,
                    // Reset campos no aplicables al nuevo tipo
                    originId: mtype === "Ingreso" ? form.originId : "",
                    categoryId: mtype === "Egreso" ? form.categoryId : "",
                    providerId: mtype === "Egreso" ? form.providerId : "",
                    destAccountId: mtype === "Interbancario" ? form.destAccountId : "",
                    partnerId: mtype === "Ingreso" ? form.partnerId : "",
                    lenderId: (mtype === "Ingreso" || mtype === "Egreso") ? form.lenderId : "",
                  })}
                  className={cls(
                    "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    active
                      ? cls("ring-2 ring-offset-1 ring-offset-bg-soft", tb.color, "ring-current")
                      : "border-line text-slate-400 hover:bg-bg-hover"
                  )}
                >
                  <Icon size={14} />
                  {mtype === "Ingreso" ? t('common.ingreso') : mtype === "Egreso" ? t('common.egreso') : t('fin.movs.transferencia')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Campos básicos siempre visibles */}
        <div>
          <label className="label">{t('fin.capital.fecha')}</label>
          <input type="date" className="input w-full" value={form.date} onChange={(e) => update({ date: e.target.value })} required />
        </div>
        <div>
          <label className="label">{t('common.montoUsd')}</label>
          <input type="number" step="0.01" min="0.01" className="input w-full" value={form.amount} onChange={(e) => update({ amount: e.target.value })} required />
        </div>
        <div>
          <label className="label">
            {form.type === "Interbancario" ? t('fin.movs.cuentaOrigen') : t('fin.movs.cuenta')}
          </label>
          <select className="select w-full" value={form.accountId} onChange={(e) => update({ accountId: e.target.value })} required>
            <option value="">{t('common.seleccionar')}</option>
            {catalogs?.accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name} · {a.bank}</option>)}
          </select>
        </div>
        {form.type === "Interbancario" && (
          <div>
            <label className="label">{t('fin.movs.cuentaDestino')}</label>
            <select className="select w-full" value={form.destAccountId} onChange={(e) => update({ destAccountId: e.target.value })} required>
              <option value="">{t('common.seleccionar')}</option>
              {catalogs?.accounts?.filter((a: any) => String(a.id) !== form.accountId).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} · {a.bank}</option>
              ))}
            </select>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="label">{t('common.concepto2')}</label>
          <input className="input w-full" value={form.concept} onChange={(e) => update({ concept: e.target.value })} required placeholder={t('fin.movs.descripcionDelMovimiento')} />
        </div>

        {/* Cascada: Egreso → Categoría + Proveedor + Proyecto */}
        {form.type === "Egreso" && (
          <>
            <div>
              <label className="label">{t('fin.movs.categoria')}</label>
              <select className="select w-full" value={form.categoryId} onChange={(e) => update({ categoryId: e.target.value })} required>
                <option value="">{t('fin.movs.seleccionarCategoria')}</option>
                {catalogs?.categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('fin.movs.proveedorTercero')}</label>
              <select className="select w-full" value={form.providerId} onChange={(e) => update({ providerId: e.target.value })}>
                <option value="">{t('common.ninguno')}</option>
                {catalogs?.providers?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('fin.movDet.proyectoAsociado')} <span className="text-[11px] font-normal" style={{ color: 'var(--brand-teal2)' }}>{t('fin.movs.opcionalUsarNoAsociadoParaGastos')}</span></label>
              <select className="select w-full" value={form.projectId} onChange={(e) => update({ projectId: e.target.value })}>
                <option value="">{t('fin.movs.noAsociadoAProyectoGastoCorporativo')}</option>
                {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
              {!form.projectId && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--brand-gold)' }}>
                  {t('fin.movs.esteEgresoSeRegistraraComoGasto')}
                </p>
              )}
            </div>
            {isDebtPayment && (
              <div className="md:col-span-2">
                <label className="label">{t('fin.movs.lenderAcreedorDeLaDeuda')}</label>
                <select className="select w-full" value={form.lenderId} onChange={(e) => update({ lenderId: e.target.value })} required>
                  <option value="">{t('fin.movs.seleccionarLender')}</option>
                  {catalogs?.lenders?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">{t('fin.movs.estePagoSeReflejaraEnDeuda')}</p>
              </div>
            )}

            {/* ── ENGRANAJE CON LA OBRA (módulo técnico) ─────────────────────
                Cascada proyecto → fase → actividad (existente o NUEVA) →
                subactividad opcional. El gasto queda registrado en Finanzas Y
                en Ejecución de una sola vez. */}
            <div className="md:col-span-2 p-3 rounded-lg" style={{ background: 'rgba(198,149,47,0.06)', border: '1px dashed rgba(198,149,47,0.4)' }}>
              <label className="label flex items-center gap-1.5" style={{ marginBottom: 6 }}>
                <HardHat size={13} style={{ color: 'var(--brand-gold)' }} />
                {t('fin.movs.asociarALaObraModuloTecnico')} <span className="text-[11px] font-normal text-slate-500">{t('fin.movs.opcional')}</span>
              </label>
              <TechAssociate sel={techSel} onChange={setTechSel} enabled={open} />
            </div>
          </>
        )}

        {/* Cascada: Ingreso → Origen + (Socio si Equity | Lender si Préstamo) */}
        {form.type === "Ingreso" && (
          <>
            <div className="md:col-span-2">
              <label className="label">{t('fin.movs.origenDelCapital')}</label>
              <select className="select w-full" value={form.originId} onChange={(e) => update({ originId: e.target.value, partnerId: "", lenderId: "" })} required>
                <option value="">{t('fin.movs.seleccionarOrigen')}</option>
                {catalogs?.origins?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            {isEquityOrigin && (
              <div>
                <label className="label">{t('common.socioQueAporta')}</label>
                <select className="select w-full" value={form.partnerId} onChange={(e) => update({ partnerId: e.target.value })} required>
                  <option value="">{t('common.seleccionarSocio')}</option>
                  {catalogs?.partners?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">{t('fin.movs.seRegistraraAutomaticamenteEnCapitalAporta')}</p>
              </div>
            )}
            {isLoanOrigin && (
              <div>
                <label className="label">{t('fin.movs.lenderPrestamista2')}</label>
                <select className="select w-full" value={form.lenderId} onChange={(e) => update({ lenderId: e.target.value })} required>
                  <option value="">{t('fin.movs.seleccionarLender')}</option>
                  {catalogs?.lenders?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">{t('fin.movDet.proyectoAsociado')} <span className="text-slate-500 text-[11px]">{t('fin.movs.opcional')}</span></label>
              <select className="select w-full" value={form.projectId} onChange={(e) => update({ projectId: e.target.value })}>
                <option value="">{t('fin.movs.corporativo')}</option>
                {catalogs?.projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="md:col-span-2">
          <label className="label">{t('common.notas')}</label>
          <textarea className="input w-full" rows={2} value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
        </div>

        <div className="md:col-span-2 flex justify-end gap-2 mt-2 pt-3 border-t border-line">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancelar')}</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.guardando') : t('common.crearMovimiento')}
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
