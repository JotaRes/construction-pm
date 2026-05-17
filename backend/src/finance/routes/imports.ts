import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ok, fail } from "../lib/respond";
import { importExcelFromBuffer } from "../services/excelImporter";
import { prisma } from "../lib/prisma";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// POST /api/imports/excel — sube DOC FINANCIERO y carga todo
router.post("/excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return fail(res, "missing file", 400);
    const result = await importExcelFromBuffer(req.file.buffer, { wipe: req.body.wipe === "true" });
    ok(res, result);
  } catch (e) { fail(res, e); }
});

// POST /api/imports/excel-from-disk — importa el archivo conocido en el desktop (dev)
router.post("/excel-from-disk", async (req, res) => {
  try {
    const defaultPath = "/Users/juandavid/Desktop/CLAUDE/DIRECTOR FINANCIERO /DOC FINANCIERO 2025-2026 .xlsx";
    const filePath = (req.body?.path as string) || defaultPath;
    if (!fs.existsSync(filePath)) return fail(res, `file not found: ${filePath}`, 404);
    const buffer = fs.readFileSync(filePath);
    const result = await importExcelFromBuffer(buffer, { wipe: req.body?.wipe === true });
    ok(res, { ...result, source: path.basename(filePath) });
  } catch (e) { fail(res, e); }
});

// DELETE /api/imports/clear-all — borra todos los movimientos, aportes, préstamos, extractos, documentos
router.delete("/clear-all", async (req, res) => {
  try {
    await prisma.finMovementDocument.deleteMany({});
    await prisma.finProjectDocument.deleteMany({});
    await prisma.finBankStatementLine.deleteMany({});
    await prisma.finBankStatement.deleteMany({});
    await prisma.finNonBankContribution.deleteMany({});
    await prisma.finLoan.deleteMany({});
    await prisma.finCapitalContribution.deleteMany({});
    await prisma.finMovement.deleteMany({});
    ok(res, { cleared: true, message: "Todos los datos transaccionales han sido eliminados" });
  } catch (e) { fail(res, e); }
});

export default router;
