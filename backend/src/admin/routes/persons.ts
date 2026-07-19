// ============================================================
// SOCIOS Y COLABORADORES — carpeta documental personal + tareas
// ============================================================
// Cada persona tiene: perfil, checklist de documentos (requisitos con
// categorías libres creadas por el usuario), archivos en Cloudinary y
// tareas. El semáforo se DERIVA de datos reales (patrón de empresas).
import { Router } from "express";
import multer from "multer";
import { prisma } from "../../lib/prisma";
import { ok, fail } from "../../finance/lib/respond";
import { tryCloudinaryUpload, resourceTypeFor, deleteFromCloudinary } from "../../finance/lib/cloudinary";
import {
  parseOrError,
  personCreateSchema,
  personUpdateSchema,
  personRequirementCreateSchema,
  personRequirementUpdateSchema,
  personDocumentMetaSchema,
} from "../lib/validate";
import { computePersonCompliance, computeAllPersonCompliance } from "../lib/compliance";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Checklist inicial sugerido para una persona nueva (editable/eliminable).
// El usuario puede agregar categorías y documentos adicionales sin límite.
const DEFAULT_PERSON_REQUIREMENTS: Array<{ name: string; category: string; hasExpiry: boolean; sortOrder: number }> = [
  { name: "Documento de identidad / Cédula", category: "IDENTIDAD", hasExpiry: true, sortOrder: 1 },
  { name: "Pasaporte", category: "IDENTIDAD", hasExpiry: true, sortOrder: 2 },
  { name: "Visa / Estatus migratorio", category: "MIGRATORIO", hasExpiry: true, sortOrder: 3 },
  { name: "SSN / ITIN", category: "FISCAL", hasExpiry: false, sortOrder: 4 },
  { name: "Hoja de vida (CV)", category: "PERSONAL", hasExpiry: false, sortOrder: 5 },
  { name: "Comprobante de dirección", category: "PERSONAL", hasExpiry: false, sortOrder: 6 },
];

function docResourceType(mimetype?: string | null): "image" | "video" | "raw" {
  if (mimetype?.startsWith("image/")) return "image";
  if (mimetype?.startsWith("video/")) return "video";
  return "raw";
}

// ⚠️ ORDEN DE RUTAS: las rutas con prefijo fijo (/requirements/*, /documents/*)
// van ANTES que las paramétricas (/:id) — de lo contrario Express interpretaría
// "requirements" o "documents" como un :id.

// ── REQUISITOS: edición/eliminación por id de requisito ───────────────────

