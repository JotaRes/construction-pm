import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import OrgChart from "./pages/OrgChart";
import CompanyDetail from "./pages/CompanyDetail";
import AdminTasks from "./pages/AdminTasks";
import AdminAlerts from "./pages/AdminAlerts";
import Persons from "./pages/Persons";
import PersonDetail from "./pages/PersonDetail";

export default function AdminApp() {
  return (
    <div className="fin-app admin-app">
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="orgchart" replace />} />
          <Route path="orgchart" element={<OrgChart />} />
          <Route path="companies/:id" element={<CompanyDetail />} />
          <Route path="persons" element={<Persons />} />
          <Route path="persons/:id" element={<PersonDetail />} />
          <Route path="tasks" element={<AdminTasks />} />
          <Route path="alerts" element={<AdminAlerts />} />
          <Route path="*" element={<Navigate to="orgchart" replace />} />
        </Routes>
      </Layout>
    </div>
  );
}
