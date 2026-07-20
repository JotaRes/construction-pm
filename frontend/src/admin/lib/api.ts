import axios from "axios";

// Prefijo /api/admin/* — el backend monta las rutas del módulo administrativo aquí.
const api = axios.create({ baseURL: "/api/admin" });

// Token unificado del ecosistema (mismo patrón que el módulo financiero)
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

async function unwrap<T>(p: Promise<{ data: { data: T; error: string | null } }>): Promise<T> {
  const res = await p;
  if (res.data.error) throw new Error(res.data.error);
  return res.data.data;
}

export const ROLE_LABELS: Record<string, string> = {
  HOLDING: "Holding",
  PROPERTY_MANAGER: "Property Manager",
  SUBSIDIARY_OWNER: "Propietaria",
  OTHER: "Otra",
};

export const PERSON_ROLE_LABELS: Record<string, string> = {
  SOCIO: "Socio",
  COLABORADOR: "Colaborador",
  OTRO: "Otro",
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  DISSOLVED: "Disuelta",
};

export const AdminAPI = {
  // Empresas / organigrama
  getCompanies: () => unwrap<any[]>(api.get("/companies")),
  getOrgChart: () => unwrap<any>(api.get("/companies/orgchart")),
  getCompany: (id: number) => unwrap<any>(api.get(`/companies/${id}`)),
  createCompany: (data: any) => unwrap<any>(api.post("/companies", data)),
  updateCompany: (id: number, data: any) => unwrap<any>(api.patch(`/companies/${id}`, data)),
  deleteCompany: (id: number) => unwrap<any>(api.delete(`/companies/${id}`)),
  importSPVs: () => unwrap<any>(api.post("/companies/import-spvs")),

  // Proyectos y propiedades a cargo de una empresa (carga de la LLC)
  getCompanyProjects: (id: number) => unwrap<{ techProjects: any[]; finProjects: any[]; availableTech: any[] }>(api.get(`/companies/${id}/projects`)),
  assignProject: (id: number, projectId: string) => unwrap<any>(api.post(`/companies/${id}/assign-project`, { projectId })),
  unassignProject: (id: number, projectId: string) => unwrap<any>(api.post(`/companies/${id}/unassign-project`, { projectId })),

  // Catálogo documental + checklist
  getDocTypes: () => unwrap<any[]>(api.get("/doc-types")),
  createDocType: (data: any) => unwrap<any>(api.post("/doc-types", data)),
  getChecklist: (companyId: number) => unwrap<any>(api.get(`/doc-types/companies/${companyId}/checklist`)),
  toggleRequirement: (companyId: number, data: any) => unwrap<any>(api.put(`/doc-types/companies/${companyId}/requirements`, data)),

  /** Crea un tipo documental nuevo (categoría libre) y lo exige de una vez a la empresa. */
  addCompanyRequirement: async (companyId: number, data: { name: string; category: string; hasExpiry: boolean }) => {
    const code = `CUSTOM_${data.name.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, "_").slice(0, 40)}_${Date.now().toString(36).toUpperCase()}`;
    const docType = await unwrap<any>(api.post("/doc-types", {
      code,
      name: data.name,
      category: data.category.toUpperCase(),
      hasExpiry: data.hasExpiry,
      defaultRequired: false,
      sortOrder: 999,
    }));
    await unwrap<any>(api.put(`/doc-types/companies/${companyId}/requirements`, { docTypeId: docType.id, required: true }));
    return docType;
  },

  // Documentos
  getDocuments: (companyId: number) => unwrap<any[]>(api.get(`/companies/${companyId}/documents`)),
  uploadDocument: (companyId: number, form: FormData) =>
    unwrap<any>(api.post(`/companies/${companyId}/documents`, form, { headers: { "Content-Type": "multipart/form-data" } })),
  updateDocument: (docId: number, data: any) => unwrap<any>(api.patch(`/documents/${docId}`, data)),
  deleteDocument: (docId: number) => unwrap<any>(api.delete(`/documents/${docId}`)),
  getShareInfo: (docId: number) => unwrap<any>(api.get(`/documents/${docId}/share`)),

  // Tareas
  getTasks: (params?: { companyId?: number; personId?: number; status?: string }) => unwrap<any[]>(api.get("/tasks", { params })),
  getTaskSummary: () => unwrap<{ pending: number; overdue: number; dueSoon: number; highPriority: number }>(api.get("/tasks/summary")),
  createTask: (data: any) => unwrap<any>(api.post("/tasks", data)),
  updateTask: (id: number, data: any) => unwrap<any>(api.patch(`/tasks/${id}`, data)),
  deleteTask: (id: number) => unwrap<any>(api.delete(`/tasks/${id}`)),

  // Socios y colaboradores
  getPersons: () => unwrap<any[]>(api.get("/persons")),
  getPerson: (id: number) => unwrap<any>(api.get(`/persons/${id}`)),
  createPerson: (data: any) => unwrap<any>(api.post("/persons", data)),
  updatePerson: (id: number, data: any) => unwrap<any>(api.patch(`/persons/${id}`, data)),
  deletePerson: (id: number) => unwrap<any>(api.delete(`/persons/${id}`)),
  getPersonChecklist: (id: number) => unwrap<any>(api.get(`/persons/${id}/checklist`)),
  getPersonRequirements: (id: number) => unwrap<any[]>(api.get(`/persons/${id}/requirements`)),
  createPersonRequirement: (id: number, data: any) => unwrap<any>(api.post(`/persons/${id}/requirements`, data)),
  updatePersonRequirement: (reqId: number, data: any) => unwrap<any>(api.patch(`/persons/requirements/${reqId}`, data)),
  deletePersonRequirement: (reqId: number) => unwrap<any>(api.delete(`/persons/requirements/${reqId}`)),
  getPersonDocuments: (id: number) => unwrap<any[]>(api.get(`/persons/${id}/documents`)),
  uploadPersonDocument: (id: number, form: FormData) =>
    unwrap<any>(api.post(`/persons/${id}/documents`, form, { headers: { "Content-Type": "multipart/form-data" } })),
  updatePersonDocument: (docId: number, data: any) => unwrap<any>(api.patch(`/persons/documents/${docId}`, data)),
  deletePersonDocument: (docId: number) => unwrap<any>(api.delete(`/persons/documents/${docId}`)),
  getPersonShareInfo: (docId: number) => unwrap<any>(api.get(`/persons/documents/${docId}/share`)),

  // Dashboard + alertas
  getDashboard: () => unwrap<any>(api.get("/dashboard")),
  getAlerts: () => unwrap<any[]>(api.get("/dashboard/alerts")),
};

/** Enlace absoluto y público (proxy /api/download) para compartir un documento. */
export function absoluteShareUrl(sharePath: string): string {
  return `${window.location.origin}${sharePath}`;
}

/** Abre WhatsApp con el mensaje y el enlace del documento listos. */
export function shareByWhatsApp(filename: string, companyName: string, url: string) {
  const text = `Documento: ${filename}\nEmpresa: ${companyName}\n\n${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

/** Abre el cliente de correo con asunto y cuerpo prellenados. */
export function shareByEmail(filename: string, companyName: string, url: string) {
  const subject = `Documento: ${filename} — ${companyName}`;
  const body = `Hola,\n\nComparto el documento "${filename}" de ${companyName}:\n\n${url}\n\nSaludos,\nRestrepo Acosta Global Holding LLC`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
