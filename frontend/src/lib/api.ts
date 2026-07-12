import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Token unificado: misma clave que el módulo financiero (pm_auth_token).
// Sin este interceptor, todas las rutas /api/* del módulo técnico darían 401
// ahora que el backend exige autenticación global.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pm_auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si el token expira o es inválido, limpiar sesión y volver a la landing/login.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pm_auth_token')
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

// Descarga autenticada vía blob: para endpoints protegidos (/api/backup,
// /api/backup/excel-tech, etc.) que NO pueden viajar por <a href> porque el
// navegador no adjunta el header Authorization en una navegación normal.
export async function downloadAuthed(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem('pm_auth_token')
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objUrl)
}

export const projectsApi = {
  list: () => api.get('/projects').then(r => r.data.data),
  get: (id: string) => api.get(`/projects/${id}`).then(r => r.data.data),
  dashboard: (id: string) => api.get(`/projects/${id}/dashboard`).then(r => r.data.data),
  create: (data: Record<string, unknown>) => api.post('/projects', data).then(r => r.data.data),
  patch: (id: string, data: Record<string, unknown>) => api.patch(`/projects/${id}`, data).then(r => r.data.data),
  resetExecution: (id: string) => api.post(`/projects/${id}/reset-execution`).then(r => r.data.data),
  resetBudget: (id: string) => api.post(`/projects/${id}/reset-budget`).then(r => r.data.data),
  resetConstructionBudget: (id: string) => api.post(`/projects/${id}/reset-construction-budget`).then(r => r.data.data),
  resetDrawsSection: (id: string) => api.post(`/projects/${id}/reset-draws-section`).then(r => r.data.data),
  parseHud: (file: File) => {
    const fd = new FormData()
    fd.append('pdf', file)
    return api.post('/projects/parse-hud', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
}

export const phasesApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/phases`).then(r => r.data.data),
  summary: (projectId: string): Promise<PhaseSummary[]> =>
    api.get(`/projects/${projectId}/phases-summary`).then(r => r.data.data),
}

export interface PhaseSummary {
  id: string
  code: string
  name: string
  groupName: string
  order: number
  totalItems: number
  completedItems: number
  progressPct: number
  budgetTotal: number
  approvedTotal: number
  paidTotal: number
  variancePct: number
  startDateReal: string | null
  endDateReal: string | null
  status: 'COMPLETA' | 'EN_CURSO' | 'PENDIENTE'
}

export const itemsApi = {
  create: (data: Record<string, unknown>) => api.post('/items', data).then(r => r.data.data),
  patch: (id: string, data: Record<string, unknown>) => api.patch(`/items/${id}`, data).then(r => r.data.data),
  delete: (id: string) => api.delete(`/items/${id}`).then(r => r.data.data),
}

export const drawsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/draws`).then(r => r.data.data),
  create: (projectId: string) => api.post(`/projects/${projectId}/draws`).then(r => r.data.data),
  patch: (id: string, data: Record<string, unknown>) => api.patch(`/draws/${id}`, data).then(r => r.data.data),
  uploadDoc: (drawId: string, file: File, kind: 'INVOICE' | 'APPROVAL' | 'EXCEL') => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    // Return the full envelope so callers can read extracted/parsedDrawNumber/budgetUpdate.
    return api.post(`/draws/${drawId}/document`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data as {
        data: unknown
        extracted?: Record<string, unknown>
        parsedDrawNumber?: number | null
        budgetUpdate?: BudgetUpdateResult | null
        error: string | null
      })
  },
  deleteDoc: (drawId: string, kind: 'INVOICE' | 'APPROVAL' | 'EXCEL') =>
    api.delete(`/draws/${drawId}/document/${kind}`).then(r => r.data.data),
  deleteDraw: (drawId: string) =>
    api.delete(`/draws/${drawId}`).then(r => r.data.data),
  // Excel general del lender (nivel proyecto) — complementa y valida los PDF por draw.
  validation: (projectId: string) =>
    api.get(`/projects/${projectId}/draws/validation`).then(r => r.data.data as DrawsValidation),
  uploadLenderExcel: (projectId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post(`/projects/${projectId}/draws/lender-excel`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data as { data: DrawsValidation; extractionError?: string | null; error: string | null })
  },
  deleteLenderExcel: (projectId: string) =>
    api.delete(`/projects/${projectId}/draws/lender-excel`).then(r => r.data.data as DrawsValidation),
  // Reparación one-time: convierte contribuciones ACUMULADAS por ítem a DELTAS reales.
  repairCumulative: (projectId: string) =>
    api.post(`/projects/${projectId}/draws/repair-cumulative`).then(r => r.data.data as { linesFixed: number; contribsFixed: number; totalAprobado: number }),
}

