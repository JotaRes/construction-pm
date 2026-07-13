import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, CheckSquare, DollarSign, TrendingUp,
  AlertTriangle, Users, Folder, Search, BarChart3, Building2,
  ChevronDown, FolderKanban, ListChecks, FileSpreadsheet, Tag, LogOut,
  Archive, Menu, X, Download, Layers, GanttChart, Image, HardHat,
  FileDiff, ClipboardCheck,
} from 'lucide-react'
import { alertsApi, projectsApi, downloadAuthed } from '../../lib/api'
import { logout } from '../AuthGate'
import ModuleSwitcher from '../ModuleSwitcher'
import CapacityBanner from '../CapacityBanner'
import { useProjectStore } from '../../store/projectStore'
import type { Alert, Task } from '../../lib/types'
import { tasksApi } from '../../lib/api'
import { useState, useRef, useEffect } from 'react'

const navGroups = [
  {
    label: 'Portafolio',
    items: [
      { to: '/tech/projects',   icon: FolderKanban,    label: 'Proyectos' },
      { to: '/tech/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Ejecución',
    items: [
      { to: '/tech/budget',     icon: DollarSign,      label: 'Presupuesto' },
      { to: '/tech/execution',  icon: CheckSquare,     label: 'Ejecución' },
      { to: '/tech/phases',     icon: Layers,          label: 'Fases' },
      { to: '/tech/construction-budget', icon: FileSpreadsheet, label: 'Const. Budget' },
      { to: '/tech/draws',      icon: TrendingUp,      label: 'Draws' },
      { to: '/tech/inspections',icon: Search,          label: 'Inspecciones' },
      { to: '/tech/gantt',      icon: GanttChart,      label: 'Gantt' },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { to: '/tech/financial',  icon: BarChart3,       label: 'Financiero' },
      { to: '/tech/alerts',     icon: AlertTriangle,   label: 'Alertas' },
      { to: '/tech/tasks',      icon: ListChecks,      label: 'Tareas' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/tech/providers',  icon: Users,           label: 'Proveedores' },
      { to: '/tech/subcontracts', icon: HardHat,       label: 'Subcontratos' },
      { to: '/tech/change-orders', icon: FileDiff,    label: 'Change Orders' },
      { to: '/tech/punch-list', icon: ClipboardCheck, label: 'Punch List' },
      { to: '/tech/gallery',    icon: Image,           label: 'Galería' },
      { to: '/tech/files',      icon: Folder,          label: 'Archivos' },
      { to: '/tech/price-refs', icon: Tag,             label: 'Precios Ref.' },
      { to: '/tech/import',     icon: Archive,         label: 'Importar / Backup' },
    ],
  },
]

// Flat list for backwards compat
const navItems = navGroups.flatMap(g => g.items)

interface Props {
  projectId: string
  children: React.ReactNode
}

function ProjectSwitcher({ projectId }: { projectId: string }) {
  const { setActiveProjectId } = useProjectStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string; spv: string }>>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    staleTime: 30000,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = projects.find(p => p.id === projectId)

  const handleSelect = (id: string) => {
    setActiveProjectId(id)
    setOpen(false)
    navigate('/tech/dashboard')
  }

  return (
    <div ref={ref} className="relative" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 7.5, textTransform: 'uppercase',
        letterSpacing: '0.22em', color: 'var(--text-muted)',
        marginBottom: 6, paddingLeft: 2,
      }}>
        Proyecto activo
      </div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors"
        style={{ background: open ? 'var(--accent-soft)' : 'transparent' }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'var(--row-hover-v2)' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: 5,
          background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Building2 size={12} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current?.name ?? '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current?.spv ?? ''}
          </div>
        </div>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 16, right: 16, marginBottom: 4,
          borderRadius: 10, overflow: 'hidden', zIndex: 50,
          background: 'var(--bg-surface-3)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-lg-v2)',
        }}>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className="w-full px-3 py-2.5 text-left transition-colors flex items-center gap-2"
              style={{ background: p.id === projectId ? 'var(--accent-soft)' : 'transparent' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--row-hover-v2)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = p.id === projectId ? 'var(--accent-soft)' : 'transparent'}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: p.id === projectId ? 'var(--accent)' : 'var(--border-strong)',
              }} />
              <div className="min-w-0">
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.spv}</div>
              </div>
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => { setOpen(false); navigate('/tech/projects') }}
              className="w-full px-3 py-2 text-left transition-colors"
              style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--row-hover-v2)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
            >
              + Nuevo proyecto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function getPageTitle(pathname: string): { title: string; sub: string } {
  const flat = navItems.find(n => pathname === n.to || pathname.startsWith(n.to + '/'))
  if (!flat) return { title: 'Módulo Técnico', sub: 'Gestión de obra residencial' }
  const subs: Record<string, string> = {
    '/tech/projects': 'Portafolio de proyectos',
    '/tech/dashboard': 'Vista general del proyecto activo',
    '/tech/execution': 'Control de ejecución en campo',
    '/tech/budget': 'Presupuesto y control de costos',
    '/tech/construction-budget': 'Presupuesto de construcción detallado',
    '/tech/draws': 'Solicitudes de desembolso',
    '/tech/inspections': 'Registro de inspecciones',
    '/tech/financial': 'Análisis financiero del proyecto',
    '/tech/alerts': 'Alertas y notificaciones activas',
    '/tech/tasks': 'Gestión de tareas y pendientes',
    '/tech/providers': 'Registro de proveedores',
    '/tech/notes': 'Notas y bitácora',
    '/tech/files': 'Archivos y documentación',
    '/tech/price-refs': 'Precios de referencia',
    '/tech/import': 'Importar datos / Backup',
  }
  return { title: flat.label, sub: subs[flat.to] ?? 'Módulo técnico' }
}

