import { prisma } from "../lib/prisma";

/**
 * Sincroniza FinCapitalContribution con un FinMovement.
 *
 * Regla: si el movimiento es Ingreso + isEquity=true + tiene partnerId,
 * existe una contribución 1-1 vinculada por sourceMovementId.
 *
 * - upsertFromMovement(movId): crea o actualiza la contribución
 * - removeForMovement(movId):  elimina la contribución vinculada (si existe)
 *
 * Idempotente: llamar varias veces produce el mismo resultado.
 */
export async function upsertCapitalFromMovement(movementId: number): Promise<void> {
  const m = await prisma.finMovement.findUnique({
    where: { id: movementId },
    include: { account: true },
  });
  if (!m) return;

  const shouldExist = m.type === "Ingreso" && m.isEquity && m.partnerId != null;

  const existing = await prisma.finCapitalContribution.findUnique({
    where: { sourceMovementId: movementId },
  });

  if (!shouldExist) {
    if (existing) {
      await prisma.finCapitalContribution.delete({ where: { id: existing.id } });
    }
    return;
  }

  // Determinar el "origen" textual. Si el movimiento tiene origin link
  // lo usamos; sino, "Equity socio" por defecto.
  let originLabel = "Equity socio";
  if (m.originId) {
    const o = await prisma.finIncomeOrigin.findUnique({ where: { id: m.originId } });
    if (o) originLabel = o.name;
  }

  const data = {
    date: m.date,
    amount: m.amount,
    concept: m.concept,
    origin: originLabel,
    partnerId: m.partnerId!,
    projectId: m.projectId ?? null,
    destAccountCode: m.account?.code ?? null,
    notes: m.notes ?? null,
    sourceMovementId: m.id,
  };

  if (existing) {
    await prisma.finCapitalContribution.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.finCapitalContribution.create({ data });
  }
}

export async function removeCapitalForMovement(movementId: number): Promise<void> {
  const existing = await prisma.finCapitalContribution.findUnique({
    where: { sourceMovementId: movementId },
  });
  if (existing) {
    await prisma.finCapitalContribution.delete({ where: { id: existing.id } });
  }
}