export interface DrawsValidation {
  file: { url: string | null; name: string | null }
  system: {
    holdback: number; totalWired: number; totalElegible: number
    budgetTotal: number; totalApproved: number; saldoHoldback: number; pendientePorGirar: number
  }
  mode: 'ACUMULADO' | 'INCREMENTAL'
  perDraw: Record<string, number>
  excel: Record<string, unknown> | null
  comparison: Record<string, { excel: number; sistema: number; difiere: boolean }>
  warnings: string[]
}

export const providersApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/providers`).then(r => r.data.data),
  create: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/providers`, data).then(r => r.data.data),
  patch: (projectId: string, id: string, data: Record<string, unknown>) => api.patch(`/projects/${projectId}/providers/${id}`, data).then(r => r.data.data),
  delete: (projectId: string, id: string) => api.delete(`/projects/${projectId}/providers/${id}`).then(r => r.data.data),
}

export const providerQuotesApi = {
  create: (projectId: string, providerId: string, formData: FormData) =>
    api.post(`/projects/${projectId}/providers/${providerId}/quotes`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data),
  delete: (projectId: string, providerId: string, quoteId: string) =>
    api.delete(`/projects/${projectId}/providers/${providerId}/quotes/${quoteId}`).then(r => r.data.data),
}

export const providerDocumentsApi = {
  list: (projectId: string, providerId: string) =>
    api.get(`/projects/${projectId}/providers/${providerId}/documents`).then(r => r.data.data),
  create: (projectId: string, providerId: string, formData: FormData) =>
    api.post(`/projects/${projectId}/providers/${providerId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data),
  patch: (projectId: string, providerId: string, docId: string, data: Record<string, unknown>) =>
    api.patch(`/projects/${projectId}/providers/${providerId}/documents/${docId}`, data).then(r => r.data.data),
  delete: (projectId: string, providerId: string, docId: string) =>
    api.delete(`/projects/${projectId}/providers/${providerId}/documents/${docId}`).then(r => r.data.data),
}

export const budgetInitApi = {
  init: (projectId: string) => api.post(`/projects/${projectId}/construction-budget/init`).then(r => r.data.data),
  parsePdf: (projectId: string, file: File) => {
    const fd = new FormData()
    fd.append('pdf', file)
    return api.post(`/projects/${projectId}/construction-budget/parse-pdf`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
}

export const inspectionsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/inspections`).then(r => r.data.data),
  patch: (projectId: string, id: string, data: Record<string, unknown>) => api.patch(`/projects/${projectId}/inspections/${id}`, data).then(r => r.data.data),
}

export const notesApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/notes`).then(r => r.data.data),
  create: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/notes`, data).then(r => r.data.data),
  patch: (projectId: string, id: string, data: Record<string, unknown>) => api.patch(`/projects/${projectId}/notes/${id}`, data).then(r => r.data.data),
  delete: (projectId: string, id: string) => api.delete(`/projects/${projectId}/notes/${id}`).then(r => r.data.data),
}

