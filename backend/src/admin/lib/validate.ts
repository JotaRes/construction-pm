// ============================================================
// VALIDACIÓN DE ENTRADA (Zod) — MÓDULO ADMINISTRATIVO
// ============================================================
// El expediente corporativo alimenta el semáforo de cumplimiento y las
// alertas de vencimiento. Un dato corrupto (rol inventado, fecha inválida)
// contamina el organigrama y el motor de alertas. Mismo patrón que
// finance/lib/validate.ts.
import { z } from "zod";

const intId = z.coerce.number().int().positive();
const optionalId = intId.nullable().optional();
const optionalDate = z.coerce.date().nullable().optional();
const optionalStr = (max: number) => z.string().trim().max(max).nullable().optional();

export const COMPANY_ROLES = ["HOLDING", "PROPERTY_MANAGER", "SUBSIDIARY_OWNER", "OTHER"] as const;
export const COMPANY_STATUS = ["ACTIVE", "INACTIVE", "DISSOLVED"] as const;

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  legalName: optionalStr(300),
  role: z.enum(COMPANY_ROLES).optional(),
  entityType: optionalStr(50),
  stateOfFormation: optionalStr(100),
  ein: optionalStr(20),
  formationDate: optionalDate,
  registeredAgent: optionalStr(300),
  address: optionalStr(500),
  status: z.enum(COMPANY_STATUS).optional(),
  notes: optionalStr(5000),
  parentId: optionalId,
  finSpvId: optionalId,
});

export const companyUpdateSchema = companyCreateSchema.partial();

export const docTypeCreateSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  category: z.string().trim().min(1).max(60),
  description: optionalStr(1000),
  defaultRequired: z.coerce.boolean().optional(),
  hasExpiry: z.coerce.boolean().optional(),
  renewalMonths: z.coerce.number().int().positive().nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const docTypeUpdateSchema = docTypeCreateSchema.partial();

export const documentMetaSchema = z.object({
  docTypeId: optionalId,
  issueDate: optionalDate,
  expiryDate: optionalDate,
  notes: optionalStr(2000),
  filename: z.string().trim().min(1).max(300).optional(),
});

export const requirementToggleSchema = z.object({
  docTypeId: intId,
  required: z.coerce.boolean(),
  notes: optionalStr(1000),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(300),
  description: optionalStr(5000),
  companyId: optionalId,
  dueDate: optionalDate,
  priority: z.enum(["alta", "media", "baja"]).optional(),
  status: z.enum(["pendiente", "en_progreso", "completada"]).optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial();

/** Devuelve { data } o { error } con mensajes legibles (patrón finance). */
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
