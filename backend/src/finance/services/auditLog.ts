import { prisma } from "../lib/prisma";

/**
 * Registra una entrada en el audit log financiero.
 *
 * Acciones típicas:
 *   - "create" / "update" / "delete" sobre cualquier entidad
 *   - "wipe-all"
 *   - "restore"
 *   - "excel-import"
 *
 * Entidad: nombre del modelo afectado (FinMovement, FinAccount, etc.)
 *
 * El log NUNCA debe lanzar excepciones que rompan la operación principal.
 */
export async function logActivity(
  action: string,
  entity: string,
  entityId?: number | null,
  detail?: string,
  user?: string
): Promise<void> {
  try {
    await prisma.finActivityLog.create({
      data: {
        action,
        entity,
        entityId: entityId ?? null,
        detail: detail ?? null,
        user: user ?? "system",
      },
    });
  } catch (e) {
    // Silenciar — el log no debe romper la operación principal
    console.error("[audit-log] error:", e);
  }
}
