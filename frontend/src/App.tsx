import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import { useQuery } from '@tanstack/react-query'
import { useProjectStore } from './store/projectStore'
import { projectsApi } from './lib/api'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Execution from './pages/Execution'
import Budget from './pages/Budget'
import Draws from './pages/Draws'
import Inspections from './pages/Inspections'
import Alerts from './pages/Alerts'
import Providers from './pages/Providers'
import Financial from './pages/Financial'
import Notes from './pages/Notes'
import Files from './pages/Files'
import Projects from './pages/Projects'
import Tasks from './pages/Tasks'
import ConstructionBudget from './pages/ConstructionBudget'
import PriceReference from './pages/PriceReference'
import TechImport from './pages/TechImport'
import Landing from './Landing'
import FinanceApp from './finance/FinanceApp'

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--brand-cream)' }}>
        <div className="text-sm font-mono animate-pulse" style={{ color: 'var(--brand-teal)' }}>Cargando sistema...</div>
      </div>
    )
  }

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
        <Route path="budget" element={<Budget projectId={activeProjectId} />} />
        <Route path="draws" element={<Draws projectId={activeProjectId} />} />
        <Route path="inspections" element={<Inspections projectId={activeProjectId} />} />
        <Route path="alerts" element={<Alerts projectId={activeProjectId} />} />
        <Route path="providers" element={<Providers projectId={activeProjectId} />} />
        <Route path="financial" element={<Financial projectId={activeProjectId} />} />
        <Route path="notes" element={<Notes projectId={activeProjectId} />} />
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
  return (
    <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/tech/*" element={<TechModule />} />
          <Route path="/finance/*" element={<FinanceApp />} />
        </Routes>
      </BrowserRouter>
    </AuthGate>
  )
}
