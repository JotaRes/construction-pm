import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

const includeAll = {
  account: true,
  destAccount: true,
  category: true,
  origin: true,
  provider: true,
  partner: true,
  lender: true,
  project: true,
  documents: true,
};

router.get("/", async (req, res) => {
  try {
    const { accountId, projectId, partnerId, categoryId, originId, providerId, lenderId, type, from, to, q, needsReview, isIntercompany, isReconciled, limit, offset } = req.query as Record<string, string>;
    const where: any = {};
    if (accountId) where.accountId = +accountId;
    if (projectId) where.projectId = +projectId;
    if (partnerId) where.partnerId = +partnerId;
    if (categoryId) where.categoryId = +categoryId;
    if (originId) where.originId = +originId;
    if (providerId) where.providerId = +providerId;
    if (lenderId) where.lenderId = +lenderId;
    if (type) where.type = type;
    if (needsReview === "true") where.needsReview = true;
    if (isIntercompany === "true") where.isIntercompany = true;
    if (isReconciled === "false") where.isReconciled = false;
    if (from || to) where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
    if (q) {
      where.OR = [
        { concept: { contains: q } },
        { notes: { contains: q } },
      ];
    }
    const take = limit ? Math.min(+limit, 5000) : 500;
    const skip = offset ? +offset : 0;
    const [movements, total] = await Promise.all([
      prisma.movement.findMany({ where, include: includeAll, orderBy: { date: "desc" }, take, skip }),
      prisma.movement.count({ where }),
    ]);
    ok(res, { movements, total });
  } catch (e) { fail(res, e); }
});

router.get("/:id", async (req, res) => {
  try {
    const m = await prisma.movement.findUnique({ where: { id: +req.params.id }, include: includeAll });
    if (!m) return fail(res, "not found", 404);
    ok(res, m);
  } catch (e) { fail(res, e); }
});

router.post("/", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    const created = await prisma.movement.create({ data, include: includeAll });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    delete data.id;
    delete data.account;
    delete data.destAccount;
    delete data.category;
    delete data.origin;
    delete data.provider;
    delete data.partner;
    delete data.lender;
    delete data.project;
    delete data.documents;
    delete data.linkedMovement;
    delete data.linkedFrom;
    delete data.loan;
    const updated = await prisma.movement.update({ where: { id: +req.params.id }, data, include: includeAll });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.movement.delete({ where: { id: +req.params.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// POST /api/movements/detect-intercompany — corre el detector automático
router.post("/detect-intercompany", async (_req, res) => {
  try {
    const { detectIntercompany } = await import("../services/intercompany");
    const result = await detectIntercompany();
    ok(res, result);
  } catch (e) { fail(res, e); }
});

// POST /api/movements/:id/link/:otherId — vincular manualmente
router.post("/:id/link/:otherId", async (req, res) => {
  try {
    const a = +req.params.id;
    const b = +req.params.otherId;
    await prisma.$transaction([
      prisma.movement.update({ where: { id: a }, data: { isIntercompany: true, linkedMovementId: b } }),
      prisma.movement.update({ where: { id: b }, data: { isIntercompany: true } }),
    ]);
    ok(res, { linked: [a, b] });
  } catch (e) { fail(res, e); }
});

router.post("/:id/unlink", async (req, res) => {
  try {
    const id = +req.params.id;
    const m = await prisma.movement.findUnique({ where: { id } });
    if (!m) return fail(res, "not found", 404);
    const other = m.linkedMovementId;
    await prisma.movement.update({ where: { id }, data: { isIntercompany: false, linkedMovementId: null } });
    if (other) await prisma.movement.update({ where: { id: other }, data: { isIntercompany: false, linkedMovementId: null } }).catch(() => {});
    ok(res, { unlinked: true });
  } catch (e) { fail(res, e); }
});

export default router;
