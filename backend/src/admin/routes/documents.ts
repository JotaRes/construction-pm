// ============================================================
// EXPEDIENTE DIGITAL — documentos por empresa (Cloudinary)
// ============================================================
import { Router } from "express";
import multer from "multer";
import { prisma } from "../../lib/prisma";
import { ok, fail } from "../../finance/lib/respond";
import { tryCloudinaryUpload, resourceTypeFor, deleteFromCloudinary } from "../../finance/lib/cloudinary";
import { parseOrError, documentMetaSchema } from "../lib/validate";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Documentos de una empresa (opcionalmente filtrados por tipo)
router.get("/companies/:companyId/documents", async (req, res) => {
  try {
    const docTypeId = req.query.docTypeId ? +String(req.query.docTypeId) : undefined;
    const docs = await prisma.admDocument.findMany({
      where: { companyId: +req.params.companyId, ...(docTypeId ? { docTypeId } : {}) },
      include: { docType: { select: { id: true, code: true, name: true, category: true, hasExpiry: true } } },
      orderBy: { uploadedAt: "desc" },
    });
    ok(res, docs);
  } catch (e) { fail(res, e); }
});

// Subir documento al expediente
router.post("/companies/:companyId/documents", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return fail(res, "missing file", 400);
    const { data: meta, error } = parseOrError(documentMetaSchema, req.body);
    if (error !== null) return fail(res, error, 400);

    const companyId = +req.params.companyId;
    const company = await prisma.admCompany.findUnique({ where: { id: companyId } });
    if (!company) return fail(res, "Empresa no encontrada", 404);

    const mimetype = req.file.mimetype;
    const cloud = await tryCloudinaryUpload(req.file.buffer, {
      folder: `admin-corporate/companies/${companyId}`,
      resourceType: resourceTypeFor(mimetype),
      filename: req.file.originalname,
    });

    const created = await prisma.admDocument.create({
      data: {
        companyId,
        docTypeId: meta.docTypeId ?? null,
        filename: req.file.originalname,
        url: cloud?.url || `local:${req.file.originalname}`,
        publicId: cloud?.publicId,
        mimetype,
        size: req.file.size,
        issueDate: meta.issueDate ?? null,
        expiryDate: meta.expiryDate ?? null,
        notes: meta.notes ?? null,
      },
      include: { docType: true },
    });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

// Editar metadatos (tipo, fechas de emisión/vencimiento, notas)
router.patch("/documents/:docId", async (req, res) => {
  try {
    const { data, error } = parseOrError(documentMetaSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const updated = await prisma.admDocument.update({
      where: { id: +req.params.docId },
      data: {
        ...(data.docTypeId !== undefined ? { docTypeId: data.docTypeId } : {}),
        ...(data.issueDate !== undefined ? { issueDate: data.issueDate } : {}),
        ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.filename !== undefined ? { filename: data.filename } : {}),
      },
      include: { docType: true },
    });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

router.delete("/documents/:docId", async (req, res) => {
  try {
    const doc = await prisma.admDocument.findUnique({ where: { id: +req.params.docId } });
    if (!doc) return fail(res, "Documento no encontrado", 404);
    if (doc.publicId) {
      const rt = doc.mimetype?.startsWith("image/") ? "image" : doc.mimetype?.startsWith("video/") ? "video" : "raw";
      await deleteFromCloudinary(doc.publicId, rt);
    }
    await prisma.admDocument.delete({ where: { id: doc.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// Datos para compartir: ruta del proxy público de descarga (/api/download)
// El frontend compone con esto los enlaces mailto: y wa.me
router.get("/documents/:docId/share", async (req, res) => {
  try {
    const doc = await prisma.admDocument.findUnique({
      where: { id: +req.params.docId },
      include: { company: { select: { name: true } }, docType: { select: { name: true } } },
    });
    if (!doc) return fail(res, "Documento no encontrado", 404);
    if (doc.url.startsWith("local:")) {
      return fail(res, "Este documento no está en la nube (Cloudinary no configurado al subirlo) — no se puede compartir por enlace.", 400);
    }
    const sharePath = `/api/download?url=${encodeURIComponent(doc.url)}&name=${encodeURIComponent(doc.filename)}`;
    ok(res, {
      sharePath,
      filename: doc.filename,
      companyName: doc.company.name,
      docTypeName: doc.docType?.name ?? null,
    });
  } catch (e) { fail(res, e); }
});

export default router;
