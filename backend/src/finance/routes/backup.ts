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
      prisma.finSPV.findMany(),
      prisma.finAccount.findMany(),
      prisma.finPartner.findMany(),
      prisma.finLender.findMany(),
      prisma.finProvider.findMany(),
      prisma.finExpenseCategory.findMany(),
      prisma.finIncomeOrigin.findMany(),
      prisma.finProject.findMany(),
      prisma.finMovement.findMany(),
      prisma.finCapitalContribution.findMany(),
      prisma.finLoan.findMany(),
      prisma.finNonBankContribution.findMany(),
      prisma.finBankStatement.findMany(),
      prisma.finBankStatementLine.findMany(),
      prisma.finMovementDocument.findMany(),
      prisma.finProjectDocument.findMany(),
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
