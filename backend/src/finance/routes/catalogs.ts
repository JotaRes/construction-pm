import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

// GET /api/catalogs — todos los catálogos en una sola llamada (frontend lo usa al cargar)
router.get("/", async (_req, res) => {
  try {
    const [spvs, accounts, partners, lenders, providers, categories, origins, projects] =
      await Promise.all([
        prisma.finSPV.findMany({ orderBy: { code: "asc" } }),
        prisma.finAccount.findMany({ orderBy: { code: "asc" }, include: { spv: true } }),
        prisma.finPartner.findMany({ orderBy: { code: "asc" } }),
        prisma.finLender.findMany({ orderBy: { name: "asc" } }),
        prisma.finProvider.findMany({ orderBy: { name: "asc" } }),
        prisma.finExpenseCategory.findMany({ orderBy: { code: "asc" } }),
        prisma.finIncomeOrigin.findMany({ orderBy: { code: "asc" } }),
        prisma.finProject.findMany({ orderBy: { code: "asc" }, include: { spv: true } }),
      ]);
    ok(res, { spvs, accounts, partners, lenders, providers, categories, origins, projects });
  } catch (e) {
    fail(res, e);
  }
});

// SPVs
router.post("/spvs", async (req, res) => {
  try {
    const created = await prisma.finSPV.create({ data: req.body });
    ok(res, created);
  } catch (e) { fail(res, e); }
});
router.patch("/spvs/:id", async (req, res) => {
  try {
    const updated = await prisma.finSPV.update({ where: { id: +req.params.id }, data: req.body });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});
router.delete("/spvs/:id", async (req, res) => {
  try { await prisma.finSPV.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Accounts
router.post("/accounts", async (req, res) => {
  try {
    const created = await prisma.finAccount.create({ data: req.body });
    ok(res, created);
  } catch (e) { fail(res, e); }
});
router.patch("/accounts/:id", async (req, res) => {
  try {
    const updated = await prisma.finAccount.update({ where: { id: +req.params.id }, data: req.body });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});
router.delete("/accounts/:id", async (req, res) => {
  try { await prisma.finAccount.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Partners
router.post("/partners", async (req, res) => {
  try { ok(res, await prisma.finPartner.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/partners/:id", async (req, res) => {
  try { ok(res, await prisma.finPartner.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/partners/:id", async (req, res) => {
  try { await prisma.finPartner.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Lenders
router.post("/lenders", async (req, res) => {
  try { ok(res, await prisma.finLender.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/lenders/:id", async (req, res) => {
  try { ok(res, await prisma.finLender.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/lenders/:id", async (req, res) => {
  try { await prisma.finLender.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Providers
router.post("/providers", async (req, res) => {
  try { ok(res, await prisma.finProvider.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/providers/:id", async (req, res) => {
  try { ok(res, await prisma.finProvider.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/providers/:id", async (req, res) => {
  try { await prisma.finProvider.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Categories
router.post("/categories", async (req, res) => {
  try { ok(res, await prisma.finExpenseCategory.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/categories/:id", async (req, res) => {
  try { ok(res, await prisma.finExpenseCategory.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/categories/:id", async (req, res) => {
  try { await prisma.finExpenseCategory.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Origins
router.post("/origins", async (req, res) => {
  try { ok(res, await prisma.finIncomeOrigin.create({ data: req.body })); } catch (e) { fail(res, e); }
});
router.patch("/origins/:id", async (req, res) => {
  try { ok(res, await prisma.finIncomeOrigin.update({ where: { id: +req.params.id }, data: req.body })); } catch (e) { fail(res, e); }
});
router.delete("/origins/:id", async (req, res) => {
  try { await prisma.finIncomeOrigin.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

export default router;
