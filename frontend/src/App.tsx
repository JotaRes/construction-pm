import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import Splash from './components/Splash'
import { ConfirmProvider } from './components/ConfirmDialog'
import ModuleGate from './components/ModuleGate'
import { useQuery } from '@tanstack/react-query'
import { useProjectStore } from './store/projectStore'
import { projectsApi } from './lib/api'
import Layout from './components/layout/Layout'
import Landing from './Landing'
import { useTheme } from './hooks/useTheme'
import { I18nProvider, useI18n } from './i18n'

// ── CODE-SPLITTING ────────────────────────────────────────────────────────────
// Cada página y cada módulo se carga BAJO DEMANDA (dynamic import). Así el bundle
// inicial baja de ~1.3MB a solo lo necesario para la Landing + AuthGate: el
// arranque en móvil/red lenta es mucho más rápido y cada módulo (técnico,
// financiero, administrativo) descarga su código solo cuando el usuario entra.
// Recharts (vendor pesado) queda aislado en su propio chunk (ver vite.config.ts).
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Execution = lazy(() => import('./pages/Execution'))
const Draws = lazy(() => import('./pages/Draws'))
const Inspections = lazy(() => import('./pages/Inspections'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Providers = lazy(() => import('./pages/Providers'))
const Financial = lazy(() => import('./pages/Financial'))
const Files = lazy(() => import('./pages/Files'))
const Projects = lazy(() => import('./pages/Projects'))
const Tasks = lazy(() => import('./pages/Tasks'))
const ConstructionBudget = lazy(() => import('./pages/ConstructionBudget'))
const PriceReference = lazy(() => import('./pages/PriceReference'))
const TechImport = lazy(() => import('./pages/TechImport'))
const PhasesDashboard = lazy(() => import('./pages/PhasesDashboard'))
const GanttView = lazy(() => import('./pages/GanttView'))
const Subcontracts = lazy(() => import('./pages/Subcontracts'))
const ChangeOrders = lazy(() => import('./pages/ChangeOrders'))
const PunchList = lazy(() => import('./pages/PunchList'))
const FinanceApp = lazy(() => import('./finance/FinanceApp'))
const AdminApp = lazy(() => import('./admin/AdminApp'))

function TechModule() {
  const { t } = useI18n()
  const { activeProjectId, setActiveProjectId } = useProjectStore()

  const { data: projects = [], isLoading } = useQuery<Array<{ id: string }>>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id)
    }
  }, [projects, activeProjectId, setActiveProjectId])

  if (isLoading) return <Splash />

  if (!activeProjectId) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--brand-cream)' }}>
        <aside className="w-56 flex-shrink-0 flex items-center justify-center"
          style={{ background: 'var(--brand-teal)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('layout.noActiveProject')}</div>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          <Projects />
        </main>
      </div>
    )
  }

  return (
    <Layout projectId={activeProjectId}>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route path="projects" element={<Projects />} />
        <Route path="dashboard" element={<Dashboard projectId={activeProjectId} />} />
        <Route path="execution" element={<Execution projectId={activeProjectId} />} />
        <Route path="phases" element={<PhasesDashboard projectId={activeProjectId} />} />
        <Route path="gantt" element={<GanttView projectId={activeProjectId} />} />
        <Route path="subcontracts" element={<Subcontracts projectId={activeProjectId} />} />
        <Route path="change-orders" element={<ChangeOrders projectId={activeProjectId} />} />
        <Route path="punch-list" element={<PunchList projectId={activeProjectId} />} />
        {/* Presupuesto está UNIFICADO dentro de Ejecución (columna Presup. editable).
            Se mantiene la ruta vieja como redirección para no romper enlaces guardados. */}
        <Route path="budget" element={<Navigate to="/tech/execution" replace />} />
        <Route path="draws" element={<Draws projectId={activeProjectId} />} />
        <Route path="inspections" element={<Inspections projectId={activeProjectId} />} />
        <Route path="alerts" element={<Alerts projectId={activeProjectId} />} />
        <Route path="providers" element={<Providers projectId={activeProjectId} />} />
        <Route path="financial" element={<Financial projectId={activeProjectId} />} />
        <Route path="files" element={<Files projectId={activeProjectId} />} />
        <Route path="tasks" element={<Tasks projectId={activeProjectId} />} />
        <Route path="construction-budget" element={<ConstructionBudget projectId={activeProjectId} />} />
        <Route path="price-refs" element={<PriceReference />} />
        <Route path="import" element={<TechImport />} />
      </Routes>
      </Suspense>
    </Layout>
  )
}

// Fallback ligero mientras un chunk perezoso se descarga. Coherente con la
// paleta (marfil + petróleo); no bloquea toda la pantalla como el Splash.
function PageFallback() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div className="text-sm font-mono" style={{ color: 'var(--brand-teal, #33495C)', opacity: 0.6 }}>
        {t('common.loading')}
      </div>
    </div>
  )
}

// Las rutas viven en su propio componente porque necesitan `t()`, y `t()` solo
// existe DENTRO del <I18nProvider>. Los labels de los ModuleGate se traducen aquí.
function AppRoutes() {
  const { t } = useI18n()
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/tech/*" element={
        <ModuleGate moduleName="tech" moduleLabel={t('modules.techFull')}>
          <TechModule />
        </ModuleGate>
      } />
      <Route path="/finance/*" element={
        <ModuleGate moduleName="finance" moduleLabel={t('modules.financeFull')}>
          <FinanceApp />
        </ModuleGate>
      } />
      <Route path="/admin/*" element={
        <ModuleGate moduleName="admin" moduleLabel={t('modules.adminFull')}>
          <AdminApp />
        </ModuleGate>
      } />
    </Routes>
  )
}

export default function App() {
  useTheme() // inicializa data-theme en <html>
  // I18nProvider envuelve TODO —  incluido el AuthGate — para que la pantalla de
  // login también responda al idioma elegido.
  return (
    <I18nProvider>
      <Splash />
      <AuthGate>
        <ConfirmProvider>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <AppRoutes />
            </Suspense>
          </BrowserRouter>
        </ConfirmProvider>
      </AuthGate>
    </I18nProvider>
  )
}
