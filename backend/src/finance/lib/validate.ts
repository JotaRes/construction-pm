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
  // techSubActivityId NO se acepta del cliente: lo gestiona el backend (espejo).
  techItemId: z.string().trim().min(1).max(50).nullable().optional(),
});
// .strip() por defecto: cualquier campo desconocido se descarta en vez de
// llegar crudo a Prisma (protege contra inyección de campos y typos).

export const movementUpdateSchema = movementCreateSchema.partial();

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
