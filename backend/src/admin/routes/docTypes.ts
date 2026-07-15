// ============================================================
// CATÁLOGO DE TIPOS DOCUMENTALES + REQUISITOS POR EMPRESA
// ============================================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { ok, fail } from "../../finance/lib/respond";
import { parseOrError, docTypeCreateSchema, docTypeUpdateSchema, requirementToggleSchema } from "../lib/validate";
import { ensureDocTypesSeeded } from "../lib/seedDocTypes";
import { computeCompliance } from "../lib/compliance";

const router = Router();

// Catálogo completo (siembra los defaults la primera vez)
router.get("/", async (_req, res) => {
  try {
    await ensureDocTypesSeeded();
    const types = await prisma.admDocType.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
    ok(res, types);
  } catch (e) { fail(res, e); }
});

router.post("/", async (req, res) => {
  try {
    const { data, error } = parseOrError(docTypeCreateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    ok(res, await prisma.admDocType.create({ data }));
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const { data, error } = parseOrError(docTypeUpdateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    ok(res, await prisma.admDocType.update({ where: { id: +req.params.id }, data }));
  } catch (e) { fail(res, e); }
});

router.delete("/:id", async (req, res) => {
  try {
    const docs = await prisma.admDocument.count({ where: { docTypeId: +req.params.id } });
    if (docs > 0) return fail(res, `Hay ${docs} documento(s) clasificados con este tipo. Reclasifícalos primero.`, 400);
    await prisma.admDocType.delete({ where: { id: +req.params.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// === REQUISITOS (checklist de cumplimiento) por empresa ===

// Checklist con semáforo: qué debe tener la empresa y en qué estado está
router.get("/companies/:companyId/checklist", async (req, res) => {
  try {
    await ensureDocTypesSeeded();
    ok(res, await computeCompliance(+req.params.companyId));
  } catch (e) { fail(res, e); }
});

// Requisitos configurados (para activar/desactivar tipos exigidos)
router.get("/companies/:companyId/requirements", async (req, res) => {
  try {
    const reqs = await prisma.admRequirement.findMany({
      where: { companyId: +req.params.companyId },
      include: { docType: true },
    });
    ok(res, reqs);
  } catch (e) { fail(res, e); }
});

// Activar/desactivar un requisito (upsert)
router.put("/companies/:companyId/requirements", async (req, res) => {
  try {
    const { data, error } = parseOrError(requirementToggleSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const companyId = +req.params.companyId;
    const saved = await prisma.admRequirement.upsert({
      where: { companyId_docTypeId: { companyId, docTypeId: data.docTypeId } },
      create: { companyId, docTypeId: data.docTypeId, required: data.required, notes: data.notes ?? null },
      update: { required: data.required, notes: data.notes ?? null },
    });
    ok(res, saved);
  } catch (e) { fail(res, e); }
});

// Aplicar los requisitos por defecto del catálogo a una empresa
router.post("/companies/:companyId/requirements/apply-defaults", async (req, res) => {
  try {
    await ensureDocTypesSeeded();
    const defaults = await prisma.admDocType.findMany({ where: { defaultRequired: true } });
    const created = await prisma.admRequirement.createMany({
      data: defaults.map((t) => ({ companyId: +req.params.companyId, docTypeId: t.id, required: true })),
      skipDuplicates: true,
    });
    ok(res, { applied: created.count });
  } catch (e) { fail(res, e); }
});

export default router;
