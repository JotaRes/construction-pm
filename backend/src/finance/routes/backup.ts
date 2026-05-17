import { Router } from "express";
import archiver from "archiver";
import { prisma } from "../lib/prisma";
import { fail } from "../lib/respond";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [
      spvs, accounts, partners, lenders, providers, categories, origins, projects,
      movements, capital, loans, nonBank, statements, lines, movDocs, projDocs,
    ] = await Promise.all([
      prisma.sPV.findMany(),
      prisma.account.findMany(),
      prisma.partner.findMany(),
      prisma.lender.findMany(),
      prisma.provider.findMany(),
      prisma.expenseCategory.findMany(),
      prisma.incomeOrigin.findMany(),
      prisma.project.findMany(),
      prisma.movement.findMany(),
      prisma.capitalContribution.findMany(),
      prisma.loan.findMany(),
      prisma.nonBankContribution.findMany(),
      prisma.bankStatement.findMany(),
      prisma.bankStatementLine.findMany(),
      prisma.movementDocument.findMany(),
      prisma.projectDocument.findMany(),
    ]);

    const snapshot = {
      exportedAt: new Date().toISOString(),
      version: 1,
      spvs, accounts, partners, lenders, providers, categories, origins, projects,
      movements, capital, loans, nonBank, statements, lines, movDocs, projDocs,
    };

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="financial-cfo-backup-${Date.now()}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => {
      console.error("[backup] archive error:", err);
      try { res.status(500).end(); } catch {}
    });
    archive.pipe(res);
    archive.append(JSON.stringify(snapshot, null, 2), { name: "data.json" });
    await archive.finalize();
  } catch (e) {
    fail(res, e);
  }
});

export default router;
