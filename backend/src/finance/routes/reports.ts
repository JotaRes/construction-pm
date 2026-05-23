import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

// Fuentes y usos del capital
router.get("/sources-uses", async (_req, res) => {
  try {
    const movs = await prisma.finMovement.findMany({
      where: { isIntercompany: false },
      include: { origin: true, category: true, partner: true, lender: true, project: true },
    });

    const sources = new Map<string, number>();
    const uses = new Map<string, number>();

    for (const m of movs) {
      if (m.type === "Ingreso") {
        const k = m.origin?.name || "Sin origen";
        sources.set(k, (sources.get(k) || 0) + m.amount);
      } else if (m.type === "Egreso") {
        const k = m.category?.name || "Sin categoría";
        uses.set(k, (uses.get(k) || 0) + m.amount);
      }
    }

    ok(res, {
      sources: Array.from(sources.entries()).map(([k, v]) => ({ label: k, amount: v })).sort((a, b) => b.amount - a.amount),
      uses: Array.from(uses.entries()).map(([k, v]) => ({ label: k, amount: v })).sort((a, b) => b.amount - a.amount),
    });
  } catch (e) { fail(res, e); }
});

// Flujo mensual
router.get("/cashflow", async (req, res) => {
  try {
    const year = req.query.year ? +req.query.year : new Date().getFullYear();
    const movs = await prisma.finMovement.findMany({
      where: {
        isIntercompany: false,
        date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
    });

    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ingresos: 0, egresos: 0, neto: 0 }));
    for (const m of movs) {
      const idx = m.date.getMonth();
      if (m.type === "Ingreso") months[idx].ingresos += m.amount;
      else if (m.type === "Egreso") months[idx].egresos += m.amount;
    }
    months.forEach((mo) => (mo.neto = mo.ingresos - mo.egresos));
    ok(res, { year, months });
  } catch (e) { fail(res, e); }
});

// === CASHFLOW FORECAST — 90 días ===
// Proyecta los próximos 90 días basándose en:
//  - Patrón histórico de los últimos 90 días (promedio diario ingresos/egresos)
//  - Intereses devengados de préstamos activos (interestRate * outstanding / 365)
//  - Vencimientos próximos de préstamos (endDate dentro de 90d)
router.get("/cashflow-forecast", async (_req, res) => {
  try {
    const today = new Date();
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 86400000);
    const ninetyDaysAhead = new Date(today.getTime() + 90 * 86400000);

    // 1. Histórico últimos 90d (no intercompany)
    const histMovs = await prisma.finMovement.findMany({
      where: {
        isIntercompany: false,
        date: { gte: ninetyDaysAgo, lte: today },
      },
    });
    const histIngresos = histMovs.filter((m) => m.type === "Ingreso").reduce((s, m) => s + m.amount, 0);
    const histEgresos = histMovs.filter((m) => m.type === "Egreso").reduce((s, m) => s + m.amount, 0);
    const avgDailyIngreso = histIngresos / 90;
    const avgDailyEgreso = histEgresos / 90;

    // 2. Saldo actual consolidado
    const accounts = await prisma.finAccount.findMany();
    const allMovs = await prisma.finMovement.findMany();
    const balances = new Map<number, number>();
    for (const a of accounts) balances.set(a.id, a.initialBalance || 0);
    for (const m of allMovs) {
      if (m.type === "Ingreso") balances.set(m.accountId, (balances.get(m.accountId) || 0) + m.amount);
      else if (m.type === "Egreso") balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount);
      else if (m.type === "Interbancario") {
        balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount);
        if (m.destAccountId) balances.set(m.destAccountId, (balances.get(m.destAccountId) || 0) + m.amount);
      }
    }
    const currentBalance = Array.from(balances.values()).reduce((s, v) => s + v, 0);

    // 3. Préstamos activos: intereses devengados + vencimientos
    const loans = await prisma.finLoan.findMany({ where: { status: "activo" } });
    const interestPerDay = loans.reduce((s, l) => {
      const outstanding = l.amount - (l.totalRepaid || 0);
      const annualRate = (l.interestRate || 0) / 100;
      return s + (outstanding * annualRate / 365);
    }, 0);

    const upcomingMaturity = loans
      .filter((l) => l.endDate && l.endDate > today && l.endDate < ninetyDaysAhead)
      .map((l) => ({
        loanId: l.id,
        amount: l.amount - (l.totalRepaid || 0),
        date: l.endDate,
      }));

    // 4. Construir serie diaria (30 días forecast + saldo proyectado)
    const forecast: any[] = [];
    let runningBalance = currentBalance;
    for (let i = 0; i <= 90; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const dayIngreso = avgDailyIngreso;
      const dayEgreso = avgDailyEgreso + interestPerDay;
      // Vencimientos del día
      const matToday = upcomingMaturity.filter((m) =>
        m.date && m.date.toISOString().slice(0, 10) === d.toISOString().slice(0, 10)
      ).reduce((s, m) => s + m.amount, 0);
      const dayEgresoTotal = dayEgreso + matToday;
      runningBalance += (dayIngreso - dayEgresoTotal);
      forecast.push({
        date: d.toISOString().slice(0, 10),
        balance: Math.round(runningBalance),
        ingreso: Math.round(dayIngreso),
        egreso: Math.round(dayEgresoTotal),
        hasMaturity: matToday > 0,
      });
    }

    ok(res, {
      currentBalance,
      avgDailyIngreso,
      avgDailyEgreso,
      interestPerDay,
      forecast90Days: forecast,
      upcomingMaturity,
      runwayDays: avgDailyEgreso > 0 ? Math.floor(currentBalance / (avgDailyEgreso + interestPerDay)) : null,
    });
  } catch (e) { fail(res, e); }
});