export default function Layout({ projectId, children }: Props) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['alerts', projectId],
    queryFn: () => alertsApi.list(projectId),
    refetchInterval: 60000,
  })
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.list(projectId),
    staleTime: 30000,
  })

  const criticalCount = alerts.filter(a => a.level === 'critical').length
  const warningCount  = alerts.filter(a => a.level === 'warning').length
  const urgentTasks   = tasks.filter(t => !t.done && t.priority === 'URGENT').length
  const pendingTasks  = tasks.filter(t => !t.done).length

  const { title, sub } = getPageTitle(location.pathname)

  return (
    <div className="flex h-screen overflow-hidden tech-app" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* === MOBILE HEADER === */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          height: 'calc(56px + env(safe-area-inset-top, 0))',
          paddingTop: 'env(safe-area-inset-top, 0)',
        }}
      >
        <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--text-secondary)', padding: '8px', marginLeft: -8 }} aria-label="Abrir menú">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="13" viewBox="0 0 90 80" fill="none">
              <polygon points="12,74 12,18 41,6 41,74" fill="rgba(255,255,255,0.9)"/>
              <polygon points="46,74 46,28 67,20 67,74" fill="rgba(255,255,255,0.7)"/>
              <path d="M 5,68 Q 42,50 82,61" stroke="rgba(255,220,160,0.9)" strokeWidth="6" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Restrepo Acosta
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* === SIDEBAR === */}
      <aside
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} fixed md:relative inset-y-0 left-0 z-50 flex flex-col transition-transform duration-200 ease-out`}
        style={{
          width: 216, flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          paddingTop: 'env(safe-area-inset-top, 0)',
        }}
      >
        {/* Cierre móvil */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-3 right-3 p-2"
          style={{ color: 'var(--text-secondary)', zIndex: 10 }}
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-[11px]">
            <div style={{
              width: 30, height: 30, borderRadius: 6,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'background 0.35s',
            }}>
              <svg width="15" height="14" viewBox="0 0 90 80" fill="none">
                <polygon points="12,74 12,18 41,6 41,74" fill="rgba(255,255,255,0.9)"/>
                <polygon points="46,74 46,28 67,20 67,74" fill="rgba(255,255,255,0.7)"/>
                <path d="M 5,68 Q 42,50 82,61" stroke="rgba(255,220,160,0.9)" strokeWidth="6.5" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 400,
                letterSpacing: '-0.025em', color: 'var(--text-primary)', lineHeight: 1.25,
              }}>
                Restrepo Acosta
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 7.5,
                textTransform: 'uppercase', letterSpacing: '0.18em',
                color: 'var(--text-muted)', marginTop: 3,
              }}>
                Construction PM
              </div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navGroups.map(group => (
            <div key={group.label}>
              <div style={{
                padding: '14px 18px 4px',
                fontFamily: 'var(--font-mono)', fontSize: 7.5,
                textTransform: 'uppercase', letterSpacing: '0.22em',
                color: 'var(--text-muted)',
              }}>
                {group.label}
              </div>
              {group.items.map(({ to, icon: Icon, label }) => {
                const isActive = location.pathname === to || location.pathname.startsWith(to + '/')
                const alertTo   = to === '/tech/alerts'
                const tasksTo   = to === '/tech/tasks'
                return (
                  <NavLink
                    key={to}
                    to={to}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 18px',
                      fontSize: 12.5, letterSpacing: '0.01em',
                      borderRight: '2px solid transparent',
                      transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                      textDecoration: 'none',
                      ...(isActive
                        ? {
                            background: 'var(--accent-soft)',
                            color: 'var(--text-primary)',
                            borderRightColor: 'var(--accent)',
                          }
                        : { color: 'var(--text-secondary)' }
                      ),
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'var(--row-hover-v2)'
                        ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'
                      }
                    }}
                  >
                    <Icon size={14} style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'inherit' }} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {alertTo && (criticalCount > 0 || warningCount > 0) && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9,
                        padding: '1px 6px', borderRadius: 3,
                        background: criticalCount > 0 ? 'var(--err-soft)' : 'var(--warn-soft)',
                        color: criticalCount > 0 ? 'var(--err)' : 'var(--warn)',
                        border: `1px solid ${criticalCount > 0 ? 'var(--err-border)' : 'var(--warn-border)'}`,
                      }}>
                        {criticalCount > 0 ? criticalCount : warningCount}
                      </span>
                    )}
                    {tasksTo && pendingTasks > 0 && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9,
                        padding: '1px 6px', borderRadius: 3,
                        background: urgentTasks > 0 ? 'var(--err-soft)' : 'var(--bg-surface-3)',
                        color: urgentTasks > 0 ? 'var(--err)' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}>
                        {pendingTasks}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Project switcher */}
        <ProjectSwitcher projectId={projectId} />

        {/* User + logout */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600,
            color: 'white', flexShrink: 0,
          }}>
            JR
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>Dr. Restrepo</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginTop: 2 }}>Construction PM</div>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            style={{
              width: 26, height: 26,
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--err-border)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--err)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            }}
          >
            <LogOut size={11} />
          </button>
        </div>
      </aside>

      {/* === MAIN === */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ background: 'var(--bg-base)' }}>
        {/* Spacer móvil */}
        <div className="md:hidden" style={{ height: 'calc(56px + env(safe-area-inset-top, 0))' }} />

        {/* TOPBAR */}
        <header
          className="hidden md:flex items-center justify-between flex-shrink-0"
          style={{
            height: 54,
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border)',
            padding: '0 28px',
            transition: 'background 0.35s, border-color 0.35s',
          }}
        >
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 300,
              letterSpacing: '-0.025em', color: 'var(--text-primary)', lineHeight: 1,
            }}>
              {title}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 8,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: 'var(--text-muted)', marginTop: 3,
            }}>
              {sub}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModuleSwitcher currentModule="tech" />
            <a
              href="/api/backup"
              download
              title="Backup del sistema"
              onClick={e => {
                e.preventDefault()
                downloadAuthed('/api/backup', `restrepoacosta-backup-${new Date().toISOString().slice(0, 10)}.zip`)
                  .catch(() => window.alert('Error al descargar el backup. Verifica tu sesión e intenta de nuevo.'))
              }}
              style={{
                width: 32, height: 32,
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'transparent', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.18s', textDecoration: 'none',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-strong)'
                ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'
              }}
            >
              <Download size={13} />
            </a>
          </div>
        </header>

        <CapacityBanner />
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 md:p-7 page-content">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
