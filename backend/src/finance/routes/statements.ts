import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";
import { parseStatementFile } from "../services/statementParser";
import { reconcileStatement } from "../services/reconciliation";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.get("/", async (_req, res) => {
  try {
    const list = await prisma.finBankStatement.findMany({
      include: { account: true, _count: { select: { lines: true } } },
      orderBy: { periodStart: "desc" },
    });
    ok(res, list);
  } catch (e) { fail(res, e); }
});

router.get("/:id", async (req, res) => {
  try {
    const stmt = await prisma.finBankStatement.findUnique({
      where: { id: +req.params.id },
      include: { account: true, lines: { orderBy: { date: "asc" } } },
    });
    if (!stmt) return fail(res, "not found", 404);
    ok(res, stmt);
  } catch (e) { fail(res, e); }
});

// POST /api/statements/upload — sube extracto (CSV/Excel/PDF) y crea líneas
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return fail(res, "missing file", 400);
    const accountId = +(req.body.accountId || 0);
    if (!accountId) return fail(res, "missing accountId", 400);

    const parsed = await parseStatementFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!parsed.lines.length) return fail(res, "no se pudieron extraer líneas del archivo", 400);

    const stmt = await prisma.finBankStatement.create({
      data: {
        accountId,
        periodStart: parsed.periodStart || parsed.lines[0].date,
        periodEnd: parsed.periodEnd || parsed.lines[parsed.lines.length - 1].date,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
        filename: req.file.originalname,
        lines: {
          create: parsed.lines.map((l) => ({
            date: l.date,
            description: l.description,
            amount: l.amount,
            type: l.type,
          })),
        },
      },
      include: { lines: true },
    });

    // Conciliar automáticamente
    const reconcileResult = await reconcileStatement(stmt.id);
    ok(res, { statement: stmt, reconciliation: reconcileResult });
  } catch (e) { fail(res, e); }
});

router.post("/:id/reconcile", async (req, res) => {
  try {
    const result = await reconcileStatement(+req.params.id);
    ok(res, result);
  } catch (e) { fail(res, e); }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.finBankStatement.delete({ where: { id: +req.params.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

router.post("/lines/:lineId/match/:movementId", async (req, res) => {
  try {
    await prisma.finBankStatementLine.update({
      where: { id: +req.params.lineId },
      data: { matchedMovementId: +req.params.movementId, matchStatus: "matched_manual" },
    });
    await prisma.finMovement.update({
      where: { id: +req.params.movementId },
      data: { isReconciled: true },
    });
    ok(res, { matched: true });
  } catch (e) { fail(res, e); }
});

router.post("/lines/:lineId/create-movement", async (req, res) => {
  try {
    const line = await prisma.finBankStatementLine.findUnique({
      where: { id: +req.params.lineId },
      include: { statement: true },
    });
    if (!line) return fail(res, "not found", 404);
    const created = await prisma.finMovement.create({
      data: {
        date: line.date,
        accountId: line.statement.accountId,
        type: line.type === "credit" ? "Ingreso" : "Egreso",
        amount: Math.abs(line.amount),
        concept: line.description,
        importSource: "bank_statement",
        importRef: `stmt:${line.statementId}:line:${line.id}`,
        isReconciled: true,
      },
    });
    await prisma.finBankStatementLine.update({
      where: { id: line.id },
      data: { matchedMovementId: created.id, matchStatus: "created" },
    });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

export default router;
