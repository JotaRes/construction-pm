// ============================================================
// VALIDACIÓN DE ENTRADA (Zod) — NÚCLEO FINANCIERO
// ============================================================
// Los movimientos bancarios son el corazón del módulo financiero: de ellos
// se derivan balances, aportes de capital y préstamos (capitalSync/loanSync).
// Un movimiento corrupto (monto negativo, tipo inventado, string donde va
// número) contamina TODO río abajo. Por eso el backend valida — el frontend
// puede tener bugs, los imports de Excel pueden traer basura.
import { z } from "zod";

const intId = z.coerce.number().int().positive();
const optionalId = intId.nullable().optional();
const bool = z.coerce.boolean().optional();

export const movementCreateSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: "Fecha inválida" }) }),
  type: z.enum(["Ingreso", "Egreso", "Interbancario"], {
    errorMap: () => ({ message: "Tipo debe ser Ingreso, Egreso o Interbancario" }),
  }),
  amount: z.coerce
    .number({ errorMap: () => ({ message: "Monto debe ser un número" }) })
    .finite()
    .positive("El monto debe ser mayor que 0"),
  concept: z.string().trim().min(1, "El concepto es obligatorio").max(500),
  notes: z.string().max(5000).nullable().optional(),

  accountId: intId,
  destAccountId: optionalId,
  categoryId: optionalId,
  originId: optionalId,
  providerId: optionalId,
  partnerId: optionalId,
  lenderId: optionalId,
  loanId: optionalId,
  projectId: optionalId,
  linkedMovementId: optionalId,
  matchedLineId: optionalId,

  isEquity: bool,
  isLoan: bool,
  isLoanRepayment: bool,
  isIntercompany: bool,
  hasSupport: bool,
  isReconciled: bool,
  needsReview: bool,

  reviewReason: z.string().max(1000).nullable().optional(),
  matchStatus: z.enum(["matched", "manual_only", "extract_only", "pending"]).optional(),
  importSource: z.string().max(200).nullable().optional(),
  importRef: z.string().max(200).nullable().optional(),

  // Vínculo opcional a una actividad del módulo TÉCNICO (id cuid string).
  techItemId: z.string().trim().min(1).max(50).nullable().optional(),
  // Subactividad EXISTENTE elegida por el usuario (adopción). Si viene null o
  // ausente, el backend crea/gestiona su propia subactividad espejo.
  techSubActivityId: z.string().trim().min(1).max(50).nullable().optional(),
});
// .strip() por defecto: cualquier campo desconocido se descarta en vez de
// llegar crudo a Prisma (protege contra inyección de campos y typos).

export const movementUpdateSchema = movementCreateSchema.partial();

// ── Helpers compartidos ──────────────────────────────────────────────────────
const money = z.coerce
  .number({ errorMap: () => ({ message: "Monto debe ser un número" }) })
  .finite();
const positiveMoney = money.positive("El monto debe ser mayor que 0");
const optDate = z.coerce.date().nullable().optional();
const optStr = (max: number) => z.string().trim().max(max).nullable().optional();

// ── APORTES DE CAPITAL (equity de socios) ────────────────────────────────────
// Un aporte corrupto descuadra el total de equity y el ROI por proyecto.
export const capitalContributionCreateSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: "Fecha inválida" }) }),
  amount: positiveMoney,
  concept: z.string().trim().min(1, "El concepto es obligatorio").max(500),
  origin: z.string().trim().min(1, "El origen es obligatorio").max(200),
  partnerId: intId,
  projectId: optionalId,
  destAccountCode: optStr(60),
  notes: optStr(5000),
});
export const capitalContributionUpdateSchema = capitalContributionCreateSchema.partial();

// ── APORTES NO BANCARIOS ─────────────────────────────────────────────────────
export const nonBankContributionCreateSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: "Fecha inválida" }) }),
  amount: positiveMoney,
  concept: z.string().trim().min(1, "El concepto es obligatorio").max(500),
  partnerId: intId,
  projectId: optionalId,
  notes: optStr(5000),
});
export const nonBankContributionUpdateSchema = nonBankContributionCreateSchema.partial();

