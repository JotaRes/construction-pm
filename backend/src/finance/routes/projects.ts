import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const projects = await prisma.finProject.findMany({
      include: { spv: true, _count: { select: { movements: true, loans: true, documents: true } } },
      orderBy: { code: "asc" },
    });
    ok(res, projects);
  } catch (e) { fail(res, e); }
});

router.get("/:id", async (req, res) => {
  try {
    const project = await prisma.finProject.findUnique({
      where: { id: +req.params.id },
      include: {
        spv: true,
        movements: { include: { account: true, category: true, origin: true, provider: true }, orderBy: { date: "desc" } },
        capitalContribs: { include: { partner: true }, orderBy: { date: "desc" } },
        loans: { include: { lender: true }, orderBy: { date: "desc" } },
        nonBankContribs: { include: { partner: true }, orderBy: { date: "desc" } },
        documents: { orderBy: { uploadedAt: "desc" } },
      },
    });
    if (!project) return fail(res, "not found", 404);
    ok(res, project);
  } catch (e) { fail(res, e); }
});

router.post("/", async (req, res) => {
  try {
    const created = await prisma.finProject.create({ data: req.body });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const updated = await prisma.finProject.update({ where: { id: +req.params.id }, data: req.body });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.finProject.delete({ where: { id: +req.params.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// GET /api/projects/:id/summary — KPIs por proyecto
router.get("/:id/summary", async (req, res) => {
  try {
    const id = +req.params.id;
    const project = await prisma.finProject.findUnique({ where: { id } });
    if (!project) return fail(res, "not found", 404);

    const movements = await prisma.finMovement.findMany({
      where: { projectId: id, isIntercompany: false },
    });

    const ingresos = movements.filter((m) => m.type === "Ingreso").reduce((s, m) => s + m.amount, 0);
    const egresos = movements.filter((m) => m.type === "Egreso").reduce((s, m) => s + m.amount, 0);
    const neto = ingresos - egresos;

    const capitalContribs = await prisma.finCapitalContribution.findMany({ where: { projectId: id }, include: { partner: true } });
    const loans = await prisma.finLoan.findMany({ where: { projectId: id }, include: { lender: true } });

    const equityTotal = capitalContribs.reduce((s, c) => s + c.amount, 0);
    const debtTotal = loans.reduce((s, l) => s + l.amount, 0);
    const debtOutstanding = loans.reduce((s, l) => s + (l.amount - (l.totalRepaid || 0)), 0);

    const costoReal = egresos;
    const gananciaEst = (project.arv || 0) - costoReal;
    const roiEst = costoReal > 0 ? (gananciaEst / costoReal) : 0;
    const pctCosto = project.arv > 0 ? costoReal / project.arv : 0;

    ok(res, {
      project,
      kpis: { ingresos, egresos, neto, costoReal, gananciaEst, roiEst, pctCosto, equityTotal, debtTotal, debtOutstanding, movementCount: movements.length },
      capitalContribs,
      loans,
    });
  } catch (e) { fail(res, e); }
});

export default router;
