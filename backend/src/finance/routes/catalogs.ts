import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

// GET /api/catalogs — todos los catálogos en una sola llamada (frontend lo usa al cargar)
router.get("/", async (_req, res) => {
  try {
    const [spvs, accounts, partners, lenders, providers, categories, origins, projects] =
      await Promise.all([
        prisma.sPV.findMany({ orderBy: { code: "asc" } }),
        prisma.account.findMany({ orderBy: { code: "asc" }, include: { spv: true } }),
        prisma.partner.findMany({ orderBy: { code: "asc" } }),
        prisma.lender.findMany({ orderBy: { name: "asc" } }),
        prisma.provider.findMany({ orderBy: { name: "asc" } }),
        prisma.expenseCategory.findMany({ orderBy: { code: "asc" } }),
        prisma.incomeOrigin.findMany({ orderBy: { code: "asc" } }),
        prisma.project.findMany({ orderBy: { code: "asc" }, include: { spv: true } }),
      ]);
    ok(res, { spvs, accounts, partners, lenders, providers, categories, origins, projects });
  } catch (e) {
    fail(res, e);
  }
});

// SPVs
router.post("/spvs", async (req, res) => {
  try {
    const created = await prisma.sPV.create({ data: req.body });
    ok(res, created);
  } catch (e) { fail(res, e); }
});
router.patch("/spvs/:id", async (req, res) => {
  try {
    const updated = await prisma.sPV.update({ where: { id: +req.params.id }, data: req.body });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});
router.delete("/spvs/:id", async (req, res) => {
  try { await prisma.sPV.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Accounts
router.post("/accounts", async (req, res) => {
  try {
    const created = await prisma.account.create({ data: req.body });
    ok(res, created);
  } catch (e) { fail(res, e); }
});
router.patch("/accounts/:id", async (req, res) => {
  try {
    const updated = await prisma.account.update({ where: { id: +req.params.id }, data: req.body });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});
router.delete("/accounts/:id", async (req, res) => {
  try { await prisma.account.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Partners
router.post("/partners", async (req, res) => {
  try { ok(res, await prisma.partner.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/partners/:id", async (req, res) => {
  try { ok(res, await prisma.partner.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/partners/:id", async (req, res) => {
  try { await prisma.partner.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Lenders
router.post("/lenders", async (req, res) => {
  try { ok(res, await prisma.lender.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/lenders/:id", async (req, res) => {
  try { ok(res, await prisma.lender.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/lenders/:id", async (req, res) => {
  try { await prisma.lender.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Providers
router.post("/providers", async (req, res) => {
  try { ok(res, await prisma.provider.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/providers/:id", async (req, res) => {
  try { ok(res, await prisma.provider.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/providers/:id", async (req, res) => {
  try { await prisma.provider.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Categories
router.post("/categories", async (req, res) => {
  try { ok(res, await prisma.expenseCategory.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/categories/:id", async (req, res) => {
  try { ok(res, await prisma.expenseCategory.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/categories/:id", async (req, res) => {
  try { await prisma.expenseCategory.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Origins
router.post("/origins", async (req, res) => {
  try { ok(res, await prisma.incomeOrigin.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/origins/:id", async (req, res) => {
  try { ok(res, await prisma.incomeOrigin.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/origins/:id", async (req, res) => {
  try { await prisma.incomeOrigin.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

export default router;