// ── PRÉSTAMOS (deuda con lenders) ────────────────────────────────────────────
export const LOAN_STATUS = ["activo", "pagado", "cancelado", "en_mora"] as const;
export const loanCreateSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: "Fecha inválida" }) }),
  amount: positiveMoney,
  concept: z.string().trim().min(1, "El concepto es obligatorio").max(500),
  lenderId: intId,
  projectId: optionalId,
  destAccountCode: optStr(60),
  interestRate: money.nonnegative().nullable().optional(),
  termMonths: z.coerce.number().int().positive().nullable().optional(),
  startDate: optDate,
  endDate: optDate,
  status: z.enum(LOAN_STATUS).optional(),
  classification: optStr(40),
  totalRepaid: money.nonnegative().optional(),
  notes: optStr(5000),
});
export const loanUpdateSchema = loanCreateSchema.partial();

// ── CUENTAS BANCARIAS ────────────────────────────────────────────────────────
export const accountCreateSchema = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(60),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  bank: z.string().trim().min(1, "El banco es obligatorio").max(200),
  type: optStr(60),
  accountNumber: optStr(60),
  routingNumber: optStr(60),
  address: optStr(500),
  currentBalance: money.optional(),
  initialBalance: money.optional(),
  reportedBalance: money.optional(),
  active: z.coerce.boolean().optional(),
  notes: optStr(5000),
  spvId: optionalId,
});
export const accountUpdateSchema = accountCreateSchema.partial();

// ── PROYECTOS FINANCIEROS (propiedades) ──────────────────────────────────────
export const finProjectCreateSchema = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(60),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(300),
  line: optStr(120),
  model: optStr(120),
  status: optStr(60),
  spvId: optionalId,
  admCompanyId: optionalId,
  address: optStr(500),
  purchasePrice: money.nonnegative().optional(),
  arv: money.nonnegative().optional(),
  expectedCost: money.nonnegative().optional(),
  cashIn: money.optional(),
  notes: optStr(5000),
});
export const finProjectUpdateSchema = finProjectCreateSchema.partial();

// ── CATÁLOGOS MAESTROS ───────────────────────────────────────────────────────
// Datos de referencia (SPVs, socios, lenders, proveedores, categorías, orígenes).
// Un catálogo corrupto se propaga a movimientos, aportes y préstamos.
export const spvCreateSchema = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(60),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(300),
  notes: optStr(5000),
});
export const spvUpdateSchema = spvCreateSchema.partial();

export const partnerCreateSchema = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(60),
  fullName: z.string().trim().min(1, "El nombre es obligatorio").max(300),
  email: optStr(200),
  notes: optStr(5000),
});
export const partnerUpdateSchema = partnerCreateSchema.partial();

export const lenderCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(300),
  type: optStr(60),
  contactName: optStr(200),
  email: optStr(200),
  phone: optStr(50),
  notes: optStr(5000),
});
export const lenderUpdateSchema = lenderCreateSchema.partial();

export const providerCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(300),
  type: optStr(60),
  contactName: optStr(200),
  phone: optStr(50),
  email: optStr(200),
  notes: optStr(5000),
});
export const providerUpdateSchema = providerCreateSchema.partial();

export const expenseCategoryCreateSchema = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(60),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(300),
  group: optStr(120),
  isCorporate: z.coerce.boolean().optional(),
  taxBucket: optStr(120),
  notes: optStr(5000),
});
export const expenseCategoryUpdateSchema = expenseCategoryCreateSchema.partial();

export const incomeOriginCreateSchema = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(60),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(300),
  notes: optStr(5000),
});
export const incomeOriginUpdateSchema = incomeOriginCreateSchema.partial();

/** Devuelve { data } o { error } con mensajes legibles para el usuario. */
export function parseOrError<T>(schema: z.ZodType<T>, body: unknown):
  | { data: T; error: null }
  | { data: null; error: string } {
  const result = schema.safeParse(body);
  if (result.success) return { data: result.data, error: null };
  const msg = result.error.errors
    .map((e) => `${e.path.join(".") || "body"}: ${e.message}`)
    .join(" · ");
  return { data: null, error: `Datos inválidos — ${msg}` };
}
