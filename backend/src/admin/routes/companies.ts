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
import { SPVS } from "../../finance/data/catalogs";

const router = Router();

// Aplica los requisitos por defecto del due diligence a una empresa nueva.
async function applyDefaultRequirements(companyId: number) {
  const defaults = await prisma.admDocType.findMany({ where: { defaultRequired: true } });
  if (defaults.length > 0) {
    await prisma.admRequirement.createMany({
      data: defaults.map((t) => ({ companyId, docTypeId: t.id, required: true })),
      skipDuplicates: true,
    });
  }
}

// Crea una AdmCompany por cada SPV del módulo financiero que aún no tenga
// empresa administrativa. Si la tabla FinSPV está vacía, usa el catálogo
// maestro SPVS como respaldo — así el organigrama SIEMPRE puede poblarse.
// Detecta la holding por el nombre y cuelga de ella las subsidiarias sin padre.
export async function provisionCompaniesFromSPVs(): Promise<{ imported: number; skipped: number }> {
  await ensureDocTypesSeeded();
  const spvs = await prisma.finSPV.findMany({ include: { admCompany: { select: { id: true } } } });

  let imported = 0;
  let skipped = 0;

  if (spvs.length > 0) {
    for (const spv of spvs) {
      if (spv.admCompany) { skipped++; continue; }
      const company = await prisma.admCompany.create({
        data: {
          name: spv.name,
          role: /holding/i.test(spv.name) ? "HOLDING" : "SUBSIDIARY_OWNER",
          finSpvId: spv.id,
          notes: spv.notes ?? null,
        },
      });
      await applyDefaultRequirements(company.id);
      imported++;
    }
  } else {
    // Respaldo: sin SPVs en la BD → sembrar desde el catálogo maestro.
    for (const s of SPVS) {
      const exists = await prisma.admCompany.findFirst({ where: { name: s.name } });
      if (exists) { skipped++; continue; }
      const company = await prisma.admCompany.create({
        data: { name: s.name, role: /holding/i.test(s.name) ? "HOLDING" : "SUBSIDIARY_OWNER" },
      });
      await applyDefaultRequirements(company.id);
      imported++;
    }
  }

  // Colgar las subsidiarias sin padre bajo la holding.
  const holding = await prisma.admCompany.findFirst({ where: { role: "HOLDING" } });
  if (holding) {
    await prisma.admCompany.updateMany({
      where: { role: { not: "HOLDING" }, parentId: null, id: { not: holding.id } },
      data: { parentId: holding.id },
    });
  }

  return { imported, skipped };
}

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

// Organigrama: holding arriba, subsidiarias abajo + semáforo de cumplimiento +
// proyectos a cargo de cada LLC (carga operativa) + tareas vencidas a la vista.
router.get("/orgchart", async (_req, res) => {
  try {
    await ensureDocTypesSeeded();
    // Poblar el organigrama automáticamente la primera vez (aún sin empresas).
    if ((await prisma.admCompany.count()) === 0) {
      await provisionCompaniesFromSPVs();
    }
    const now = new Date();
    const [companies, compliance, overdueByCompany, pendingByCompany] = await Promise.all([
      prisma.admCompany.findMany({
        include: {
          finSpv: {
            select: {
              id: true, code: true, name: true,
              projects: { select: { id: true, code: true, name: true, status: true }, where: { archivedAt: null } },
            },
          },
          finProjectsDirect: { select: { id: true, code: true, name: true, status: true }, where: { archivedAt: null } },
          techProjects: { select: { id: true, name: true, photoUrl: true, constructionBudget: true, loanAmount: true } },
          _count: { select: { documents: true, tasks: true } },
        },
        orderBy: { name: "asc" },
      }),
      computeAllCompliance(),
      prisma.admTask.groupBy({
        by: ["companyId"],
        where: { companyId: { not: null }, status: { not: "completada" }, dueDate: { lt: now } },
        _count: { _all: true },
      }),
      prisma.admTask.groupBy({
        by: ["companyId"],
        where: { companyId: { not: null }, status: { not: "completada" } },
        _count: { _all: true },
      }),
    ]);
    const overdueOf = new Map(overdueByCompany.map((t) => [t.companyId, t._count._all]));
    const pendingOf = new Map(pendingByCompany.map((t) => [t.companyId, t._count._all]));

    const withCompliance = companies.map((c) => {
      // Propiedades = derivadas del SPV + asignadas directamente (sin duplicar)
      const viaSpv = c.finSpv?.projects ?? [];
      const direct = (c as any).finProjectsDirect ?? [];
      const seen = new Set(viaSpv.map((p: any) => p.id));
      return {
        ...c,
        compliance: compliance.get(c.id) ?? null,
        overdueTasks: overdueOf.get(c.id) ?? 0,
        pendingTasks: pendingOf.get(c.id) ?? 0,
        finProjects: [...viaSpv, ...direct.filter((p: any) => !seen.has(p.id))],
      };
    });

    const holding = withCompliance.find((c) => c.role === "HOLDING") ?? null;
    const subsidiaries = withCompliance.filter(
      (c) => c.role !== "HOLDING" && (holding ? c.parentId === holding.id || c.parentId === null : true)
    );

    ok(res, { holding, subsidiaries, all: withCompliance });
  } catch (e) { fail(res, e); }
});

