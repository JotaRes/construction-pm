import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Movements from "./pages/Movements";
import MovementDetail from "./pages/MovementDetail";
import Capital from "./pages/Capital";
import Debt from "./pages/Debt";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import Catalogs from "./pages/Catalogs";
import Statements from "./pages/Statements";
import StatementDetail from "./pages/StatementDetail";
import Import from "./pages/Import";
import Reports from "./pages/Reports";

export default function FinanceApp() {
  return (
    <div className="fin-app">
      <Layout>
        <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="movements" element={<Movements />} />
        <Route path="movements/:id" element={<MovementDetail />} />
        <Route path="capital" element={<Capital />} />
        <Route path="debt" element={<Debt />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="accounts/:id" element={<AccountDetail />} />
        <Route path="catalogs" element={<Catalogs />} />
        <Route path="statements" element={<Statements />} />
        <Route path="statements/:id" element={<StatementDetail />} />
        <Route path="import" element={<Import />} />
        <Route path="reports" element={<Reports />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Layout>
    </div>
  );
}
