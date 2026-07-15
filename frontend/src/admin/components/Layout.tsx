import { NavLink, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Network, ListChecks, Bell, LogOut, Home, Menu, X, Download } from "lucide-react";
import { cls } from "../../finance/lib/format";
import { logout as unifiedLogout } from "../../components/AuthGate";
import ModuleSwitcher from "../../components/ModuleSwitcher";
import CapacityBanner from "../../components/CapacityBanner";
import { useTheme } from "../../hooks/useTheme";
import { downloadAuthed } from "../../lib/api";

const NAV = [
  { to: "/admin/orgchart", label: "Organigrama", icon: Network, group: "Estructura corporativa" },
  { to: "/admin/tasks", label: "Tareas", icon: ListChecks, group: "Gestión" },
  { to: "/admin/alerts", label: "Alertas de cumplimiento", icon: Bell, group: "Gestión" },
];

const GROUPS = ["Estructura corporativa", "Gestión"];

function RAMark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.93} viewBox="0 0 90 80" fill="none">
      <polygon points="12,74 12,18 41,6 41,74" fill="rgba(255,255,255,0.9)" />
      <polygon points="46,74 46,28 67,20 67,74" fill="rgba(255,255,255,0.7)" />
      <path d="M 5,68 Q 42,50 82,61" stroke="rgba(255,220,160,0.9)" strokeWidth="6.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function getPageTitle(pathname: string): { title: string; sub: string } {
  if (pathname.includes("/companies/")) return { title: "Expediente corporativo", sub: "Documentación y cumplimiento" };
  const item = NAV.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"));
  if (!item) return { title: "Gobierno Corporativo", sub: "Restrepo Acosta Global Holding LLC" };
  const subs: Record<string, string> = {
    "Estructura corporativa": "Holding y subsidiarias",
    "Gestión": "Tareas, alertas y cumplimiento",
  };
  return { title: item.label, sub: subs[item.group] || "Módulo administrativo" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useTheme();
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const { title, sub } = getPageTitle(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden fin-app" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* === MOBILE HEADER === */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 fin-topbar-v2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 0.75rem)", height: "auto" }}
      >
        <button onClick={() => setMobileOpen(true)} style={{ color: "var(--text-secondary)" }} className="p-2 -ml-2" aria-label="Abrir menú">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="fin-logo-mark" style={{ width: 28, height: 28 }}>
            <RAMark size={14} />
          </div>
          <div className="fin-logo-name" style={{ fontSize: 13 }}>Gobierno Corporativo</div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* === SIDEBAR === */}
      <aside
        className={cls(
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "fixed md:relative inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-200 ease-out fin-sidebar-v2"
        )}
        style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-3 right-3 p-2"
          style={{ color: "var(--text-secondary)", zIndex: 10 }}
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-[18px] py-[22px] flex items-center gap-[11px]" style={{ borderBottom: "1px solid var(--border)" }}>
          <Link to="/" className="flex items-center gap-[11px] group" style={{ textDecoration: "none" }}>
            <div className="fin-logo-mark">
              <RAMark size={15} />
            </div>
            <div>
              <div className="fin-logo-name">Restrepo Acosta</div>
              <div className="fin-logo-sub">Gobierno Corporativo</div>
            </div>
          </Link>
        </div>

        <Link to="/" className="fin-nav-item mt-2" style={{ fontSize: 11.5 }}>
          <Home size={13} style={{ color: "var(--text-muted)" }} />
          <span>Inicio</span>
        </Link>

        <nav className="flex-1 overflow-y-auto py-3">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="fin-nav-grp">{group}</div>
              {NAV.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                return (
                  <NavLink key={item.to} to={item.to} className={cls("fin-nav-item", active && "active")}>
                    <Icon size={14} style={{ flexShrink: 0 }} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-[18px] py-[14px] flex items-center gap-[10px]" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="fin-user-av">JR</div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.3 }}>Dr. Restrepo</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginTop: 2 }}>Managing Director</div>
          </div>
          <button onClick={unifiedLogout} title="Cerrar sesión" className="fin-btn-icon" style={{ width: 26, height: 26 }}>
            <LogOut size={12} />
          </button>
        </div>
      </aside>

      {/* === MAIN === */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ background: "var(--bg-base)" }}>
        <div className="md:hidden" style={{ height: "calc(56px + env(safe-area-inset-top, 0))" }} />

        <header className="fin-topbar-v2 hidden md:flex flex-shrink-0">
          <div>
            <div className="fin-tb-title">{title}</div>
            <div className="fin-tb-sub">{sub} · {new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" })}</div>
          </div>
          <div className="flex items-center gap-2">
            <ModuleSwitcher currentModule="admin" />
            <a
              href="/api/backup"
              download
              className="fin-btn-icon"
              title="Backup del sistema"
              onClick={(e) => {
                e.preventDefault();
                downloadAuthed("/api/backup", `restrepoacosta-backup-${new Date().toISOString().slice(0, 10)}.zip`)
                  .catch(() => window.alert("Error al descargar el backup. Verifica tu sesión e intenta de nuevo."));
              }}
            >
              <Download size={13} />
            </a>
          </div>
        </header>

        <CapacityBanner />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto p-5 md:p-7 page-content">{children}</div>
        </div>
      </main>
    </div>
  );
}
