import { prisma } from "../lib/prisma";

export interface ReconResult {
  totalLines: number;
  matched: number;
  unmatched: number;
  amountMismatch: number;
  missingInBank: number;
  missingInBook: Array<{ lineId: number; description: string; amount: number; date: Date; type: string }>;
}

// Concilia movimientos contra líneas de extracto. Estrategias:
//  1. Match exacto: misma fecha (±2 días), mismo monto, misma cuenta
//  2. Match aproximado: monto exacto, ±5 días, mismo signo
export async function reconcileStatement(statementId: number): Promise<ReconResult> {
  const stmt = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    include: { lines: true, account: true },
  });
  if (!stmt) throw new Error("statement not found");

  // Movimientos posibles de la cuenta en rango del extracto (±10 días buffer)
  const dateLow = new Date(stmt.periodStart.getTime() - 10 * 86400000);
  const dateHigh = new Date(stmt.periodEnd.getTime() + 10 * 86400000);

  const candidateMovs = await prisma.movement.findMany({
    where: {
      OR: [{ accountId: stmt.accountId }, { destAccountId: stmt.accountId }],
      date: { gte: dateLow, lte: dateHigh },
    },
  });

  const usedMovIds = new Set<number>();
  const usedLineIds = new Set<number>();

  // 1) match exacto
  for (const line of stmt.lines) {
    if (usedLineIds.has(line.id)) continue;
    for (const m of candidateMovs) {
      if (usedMovIds.has(m.id)) continue;
      const days = Math.abs((m.date.getTime() - line.date.getTime()) / 86400000);
      if (days > 2) continue;
      let movAmt: number;
      let movType: "credit" | "debit";
      if (m.accountId === stmt.accountId) {
        movAmt = m.amount;
        if (m.type === "Ingreso") movType = "credit";
        else if (m.type === "Egreso") movType = "debit";
        else movType = "debit";
      } else {
        movAmt = m.amount;
        movType = "credit";
      }
      if (Math.abs(movAmt - line.amount) < 0.01 && movType === line.type) {
        await prisma.bankStatementLine.update({
          where: { id: line.id },
          data: { matchedMovementId: m.id, matchStatus: "matched_exact" },
        });
        await prisma.movement.update({ where: { id: m.id }, data: { isReconciled: true } });
        usedMovIds.add(m.id);
        usedLineIds.add(line.id);
        break;
      }
    }
  }

  // 2) match aproximado (±5 días)
  for (const line of stmt.lines) {
    if (usedLineIds.has(line.id)) continue;
    for (const m of candidateMovs) {
      if (usedMovIds.has(m.id)) continue;
      const days = Math.abs((m.date.getTime() - line.date.getTime()) / 86400000);
      if (days > 5) continue;
      const movAmt = m.amount;
      const movType: "credit" | "debit" = m.type === "Ingreso" ? "credit" : "debit";
      if (Math.abs(movAmt - line.amount) < 0.01 && movType === line.type) {
        await prisma.bankStatementLine.update({
          where: { id: line.id },
          data: { matchedMovementId: m.id, matchStatus: "matched_approx" },
        });
        await prisma.movement.update({ where: { id: m.id }, data: { isReconciled: true } });
        usedMovIds.add(m.id);
        usedLineIds.add(line.id);
        break;
      }
    }
  }

  const lines = await prisma.bankStatementLine.findMany({ where: { statementId } });
  const matched = lines.filter((l) => l.matchStatus !== "unmatched").length;
  const unmatched = lines.length - matched;
  const missingInBook = lines
    .filter((l) => l.matchStatus === "unmatched")
    .map((l) => ({ lineId: l.id, description: l.description, amount: l.amount, date: l.date, type: l.type }));

  const missingInBank = candidateMovs.filter((m) => !usedMovIds.has(m.id)).length;

  return {
    totalLines: lines.length,
    matched,
    unmatched,
    amountMismatch: 0,
    missingInBank,
    missingInBook,
  };
}
