import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, ArrowLeftRight, Users, Wallet, Banknote,
  Briefcase, ListTree, FileSpreadsheet, Upload, BarChart3,
  LogOut, ShieldCheck, Home,
} from "lucide-react";
import { cls } from "../lib/format";
import { logout as unifiedLogout } from "../../components/AuthGate";
import ModuleSwitcher from "../../components/ModuleSwitcher";

const NAV = [
  { to: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Vista ejecutiva" },
  { to: "/finance/movements", label: "Movimientos", icon: ArrowLeftRight, group: "Operación" },
  { to: "/finance/accounts", label: "Cuentas bancarias", icon: Wallet, group: "Operación" },
  { to: "/finance/statements", label: "Extractos bancarios", icon: FileSpreadsheet, group: "Operación" },
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

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 bg-bg-soft border-r border-line flex flex-col">
        <div className="px-5 py-5 border-b border-line">
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
        {/* Top bar: switcher de módulos + backup */}
        <div className="flex items-center justify-end gap-2 px-6 py-2 border-b border-line bg-bg-soft/60 backdrop-blur-sm" style={{ minHeight: 44 }}>
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
            Backup del sistema
          </a>
        </div>
        <div className="max-w-[1600px] mx-auto p-6 flex-1 w-full">{children}</div>
      </main>
    </div>
  );
}