export const filesApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/files`).then(r => r.data.data),
  create: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/files`, data).then(r => r.data.data),
  upload: (projectId: string, file: File, kind?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (kind) fd.append('kind', kind)
    return api.post(`/projects/${projectId}/files/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
  patch: (projectId: string, id: string, data: Record<string, unknown>) => api.patch(`/projects/${projectId}/files/${id}`, data).then(r => r.data.data),
  delete: (projectId: string, id: string) => api.delete(`/projects/${projectId}/files/${id}`).then(r => r.data.data),
  getChecklist: (projectId: string) => api.get(`/projects/${projectId}/document-checklist`).then(r => r.data.data),
}

// Tech backup/import — paralelo al financiero
export const techBackupApi = {
  downloadUrl: () => `/api/backup`,
  excelExportUrl: () => `/api/backup/excel-tech`,
  restoreFromFile: (file: File, password: string) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/backup/restore-tech', fd, {
      headers: { 'Content-Type': 'multipart/form-data', 'X-Restore-Password': password },
    }).then(r => r.data.data)
  },
  wipeAll: (password: string) =>
    api.delete('/backup/wipe-tech', { headers: { 'X-Wipe-Password': password } }).then(r => r.data.data),
}

export const constructionBudgetApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/construction-budget`).then(r => r.data.data),
  patch: (projectId: string, id: string, data: Record<string, unknown>) =>
    api.patch(`/projects/${projectId}/construction-budget/${id}`, data).then(r => r.data.data),
  // Importa el construction budget extrayendo items reales del PDF.
  // Usa el cliente `api` (con interceptor de token) — NO axios crudo, que daba 401
  // ahora que /api/* exige autenticación global.
  importFromPdf: (projectId: string, file: File) => {
    const fd = new FormData()
    fd.append('pdf', file)
    return api.post(`/projects/${projectId}/construction-budget/import-from-pdf`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
}

export const alertsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/alerts`).then(r => r.data.data),
  upcoming: (projectId: string): Promise<UpcomingAlert[]> =>
    api.get(`/projects/${projectId}/upcoming`).then(r => r.data.data),
}

export interface UpcomingAlert {
  type: 'INSPECCION' | 'PERMISO' | 'TAREA'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  title: string
  description: string
  date: string | null
}

// === Subcontratistas: contratos + calendario de pagos por hito ===
export interface SubPayment {
  id: string
  contractId: string
  milestoneDesc: string
  amount: number
  dueDate: string | null
  paidDate: string | null
  status: 'PENDIENTE' | 'PAGADO' | 'RETENIDO'
  notes: string | null
}

export interface SubContract {
  id: string
  providerId: string
  projectId: string
  contractValue: number
  scopeDetails: string | null
  startDate: string | null
  endDate: string | null
  status: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO'
  contractUrl: string | null
  contractName: string | null
  notes: string | null
  provider: { id: string; name: string; type: string | null; phone: string | null }
  paymentSchedule: SubPayment[]
  createdAt: string
}

export const subcontractsApi = {
  list: (projectId: string): Promise<SubContract[]> =>
    api.get(`/subcontracts/project/${projectId}`).then(r => r.data.data),
  create: (data: Record<string, unknown>) =>
    api.post('/subcontracts', data).then(r => r.data.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/subcontracts/${id}`, data).then(r => r.data.data),
  remove: (id: string) =>
    api.delete(`/subcontracts/${id}`).then(r => r.data.data),
  addPayment: (contractId: string, data: Record<string, unknown>) =>
    api.post(`/subcontracts/${contractId}/payments`, data).then(r => r.data.data),
  pay: (paymentId: string) =>
    api.patch(`/subcontracts/payments/${paymentId}/pay`).then(r => r.data.data),
  removePayment: (paymentId: string) =>
    api.delete(`/subcontracts/payments/${paymentId}`).then(r => r.data.data),
}

export interface ExecutiveSummary {
  project: { name: string; address: string | null; lender: string | null; spv: string | null }
  tech: {
    globalProgress: number
    activePhase: { code: string; name: string } | null
    totalBudget: number
    totalPaid: number
    budgetVariancePct: number
    draws: { total: number; totalFunded: number; latest: { number: number; status: string; amount: number } | null }
    loanAmount: number
    upbPost: number
    remainingLoanBalance: number
    pendingInspections: number
    overdueTasks: number
  }
  finance: {
    consolidatedCash: number
    totalIngresos: number
    totalEgresos: number
    netFlow: number
    accounts: Array<{ name: string; code: string; balance: number }>
  }
}

export const executiveApi = {
  summary: (projectId: string): Promise<ExecutiveSummary> =>
    api.get(`/projects/${projectId}/executive-summary`).then(r => r.data.data),
}

export interface PortfolioProject {
  id: string
  name: string
  address: string | null
  spv: string | null
  lender: string | null
  progress: number
  activePhase: { code: string; name: string } | null
  totalBudget: number
  totalPaid: number
  totalItems: number
  loanAmount: number
  totalFunded: number
  remainingLoan: number
  latestDraw: { number: number; status: string } | null
  pendingInspections: number
  overdueTasks: number
}

export interface PortfolioSummary {
  portfolio: {
    projectCount: number
    weightedProgress: number
    totalBudget: number
    totalPaid: number
    totalLoan: number
    totalFunded: number
    totalRemainingLoan: number
    pendingInspections: number
    overdueTasks: number
    budgetVariancePct: number
    projects: PortfolioProject[]
  }
  finance: {
    consolidatedCash: number
    totalIngresos: number
    totalEgresos: number
    netFlow: number
    accounts: Array<{ name: string; code: string; balance: number }>
  }
}

export const portfolioApi = {
  executive: (): Promise<PortfolioSummary> =>
    api.get('/portfolio/executive-summary').then(r => r.data.data),
}

