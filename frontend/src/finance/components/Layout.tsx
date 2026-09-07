import { NavLink, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, ArrowLeftRight, Users, Wallet, Banknote,
  Briefcase, ListTree, Upload, BarChart3,
  LogOut, Home, Menu, X, Download, Activity, Droplets, Percent,
} from "lucide-react";
import { cls } from "../lib/format";
import { logout as unifiedLogout } from "../../components/AuthGate";
import ModuleSwitcher from "../../components/ModuleSwitcher";
import CapacityBanner from "../../components/CapacityBanner";
import { useTheme } from "../../hooks/useTheme";
import { downloadAuthed } from "../../lib/api";
import { useI18n, type TranslationKey } from "../../i18n";
import LanguageToggle from "../../components/LanguageToggle";

// NAV guarda CLAVES de traducción; el texto se resuelve en el render con t().
type NavGroupKey =
  | "nav.fin.group.executive" | "nav.fin.group.operations" | "nav.fin.group.structure"
  | "nav.fin.group.investment" | "nav.fin.group.analysis" | "nav.fin.group.administration";

const NAV: Array<{ to: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; group: NavGroupKey }> = [
  { to: "/finance/dashboard", labelKey: "nav.fin.dashboard", icon: LayoutDashboard, group: "nav.fin.group.executive" },
  { to: "/finance/movements", labelKey: "nav.fin.movements", icon: ArrowLeftRight, group: "nav.fin.group.operations" },
  { to: "/finance/accounts", labelKey: "nav.fin.accounts", icon: Wallet, group: "nav.fin.group.operations" },
  { to: "/finance/capital", labelKey: "nav.fin.capital", icon: Users, group: "nav.fin.group.structure" },
  { to: "/finance/debt", labelKey: "nav.fin.debt", icon: Banknote, group: "nav.fin.group.structure" },
  { to: "/finance/projects", labelKey: "nav.fin.projects", icon: Briefcase, group: "nav.fin.group.investment" },
  { to: "/finance/returns", labelKey: "nav.fin.returns", icon: Percent, group: "nav.fin.group.investment" },
  { to: "/finance/cashflow", labelKey: "nav.fin.cashflow", icon: Activity, group: "nav.fin.group.analysis" },
  { to: "/finance/liquidity", labelKey: "nav.fin.liquidity", icon: Droplets, group: "nav.fin.group.analysis" },
  { to: "/finance/reports", labelKey: "nav.fin.reports", icon: BarChart3, group: "nav.fin.group.analysis" },
  { to: "/finance/catalogs", labelKey: "nav.fin.catalogs", icon: ListTree, group: "nav.fin.group.administration" },
  { to: "/finance/import", labelKey: "nav.fin.import", icon: Upload, group: "nav.fin.group.administration" },
];

const GROUPS: NavGroupKey[] = [
  "nav.fin.group.executive", "nav.fin.group.operations", "nav.fin.group.structure",
  "nav.fin.group.investment", "nav.fin.group.analysis", "nav.fin.group.administration",
];

// Logo SVG custom — cityscape Restrepo Acosta (conservado del diseño previo)
function RAMark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.93} viewBox="0 0 90 80" fill="none">
      <polygon points="12,74 12,18 41,6 41,74" fill="rgba(255,255,255,0.9)" />
      <polygon points="46,74 46,28 67,20 67,74" fill="rgba(255,255,255,0.7)" />
      <path d="M 5,68 Q 42,50 82,61" stroke="#D9AE52" strokeWidth="6.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Devuelve CLAVES de traducción para el topbar (no texto).
