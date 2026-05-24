import { NavLink, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, ArrowLeftRight, Users, Wallet, Banknote,
  Briefcase, ListTree, Upload, BarChart3,
  LogOut, ShieldCheck, Home, Menu, X,
} from "lucide-react";
import { cls } from "../lib/format";
import { logout as unifiedLogout } from "../../components/AuthGate";
import ModuleSwitcher from "../../components/ModuleSwitcher";

const NAV = [
  { to: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Vista ejecutiva" },
  { to: "/finance/movements", label: "Movimientos", icon: ArrowLeftRight, group: "Operación" },
  { to: "/finance/accounts", label: "Cuentas bancarias", icon: Wallet, group: "Operación" },
  { to: "/finance/capital", label: "Capital aportado", icon: Users, group: "Estructura" },
  { to: "/finance/debt", label: "Deuda y préstamos", icon: Banknote, group: "Estructura" },
  { to: "/finance/projects", label: "Proyectos", icon: Briefcase, group: "Inversión" },
  { to: "/finance/reports", label: "Reportes & Trazabilidad", icon: BarChart3, group: "Análisis" },
  { to: "/finance/catalogs", label: "Catálogos", icon: ListTree, group: "Administración" },
  { to: "/finance/import", label: "Importar / Backup", icon: Upload, group: "Administración" },
];

const GROUPS = ["Vista ejecutiva", "Operación", "Estructura", "Inversión", "Análisis", "Administración"];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* === MOBILE HEADER === */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 shadow-sm"
        style={{ background: 'var(--brand-teal)', paddingTop: 'calc(env(safe-area-inset-top, 0) + 0.75rem)' }}
      >
        <button onClick={() => setMobileOpen(true)} className="text-white p-2 -ml-2" aria-label="Abrir menú">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(200,146,42,0.25)' }}>
            <ShieldCheck size={16} style={{ color: '#C8922A' }} />
          </div>
          <div className="text-white text-sm font-semibold" style={{ fontFamily: 'Georgia, serif' }}>CFO Holding</div>
        </div>
        <div className="w-8" />
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} fixed md:relative inset-y-0 left-0 z-50 w-72 md:w-64 bg-bg-soft border-r border-line flex flex-col transition-transform duration-200 ease-out`}
      >
        {/* Botón cierre móvil */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-3 right-3 p-2 text-white/70 hover:text-white"
          aria-label="Cerrar menú"
          style={{ zIndex: 10 }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-5 py-5 border-b border-line" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0) + 1.25rem)' }}>
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-accent-deep flex items-center justify-center group-hover:bg-accent-soft transition-colors">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">CFO Holding</div>
              <div className="text-[11px] text-slate-500">Restrepo Acosta</div>
            </div>
          </Link>
        </div>

        <Link
          to="/"
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:bg-bg-hover hover:text-slate-200 transition-colors border border-line/50"
        >
          <Home size={14} /> Volver al inicio
        </Link>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-3">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="px-3 mb-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{group}</div>
              {NAV.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cls(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-accent-deep/15 text-accent border border-accent/30"
                        : "text-slate-300 hover:bg-bg-hover"
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <button onClick={unifiedLogout} className="btn-ghost w-full justify-between text-xs">
            <span className="flex items-center gap-2"><LogOut size={14} /> Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-bg flex flex-col">
        {/* Spacer móvil para header fijo */}
        <div className="md:hidden" style={{ height: 'calc(56px + env(safe-area-inset-top, 0))' }} />

        {/* Top bar: switcher de módulos + backup */}
        <div className="flex items-center justify-end gap-2 px-4 md:px-6 py-2 border-b border-line bg-bg-soft/60 backdrop-blur-sm flex-wrap" style={{ minHeight: 44 }}>
          <ModuleSwitcher currentModule="finance" />
          <a
            href="/api/backup"
            download
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors text-slate-300 hover:text-white"
            style={{ background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.18)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(94,234,212,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(94,234,212,0.08)')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span className="hidden sm:inline">Backup del sistema</span>
            <span className="sm:hidden">Backup</span>
          </a>
        </div>
        <div className="max-w-[1600px] mx-auto p-4 md:p-6 flex-1 w-full">{children}</div>
      </main>
    </div>
  );
}
