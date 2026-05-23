import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
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

// === POST /api/finance/imports/restore — restaura snapshot desde JSON o ZIP ===
// Acepta archivos:
//   - .json (snapshot directo del backup)
//   - .zip (ZIP con data.json o finance-data.json adentro)
// Borra TODO antes de restaurar (es un restore completo, no merge).
// PROTEGIDO con contraseña en X-Restore-Password header o body.password.
router.post("/restore", upload.single("file"), async (req, res) => {
  try {
    const pwd = (req.headers["x-restore-password"] as string) || (req.body && req.body.password) || "";
    if (pwd !== (process.env.WIPE_PASSWORD || "18418598")) {
      return fail(res, "Contraseña incorrecta. El restore fue bloqueado por seguridad.", 403);
    }

    if (!req.file) return fail(res, "No se subió ningún archivo", 400);

    const filename = (req.file.originalname || "").toLowerCase();
    let snapshot: any = null;

    if (filename.endsWith(".json")) {
      const text = req.file.buffer.toString("utf8");
      snapshot = JSON.parse(text);
    } else if (filename.endsWith(".zip")) {
      const zip = new AdmZip(req.file.buffer);
      const entry =
        zip.getEntry("finance-data.json") ||
        zip.getEntry("data.json");
      if (!entry) {
        return fail(res, "El ZIP no contiene finance-data.json ni data.json", 400);
      }
      const text = entry.getData().toString("utf8");
      snapshot = JSON.parse(text);
    } else {
      return fail(res, `Formato no soportado: ${filename}. Use .json o .zip`, 400);
    }

    if (!snapshot || typeof snapshot !== "object") {
      return fail(res, "El snapshot está corrupto o vacío", 400);
    }

    // Wipe completo antes de restaurar
    await prisma.finBankStatementLine.deleteMany({});
    await prisma.finBankStatement.deleteMany({});
    await prisma.finMovementDocument.deleteMany({});
    await prisma.finProjectDocument.deleteMany({});
    await prisma.finCapitalContribution.deleteMany({});
    await prisma.finNonBankContribution.deleteMany({});
    await prisma.finMovement.deleteMany({});
    await prisma.finLoan.deleteMany({});
    await prisma.finProject.deleteMany({});
    await prisma.finAccount.deleteMany({});
    await prisma.finPartner.deleteMany({});
    await prisma.finLender.deleteMany({});
    await prisma.finProvider.deleteMany({});
    await prisma.finExpenseCategory.deleteMany({});
    await prisma.finIncomeOrigin.deleteMany({});
    await prisma.finSPV.deleteMany({});

    // Helpers para limpiar objetos antes de insertar (quitar relations expandidas)
    const cleanForInsert = (obj: any, allowedFields: string[]) => {
      const cleaned: any = {};
      for (const k of allowedFields) {
        if (obj[k] !== undefined) cleaned[k] = obj[k];
      }
      // Convertir fechas string → Date donde aplique
      for (const dateField of ["date", "startDate", "endDate", "periodStart", "periodEnd", "uploadedAt", "createdAt", "updatedAt", "archivedAt"]) {
        if (cleaned[dateField] && typeof cleaned[dateField] === "string") {
          cleaned[dateField] = new Date(cleaned[dateField]);
        }
      }
      return cleaned;
    };

    const counts: any = {};

    // 1. SPVs
    for (const s of snapshot.spvs || []) {
      await prisma.finSPV.create({ data: cleanForInsert(s, ["id", "code", "name", "notes", "createdAt"]) });
    }
    counts.spvs = (snapshot.spvs || []).length;

    // 2. Cuentas (después de SPV por FK)
    for (const a of snapshot.accounts || []) {
      await prisma.finAccount.create({ data: cleanForInsert(a, ["id", "code", "name", "bank", "yearsActive", "initialBalance", "reportedBalance", "currentBalance", "accountNumber", "routingNumber", "address", "type", "active", "notes", "spvId", "createdAt"]) });
    }
    counts.accounts = (snapshot.accounts || []).length;

    // 3. Catálogos restantes (orden indiferente)
    for (const p of snapshot.partners || []) {
      await prisma.finPartner.create({ data: cleanForInsert(p, ["id", "code", "fullName", "email", "notes", "createdAt"]) });
    }
    counts.partners = (snapshot.partners || []).length;

    for (const l of snapshot.lenders || []) {
      await prisma.finLender.create({ data: cleanForInsert(l, ["id", "name", "type", "contactName", "email", "phone", "notes", "createdAt"]) });
    }
    counts.lenders = (snapshot.lenders || []).length;

    for (const p of snapshot.providers || []) {
      await prisma.finProvider.create({ data: cleanForInsert(p, ["id", "name", "type", "contactName", "phone", "email", "notes", "createdAt"]) });
    }
    counts.providers = (snapshot.providers || []).length;

    for (const c of snapshot.categories || []) {
      await prisma.finExpenseCategory.create({ data: cleanForInsert(c, ["id", "code", "name", "group", "isCorporate", "notes", "createdAt"]) });
    }
    counts.categories = (snapshot.categories || []).length;

    for (const o of snapshot.origins || []) {
      await prisma.finIncomeOrigin.create({ data: cleanForInsert(o, ["id", "code", "name", "notes", "createdAt"]) });
    }
    counts.origins = (snapshot.origins || []).length;

    // 4. Proyectos (FK a SPV)
    for (const p of snapshot.projects || []) {
      await prisma.finProject.create({ data: cleanForInsert(p, ["id", "code", "name", "line", "model", "status", "spvId", "address", "purchasePrice", "arv", "expectedCost", "cashIn", "notes", "archivedAt", "createdAt"]) });
    }
    counts.projects = (snapshot.projects || []).length;

    // 5. Préstamos (FK lender, project) — SIN sourceMovementId todavía
    const loanIdMap = new Map<number, number>();
    for (const l of snapshot.loans || []) {
      const created = await prisma.finLoan.create({
        data: cleanForInsert(l, ["id", "date", "amount", "concept", "lenderId", "projectId", "destAccountCode", "interestRate", "termMonths", "startDate", "endDate", "status", "classification", "totalRepaid", "notes", "createdAt"]),
      });
      if (l.id) loanIdMap.set(l.id, created.id);
    }
    counts.loans = (snapshot.loans || []).length;

    // 6. Movimientos (FK múltiple) — SIN loanId todavía para evitar referencias circulares
    for (const m of snapshot.movements || []) {
      const cleaned = cleanForInsert(m, [
        "id", "date", "type", "amount", "concept", "notes",
        "accountId", "destAccountId", "categoryId", "originId", "providerId",
        "isEquity", "partnerId", "isLoan", "lenderId", "isLoanRepayment",
        "projectId", "isIntercompany", "linkedMovementId",
        "hasSupport", "isReconciled", "needsReview", "reviewReason",
        "matchStatus", "matchedLineId", "importSource", "importRef",
        "createdAt", "updatedAt",
      ]);
      // Skip loanId — se restablece después
      await prisma.finMovement.create({ data: cleaned });
    }
    counts.movements = (snapshot.movements || []).length;

    // Restablecer loanId del movement y sourceMovementId del loan
    for (const m of snapshot.movements || []) {
      if (m.loanId && m.id) {
        await prisma.finMovement.update({
          where: { id: m.id },
          data: { loanId: m.loanId },
        }).catch(() => {});
      }
    }
    for (const l of snapshot.loans || []) {
      if (l.sourceMovementId && l.id) {
        await prisma.finLoan.update({
          where: { id: l.id },
          data: { sourceMovementId: l.sourceMovementId },
        }).catch(() => {});
      }
    }

    // 7. Capital y NonBank contributions
    for (const c of snapshot.capital || []) {
      await prisma.finCapitalContribution.create({ data: cleanForInsert(c, ["id", "date", "amount", "concept", "origin", "partnerId", "projectId", "destAccountCode", "notes", "sourceMovementId", "createdAt"]) });
    }
    counts.capital = (snapshot.capital || []).length;

    for (const n of snapshot.nonBank || []) {
      await prisma.finNonBankContribution.create({ data: cleanForInsert(n, ["id", "date", "amount", "concept", "partnerId", "projectId", "notes", "createdAt"]) });
    }
    counts.nonBank = (snapshot.nonBank || []).length;

    // 8. Extractos bancarios
    for (const s of snapshot.statements || []) {
      await prisma.finBankStatement.create({ data: cleanForInsert(s, ["id", "accountId", "periodStart", "periodEnd", "openingBalance", "closingBalance", "filename", "url", "uploadedAt"]) });
    }
    counts.statements = (snapshot.statements || []).length;

    for (const l of snapshot.lines || []) {
      await prisma.finBankStatementLine.create({ data: cleanForInsert(l, ["id", "statementId", "date", "description", "amount", "type", "matchStatus", "matchedMovementId", "diffNote"]) });
    }
    counts.lines = (snapshot.lines || []).length;

    // 9. Documentos
    for (const d of snapshot.movDocs || []) {
      await prisma.finMovementDocument.create({ data: cleanForInsert(d, ["id", "movementId", "filename", "url", "publicId", "mimetype", "size", "kind", "uploadedAt"]) });
    }
    counts.movDocs = (snapshot.movDocs || []).length;

    for (const d of snapshot.projDocs || []) {
      await prisma.finProjectDocument.create({ data: cleanForInsert(d, ["id", "projectId", "filename", "url", "publicId", "mimetype", "size", "kind", "uploadedAt"]) });
    }
    counts.projDocs = (snapshot.projDocs || []).length;

    ok(res, {
      restored: true,
      version: snapshot.version,
      exportedAt: snapshot.exportedAt,
      counts,
    });
  } catch (e) {
    console.error("[restore] error:", e);
    fail(res, e);
  }
});

export default router;
