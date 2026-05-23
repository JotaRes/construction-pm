import { prisma } from "../lib/prisma";

/**
 * Sincroniza FinLoan con un FinMovement (1-1).
 *
 * Regla: si el movimiento es Ingreso + isLoan=true + tiene lenderId,
 * debe existir un préstamo vinculado por sourceMovementId.
 *
 * - upsertLoanFromMovement(movId): crea o actualiza el préstamo
 * - removeLoanForMovement(movId):  elimina el préstamo vinculado (si existe)
 *
 * También sincroniza pagos de deuda (Egreso + isLoanRepayment) sumando al
 * totalRepaid del préstamo objetivo (loanId del movimiento).
 *
 * Idempotente: llamar varias veces produce el mismo resultado.
 */

function classifyLoan(rate: number | null | undefined): string {
  if (rate == null) return "sin clasificar";
  if (rate <= 7) return "competitiva";
  if (rate <= 10) return "razonable";
  if (rate <= 13) return "cara";
  if (rate <= 16) return "agresiva";
  return "peligrosa";
}

export async function upsertLoanFromMovement(movementId: number): Promise<void> {
  const m = await prisma.finMovement.findUnique({
    where: { id: movementId },
    include: { account: true, lender: true },
  });
  if (!m) return;

  const shouldExist = m.type === "Ingreso" && m.isLoan && m.lenderId != null;

  const existing = await prisma.finLoan.findUnique({
    where: { sourceMovementId: movementId },
  });

  if (!shouldExist) {
    if (existing) {
      // Antes de borrar, desvincular el movement.loanId si apuntaba a éste
      await prisma.finMovement.updateMany({
        where: { loanId: existing.id },
        data: { loanId: null },
      });
      await prisma.finLoan.delete({ where: { id: existing.id } });
    }
    return;
  }

  const data = {
    date: m.date,
    amount: m.amount,
    concept: m.concept,
    lenderId: m.lenderId!,
    projectId: m.projectId ?? null,
    destAccountCode: m.account?.code ?? null,
    startDate: m.date,
    status: "activo",
    classification: classifyLoan(null), // sin tasa al crearse desde movimiento — usuario lo edita después
    notes: m.notes ?? null,
    sourceMovementId: m.id,
  };

  let loan;
  if (existing) {
    loan = await prisma.finLoan.update({ where: { id: existing.id }, data });
  } else {
    loan = await prisma.finLoan.create({ data });
  }

  // Vincular el movimiento al préstamo creado
  if (m.loanId !== loan.id) {
    await prisma.finMovement.update({
      where: { id: m.id },
      data: { loanId: loan.id },
    });
  }
}

export async function removeLoanForMovement(movementId: number): Promise<void> {
  const existing = await prisma.finLoan.findUnique({
    where: { sourceMovementId: movementId },
  });
  if (existing) {
    await prisma.finMovement.updateMany({
      where: { loanId: existing.id },
      data: { loanId: null },
    });
    await prisma.finLoan.delete({ where: { id: existing.id } });
  }
}

/**
 * Recalcula totalRepaid de TODOS los préstamos sumando los movimientos
 * Egreso + isLoanRepayment + loanId. Llamado tras cualquier cambio de
 * movimiento de pago de deuda.
 */
export async function recalculateLoanRepayments(): Promise<void> {
  const repayments = await prisma.finMovement.findMany({
    where: { type: "Egreso", isLoanRepayment: true, loanId: { not: null } },
    select: { loanId: true, amount: true },
  });

  // Agrupar por loanId
  const totals = new Map<number, number>();
  for (const r of repayments) {
    if (r.loanId == null) continue;
    totals.set(r.loanId, (totals.get(r.loanId) || 0) + r.amount);
  }

  // Resetear todos a 0, luego aplicar totales
  await prisma.finLoan.updateMany({ data: { totalRepaid: 0 } });
  for (const [loanId, total] of totals.entries()) {
    await prisma.finLoan.update({
      where: { id: loanId },
      data: { totalRepaid: total },
    });
  }
}
