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
