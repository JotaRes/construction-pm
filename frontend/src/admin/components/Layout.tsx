import { NavLink, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Network, ListChecks, Bell, LogOut, Home, Menu, X, Download, Users } from "lucide-react";
import { cls } from "../../finance/lib/format";
import { logout as unifiedLogout } from "../../components/AuthGate";
import ModuleSwitcher from "../../components/ModuleSwitcher";
import CapacityBanner from "../../components/CapacityBanner";
import { useTheme } from "../../hooks/useTheme";
import { downloadAuthed } from "../../lib/api";
import { AdminAPI } from "../lib/api";
import { useI18n, type TranslationKey } from "../../i18n";
import LanguageToggle from "../../components/LanguageToggle";

type AdmGroupKey = "nav.adm.group.corporate" | "nav.adm.group.management";

// NAV guarda CLAVES de traducción; el texto se resuelve en el render con t().
const NAV: Array<{ to: string; labelKey: TranslationKey; icon: typeof Network; group: AdmGroupKey }> = [
  { to: "/admin/orgchart", labelKey: "nav.adm.orgchart", icon: Network, group: "nav.adm.group.corporate" },
  { to: "/admin/persons", labelKey: "nav.adm.persons", icon: Users, group: "nav.adm.group.corporate" },
  { to: "/admin/tasks", labelKey: "nav.adm.tasks", icon: ListChecks, group: "nav.adm.group.management" },
  { to: "/admin/alerts", labelKey: "nav.adm.alerts", icon: Bell, group: "nav.adm.group.management" },
];

const GROUPS: AdmGroupKey[] = ["nav.adm.group.corporate", "nav.adm.group.management"];

/** Badge del menú lateral: pendientes en ámbar; si hay vencidas, rojo pulsante. */
function NavBadge({ count, urgent, title }: { count: number; urgent?: boolean; title?: string }) {
  if (!count) return null;
  return (
    <span
      title={title}
      className={cls("ml-auto flex-shrink-0 min-w-[20px] h-[18px] px-1.5 rounded-full flex items-center justify-center", urgent && "animate-pulse")}
      style={{
        background: urgent ? "#D93025" : "rgba(201,130,11,0.9)",
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        lineHeight: 1,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function RAMark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.93} viewBox="0 0 90 80" fill="none">
      <polygon points="12,74 12,18 41,6 41,74" fill="rgba(255,255,255,0.9)" />
      <polygon points="46,74 46,28 67,20 67,74" fill="rgba(255,255,255,0.7)" />
      <path d="M 5,68 Q 42,50 82,61" stroke="rgba(255,220,160,0.9)" strokeWidth="6.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Devuelve CLAVES de traducción para el topbar (no texto).
function getPageTitleKeys(pathname: string): { titleKey: TranslationKey; subKey: TranslationKey } {
  if (pathname.includes("/companies/")) return { titleKey: "adm.corpFile", subKey: "adm.corpFileSub" };
  if (/\/persons\/\d+/.test(pathname)) return { titleKey: "adm.personFile", subKey: "adm.personFileSub" };
  const item = NAV.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"));
  if (!item) return { titleKey: "adm.title.default", subKey: "fin.sub.default" };
  const subs: Record<AdmGroupKey, TranslationKey> = {
    "nav.adm.group.corporate": "sub.adm.corporate",
    "nav.adm.group.management": "sub.adm.management",
  };
  return { titleKey: item.labelKey, subKey: subs[item.group] ?? "sub.adm.fallback" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useTheme();
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const { titleKey, subKey } = getPageTitleKeys(location.pathname);

  // Señalización inteligente del sidebar: se refresca sola cada minuto y al
  // volver a la pestaña. Tareas → pendientes/vencidas; Alertas → críticas+altas.
  const summaryQ = useQuery({
    queryKey: ["adm-task-summary"],
    queryFn: AdminAPI.getTaskSummary,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const dashQ = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: AdminAPI.getDashboard,
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const taskSummary = summaryQ.data;
  const alertCounts = dashQ.data?.alertCounts;
  const badgeFor = (to: string): { count: number; urgent: boolean; title: string } | null => {
    if (to === "/admin/tasks" && taskSummary && taskSummary.pending > 0) {
      return {
        count: taskSummary.pending,
        urgent: taskSummary.overdue > 0,
        title: taskSummary.overdue > 0
          ? t('adm.badge.overdue', { pending: taskSummary.pending, overdue: taskSummary.overdue })
          : t('adm.badge.pending', { pending: taskSummary.pending })
            + (taskSummary.dueSoon > 0 ? t('adm.badge.dueSoon', { n: taskSummary.dueSoon }) : ""),
      };
    }
    if (to === "/admin/alerts" && alertCounts) {
      const n = (alertCounts.criticas ?? 0) + (alertCounts.altas ?? 0);
      if (n > 0) return { count: n, urgent: (alertCounts.criticas ?? 0) > 0, title: t('adm.badge.alerts', { critical: alertCounts.criticas ?? 0, high: alertCounts.altas ?? 0 }) };
    }
    return null;
  };

  return (
    <div className="flex h-screen overflow-hidden fin-app" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* === MOBILE HEADER === */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 fin-topbar-v2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 0.75rem)", height: "auto" }}
      >
        <button onClick={() => setMobileOpen(true)} style={{ color: "var(--text-secondary)" }} className="p-2 -ml-2" aria-label={t('common.openMenu')}>
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="fin-logo-mark" style={{ width: 28, height: 28 }}>
            <RAMark size={14} />
          </div>
          <div className="fin-logo-name" style={{ fontSize: 13 }}>{t('adm.title.default')}</div>
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
          aria-label={t('common.closeMenu')}
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
              <div className="fin-logo-sub">{t('adm.title.default')}</div>
            </div>
          </Link>
        </div>

        <Link to="/" className="fin-nav-item mt-2" style={{ fontSize: 11.5 }}>
          <Home size={13} style={{ color: "var(--text-muted)" }} />
          <span>{t('common.home')}</span>
        </Link>

        <nav className="flex-1 overflow-y-auto py-3">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="fin-nav-grp">{t(group)}</div>
              {NAV.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                const badge = badgeFor(item.to);
                return (
                  <NavLink key={item.to} to={item.to} className={cls("fin-nav-item", active && "active")}>
                    <Icon size={14} style={{ flexShrink: 0 }} />
                    <span>{t(item.labelKey)}</span>
                    {badge && <NavBadge count={badge.count} urgent={badge.urgent} title={badge.title} />}
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
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginTop: 2 }}>{t('layout.role.managingDirector')}</div>
          </div>
          <button onClick={unifiedLogout} title={t('common.logout')} className="fin-btn-icon" style={{ width: 26, height: 26 }}>
            <LogOut size={12} />
          </button>
        </div>
      </aside>

      {/* === MAIN === */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ background: "var(--bg-base)" }}>
        <div className="md:hidden" style={{ height: "calc(56px + env(safe-area-inset-top, 0))" }} />

        <header className="fin-topbar-v2 hidden md:flex flex-shrink-0">
          <div>
            <div className="fin-tb-title">{t(titleKey)}</div>
            <div className="fin-tb-sub">{t(subKey)} · {new Date().toLocaleDateString(locale, { month: "long", year: "numeric" })}</div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ModuleSwitcher currentModule="admin" />
            <a
              href="/api/backup"
              download
              className="fin-btn-icon"
              title={t('common.systemBackup')}
              onClick={(e) => {
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
          <div className="max-w-[1400px] mx-auto p-5 md:p-7 page-content">{children}</div>
        </div>
      </main>
    </div>
  );
}