// === INSIGHTS EJECUTIVOS — alertas profesionales tipo CFO ===
router.get("/insights", async (_req, res) => {
  try {
    const today = new Date();
    const thirtyDaysAhead = new Date(today.getTime() + 30 * 86400000);
    const insights: Array<{ severity: "info" | "warn" | "red"; category: string; message: string; data?: any }> = [];

    // 1. Préstamos próximos a vencer (30 días)
    const loans = await prisma.finLoan.findMany({
      where: { status: "activo", endDate: { gte: today, lte: thirtyDaysAhead } },
      include: { lender: true, project: true },
    });
    for (const l of loans) {
      const outstanding = l.amount - (l.totalRepaid || 0);
      if (outstanding > 0) {
        const days = Math.ceil(((l.endDate?.getTime() || 0) - today.getTime()) / 86400000);
        insights.push({
          severity: days <= 7 ? "red" : days <= 15 ? "warn" : "info",
          category: "deuda",
          message: `Préstamo ${l.lender.name} vence en ${days} días con saldo de $${outstanding.toLocaleString()}`,
          data: { loanId: l.id, daysUntilDue: days, outstanding },
        });
      }
    }

    // 2. Préstamos con tasa peligrosa (>16%)
    const dangerousLoans = await prisma.finLoan.findMany({
      where: { status: "activo", interestRate: { gt: 16 } },
      include: { lender: true },
    });
    for (const l of dangerousLoans) {
      insights.push({
        severity: "red",
        category: "deuda",
        message: `${l.lender.name} tiene tasa peligrosa de ${l.interestRate}% (>16%)`,
        data: { loanId: l.id, rate: l.interestRate },
      });
    }

    // 3. Movimientos sin soporte documental (>30 días)
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
    const unsupported = await prisma.finMovement.count({
      where: {
        hasSupport: false,
        type: { in: ["Ingreso", "Egreso"] },
        date: { lt: thirtyDaysAgo, gte: new Date(today.getTime() - 180 * 86400000) },
        isIntercompany: false,
      },
    });
    if (unsupported > 5) {
      insights.push({
        severity: "warn",
        category: "documentacion",
        message: `${unsupported} movimientos de los últimos 6 meses no tienen soporte documental`,
        data: { count: unsupported },
      });
    }

    // 4. Cuentas con saldo negativo (¿error de registro?)
    const accounts = await prisma.finAccount.findMany();
    const allMovs = await prisma.finMovement.findMany();
    const balances = new Map<number, number>();
    for (const a of accounts) balances.set(a.id, a.initialBalance || 0);
    for (const m of allMovs) {
      if (m.type === "Ingreso") balances.set(m.accountId, (balances.get(m.accountId) || 0) + m.amount);
      else if (m.type === "Egreso") balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount);
      else if (m.type === "Interbancario") {
        balances.set(m.accountId, (balances.get(m.accountId) || 0) - m.amount);
        if (m.destAccountId) balances.set(m.destAccountId, (balances.get(m.destAccountId) || 0) + m.amount);
      }
    }
    for (const a of accounts) {
      const bal = balances.get(a.id) || 0;
      if (bal < -100) {
        insights.push({
          severity: "warn",
          category: "saldos",
          message: `Cuenta ${a.name} tiene saldo negativo de $${Math.round(bal).toLocaleString()} — revisa si faltan ingresos por registrar`,
          data: { accountId: a.id, balance: bal },
        });
      }
    }

    // 5. Proyectos sin movimientos en los últimos 90 días (¿abandonados?)
    const projects = await prisma.finProject.findMany({
      where: { status: { in: ["Enlistado", "En Construcción"] }, archivedAt: null },
      include: { movements: { where: { date: { gte: thirtyDaysAgo } }, take: 1 } },
    });
    for (const p of projects) {
      if (p.movements.length === 0 && (p.expectedCost || 0) > 0) {
        insights.push({
          severity: "info",
          category: "proyectos",
          message: `Proyecto ${p.name} no tiene movimientos hace >30 días`,
          data: { projectId: p.id },
        });
      }
    }

    // 6. Líneas de extracto sin conciliar (potencial olvido de registro)
    const unreconciled = await prisma.finBankStatementLine.count({
      where: { matchStatus: "unmatched" },
    });
    if (unreconciled > 0) {
      insights.push({
        severity: "warn",
        category: "conciliacion",
        message: `${unreconciled} líneas de extractos bancarios sin conciliar — posibles movimientos no registrados`,
        data: { count: unreconciled },
      });
    }

    // Ordenar por severidad
    const sevOrder = { red: 0, warn: 1, info: 2 };
    insights.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    ok(res, {
      total: insights.length,
      byCategory: insights.reduce((acc: any, i) => {
        acc[i.category] = (acc[i.category] || 0) + 1;
        return acc;
      }, {}),
      bySeverity: { red: insights.filter(i => i.severity === "red").length, warn: insights.filter(i => i.severity === "warn").length, info: insights.filter(i => i.severity === "info").length },
      insights,
    });
  } catch (e) { fail(res, e); }
});

