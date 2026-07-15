// ============================================================
// TAREAS ADMINISTRATIVAS
// ============================================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { ok, fail } from "../../finance/lib/respond";
import { parseOrError, taskCreateSchema, taskUpdateSchema } from "../lib/validate";

const router = Router();

// Lista con filtros: ?companyId= & ?status=
router.get("/", async (req, res) => {
  try {
    const companyId = req.query.companyId ? +String(req.query.companyId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const tasks = await prisma.admTask.findMany({
      where: { ...(companyId ? { companyId } : {}), ...(status ? { status } : {}) },
      include: { company: { select: { id: true, name: true } } },
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
      include: { company: { select: { id: true, name: true } } },
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
      include: { company: { select: { id: true, name: true } } },
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
