import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

// GET /api/dashboard — vista consolidada ejecutiva
router.get("/", async (_req, res) => {
  try {
    const [accounts, allMovs, contribs, loans, nonBank, projects, partners, categories] = await Promise.all([
      prisma.account.findMany(),
      prisma.movement.findMany({ include: { category: true, project: true } }),
      prisma.capitalContribution.findMany({ include: { partner: true } }),
      prisma.loan.findMany({ include: { lender: true } }),
      prisma.nonBankContribution.findMany({ include: { partner: true } }),
      prisma.project.findMany({ include: { spv: true } }),
      prisma.partner.findMany(),
      prisma.expenseCategory.findMany(),
    ]);

    // Saldos por cuenta
    const balances = new Map<number, number>();
    for (const a of accounts) balances.set(a.id, a.initialBalance);
    for (const m of allMovs) {
      if (m.type === "Ingreso") balances.set(m.accountId, (balances.get(m.accountId) || 0) + m.amount);
      else if (m.type === "Egreso") balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount);
      else if (m.type === "Interbancario") {
        balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount);
        if (m.destAccountId) balances.set(m.destAccountId, (balances.get(m.destAccountId) || 0) + m.amount);
      }
    }
    const totalLiquidez = Array.from(balances.values()).reduce((s, v) => s + v, 0);

    // Capital
    const equityByPartner = partners.map((p) => {
      const eq = contribs.filter((c) => c.partnerId === p.id).reduce((s, c) => s + c.amount, 0);
      const nb = nonBank.filter((c) => c.partnerId === p.id).reduce((s, c) => s + c.amount, 0);
      return { code: p.code, name: p.fullName, equity: eq, nonBank: nb, total: eq + nb };
    });
    const totalEquity = equityByPartner.reduce((s, p) => s + p.total, 0);

    // Deuda
    const totalLoans = loans.reduce((s, l) => s + l.amount, 0);
    const totalRepaid = loans.reduce((s, l) => s + (l.totalRepaid || 0), 0);
    const outstandingDebt = totalLoans - totalRepaid;
    const avgRate = loans.length > 0 ? loans.reduce((s, l) => s + (l.interestRate || 0), 0) / loans.length : 0;

    // Por proyecto
    const validMovs = allMovs.filter((m) => !m.isIntercompany);
    const byProject = projects.map((p) => {
      const ms = validMovs.filter((m) => m.projectId === p.id);
      const ingresos = ms.filter((m) => m.type === "Ingreso").reduce((s, m) => s + m.amount, 0);
      const egresos = ms.filter((m) => m.type === "Egreso").reduce((s, m) => s + m.amount, 0);
      const costoReal = egresos;
      const gananciaEst = (p.arv || 0) - costoReal;
      const roiEst = costoReal > 0 ? gananciaEst / costoReal : 0;
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        line: p.line,
        status: p.status,
        spv: p.spv?.name,
        ingresos,
        egresos,
        neto: ingresos - egresos,
        costoReal,
        gananciaEst,
        roiEst,
        pctCosto: p.arv > 0 ? costoReal / p.arv : 0,
        arv: p.arv,
        movementCount: ms.length,
      };
    });

    // Por línea
    const byLine = new Map<string, { ingresos: number; egresos: number; projects: number }>();
    for (const p of byProject) {
      const line = p.line || "Sin línea";
      const cur = byLine.get(line) || { ingresos: 0, egresos: 0, projects: 0 };
      cur.ingresos += p.ingresos;
      cur.egresos += p.egresos;
      cur.projects += 1;
      byLine.set(line, cur);
    }

    // Gasto corporativo vs proyecto
    const corpExpenses = validMovs
      .filter((m) => m.type === "Egreso" && m.category?.isCorporate)
      .reduce((s, m) => s + m.amount, 0);
    const projectExpenses = validMovs
      .filter((m) => m.type === "Egreso" && m.projectId && !m.category?.isCorporate)
      .reduce((s, m) => s + m.amount, 0);
    const otherExpenses = validMovs
      .filter((m) => m.type === "Egreso" && !m.category?.isCorporate && !m.projectId)
      .reduce((s, m) => s + m.amount, 0);

    // Top categorías de gasto
    const catTotals = new Map<number, { name: string; amount: number; isCorporate: boolean }>();
    for (const m of validMovs.filter((m) => m.type === "Egreso" && m.categoryId)) {
      const cat = m.category!;
      const cur = catTotals.get(cat.id) || { name: cat.name, amount: 0, isCorporate: cat.isCorporate };
      cur.amount += m.amount;
      catTotals.set(cat.id, cur);
    }
    const topCategories = Array.from(catTotals.values()).sort((a, b) => b.amount - a.amount).slice(0, 10);

    // Alertas rojas
    const alerts: { code: string; severity: "info" | "warn" | "red"; message: string; count?: number }[] = [];
    const unsupportedCount = validMovs.filter((m) => !m.hasSupport && m.type !== "Interbancario").length;
    if (unsupportedCount > 0) alerts.push({ code: "no_support", severity: "warn", message: "Movimientos sin soporte documental", count: unsupportedCount });
    const ambiguousCount = validMovs.filter((m) => m.needsReview).length;
    if (ambiguousCount > 0) alerts.push({ code: "ambiguous", severity: "red", message: "Movimientos marcados como ambiguos", count: ambiguousCount });
    const unreconciledCount = validMovs.filter((m) => !m.isReconciled).length;
    if (unreconciledCount > 0) alerts.push({ code: "unreconciled", severity: "warn", message: "Movimientos sin conciliar", count: unreconciledCount });
    const orphanExpenses = validMovs.filter((m) => m.type === "Egreso" && !m.projectId && !m.category?.isCorporate).length;
    if (orphanExpenses > 0) alerts.push({ code: "orphan_expense", severity: "warn", message: "Egresos sin proyecto ni categoría corporativa", count: orphanExpenses });
    const highRateLoans = loans.filter((l) => (l.interestRate || 0) > 13).length;
    if (highRateLoans > 0) alerts.push({ code: "high_rate", severity: "red", message: "Préstamos con tasa agresiva o peligrosa", count: highRateLoans });

    ok(res, {
      kpis: {
        totalLiquidez,
        totalEquity,
        outstandingDebt,
        totalLoans,
        avgRate,
        totalProjects: projects.length,
        totalMovements: allMovs.length,
        intercompanyMovs: allMovs.filter((m) => m.isIntercompany).length,
        corpExpenses,
        projectExpenses,
        otherExpenses,
      },
      equityByPartner,
      byProject,
      byLine: Array.from(byLine.entries()).map(([line, v]) => ({ line, ...v, neto: v.ingresos - v.egresos })),
      topCategories,
      alerts,
    });
  } catch (e) { fail(res, e); }
});

export default router;
