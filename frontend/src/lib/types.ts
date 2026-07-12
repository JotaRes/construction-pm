export type ItemEstado = 'PENDIENTE' | 'EN_CURSO' | 'DONE' | 'NA'
export type DrawEstado = 'WIRED' | 'PENDING' | 'EMPTY'
export type AlertLevel = 'ok' | 'warning' | 'critical'
export type InspectionEstado = 'PENDIENTE' | 'PROGRAMADA' | 'APROBADA' | 'RECHAZADA'

export interface Partner {
  id: string
  name: string
  ownershipPct: number
  capitalAporte: number
  phone: string | null
  email: string | null
  order: number
}

export interface ProviderQuote {
  id: string
  providerId: string
  description: string
  amount: number
  date: string | null
  fileUrl: string | null
  notes: string | null
  createdAt: string
}

export type ProviderDocumentType =
  | 'SEGURO'
  | 'COTIZACION'
  | 'FACTURA'
  | 'CONTRATO'
  | 'LICENCIA'
  | 'W9'
  | 'OTRO'

export interface ProviderDocument {
  id: string
  providerId: string
  type: ProviderDocumentType
  name: string
  amount: number | null
  fileUrl: string | null
  mimetype: string | null
  size: number | null
  notes: string | null
  createdAt: string
}

export interface Provider {
  id: string
  projectId: string
  name: string
  type: string | null
  phoneCountry: string | null
  phone: string | null
  email: string | null
  license: string | null
  address: string | null
  notes: string | null
  quotes: ProviderQuote[]
  documents?: ProviderDocument[]
}

export interface ItemDocument {
  id: string
  itemId: string
  type: 'COTIZACION' | 'FACTURA' | 'OTRO'
  name: string
  vendor: string | null
  amount: number | null
  fileUrl: string | null
  notes: string | null
  createdAt: string
}

export interface Item {
  id: string
  phaseId: string
  itemCode: string
  activity: string
  description: string | null
  responsable: string | null
  unit: string | null
  esNA: boolean
  completado: boolean
  quantity?: number | null
  valorPresupuestado: number
  valorEjecutado: number
  providerId: string | null
  provider: Provider | null
  estado: ItemEstado
  fechaInicioReal: string | null
  fechaFinReal: string | null
  observaciones: string | null
  order: number
  documents?: { id: string; type: string }[]
}

export interface Phase {
  id: string
  projectId: string
  code: string
  name: string
  groupName: string
  order: number
  items: Item[]
}

export interface Draw {
  id: string
  projectId: string
  drawNumber: number
  fechaSolicitud: string | null
  fechaInspeccion: string | null
  fechaWire: string | null
  montoSolicitado: number
  elegibleTrinity: number
  porcentajeFunded: number
  netWire: number
  upbPre: number
  upbPost: number
  saldoHoldback: number
  notas: string | null
  pdfUrl: string | null
  estado: DrawEstado
  invoiceLenderUrl: string | null
  invoiceLenderName: string | null
  lenderApprovalUrl: string | null
  lenderApprovalName: string | null
  lenderExcelUrl: string | null
  lenderExcelName: string | null
}

export interface Inspection {
  id: string
  projectId: string
  wbs: string
  tipo: string
  prerrequisitos: string | null
  fase: string | null
  fechaSolicitada: string | null
  fechaRealizada: string | null
  resultado: string | null
  estado: InspectionEstado
  observaciones: string | null
  order: number
}

export interface Note {
  id: string
  projectId: string
  title: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export interface ProjectFile {
  id: string
  projectId: string
  name: string
  category: string | null
  url: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  spv: string
  holding: string
  address: string
  county: string
  hoa: string | null
  parcelId: string | null
  lotAcres: number | null
  sfHeated: number
  sfGarage: number
  sfPorches: number
  bedrooms: number
  bathrooms: string
  architecturalPlan: string | null
  foundationType: string | null
  permitNumber: string | null
  permitIssued: string | null
  permitExpires: string | null
  inspectorPhone: string | null
  hoaPhone: string | null
  gcName: string | null
  gcPhone: string | null
  gcLicense: string | null
  gcEmail: string | null
  lender: string | null
  loanNumber: string | null
  loanAmount: number
  day1Disbursement: number
  interestReserve: number
  holdback: number
  interestRate: number
  loanTermMonths: number
  settlementDate: string | null
  cashAtSettlement: number
  closingCosts: number
  contractSalesPrice: number
  settlementAgent: string | null
  arv: number
  constructionBudget: number
  trinityName: string | null
  trinityPhone: string | null
  trinityEmail: string | null
  targetCompletionDate: string | null
  startDate: string | null
  realtorName: string | null
  realtorBrokerage: string | null
  listingCommission: number
  buyerCommission: number
  targetListingPrice: number
  expectedPricePerSqft: number
  contingencyPct: number
  targetMarginPct: number
  benchmarkSfTarget: number
  // Documentos financieros
  loiUrl: string | null
  loiName: string | null
  approvalLetterUrl: string | null
  approvalLetterName: string | null
  hudUrl: string | null
  hudName: string | null
  otrosFinancieroUrl: string | null
  otrosFinancieroName: string | null
  loiSalePrice: number | null
  loiOfferDate: string | null
  loiExpectedClose: string | null
  loiEarnestMoney: number | null
  phases: Phase[]
  draws: Draw[]
  partners: Partner[]
  providers: Provider[]
  inspections: Inspection[]
}

export interface PhaseStats {
  id: string
  code: string
  name: string
  groupName: string
  totalItems: number
  doneItems: number
  avancePct: number
  budget: number
  ejecutado: number
  desviacion: number
  estado: string
}

export interface DashboardKpis {
  avanceGeneral: number
  totalBudget: number
  totalEjecutado: number
  totalDrawn: number
  upbActual: number
  saldoHoldback: number
  diasAlPermit: number | null
  tiempoTranscurrido: number
  desfaseFisicoVsTiempo: number
  costoSFPresupuestado: number
  costoSFEjecutado: number
  costoSFProyectado: number
  arvSF: number
  interestEstimado: number
  gananciaEsperada: number
}

export interface DashboardData {
  project: Partial<Project>
  kpis: DashboardKpis
  phases: PhaseStats[]
  draws: Draw[]
  inspections: Inspection[]
}

export interface Alert {
  id: string
  level: AlertLevel
  title: string
  message: string
  action: string
  source: string
}

export interface BudgetLine {
  id: string
  projectId: string
  divCode: string
  divName: string
  itemCode: string
  description: string
  unit: string
  quantity?: number | null
  vendor: string | null
  valorInicial: number
  valorPresentado: number
  valorAprobado: number
  pagadoSubs: number
  order: number
}

export interface PriceRef {
  id: string
  category: string
  code: string | null
  description: string
  unit: string
  priceLow: number
  priceHigh: number
  source: string | null
  region: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface Task {
  id: string
  projectId: string
  tipo?: 'TAREA' | 'NOTA'
  title: string
  responsable: string | null
  done: boolean
  priority: TaskPriority
  dueDate: string | null
  notes: string | null
  order: number
  createdAt: string
}
