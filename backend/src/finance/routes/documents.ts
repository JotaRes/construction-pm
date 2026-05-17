import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";
import { tryCloudinaryUpload, resourceTypeFor, deleteFromCloudinary } from "../lib/cloudinary";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Upload documento asociado a un movimiento
router.post("/movements/:id/documents", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return fail(res, "missing file", 400);
    const mimetype = req.file.mimetype;
    const cloud = await tryCloudinaryUpload(req.file.buffer, {
      folder: `financial-cfo/movements/${req.params.id}`,
      resourceType: resourceTypeFor(mimetype),
      filename: req.file.originalname,
    });

    const url = cloud?.url || `local:${req.file.originalname}`;
    const created = await prisma.movementDocument.create({
      data: {
        movementId: +req.params.id,
        filename: req.file.originalname,
        url,
        publicId: cloud?.publicId,
        mimetype,
        size: req.file.size,
        kind: req.body.kind || "soporte",
      },
    });
    await prisma.movement.update({ where: { id: +req.params.id }, data: { hasSupport: true } });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

router.delete("/movements/:movementId/documents/:docId", async (req, res) => {
  try {
    const doc = await prisma.movementDocument.findUnique({ where: { id: +req.params.docId } });
    if (doc?.publicId) await deleteFromCloudinary(doc.publicId);
    await prisma.movementDocument.delete({ where: { id: +req.params.docId } });
    const remaining = await prisma.movementDocument.count({ where: { movementId: +req.params.movementId } });
    if (remaining === 0) {
      await prisma.movement.update({ where: { id: +req.params.movementId }, data: { hasSupport: false } });
    }
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// Upload documento asociado a un proyecto
router.post("/projects/:id/documents", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return fail(res, "missing file", 400);
    const mimetype = req.file.mimetype;
    const cloud = await tryCloudinaryUpload(req.file.buffer, {
      folder: `financial-cfo/projects/${req.params.id}`,
      resourceType: resourceTypeFor(mimetype),
      filename: req.file.originalname,
    });
    const created = await prisma.projectDocument.create({
      data: {
        projectId: +req.params.id,
        filename: req.file.originalname,
        url: cloud?.url || `local:${req.file.originalname}`,
        publicId: cloud?.publicId,
        mimetype,
        size: req.file.size,
        kind: req.body.kind || "doc",
      },
    });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

router.delete("/projects/:projectId/documents/:docId", async (req, res) => {
  try {
    const doc = await prisma.projectDocument.findUnique({ where: { id: +req.params.docId } });
    if (doc?.publicId) await deleteFromCloudinary(doc.publicId);
    await prisma.projectDocument.delete({ where: { id: +req.params.docId } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

export default router;