function getPageTitleKeys(pathname: string): { titleKey: TranslationKey; subKey: TranslationKey } {
  const item = NAV.find(n => pathname === n.to || pathname.startsWith(n.to + "/"));
  if (!item) return { titleKey: "fin.title.default", subKey: "fin.sub.default" };
  const subs: Record<NavGroupKey, TranslationKey> = {
    "nav.fin.group.executive": "sub.fin.executive",
    "nav.fin.group.operations": "sub.fin.operations",
    "nav.fin.group.structure": "sub.fin.structure",
    "nav.fin.group.investment": "sub.fin.investment",
    "nav.fin.group.analysis": "sub.fin.analysis",
    "nav.fin.group.administration": "sub.fin.administration",
  };
  return { titleKey: item.labelKey, subKey: subs[item.group] ?? "sub.fin.fallback" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useTheme(); // asegura que data-theme esté aplicado en esta subtree
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const { titleKey, subKey } = getPageTitleKeys(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden fin-app" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* === MOBILE HEADER === */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 fin-topbar-v2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0) + 0.75rem)', height: 'auto' }}
      >
        <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--text-secondary)' }} className="p-2 -ml-2" aria-label={t('common.openMenu')}>
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="fin-logo-mark" style={{ width: 28, height: 28 }}>
            <RAMark size={14} />
          </div>
          <div className="fin-logo-name" style={{ fontSize: 13 }}>{t('fin.title.default')}</div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* === SIDEBAR === */}
      <aside
        className={cls(
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          'fixed md:relative inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-200 ease-out fin-sidebar-v2'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
      >
        {/* Botón cierre móvil */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-3 right-3 p-2"
          style={{ color: 'var(--text-secondary)', zIndex: 10 }}
          aria-label={t('common.closeMenu')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="px-[18px] py-[22px] flex items-center gap-[11px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <Link to="/" className="flex items-center gap-[11px] group" style={{ textDecoration: 'none' }}>
            <div className="fin-logo-mark">
              <RAMark size={15} />
            </div>
            <div>
              <div className="fin-logo-name">Restrepo Acosta</div>
              <div className="fin-logo-sub">{t('fin.logo.sub')}</div>
            </div>
          </Link>
        </div>

        {/* Back to home */}
        <Link to="/" className="fin-nav-item mt-2" style={{ fontSize: 11.5 }}>
          <Home size={13} style={{ color: 'var(--text-muted)' }} />
          <span>{t('common.home')}</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="fin-nav-grp">{t(group)}</div>
              {NAV.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cls("fin-nav-item", active && "active")}
                  >
                    <Icon size={14} style={{ flexShrink: 0 }} />
                    <span>{t(item.labelKey)}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-[18px] py-[14px] flex items-center gap-[10px]" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="fin-user-av">JR</div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>Dr. Restrepo</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginTop: 2 }}>{t('layout.role.managingDirector')}</div>
          </div>
          <button onClick={unifiedLogout} title={t('common.logout')} className="fin-btn-icon" style={{ width: 26, height: 26 }}>
            <LogOut size={12} />
          </button>
        </div>
      </aside>

      {/* === MAIN === */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ background: 'var(--bg-base)' }}>
        {/* Spacer móvil */}
        <div className="md:hidden" style={{ height: 'calc(56px + env(safe-area-inset-top, 0))' }} />

        {/* TOPBAR */}
        <header className="fin-topbar-v2 hidden md:flex flex-shrink-0">
          <div>
            <div className="fin-tb-title">{t(titleKey)}</div>
            <div className="fin-tb-sub">{t(subKey)} · {new Date().toLocaleDateString(locale, { month: "long", year: "numeric" })}</div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ModuleSwitcher currentModule="finance" />
            <a
              href="/api/backup"
              download
              className="fin-btn-icon"
              title={t('common.systemBackup')}
              onClick={e => {
                e.preventDefault();
                downloadAuthed("/api/backup", `restrepoacosta-backup-${new Date().toISOString().slice(0, 10)}.zip`)
                  .catch(() => window.alert(t('common.backupError')));
              }}
            >
              <Download size={13} />
            </a>
          </div>
        </header>

        <CapacityBanner />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto p-5 md:p-7 page-content">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