router.patch("/requirements/:reqId", async (req, res) => {
  try {
    const { data, error } = parseOrError(personRequirementUpdateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const updated = await prisma.admPersonRequirement.update({
      where: { id: +req.params.reqId },
      data: { ...data, ...(data.category ? { category: data.category.toUpperCase() } : {}) },
    });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

// Eliminar requisito. Los documentos ya cargados NO se borran (quedan
// como archivos generales de la persona — el vínculo es SetNull).
router.delete("/requirements/:reqId", async (req, res) => {
  try {
    await prisma.admPersonRequirement.delete({ where: { id: +req.params.reqId } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// ── DOCUMENTOS: edición/eliminación/compartir por id de documento ─────────

router.patch("/documents/:docId", async (req, res) => {
  try {
    const { data, error } = parseOrError(personDocumentMetaSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const updated = await prisma.admPersonDocument.update({
      where: { id: +req.params.docId },
      data: {
        ...(data.requirementId !== undefined ? { requirementId: data.requirementId } : {}),
        ...(data.issueDate !== undefined ? { issueDate: data.issueDate } : {}),
        ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.filename !== undefined ? { filename: data.filename } : {}),
      },
      include: { requirement: true },
    });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

router.delete("/documents/:docId", async (req, res) => {
  try {
    const doc = await prisma.admPersonDocument.findUnique({ where: { id: +req.params.docId } });
    if (!doc) return fail(res, "Documento no encontrado", 404);
    if (doc.publicId) await deleteFromCloudinary(doc.publicId, docResourceType(doc.mimetype));
    await prisma.admPersonDocument.delete({ where: { id: doc.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// Compartir (proxy /api/download — mismo patrón que documentos de empresa)
router.get("/documents/:docId/share", async (req, res) => {
  try {
    const doc = await prisma.admPersonDocument.findUnique({
      where: { id: +req.params.docId },
      include: { person: { select: { name: true } }, requirement: { select: { name: true } } },
    });
    if (!doc) return fail(res, "Documento no encontrado", 404);
    if (doc.url.startsWith("local:")) {
      return fail(res, "Este documento no está en la nube (Cloudinary no configurado al subirlo) — no se puede compartir por enlace.", 400);
    }
    const sharePath = `/api/download?url=${encodeURIComponent(doc.url)}&name=${encodeURIComponent(doc.filename)}`;
    ok(res, {
      sharePath,
      filename: doc.filename,
      personName: doc.person.name,
      requirementName: doc.requirement?.name ?? null,
    });
  } catch (e) { fail(res, e); }
});

// ── PERSONAS ──────────────────────────────────────────────────────────────

// Lista con semáforo de cumplimiento y conteo de tareas pendientes
router.get("/", async (_req, res) => {
  try {
    const [persons, compliance, pendingTasks] = await Promise.all([
      prisma.admPerson.findMany({
        include: { _count: { select: { documents: true, tasks: true, requirements: true } } },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      computeAllPersonCompliance(),
      prisma.admTask.groupBy({
        by: ["personId"],
        where: { personId: { not: null }, status: { not: "completada" } },
        _count: { _all: true },
      }),
    ]);
    const pendingOf = new Map(pendingTasks.map((t) => [t.personId, t._count._all]));
    ok(res, persons.map((p) => ({
      ...p,
      compliance: compliance.get(p.id) ?? null,
      pendingTasks: pendingOf.get(p.id) ?? 0,
    })));
  } catch (e) { fail(res, e); }
});

router.get("/:id", async (req, res) => {
  try {
    const person = await prisma.admPerson.findUnique({ where: { id: +req.params.id } });
    if (!person) return fail(res, "Persona no encontrada", 404);
    ok(res, person);
  } catch (e) { fail(res, e); }
});

// Crear persona + checklist inicial sugerido
router.post("/", async (req, res) => {
  try {
    const { data, error } = parseOrError(personCreateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const created = await prisma.admPerson.create({ data });
    await prisma.admPersonRequirement.createMany({
      data: DEFAULT_PERSON_REQUIREMENTS.map((r) => ({ ...r, personId: created.id })),
    });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const { data, error } = parseOrError(personUpdateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    ok(res, await prisma.admPerson.update({ where: { id: +req.params.id }, data }));
  } catch (e) { fail(res, e); }
});

// Suprimir persona: borra en cascada su carpeta (incluye archivos Cloudinary),
// requisitos y tareas.
router.delete("/:id", async (req, res) => {
  try {
    const id = +req.params.id;
    const person = await prisma.admPerson.findUnique({
      where: { id },
      include: { documents: { select: { publicId: true, mimetype: true } } },
    });
    if (!person) return fail(res, "Persona no encontrada", 404);
    for (const doc of person.documents) {
      if (doc.publicId) await deleteFromCloudinary(doc.publicId, docResourceType(doc.mimetype));
    }
    await prisma.admPerson.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// ── CHECKLIST (semáforo derivado) ─────────────────────────────────────────

router.get("/:id/checklist", async (req, res) => {
  try {
    ok(res, await computePersonCompliance(+req.params.id));
  } catch (e) { fail(res, e); }
});

// ── REQUISITOS (categorías y nombres de archivo libres) ───────────────────

router.get("/:id/requirements", async (req, res) => {
  try {
    const reqs = await prisma.admPersonRequirement.findMany({
      where: { personId: +req.params.id },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });
    ok(res, reqs);
  } catch (e) { fail(res, e); }
});

router.post("/:id/requirements", async (req, res) => {
  try {
    const { data, error } = parseOrError(personRequirementCreateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const personId = +req.params.id;
    const person = await prisma.admPerson.findUnique({ where: { id: personId } });
    if (!person) return fail(res, "Persona no encontrada", 404);
    const created = await prisma.admPersonRequirement.create({
      data: { ...data, category: data.category?.toUpperCase() || "GENERAL", personId },
    });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

// ── DOCUMENTOS (carpeta personal en Cloudinary) ───────────────────────────

router.get("/:id/documents", async (req, res) => {
  try {
    const docs = await prisma.admPersonDocument.findMany({
      where: { personId: +req.params.id },
      include: { requirement: { select: { id: true, name: true, category: true, hasExpiry: true } } },
      orderBy: { uploadedAt: "desc" },
    });
    ok(res, docs);
  } catch (e) { fail(res, e); }
});

router.post("/:id/documents", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return fail(res, "missing file", 400);
    const { data: meta, error } = parseOrError(personDocumentMetaSchema, req.body);
    if (error !== null) return fail(res, error, 400);

    const personId = +req.params.id;
    const person = await prisma.admPerson.findUnique({ where: { id: personId } });
    if (!person) return fail(res, "Persona no encontrada", 404);

    const mimetype = req.file.mimetype;
    const cloud = await tryCloudinaryUpload(req.file.buffer, {
      folder: `admin-corporate/persons/${personId}`,
      resourceType: resourceTypeFor(mimetype),
      filename: req.file.originalname,
    });

    const created = await prisma.admPersonDocument.create({
      data: {
        personId,
        requirementId: meta.requirementId ?? null,
        filename: req.file.originalname,
        url: cloud?.url || `local:${req.file.originalname}`,
        publicId: cloud?.publicId,
        mimetype,
        size: req.file.size,
        issueDate: meta.issueDate ?? null,
        expiryDate: meta.expiryDate ?? null,
        notes: meta.notes ?? null,
      },
      include: { requirement: true },
    });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

export default router;
