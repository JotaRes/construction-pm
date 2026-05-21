import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const projectsApi = {
  list: () => api.get('/projects').then(r => r.data.data),
  get: (id: string) => api.get(`/projects/${id}`).then(r => r.data.data),
  dashboard: (id: string) => api.get(`/projects/${id}/dashboard`).then(r => r.data.data),
  create: (data: Record<string, unknown>) => api.post('/projects', data).then(r => r.data.data),
  patch: (id: string, data: Record<string, unknown>) => api.patch(`/projects/${id}`, data).then(r => r.data.data),
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
  delete: (projectId: string, id: string) => api.delete(`/projects/${projectId}/files/${id}`).then(r => r.data.data),
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

export const drawParseApi = {
  parsePdf: (projectId: string, file: File) => {
    const fd = new FormData()
    fd.append('pdf', file)
    return api.post(`/projects/${projectId}/draws/parse-pdf`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
}

export const docParseApi = {
  parsePdf: (projectId: string, file: File, type = 'HUD') => {
    const fd = new FormData()
    fd.append('pdf', file)
    return api.post(`/projects/${projectId}/docs/parse-pdf?type=${type}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data)
  },
}

// Sincronización tech → finance (carta de aprobación crea/actualiza préstamo financiero)
export const financeSyncApi = {
  upsertLoanFromTech: (data: {
    lender: string
    loanNumber?: string
    loanAmount: number
    interestRate?: number
    loanTermMonths?: number
    settlementDate?: string
    day1Disbursement?: number
    holdback?: number
    interestReserve?: number
    techProjectName?: string
  }) =>
    api.post('/finance/loans/upsert-from-tech', data).then(r => r.data.data),
}
