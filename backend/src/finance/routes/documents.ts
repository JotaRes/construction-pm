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
    const created = await prisma.finMovementDocument.create({
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
    await prisma.finMovement.update({ where: { id: +req.params.id }, data: { hasSupport: true } });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

router.delete("/movements/:movementId/documents/:docId", async (req, res) => {
  try {
    const doc = await prisma.finMovementDocument.findUnique({ where: { id: +req.params.docId } });
    if (doc?.publicId) await deleteFromCloudinary(doc.publicId);
    await prisma.finMovementDocument.delete({ where: { id: +req.params.docId } });
    const remaining = await prisma.finMovementDocument.count({ where: { movementId: +req.params.movementId } });
    if (remaining === 0) {
      await prisma.finMovement.update({ where: { id: +req.params.movementId }, data: { hasSupport: false } });
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
    const created = await prisma.finProjectDocument.create({
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
    const doc = await prisma.finProjectDocument.findUnique({ where: { id: +req.params.docId } });
    if (doc?.publicId) await deleteFromCloudinary(doc.publicId);
    await prisma.finProjectDocument.delete({ where: { id: +req.params.docId } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

export default router;
