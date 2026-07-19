import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import Splash from './components/Splash'
import { ConfirmProvider } from './components/ConfirmDialog'
import ModuleGate from './components/ModuleGate'
import { useQuery } from '@tanstack/react-query'
import { useProjectStore } from './store/projectStore'
import { projectsApi } from './lib/api'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Execution from './pages/Execution'
import Draws from './pages/Draws'
import Inspections from './pages/Inspections'
import Alerts from './pages/Alerts'
import Providers from './pages/Providers'
import Financial from './pages/Financial'
import Files from './pages/Files'
import Projects from './pages/Projects'
import Tasks from './pages/Tasks'
import ConstructionBudget from './pages/ConstructionBudget'
import PriceReference from './pages/PriceReference'
import TechImport from './pages/TechImport'
import PhasesDashboard from './pages/PhasesDashboard'
import GanttView from './pages/GanttView'
import Subcontracts from './pages/Subcontracts'
import ChangeOrders from './pages/ChangeOrders'
import PunchList from './pages/PunchList'
import Landing from './Landing'
import FinanceApp from './finance/FinanceApp'
import AdminApp from './admin/AdminApp'
import { useTheme } from './hooks/useTheme'

function TechModule() {
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
          <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>Sin proyecto activo</div>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          <Projects />
        </main>
      </div>
    )
  }

  return (
    <Layout projectId={activeProjectId}>
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
    </Layout>
  )
}

export default function App() {
  useTheme() // inicializa data-theme en <html> desde localStorage
  return (
    <>
      <Splash />
      <AuthGate>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/tech/*" element={
              <ModuleGate moduleName="tech" moduleLabel="Módulo Técnico">
                <TechModule />
              </ModuleGate>
            } />
            <Route path="/finance/*" element={
              <ModuleGate moduleName="finance" moduleLabel="Módulo Financiero">
                <FinanceApp />
              </ModuleGate>
            } />
            <Route path="/admin/*" element={
              <ModuleGate moduleName="admin" moduleLabel="Módulo Administrativo">
                <AdminApp />
              </ModuleGate>
            } />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </AuthGate>
    </>
  )
}
