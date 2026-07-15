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

  // Catálogo documental + checklist
  getDocTypes: () => unwrap<any[]>(api.get("/doc-types")),
  createDocType: (data: any) => unwrap<any>(api.post("/doc-types", data)),
  getChecklist: (companyId: number) => unwrap<any>(api.get(`/doc-types/companies/${companyId}/checklist`)),
  toggleRequirement: (companyId: number, data: any) => unwrap<any>(api.put(`/doc-types/companies/${companyId}/requirements`, data)),

  // Documentos
  getDocuments: (companyId: number) => unwrap<any[]>(api.get(`/companies/${companyId}/documents`)),
  uploadDocument: (companyId: number, form: FormData) =>
    unwrap<any>(api.post(`/companies/${companyId}/documents`, form, { headers: { "Content-Type": "multipart/form-data" } })),
  updateDocument: (docId: number, data: any) => unwrap<any>(api.patch(`/documents/${docId}`, data)),
  deleteDocument: (docId: number) => unwrap<any>(api.delete(`/documents/${docId}`)),
  getShareInfo: (docId: number) => unwrap<any>(api.get(`/documents/${docId}/share`)),

  // Tareas
  getTasks: (params?: { companyId?: number; status?: string }) => unwrap<any[]>(api.get("/tasks", { params })),
  createTask: (data: any) => unwrap<any>(api.post("/tasks", data)),
  updateTask: (id: number, data: any) => unwrap<any>(api.patch(`/tasks/${id}`, data)),
  deleteTask: (id: number) => unwrap<any>(api.delete(`/tasks/${id}`)),

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
