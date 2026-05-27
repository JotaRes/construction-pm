import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const projectsApi = {
  list: () => api.get('/projects').then(r => r.data.data),
  get: (id: string) => api.get(`/projects/${id}`).then(r => r.data.data),
  dashboard: (id: string) => api.get(`/projects/${id}/dashboard`).then(r => r.data.data),
  create: (data: Record<string, unknown>) => api.post('/projects', data).then(r => r.data.data),
  patch: (id: string, data: Record<string, unknown>) => api.patch(`/projects/${id}`, data).then(r => r.data.data),
  resetExecution: (id: string) => api.post(`/projects/${id}/reset-execution`).then(r => r.data.data),
  resetBudget: (id: string) => api.post(`/projects/${id}/reset-budget`).then(r => r.data.data),
  resetConstructionBudget: (id: string) => api.post(`/projects/${id}/reset-construction-budget`).then(r => r.data.data),
  parseHud: (file: File) => {
    const fd = new FormData()
    fd.append('pdf', file)
    return api.post('/projects/parse-hud', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
}

export const phasesApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/phases`).then(r => r.data.data),
}

export const itemsApi = {
  create: (data: Record<string, unknown>) => api.post('/items', data).then(r => r.data.data),
  patch: (id: string, data: Record<string, unknown>) => api.patch(`/items/${id}`, data).then(r => r.data.data),
  delete: (id: string) => api.delete(`/items/${id}`).then(r => r.data.data),
}

export const drawsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/draws`).then(r => r.data.data),
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
        budgetUpdate?: { matched: number; updated: number; unmatched: string[] } | null
        error: string | null
      })
  },
  deleteDoc: (drawId: string, kind: 'INVOICE' | 'APPROVAL' | 'EXCEL') =>
    api.delete(`/draws/${drawId}/document/${kind}`).then(r => r.data.data),
  deleteDraw: (drawId: string) =>
    api.delete(`/draws/${drawId}`).then(r => r.data.data),
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
}

export const alertsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/alerts`).then(r => r.data.data),
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
  create: (data: Record<string, unknown>) => api.post('/price-refs', data).then(r => r.data.data),
  patch: (id: string, data: Record<string, unknown>) => api.patch(`/price-refs/${id}`, data).then(r => r.data.data),
  delete: (id: string) => api.delete(`/price-refs/${id}`).then(r => r.data.data),
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
  thisInspectionPct: number
  currentAmountAvailable: number
}

export const drawParseApi = {
  parsePdf: (projectId: string, file: File) => {
    const fd = new FormData()
    fd.append('pdf', file)
    return api.post(`/projects/${projectId}/draws/parse-pdf`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
  // Apply previously-parsed Trinity approvals to the project's construction budget.
  applyApprovals: (projectId: string, approvals: DrawLineApproval[]) =>
    api.post(`/projects/${projectId}/draws/apply-approvals`, { approvals })
      .then(r => r.data.data as { matched: number; updated: number; unmatched: string[] }),
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
