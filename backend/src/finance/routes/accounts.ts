import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const accounts = await prisma.finAccount.findMany({
      include: { spv: true, _count: { select: { movementsFrom: true } } },
      orderBy: { code: "asc" },
    });

    // Calcular saldos
    const allMovs = await prisma.finMovement.findMany({ select: { accountId: true, destAccountId: true, type: true, amount: true } });
    const balances = new Map<number, number>();
    for (const a of accounts) balances.set(a.id, a.initialBalance);

    for (const m of allMovs) {
      const cur = balances.get(m.accountId) || 0;
      if (m.type === "Ingreso") balances.set(m.accountId, cur + m.amount);
      else if (m.type === "Egreso") balances.set(m.accountId, cur - m.amount);
      else if (m.type === "Interbancario") {
        balances.set(m.accountId, cur - m.amount);
        if (m.destAccountId) balances.set(m.destAccountId, (balances.get(m.destAccountId) || 0) + m.amount);
      }
    }

    const enriched = accounts.map((a) => {
      // currentBalance del DB = saldo manual reportado por el usuario.
      // computedBalance = saldo derivado de movimientos (para detectar descuadre).
      const computed = balances.get(a.id) ?? a.initialBalance;
      const manual = a.currentBalance || a.reportedBalance || 0;
      return {
        ...a,
        computedBalance: computed,
        balanceDiff: computed - manual,
      };
    });

    ok(res, enriched);
  } catch (e) { fail(res, e); }
});

router.get("/:id", async (req, res) => {
  try {
    const a = await prisma.finAccount.findUnique({
      where: { id: +req.params.id },
      include: {
        spv: true,
        movementsFrom: { include: { category: true, origin: true, project: true }, orderBy: { date: "desc" }, take: 200 },
        statements: { include: { _count: { select: { lines: true } } }, orderBy: { periodStart: "desc" } },
      },
    });
    if (!a) return fail(res, "not found", 404);
    ok(res, a);
  } catch (e) { fail(res, e); }
});

// GET /:id/reconciliation — comparación movimientos vs líneas de extracto para esta cuenta
// Retorna 3 listas:
//   matched:      movimientos manuales que SÍ aparecen en algún extracto (verde)
//   bookOnly:     movimientos manuales que NO aparecen en extracto (amarillo — quizás aún no se subió ese período)
//   bankOnly:     líneas de extracto sin movimiento manual (rojo — falta registrar movimiento)
router.get("/:id/reconciliation", async (req, res) => {
  try {
    const accountId = +req.params.id;

    // Movimientos donde la cuenta es origen O destino (incluye transferencias recibidas)
    const movements = await prisma.finMovement.findMany({
      where: { OR: [{ accountId }, { destAccountId: accountId }] },
      include: { category: true, project: true, account: true, destAccount: true },
      orderBy: { date: "desc" },
    });

    // Líneas de extracto de esta cuenta
    const lines = await prisma.finBankStatementLine.findMany({
      where: { statement: { accountId } },
      include: { statement: { select: { id: true, filename: true, periodStart: true, periodEnd: true } } },
      orderBy: { date: "desc" },
    });

    const matchedMovIds = new Set(lines.filter(l => l.matchedMovementId).map(l => l.matchedMovementId!));
    const matched = movements.filter((m) => matchedMovIds.has(m.id));
    const bookOnly = movements.filter((m) => !matchedMovIds.has(m.id));
    const bankOnly = lines.filter((l) => l.matchStatus === "unmatched");

    ok(res, {
      counts: {
        totalMovements: movements.length,
        totalLines: lines.length,
        matched: matched.length,
        bookOnly: bookOnly.length,
        bankOnly: bankOnly.length,
      },
      matched,
      bookOnly,
      bankOnly,
    });
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const {
      initialBalance, reportedBalance, currentBalance,
      accountNumber, routingNumber, address,
      name, bank, type, active, notes,
    } = req.body;
    const data: any = {};
    if (initialBalance !== undefined) data.initialBalance = Number(initialBalance);
    if (reportedBalance !== undefined) data.reportedBalance = Number(reportedBalance);
    if (currentBalance !== undefined) data.currentBalance = Number(currentBalance);
    if (accountNumber !== undefined) data.accountNumber = accountNumber;
    if (routingNumber !== undefined) data.routingNumber = routingNumber;
    if (address !== undefined) data.address = address;
    if (name !== undefined) data.name = name;
    if (bank !== undefined) data.bank = bank;
    if (type !== undefined) data.type = type;
    if (active !== undefined) data.active = !!active;
    if (notes !== undefined) data.notes = notes;
    const updated = await prisma.finAccount.update({
      where: { id: +req.params.id },
      data,
    });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

// POST /api/finance/accounts — crear una cuenta nueva
router.post("/", async (req, res) => {
  try {
    const { code, name, bank, type, accountNumber, routingNumber, address,
      currentBalance, initialBalance, reportedBalance, active, notes, spvId } = req.body;
    if (!code || !name || !bank) return fail(res, "code, name y bank son obligatorios", 400);
    const created = await prisma.finAccount.create({
      data: {
        code, name, bank,
        type: type || "operativa",
        accountNumber: accountNumber || null,
        routingNumber: routingNumber || null,
        address: address || null,
        currentBalance: Number(currentBalance || 0),
        initialBalance: Number(initialBalance || 0),
        reportedBalance: Number(reportedBalance || 0),
        active: active !== false,
        notes: notes || null,
        spvId: spvId ? +spvId : null,
      },
    });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

// DELETE /api/finance/accounts/:id — eliminar (solo si no tiene movimientos)
router.delete("/:id", async (req, res) => {
  try {
    const id = +req.params.id;
    const count = await prisma.finMovement.count({
      where: { OR: [{ accountId: id }, { destAccountId: id }] },
    });
    if (count > 0) {
      return fail(res, `No se puede eliminar: la cuenta tiene ${count} movimiento(s) asociado(s).`, 400);
    }
    await prisma.finAccount.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

export default router;
