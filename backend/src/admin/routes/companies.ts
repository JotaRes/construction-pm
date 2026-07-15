// ============================================================
// EMPRESAS DEL GRUPO — organigrama corporativo
// ============================================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { ok, fail } from "../../finance/lib/respond";
import { deleteFromCloudinary } from "../../finance/lib/cloudinary";
import { parseOrError, companyCreateSchema, companyUpdateSchema } from "../lib/validate";
import { computeAllCompliance } from "../lib/compliance";
import { ensureDocTypesSeeded } from "../lib/seedDocTypes";

const router = Router();

// Lista plana de empresas con su SPV vinculado
router.get("/", async (_req, res) => {
  try {
    const companies = await prisma.admCompany.findMany({
      include: {
        finSpv: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { documents: true, tasks: true, children: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    ok(res, companies);
  } catch (e) { fail(res, e); }
});

// Organigrama: holding arriba, subsidiarias abajo + semáforo de cumplimiento
router.get("/orgchart", async (_req, res) => {
  try {
    await ensureDocTypesSeeded();
    const [companies, compliance] = await Promise.all([
      prisma.admCompany.findMany({
        include: {
          finSpv: { select: { id: true, code: true, name: true } },
          _count: { select: { documents: true, tasks: true } },
        },
        orderBy: { name: "asc" },
      }),
      computeAllCompliance(),
    ]);

    const withCompliance = companies.map((c) => ({
      ...c,
      compliance: compliance.get(c.id) ?? null,
    }));

    const holding = withCompliance.find((c) => c.role === "HOLDING") ?? null;
    const subsidiaries = withCompliance.filter(
      (c) => c.role !== "HOLDING" && (holding ? c.parentId === holding.id || c.parentId === null : true)
    );

    ok(res, { holding, subsidiaries, all: withCompliance });
  } catch (e) { fail(res, e); }
});

// Detalle de una empresa
router.get("/:id", async (req, res) => {
  try {
    const company = await prisma.admCompany.findUnique({
      where: { id: +req.params.id },
      include: {
        finSpv: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, role: true } },
      },
    });
    if (!company) return fail(res, "Empresa no encontrada", 404);
    ok(res, company);
  } catch (e) { fail(res, e); }
});

// Crear empresa. Si es la primera HOLDING, las demás se le pueden colgar.
router.post("/", async (req, res) => {
  try {
    const { data, error } = parseOrError(companyCreateSchema, req.body);
    if (error !== null) return fail(res, error, 400);

    // Regla de negocio: solo puede existir UNA holding en el organigrama
    if (data.role === "HOLDING") {
      const existing = await prisma.admCompany.findFirst({ where: { role: "HOLDING" } });
      if (existing) return fail(res, `Ya existe una holding (${existing.name}). Cambia su rol primero si quieres reemplazarla.`, 400);
    }

    const created = await prisma.admCompany.create({ data });

    // Aplicar requisitos por defecto del due diligence a la empresa nueva
    const defaults = await prisma.admDocType.findMany({ where: { defaultRequired: true } });
    if (defaults.length > 0) {
      await prisma.admRequirement.createMany({
        data: defaults.map((t) => ({ companyId: created.id, docTypeId: t.id, required: true })),
        skipDuplicates: true,
      });
    }
    ok(res, created);
  } catch (e) { fail(res, e); }
});

// Importar empresas desde los SPVs del módulo financiero (no duplica:
// solo crea las que aún no tienen empresa administrativa vinculada)
router.post("/import-spvs", async (_req, res) => {
  try {
    await ensureDocTypesSeeded();
    const spvs = await prisma.finSPV.findMany({ include: { admCompany: { select: { id: true } } } });
    const pending = spvs.filter((s) => !s.admCompany);
    const defaults = await prisma.admDocType.findMany({ where: { defaultRequired: true } });

    const created = [];
    for (const spv of pending) {
      const company = await prisma.admCompany.create({
        data: {
          name: spv.name,
          role: /holding/i.test(spv.name) ? "HOLDING" : "SUBSIDIARY_OWNER",
          finSpvId: spv.id,
          notes: spv.notes ?? null,
        },
      });
      if (defaults.length > 0) {
        await prisma.admRequirement.createMany({
          data: defaults.map((t) => ({ companyId: company.id, docTypeId: t.id, required: true })),
          skipDuplicates: true,
        });
      }
      created.push(company);
    }

    // Si hay holding, colgar automáticamente las subsidiarias sin padre
    const holding = await prisma.admCompany.findFirst({ where: { role: "HOLDING" } });
    if (holding) {
      await prisma.admCompany.updateMany({
        where: { role: { not: "HOLDING" }, parentId: null },
        data: { parentId: holding.id },
      });
    }

    ok(res, { imported: created.length, skipped: spvs.length - pending.length, companies: created });
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const { data, error } = parseOrError(companyUpdateSchema, req.body);
    if (error !== null) return fail(res, error, 400);

    const id = +req.params.id;
    if (data.parentId === id) return fail(res, "Una empresa no puede ser su propio padre", 400);
    if (data.role === "HOLDING") {
      const existing = await prisma.admCompany.findFirst({ where: { role: "HOLDING", id: { not: id } } });
      if (existing) return fail(res, `Ya existe una holding (${existing.name}).`, 400);
    }

    const updated = await prisma.admCompany.update({ where: { id }, data });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

// Suprimir empresa. Borra en cascada su expediente (documentos incluidos
// los archivos en Cloudinary), requisitos y tareas. Los datos financieros
// del SPV vinculado NO se tocan (el vínculo es SetNull).
router.delete("/:id", async (req, res) => {
  try {
    const id = +req.params.id;
    const company = await prisma.admCompany.findUnique({
      where: { id },
      include: { documents: { select: { publicId: true, mimetype: true } }, children: { select: { id: true } } },
    });
    if (!company) return fail(res, "Empresa no encontrada", 404);
    if (company.children.length > 0) {
      return fail(res, "Esta empresa tiene subsidiarias colgadas. Reasígnalas o elimínalas primero.", 400);
    }

    for (const doc of company.documents) {
      if (doc.publicId) {
        const rt = doc.mimetype?.startsWith("image/") ? "image" : doc.mimetype?.startsWith("video/") ? "video" : "raw";
        await deleteFromCloudinary(doc.publicId, rt);
      }
    }
    await prisma.admCompany.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

export default router;
