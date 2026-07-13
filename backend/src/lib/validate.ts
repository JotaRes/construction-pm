// ============================================================
// VALIDACIÓN DE ENTRADA (Zod) — MÓDULO TÉCNICO
// Regla de oro #7: todo endpoint de escritura nuevo lleva validación.
// Patrón espejo de finance/lib/validate.ts.
// ============================================================
import { z } from 'zod'

export const CO_REASONS = ['CONDICION_OCULTA', 'ERROR_DISENO', 'SOLICITUD_PROPIETARIO', 'CODIGO', 'CLIMA', 'OTRO'] as const
export const CO_STATUSES = ['BORRADOR', 'APROBADO', 'RECHAZADO'] as const

export const changeOrderCreateSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(300),
  description: z.string().max(5000).nullable().optional(),
  reason: z.enum(CO_REASONS).optional(),
  costDelta: z.coerce.number({ errorMap: () => ({ message: 'El costo debe ser un número' }) }).finite(),
  daysDelta: z.coerce.number().int('Los días deben ser un entero').min(-365).max(365).optional(),
  requestedBy: z.string().max(200).nullable().optional(),
  contractId: z.string().nullable().optional(),
  budgetLineId: z.string().nullable().optional(),
})

export const changeOrderUpdateSchema = changeOrderCreateSchema.partial()

/** Convierte un ZodError en mensaje legible para el usuario. */
export function zodMsg(error: z.ZodError): string {
  return 'Datos inválidos — ' + error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`).join(' · ')
}

/** Devuelve { data } o { error } con mensajes legibles. */
export function parseOrError<T>(schema: z.ZodType<T>, body: unknown):
  | { data: T; error: null }
  | { data: null; error: string } {
  const result = schema.safeParse(body)
  if (result.success) return { data: result.data, error: null }
  const msg = result.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`).join(' · ')
  return { data: null, error: `Datos inválidos — ${msg}` }
}

// ===== PUNCH LIST (Lote B) =====
export const PUNCH_SEVERITIES = ['BAJA', 'MEDIA', 'ALTA'] as const
export const PUNCH_STATUSES = ['ABIERTO', 'CORREGIDO', 'VERIFICADO'] as const

export const punchCreateSchema = z.object({
  title: z.string().trim().min(1, 'Describe el defecto').max(300),
  location: z.string().max(200).nullable().optional(),
  responsable: z.string().max(200).nullable().optional(),
  severity: z.enum(PUNCH_SEVERITIES).optional(),
  notes: z.string().max(2000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
})

export const punchUpdateSchema = punchCreateSchema.partial().extend({
  status: z.enum(PUNCH_STATUSES).optional(),
})