export const tasksApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/tasks`).then(r => r.data.data),
  create: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/tasks`, data).then(r => r.data.data),
  patch: (projectId: string, id: string, data: Record<string, unknown>) => api.patch(`/projects/${projectId}/tasks/${id}`, data).then(r => r.data.data),
  delete: (projectId: string, id: string) => api.delete(`/projects/${projectId}/tasks/${id}`).then(r => r.data.data),
}

export const projectsDeleteApi = {
  delete: (id: string) => api.delete(`/projects/${id}`).then(r => r.data.data),
}

export const priceRefsApi = {
  list: () => api.get('/price-refs').then(r => r.data.data),
  computed: () => api.get('/price-refs/computed').then(r => r.data.data as ComputedPriceRefs),
  create: (data: Record<string, unknown>) => api.post('/price-refs', data).then(r => r.data.data),
  patch: (id: string, data: Record<string, unknown>) => api.patch(`/price-refs/${id}`, data).then(r => r.data.data),
  delete: (id: string) => api.delete(`/price-refs/${id}`).then(r => r.data.data),
}

export interface ComputedPriceActivity {
  unit: string; category: string; activity: string; count: number
  avgCost: number; minCost: number; maxCost: number
  qtyCount: number; avgUnitPrice: number | null; minUnitPrice: number | null; maxUnitPrice: number | null
}
export interface ComputedPriceRefs {
  byActivity: ComputedPriceActivity[]
  byUnit: { unit: string; count: number; avgCost: number; avgUnitPrice: number | null }[]
  totalRecords: number
}

export const itemDocumentsApi = {
  list: (itemId: string) => api.get(`/items/${itemId}/documents`).then(r => r.data.data),
  create: (itemId: string, formData: FormData) =>
    api.post(`/items/${itemId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data),
  delete: (itemId: string, docId: string) => api.delete(`/items/${itemId}/documents/${docId}`).then(r => r.data.data),
}

export interface DrawLineApproval {
  itemCode: string
  description: string
  priorAmount: number
  thisInspectionPct: number
  currentAmountAvailable: number
  deltaThisDraw: number
}

export interface BudgetUpdateResult {
  matched: number
  newlyApprovedItems: number
  newlyApprovedAmount: number
  cumulativeApproved: number
  unmatched: string[]
}

export const drawParseApi = {
  parsePdf: (projectId: string, file: File) => {
    const fd = new FormData()
    fd.append('pdf', file)
    return api.post(`/projects/${projectId}/draws/parse-pdf`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
  // Apply previously-parsed Trinity approvals to the project's construction budget.
  // drawId es obligatorio: el backend guarda contribuciones por draw para poder
  // revertirlas si el draw se borra.
  applyApprovals: (projectId: string, drawId: string, approvals: DrawLineApproval[]) =>
    api.post(`/projects/${projectId}/draws/apply-approvals`, { drawId, approvals })
      .then(r => r.data.data as BudgetUpdateResult),
  // Saneo: recompute valorAprobado del proyecto desde contribuciones vivas
  // (limpia datos legacy sin contrib registrada).
  rebuildBudget: (projectId: string) =>
    api.post(`/projects/${projectId}/budget/rebuild-from-contributions`)
      .then(r => r.data.data as { lines: number; totalAprobado: number }),
  // Saneo profundo: re-descarga cada APPROVAL PDF, lo re-parsea y reconstruye
  // contribuciones desde cero. Útil para repoblar trazabilidad de datos legacy.
  rebuildContributions: (projectId: string) =>
    api.post(`/projects/${projectId}/draws/rebuild-contributions`)
      .then(r => r.data.data as {
        drawsProcessed: number
        totalAprobado: number
        report: Array<{ drawNumber: number; matched: number; newlyApprovedItems: number; newlyApprovedAmount: number; error?: string }>
      }),
}

export const docParseApi = {
  parsePdf: (projectId: string, file: File, type = 'HUD') => {
    const fd = new FormData()
    fd.append('pdf', file)
    return api.post(`/projects/${projectId}/docs/parse-pdf?type=${type}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
}

export interface SystemCapacity {
  totalBytes: number
  totalDocs: number
  limitBytes: number
  pct: number
  level: 'ok' | 'warning' | 'critical'
  breakdown: Record<string, { count: number; bytes: number; estimated?: boolean }>
}

export const systemApi = {
  capacity: (): Promise<SystemCapacity> => api.get('/system/capacity').then(r => r.data.data),
}
