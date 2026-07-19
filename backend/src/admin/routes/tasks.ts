// ============================================================
// TAREAS ADMINISTRATIVAS
// ============================================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { ok, fail } from "../../finance/lib/respond";
import { parseOrError, taskCreateSchema, taskUpdateSchema } from "../lib/validate";

const router = Router();

// Resumen para el menú lateral y señalización de alertas:
// pendientes, vencidas y próximas a vencer (7 días), por relevancia.
router.get("/summary", async (_req, res) => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 86_400_000);
    const [pending, overdue, dueSoon, highPriority] = await Promise.all([
      prisma.admTask.count({ where: { status: { not: "completada" } } }),
      prisma.admTask.count({ where: { status: { not: "completada" }, dueDate: { lt: now } } }),
      prisma.admTask.count({ where: { status: { not: "completada" }, dueDate: { gte: now, lte: soon } } }),
      prisma.admTask.count({ where: { status: { not: "completada" }, priority: "alta" } }),
    ]);
    ok(res, { pending, overdue, dueSoon, highPriority });
  } catch (e) { fail(res, e); }
});

// Lista con filtros: ?companyId= & ?personId= & ?status=
router.get("/", async (req, res) => {
  try {
    const companyId = req.query.companyId ? +String(req.query.companyId) : undefined;
    const personId = req.query.personId ? +String(req.query.personId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const tasks = await prisma.admTask.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(personId ? { personId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        person: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    ok(res, tasks);
  } catch (e) { fail(res, e); }
});

router.post("/", async (req, res) => {
  try {
    const { data, error } = parseOrError(taskCreateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const created = await prisma.admTask.create({
      data,
      include: {
        company: { select: { id: true, name: true } },
        person: { select: { id: true, name: true } },
      },
    });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const { data, error } = parseOrError(taskUpdateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const updated = await prisma.admTask.update({
      where: { id: +req.params.id },
      data: {
        ...data,
        // Registrar cuándo se completó (y limpiar si se reabre)
        ...(data.status === "completada" ? { completedAt: new Date() } : {}),
        ...(data.status && data.status !== "completada" ? { completedAt: null } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        person: { select: { id: true, name: true } },
      },
    });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.admTask.delete({ where: { id: +req.params.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

export default router;