// === RATIOS FINANCIEROS POR PROYECTO ===
router.get("/project-ratios", async (_req, res) => {
  try {
    const projects = await prisma.finProject.findMany({
      include: {
        spv: true,
        movements: { where: { isIntercompany: false } },
        loans: true,
        capitalContribs: true,
      },
    });

    const ratios = projects.map((p) => {
      const ingresos = p.movements.filter((m) => m.type === "Ingreso").reduce((s, m) => s + m.amount, 0);
      const egresos = p.movements.filter((m) => m.type === "Egreso").reduce((s, m) => s + m.amount, 0);
      const equity = p.capitalContribs.reduce((s, c) => s + c.amount, 0);
      const debt = p.loans.reduce((s, l) => s + l.amount, 0);
      const debtOutstanding = p.loans.reduce((s, l) => s + (l.amount - (l.totalRepaid || 0)), 0);

      const ltc = (p.expectedCost || 0) > 0 ? debt / (p.expectedCost || 1) : 0; // Loan-to-cost
      const ltv = (p.arv || 0) > 0 ? debt / (p.arv || 1) : 0; // Loan-to-value
      const equityRatio = (equity + debt) > 0 ? equity / (equity + debt) : 0;
      const burn = egresos / Math.max(1, p.movements.length); // promedio por movimiento
      const completionPct = (p.expectedCost || 0) > 0 ? egresos / (p.expectedCost || 1) : 0;
      const margenProyectado = (p.arv || 0) - ((p.purchasePrice || 0) + egresos);
      const margenPct = (p.arv || 0) > 0 ? margenProyectado / (p.arv || 1) : 0;

      // Semáforo: verde si margen >20%, amarillo 10-20%, rojo <10%
      const lightMargin = margenPct >= 0.20 ? "green" : margenPct >= 0.10 ? "yellow" : "red";
      const lightLTV = ltv <= 0.65 ? "green" : ltv <= 0.80 ? "yellow" : "red";
      const lightLTC = ltc <= 0.70 ? "green" : ltc <= 0.85 ? "yellow" : "red";

      return {
        id: p.id, code: p.code, name: p.name, status: p.status,
        spv: p.spv?.name,
        arv: p.arv, expectedCost: p.expectedCost, purchasePrice: p.purchasePrice,
        ingresos, egresos, equity, debt, debtOutstanding,
        ratios: { ltc, ltv, equityRatio, completionPct, margenPct, margenProyectado },
        burn: Math.round(burn),
        lights: { margin: lightMargin, ltv: lightLTV, ltc: lightLTC },
      };
    });

    ok(res, { projects: ratios });
  } catch (e) { fail(res, e); }
});

// === GET /api/finance/reports/audit-log ===
router.get("/audit-log", async (req, res) => {
  try {
    const limit = req.query.limit ? +req.query.limit : 100;
    const logs = await prisma.finActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
    });
    ok(res, logs);
  } catch (e) { fail(res, e); }
});

// Trazabilidad: para un movimiento, traer relacionados
router.get("/traceability/:movementId", async (req, res) => {
  try {
    const id = +req.params.movementId;
    const m = await prisma.finMovement.findUnique({
      where: { id },
      include: {
        account: true, destAccount: true, category: true, origin: true,
        provider: true, partner: true, lender: true, project: true,
        documents: true,
      },
    });
    if (!m) return fail(res, "not found", 404);

    const related: any[] = [];
    if (m.linkedMovementId) {
      const linked = await prisma.finMovement.findUnique({
        where: { id: m.linkedMovementId },
        include: { account: true },
      });
      if (linked) related.push({ relation: "intercompany_pair", movement: linked });
    }

    if (m.projectId) {
      const sameProject = await prisma.finMovement.count({ where: { projectId: m.projectId, NOT: { id: m.id } } });
      related.push({ relation: "same_project_count", count: sameProject });
    }

    ok(res, { movement: m, related });
  } catch (e) { fail(res, e); }
});

export default router;
