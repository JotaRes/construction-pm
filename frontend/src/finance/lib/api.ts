import axios from "axios";

// Prefijo /api/finance/* — el backend monta todas las rutas del módulo financiero bajo este prefijo.
const api = axios.create({ baseURL: "/api/finance" });

// Token unificado: misma clave que el módulo técnico (pm_auth_token).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pm_auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("pm_auth_token");
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

// Helpers que descomponen el envoltorio { data, error }
async function unwrap<T>(p: Promise<{ data: { data: T; error: string | null } }>): Promise<T> {
  const res = await p;
  if (res.data.error) throw new Error(res.data.error);
  return res.data.data;
}

export const API = {
  // Auth se gestiona por el AuthGate global del ecosistema — no se exponen endpoints aquí.

  // Catalogs
  getCatalogs: () => unwrap<any>(api.get("/catalogs")),
  createSPV: (data: any) => unwrap<any>(api.post("/catalogs/spvs", data)),
  updateSPV: (id: number, data: any) => unwrap<any>(api.patch(`/catalogs/spvs/${id}`, data)),
  deleteSPV: (id: number) => unwrap<any>(api.delete(`/catalogs/spvs/${id}`)),
  createAccount: (data: any) => unwrap<any>(api.post("/catalogs/accounts", data)),
  updateAccount: (id: number, data: any) => unwrap<any>(api.patch(`/catalogs/accounts/${id}`, data)),
  deleteAccount: (id: number) => unwrap<any>(api.delete(`/catalogs/accounts/${id}`)),
  createPartner: (data: any) => unwrap<any>(api.post("/catalogs/partners", data)),
  updatePartner: (id: number, data: any) => unwrap<any>(api.patch(`/catalogs/partners/${id}`, data)),
  deletePartner: (id: number) => unwrap<any>(api.delete(`/catalogs/partners/${id}`)),
  createLender: (data: any) => unwrap<any>(api.post("/catalogs/lenders", data)),
  updateLender: (id: number, data: any) => unwrap<any>(api.patch(`/catalogs/lenders/${id}`, data)),
  deleteLender: (id: number) => unwrap<any>(api.delete(`/catalogs/lenders/${id}`)),
  createProvider: (data: any) => unwrap<any>(api.post("/catalogs/providers", data)),
  updateProvider: (id: number, data: any) => unwrap<any>(api.patch(`/catalogs/providers/${id}`, data)),
  deleteProvider: (id: number) => unwrap<any>(api.delete(`/catalogs/providers/${id}`)),
  createCategory: (data: any) => unwrap<any>(api.post("/catalogs/categories", data)),
  updateCategory: (id: number, data: any) => unwrap<any>(api.patch(`/catalogs/categories/${id}`, data)),
  deleteCategory: (id: number) => unwrap<any>(api.delete(`/catalogs/categories/${id}`)),
  createOrigin: (data: any) => unwrap<any>(api.post("/catalogs/origins", data)),
  updateOrigin: (id: number, data: any) => unwrap<any>(api.patch(`/catalogs/origins/${id}`, data)),
  deleteOrigin: (id: number) => unwrap<any>(api.delete(`/catalogs/origins/${id}`)),

  // Projects
  getProjects: () => unwrap<any[]>(api.get("/projects")),
  getProject: (id: number) => unwrap<any>(api.get(`/projects/${id}`)),
  getProjectSummary: (id: number) => unwrap<any>(api.get(`/projects/${id}/summary`)),
  createProject: (data: any) => unwrap<any>(api.post("/projects", data)),
  updateProject: (id: number, data: any) => unwrap<any>(api.patch(`/projects/${id}`, data)),
  deleteProject: (id: number) => unwrap<any>(api.delete(`/projects/${id}`)),

  // Movements
  listMovements: (params: Record<string, any> = {}) =>
    unwrap<{ movements: any[]; total: number }>(api.get("/movements", { params })),
  getMovement: (id: number) => unwrap<any>(api.get(`/movements/${id}`)),
  createMovement: (data: any) => unwrap<any>(api.post("/movements", data)),
  updateMovement: (id: number, data: any) => unwrap<any>(api.patch(`/movements/${id}`, data)),
  deleteMovement: (id: number) => unwrap<any>(api.delete(`/movements/${id}`)),
  detectIntercompany: () => unwrap<any>(api.post("/movements/detect-intercompany")),
  linkMovements: (a: number, b: number) => unwrap<any>(api.post(`/movements/${a}/link/${b}`)),
  unlinkMovement: (id: number) => unwrap<any>(api.post(`/movements/${id}/unlink`)),

  // Accounts (con saldos calculados)
  getAccounts: () => unwrap<any[]>(api.get("/accounts")),
  getAccountDetail: (id: number) => unwrap<any>(api.get(`/accounts/${id}`)),
  getAccountReconciliation: (id: number) => unwrap<any>(api.get(`/accounts/${id}/reconciliation`)),
  updateAccountBalances: (id: number, data: any) => unwrap<any>(api.patch(`/accounts/${id}`, data)),
  uploadStatementToAccount: (accountId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("accountId", String(accountId));
    return unwrap<any>(api.post("/statements/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }));
  },

  // Capital
  getCapital: () => unwrap<any>(api.get("/capital")),
  createContribution: (data: any) => unwrap<any>(api.post("/capital/contributions", data)),
  updateContribution: (id: number, data: any) => unwrap<any>(api.patch(`/capital/contributions/${id}`, data)),
  deleteContribution: (id: number) => unwrap<any>(api.delete(`/capital/contributions/${id}`)),
  createNonBank: (data: any) => unwrap<any>(api.post("/capital/non-bank", data)),
  updateNonBank: (id: number, data: any) => unwrap<any>(api.patch(`/capital/non-bank/${id}`, data)),
  deleteNonBank: (id: number) => unwrap<any>(api.delete(`/capital/non-bank/${id}`)),

  // Loans
  getLoans: () => unwrap<any[]>(api.get("/loans")),
  createLoan: (data: any) => unwrap<any>(api.post("/loans", data)),
  updateLoan: (id: number, data: any) => unwrap<any>(api.patch(`/loans/${id}`, data)),
  deleteLoan: (id: number) => unwrap<any>(api.delete(`/loans/${id}`)),

  // Dashboard
  getDashboard: () => unwrap<any>(api.get("/dashboard")),

  // Statements
  listStatements: () => unwrap<any[]>(api.get("/statements")),
  getStatement: (id: number) => unwrap<any>(api.get(`/statements/${id}`)),
  uploadStatement: (accountId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("accountId", String(accountId));
    return unwrap<any>(api.post("/statements/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }));
  },
  reconcileStatement: (id: number) => unwrap<any>(api.post(`/statements/${id}/reconcile`)),
  matchLine: (lineId: number, movementId: number) =>
    unwrap<any>(api.post(`/statements/lines/${lineId}/match/${movementId}`)),
  createMovementFromLine: (lineId: number) =>
    unwrap<any>(api.post(`/statements/lines/${lineId}/create-movement`)),
  deleteStatement: (id: number) => unwrap<any>(api.delete(`/statements/${id}`)),
  // Líneas de extracto sin reconciliar — alimentan alertas "rojas" en MOVIMIENTOS
  getUnreconciledLines: (accountId?: number) =>
    unwrap<any[]>(api.get("/statements/unreconciled-lines/all", { params: accountId ? { accountId } : {} })),

  // Documents
  uploadMovementDoc: (movementId: number, file: File, kind?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (kind) fd.append("kind", kind);
    return unwrap<any>(api.post(`/documents/movements/${movementId}/documents`, fd));
  },
  deleteMovementDoc: (movementId: number, docId: number) =>
    unwrap<any>(api.delete(`/documents/movements/${movementId}/documents/${docId}`)),
  uploadProjectDoc: (projectId: number, file: File, kind?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (kind) fd.append("kind", kind);
    return unwrap<any>(api.post(`/documents/projects/${projectId}/documents`, fd));
  },

  // Imports
  importExcel: (file: File, wipe = false) => {
    const fd = new FormData();
    fd.append("file", file);
    if (wipe) fd.append("wipe", "true");
    return unwrap<any>(api.post("/imports/excel", fd));
  },
  importExcelFromDisk: (wipe = false) => unwrap<any>(api.post("/imports/excel-from-disk", { wipe })),
  clearAllData: () => unwrap<any>(api.delete("/imports/clear-all")),

  // Reports
  getSourcesUses: () => unwrap<any>(api.get("/reports/sources-uses")),
  getCashflow: (year?: number) => unwrap<any>(api.get("/reports/cashflow", { params: { year } })),
  getCashflowForecast: () => unwrap<any>(api.get("/reports/cashflow-forecast")),
  getInsights: () => unwrap<any>(api.get("/reports/insights")),
  getProjectRatios: () => unwrap<any>(api.get("/reports/project-ratios")),
  getAuditLog: (limit?: number) => unwrap<any[]>(api.get("/reports/audit-log", { params: { limit } })),
  getTraceability: (movementId: number) => unwrap<any>(api.get(`/reports/traceability/${movementId}`)),

  // Análisis V2 (cashflow consolidado, liquidez 90d, retornos por proyecto)
  getCashflowV2: (groupBy: "week" | "month" = "month", months = 12) =>
    unwrap<any[]>(api.get("/cashflow", { params: { groupBy, months } })),
  getLiquidityProjection: () => unwrap<any>(api.get("/liquidity-projection")),
  getProjectReturns: () => unwrap<any[]>(api.get("/project-returns")),

  // Backup
  backupUrl: () => `/api/finance/backup`,
  excelExportUrl: () => `/api/finance/backup/excel`,
  wipeAllData: (password: string) =>
    unwrap<any>(api.delete("/backup/wipe-all", { headers: { "X-Wipe-Password": password } })),
  restoreFromFile: (file: File, password: string) => {
    const fd = new FormData();
    fd.append("file", file);
    return unwrap<any>(api.post("/imports/restore", fd, {
      headers: { "Content-Type": "multipart/form-data", "X-Restore-Password": password },
    }));
  },
};

export default api;
