import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      include: { spv: true, _count: { select: { movementsFrom: true } } },
      orderBy: { code: "asc" },
    });

    // Calcular saldos
    const allMovs = await prisma.movement.findMany({ select: { accountId: true, destAccountId: true, type: true, amount: true } });
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

    const enriched = accounts.map((a) => ({
      ...a,
      currentBalance: balances.get(a.id) || a.initialBalance,
      balanceDiff: (balances.get(a.id) || a.initialBalance) - a.reportedBalance,
    }));

    ok(res, enriched);
  } catch (e) { fail(res, e); }
});

router.get("/:id", async (req, res) => {
  try {
    const a = await prisma.account.findUnique({
      where: { id: +req.params.id },
      include: {
        spv: true,
        movementsFrom: { include: { category: true, origin: true, project: true }, orderBy: { date: "desc" }, take: 200 },
        statements: { orderBy: { periodStart: "desc" } },
      },
    });
    if (!a) return fail(res, "not found", 404);
    ok(res, a);
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const { initialBalance, reportedBalance } = req.body;
    const data: any = {};
    if (initialBalance !== undefined) data.initialBalance = Number(initialBalance);
    if (reportedBalance !== undefined) data.reportedBalance = Number(reportedBalance);
    const updated = await prisma.account.update({
      where: { id: +req.params.id },
      data,
    });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

export default router;
