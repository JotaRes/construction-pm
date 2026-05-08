import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, CheckSquare, DollarSign, TrendingUp,
  AlertTriangle, Users, FileText, Folder, Search, BarChart3, Building2,
  ChevronDown, FolderKanban, ListChecks, FileSpreadsheet, Tag, LogOut
} from 'lucide-react'
import { alertsApi, projectsApi } from '../../lib/api'
import { logout } from '../AuthGate'
import { useProjectStore } from '../../store/projectStore'
import type { Alert, Task } from '../../lib/types'
import { tasksApi } from '../../lib/api'
import { useState, useRef, useEffect } from 'react'

const navItems = [
  { to: '/projects',   icon: FolderKanban,    label: 'Proyectos' },
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/execution',  icon: CheckSquare,     label: 'Ejecución' },
  { to: '/budget',     icon: DollarSign,      label: 'Presupuesto' },
  { to: '/construction-budget', icon: FileSpreadsheet, label: 'Const. Budget' },
  { to: '/draws',      icon: TrendingUp,      label: 'Draws' },
  { to: '/inspections',icon: Search,          label: 'Inspecciones' },
  { to: '/financial',  icon: BarChart3,       label: 'Financiero' },
  { to: '/alerts',     icon: AlertTriangle,   label: 'Alertas' },
  { to: '/tasks',      icon: ListChecks,      label: 'Tareas' },
  { to: '/providers',  icon: Users,           label: 'Proveedores' },
  { to: '/notes',      icon: FileText,        label: 'Notas' },
  { to: '/files',      icon: Folder,          label: 'Archivos' },
  { to: '/price-refs', icon: Tag,             label: 'Precios Ref.' },
]

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
    navigate('/dashboard')
  }

  return (
    <div ref={ref} className="relative px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="text-[9px] font-mono uppercase tracking-wider mb-1.5 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Proyecto activo
      </div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group"
        style={{ ':hover': {} } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(200,146,42,0.25)' }}>
          <Building2 className="w-3.5 h-3.5" style={{ color: '#C8922A' }} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs font-semibold truncate leading-tight text-white">
            {current?.name ?? '—'}
          </div>
          <div className="text-[10px] font-mono truncate leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {current?.spv ?? ''}
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'rgba(255,255,255,0.35)' }} />
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl shadow-2xl overflow-hidden z-50"
          style={{ background: '#1E3338', border: '1px solid rgba(255,255,255,0.1)' }}>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className="w-full px-3 py-2.5 text-left transition-colors flex items-center gap-2"
              style={{ background: p.id === projectId ? 'rgba(200,146,42,0.15)' : 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = p.id === projectId ? 'rgba(200,146,42,0.15)' : 'transparent')}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: p.id === projectId ? '#C8922A' : 'rgba(255,255,255,0.2)' }} />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">{p.name}</div>
                <div className="text-[10px] font-mono truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.spv}</div>
              </div>
            </button>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => { setOpen(false); navigate('/projects') }}
              className="w-full px-3 py-2 text-left text-[11px] transition-colors"
              style={{ color: '#C8922A' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              + Nuevo proyecto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Layout({ projectId, children }: Props) {
  useLocation()

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
  const warningCount = alerts.filter(a => a.level === 'warning').length
  const urgentTasks = tasks.filter(t => !t.done && t.priority === 'URGENT').length
  const pendingTasks = tasks.filter(t => !t.done).length

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--brand-cream)' }}>
      {/* Sidebar — brand teal */}
      <aside className="w-56 flex-shrink-0 flex flex-col shadow-xl"
        style={{ background: 'var(--brand-teal)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Logo */}
        <div className="px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {/* RA badge */}
          <div className="flex items-center justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #C8922A 0%, #E0AD4F 100%)', boxShadow: '0 4px 16px rgba(200,146,42,0.5)' }}>
              <span style={{ color: 'white', fontWeight: 900, fontSize: 22, letterSpacing: '-1px', fontFamily: 'Georgia, serif', lineHeight: 1 }}>RA</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-white leading-tight tracking-wide">Restrepo Acosta</div>
            <div className="text-[11px] font-semibold leading-tight mt-0.5" style={{ color: '#C8922A' }}>
              Global Holding LLC
            </div>
            <div className="text-[9px] mt-1 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Construction PM
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isAlerts = to === '/alerts'
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-all relative
                  ${isActive ? 'text-white' : ''}`
                }
                style={({ isActive }) => isActive
                  ? { background: 'rgba(200,146,42,0.18)', borderRight: '2px solid #C8922A', color: 'white' }
                  : { color: 'rgba(255,255,255,0.55)' }
                }
                onMouseEnter={e => {
                  const el = e.currentTarget
                  if (!el.getAttribute('aria-current')) el.style.background = 'rgba(255,255,255,0.07)'
                  el.style.color = 'white'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  if (!el.getAttribute('aria-current')) {
                    el.style.background = 'transparent'
                    el.style.color = 'rgba(255,255,255,0.55)'
                  }
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
                {isAlerts && (criticalCount > 0 || warningCount > 0) && (
                  <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full badge-urgent
                    ${criticalCount > 0 ? 'bg-red-500/30 text-red-300' : 'bg-amber-500/30 text-amber-300'}`}>
                    {criticalCount > 0 ? criticalCount : warningCount}
                  </span>
                )}
                {to === '/tasks' && pendingTasks > 0 && (
                  <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full
                    ${urgentTasks > 0 ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white/50'}`}>
                    {pendingTasks}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Project switcher */}
        <ProjectSwitcher projectId={projectId} />

        {/* Logout */}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2.5 w-full text-xs font-medium transition-all"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
            e.currentTarget.style.color = '#fca5a5'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
          }}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--brand-cream)' }}>
        <div className="p-6 page-content">
          {children}
        </div>
      </main>
    </div>
  )
}