// === PROYECTOS / PROPIEDADES A CARGO DE UNA EMPRESA ======================
// techProjects: obras del módulo técnico asignadas a esta LLC (FK directa).
// finProjects: propiedades del portafolio financiero, derivadas del SPV
// vinculado (no se almacena doble — un solo origen de verdad).
// availableTech: obras sin LLC asignada (para el selector de asignación).
router.get("/:id/projects", async (req, res) => {
  try {
    const id = +req.params.id;
    const company = await prisma.admCompany.findUnique({
      where: { id },
      select: { id: true, finSpvId: true },
    });
    if (!company) return fail(res, "Empresa no encontrada", 404);

    const [techProjects, availableTech, finViaSpv, finDirect, availableFin] = await Promise.all([
      prisma.project.findMany({
        where: { admCompanyId: id },
        select: {
          id: true, name: true, address: true, photoUrl: true,
          constructionBudget: true, loanAmount: true, arv: true, spv: true,
          phases: { select: { items: { select: { esNA: true, completado: true, valorEjecutado: true, valorPresupuestado: true } } } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.project.findMany({
        where: { admCompanyId: null },
        select: { id: true, name: true, address: true },
        orderBy: { name: "asc" },
      }),
      company.finSpvId
        ? prisma.finProject.findMany({
            where: { spvId: company.finSpvId, archivedAt: null },
            select: { id: true, code: true, name: true, status: true, address: true, purchasePrice: true, arv: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([] as any[]),
      prisma.finProject.findMany({
        where: { admCompanyId: id, archivedAt: null },
        select: { id: true, code: true, name: true, status: true, address: true, purchasePrice: true, arv: true },
        orderBy: { name: "asc" },
      }),
      // Propiedades disponibles para asignación directa: sin empresa asignada
      // (las derivadas de un SPV vinculado a OTRA empresa se excluyen en el front
      // solo visualmente; aquí basta con que no tengan asignación directa).
      prisma.finProject.findMany({
        where: { admCompanyId: null, archivedAt: null },
        select: { id: true, code: true, name: true, status: true, address: true, spvId: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Unión sin duplicados: SPV manda; la directa complementa (Vero Beach, Holiday…)
    const seenFin = new Set(finViaSpv.map((p: any) => p.id));
    const finProjects = [
      ...finViaSpv.map((p: any) => ({ ...p, source: "SPV" as const })),
      ...finDirect.filter((p: any) => !seenFin.has(p.id)).map((p: any) => ({ ...p, source: "DIRECTA" as const })),
    ];
    // No ofrecer en el selector las que ya se ven vía SPV de esta empresa
    const availableFinClean = availableFin.filter((p: any) => !seenFin.has(p.id));

    // Avance físico y carga económica de cada obra (para evaluar la carga de la LLC)
    const tech = techProjects.map((p) => {
      const items = p.phases.flatMap((ph) => ph.items).filter((i) => !i.esNA);
      const done = items.filter((i) => i.completado).length;
      const ejec = items.reduce((s, i) => s + i.valorEjecutado, 0);
      const budget = items.reduce((s, i) => s + i.valorPresupuestado, 0);
      const { phases: _omit, ...rest } = p as any;
      return {
        ...rest,
        avancePct: items.length ? Math.round((done / items.length) * 100) : 0,
        ejecutado: ejec,
        presupuestado: budget,
      };
    });

    ok(res, { techProjects: tech, finProjects, availableTech, availableFin: availableFinClean });
  } catch (e) { fail(res, e); }
});

// Asignar DIRECTAMENTE una propiedad del portafolio financiero a esta empresa
// (para propiedades sin SPV vinculado, p.ej. Vero Beach y Holiday)
router.post("/:id/assign-fin-project", async (req, res) => {
  try {
    const id = +req.params.id;
    const finProjectId = +String(req.body?.finProjectId ?? 0);
    if (!finProjectId) return fail(res, "finProjectId es obligatorio", 400);
    const [company, finProject] = await Promise.all([
      prisma.admCompany.findUnique({ where: { id }, select: { id: true } }),
      prisma.finProject.findUnique({ where: { id: finProjectId }, select: { id: true, admCompanyId: true, name: true } }),
    ]);
    if (!company) return fail(res, "Empresa no encontrada", 404);
    if (!finProject) return fail(res, "Propiedad no encontrada", 404);
    if (finProject.admCompanyId && finProject.admCompanyId !== id) {
      return fail(res, `"${finProject.name}" ya está asignada a otra empresa. Desasígnala primero.`, 400);
    }
    await prisma.finProject.update({ where: { id: finProjectId }, data: { admCompanyId: id } });
    ok(res, { assigned: true });
  } catch (e) { fail(res, e); }
});

router.post("/:id/unassign-fin-project", async (req, res) => {
  try {
    const id = +req.params.id;
    const finProjectId = +String(req.body?.finProjectId ?? 0);
    const finProject = await prisma.finProject.findUnique({ where: { id: finProjectId }, select: { id: true, admCompanyId: true } });
    if (!finProject) return fail(res, "Propiedad no encontrada", 404);
    if (finProject.admCompanyId !== id) return fail(res, "Esa propiedad no está asignada directamente a esta empresa", 400);
    await prisma.finProject.update({ where: { id: finProjectId }, data: { admCompanyId: null } });
    ok(res, { unassigned: true });
  } catch (e) { fail(res, e); }
});

// Asignar una obra del módulo técnico a esta LLC
router.post("/:id/assign-project", async (req, res) => {
  try {
    const id = +req.params.id;
    const projectId = String(req.body?.projectId ?? "");
    if (!projectId) return fail(res, "projectId es obligatorio", 400);
    const [company, project] = await Promise.all([
      prisma.admCompany.findUnique({ where: { id }, select: { id: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { id: true, admCompanyId: true } }),
    ]);
    if (!company) return fail(res, "Empresa no encontrada", 404);
    if (!project) return fail(res, "Proyecto no encontrado", 404);
    if (project.admCompanyId && project.admCompanyId !== id) {
      return fail(res, "Ese proyecto ya está asignado a otra empresa. Desasígnalo primero.", 400);
    }
    await prisma.project.update({ where: { id: projectId }, data: { admCompanyId: id } });
    ok(res, { assigned: true });
  } catch (e) { fail(res, e); }
});

// Quitar la asignación de una obra (no borra nada)
router.post("/:id/unassign-project", async (req, res) => {
  try {
    const id = +req.params.id;
    const projectId = String(req.body?.projectId ?? "");
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, admCompanyId: true } });
    if (!project) return fail(res, "Proyecto no encontrado", 404);
    if (project.admCompanyId !== id) return fail(res, "Ese proyecto no está asignado a esta empresa", 400);
    await prisma.project.update({ where: { id: projectId }, data: { admCompanyId: null } });
    ok(res, { unassigned: true });
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
    const result = await provisionCompaniesFromSPVs();
    ok(res, result);
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
