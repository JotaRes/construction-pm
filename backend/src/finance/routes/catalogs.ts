import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";
import { seedFinanceCatalogs } from "../services/seedCatalogs";
import {
  parseOrError,
  spvCreateSchema, spvUpdateSchema,
  accountCreateSchema, accountUpdateSchema,
  partnerCreateSchema, partnerUpdateSchema,
  lenderCreateSchema, lenderUpdateSchema,
  providerCreateSchema, providerUpdateSchema,
  expenseCategoryCreateSchema, expenseCategoryUpdateSchema,
  incomeOriginCreateSchema, incomeOriginUpdateSchema,
} from "../lib/validate";
import type { z } from "zod";

const router = Router();

// Valida el body contra el schema y devuelve los datos limpios, o responde 400.
// Devuelve null si hubo error (el caller debe cortar). Zod descarta campos
// desconocidos, así que lo que pasa a Prisma es exactamente lo permitido.
function validated<T>(schema: z.ZodType<T>, req: any, res: any): T | null {
  const { data, error } = parseOrError(schema, req.body);
  if (error !== null) { fail(res, error, 400); return null; }
  return data;
}

// POST /api/finance/catalogs/seed-defaults — siembra catálogos por defecto
// (SPVs, cuentas, socios, lenders, categorías, orígenes, proyectos)
// Idempotente: usa upsert por code/name. Útil para inicializar producción.
router.post("/seed-defaults", async (_req, res) => {
  try {
    const counts = await seedFinanceCatalogs();
    ok(res, { seeded: true, counts });
  } catch (e) { fail(res, e); }
});

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
    const data = validated(spvCreateSchema, req, res); if (!data) return;
    ok(res, await prisma.finSPV.create({ data }));
  } catch (e) { fail(res, e); }
});
router.patch("/spvs/:id", async (req, res) => {
  try {
    const data = validated(spvUpdateSchema, req, res); if (!data) return;
    ok(res, await prisma.finSPV.update({ where: { id: +req.params.id }, data }));
  } catch (e) { fail(res, e); }
});
router.delete("/spvs/:id", async (req, res) => {
  try { await prisma.finSPV.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Accounts
router.post("/accounts", async (req, res) => {
  try {
    const data = validated(accountCreateSchema, req, res); if (!data) return;
    ok(res, await prisma.finAccount.create({ data: data as any }));
  } catch (e) { fail(res, e); }
});
router.patch("/accounts/:id", async (req, res) => {
  try {
    const data = validated(accountUpdateSchema, req, res); if (!data) return;
    const { code, ...editable } = data;
    ok(res, await prisma.finAccount.update({ where: { id: +req.params.id }, data: editable as any }));
  } catch (e) { fail(res, e); }
});
router.delete("/accounts/:id", async (req, res) => {
  try { await prisma.finAccount.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Partners
router.post("/partners", async (req, res) => {
  try { const data = validated(partnerCreateSchema, req, res); if (!data) return; ok(res, await prisma.finPartner.create({ data })); } catch (e) { fail(res, e); }
});
router.patch("/partners/:id", async (req, res) => {
  try { const data = validated(partnerUpdateSchema, req, res); if (!data) return; ok(res, await prisma.finPartner.update({ where: { id: +req.params.id }, data })); } catch (e) { fail(res, e); }
});
router.delete("/partners/:id", async (req, res) => {
  try { await prisma.finPartner.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Lenders
router.post("/lenders", async (req, res) => {
  try { const data = validated(lenderCreateSchema, req, res); if (!data) return; ok(res, await prisma.finLender.create({ data: data as any })); } catch (e) { fail(res, e); }
});
router.patch("/lenders/:id", async (req, res) => {
  try { const data = validated(lenderUpdateSchema, req, res); if (!data) return; ok(res, await prisma.finLender.update({ where: { id: +req.params.id }, data: data as any })); } catch (e) { fail(res, e); }
});
router.delete("/lenders/:id", async (req, res) => {
  try { await prisma.finLender.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Providers
router.post("/providers", async (req, res) => {
  try { const data = validated(providerCreateSchema, req, res); if (!data) return; ok(res, await prisma.finProvider.create({ data })); } catch (e) { fail(res, e); }
});
router.patch("/providers/:id", async (req, res) => {
  try { const data = validated(providerUpdateSchema, req, res); if (!data) return; ok(res, await prisma.finProvider.update({ where: { id: +req.params.id }, data })); } catch (e) { fail(res, e); }
});
router.delete("/providers/:id", async (req, res) => {
  try { await prisma.finProvider.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Categories
router.post("/categories", async (req, res) => {
  try { const data = validated(expenseCategoryCreateSchema, req, res); if (!data) return; ok(res, await prisma.finExpenseCategory.create({ data })); } catch (e) { fail(res, e); }
});
router.patch("/categories/:id", async (req, res) => {
  try { const data = validated(expenseCategoryUpdateSchema, req, res); if (!data) return; ok(res, await prisma.finExpenseCategory.update({ where: { id: +req.params.id }, data })); } catch (e) { fail(res, e); }
});
router.delete("/categories/:id", async (req, res) => {
  try { await prisma.finExpenseCategory.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// Origins
router.post("/origins", async (req, res) => {
  try { const data = validated(incomeOriginCreateSchema, req, res); if (!data) return; ok(res, await prisma.finIncomeOrigin.create({ data })); } catch (e) { fail(res, e); }
});
router.patch("/origins/:id", async (req, res) => {
  try { const data = validated(incomeOriginUpdateSchema, req, res); if (!data) return; ok(res, await prisma.finIncomeOrigin.update({ where: { id: +req.params.id }, data })); } catch (e) { fail(res, e); }
});
router.delete("/origins/:id", async (req, res) => {
  try { await prisma.finIncomeOrigin.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

export default router;
