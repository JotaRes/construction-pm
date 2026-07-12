import { Router } from "express";
import archiver from "archiver";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/respond";
import { logActivity } from "../services/auditLog";
import { buildFinanceExcel } from "../../lib/excelReports";

const router = Router();

// === Snapshot completo de todos los datos del módulo finance ===
export async function buildSnapshot() {
  const [
    spvs, accounts, partners, lenders, providers, categories, origins, projects,
    movements, capital, loans, nonBank, statements, lines, movDocs, projDocs,
  ] = await Promise.all([
    prisma.finSPV.findMany(),
    prisma.finAccount.findMany({ include: { spv: true } }),
    prisma.finPartner.findMany(),
    prisma.finLender.findMany(),
    prisma.finProvider.findMany(),
    prisma.finExpenseCategory.findMany(),
    prisma.finIncomeOrigin.findMany(),
    prisma.finProject.findMany({ include: { spv: true } }),
    prisma.finMovement.findMany({ include: { account: true, destAccount: true, category: true, origin: true, provider: true, partner: true, lender: true, project: true } }),
    prisma.finCapitalContribution.findMany({ include: { partner: true, project: true } }),
    prisma.finLoan.findMany({ include: { lender: true, project: true } }),
    prisma.finNonBankContribution.findMany({ include: { partner: true, project: true } }),
    prisma.finBankStatement.findMany({ include: { account: true } }),
    prisma.finBankStatementLine.findMany(),
    prisma.finMovementDocument.findMany(),
    prisma.finProjectDocument.findMany(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: 2,
    spvs, accounts, partners, lenders, providers, categories, origins, projects,
    movements, capital, loans, nonBank, statements, lines, movDocs, projDocs,
  };
}

// === GET /api/finance/backup — ZIP con JSON ===
router.get("/", async (_req, res) => {
  try {
    const snapshot = await buildSnapshot();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="finance-backup-${new Date().toISOString().slice(0, 10)}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => {
      console.error("[backup] archive error:", err);
      try { res.status(500).end(); } catch {}
    });
    archive.pipe(res);
    archive.append(JSON.stringify(snapshot, null, 2), { name: "finance-data.json" });

    // Excel dashboard profesional (plan B de control)
    try {
      const xlsx = await buildFinanceExcel(snapshot as any);
      archive.append(xlsx, { name: "finance-dashboard.xlsx" });
    } catch (e) {
      console.error("[backup] finance excel failed:", e);
    }

    // README explicativo
    const readme = `# Backup del módulo financiero — Restrepo Acosta Global Holding
Generado: ${snapshot.exportedAt}
Versión: ${snapshot.version}

## Contenido
- finance-data.json: snapshot completo de la base de datos del módulo financiero
- finance-data.xlsx: las mismas tablas exportadas a Excel

## Cómo restaurar
1. POST /api/finance/imports/restore con el archivo finance-data.json
2. O bien, importar el Excel desde "Importar / Backup" en la interfaz

## Tablas incluidas (${Object.keys(snapshot).filter((k) => Array.isArray((snapshot as any)[k])).length})
${Object.entries(snapshot).filter(([_, v]) => Array.isArray(v)).map(([k, v]) => `- ${k}: ${(v as any[]).length} registros`).join("\n")}
`;
    archive.append(readme, { name: "README.txt" });

    await archive.finalize();
  } catch (e) {
    fail(res, e);
  }
});

// === GET /api/finance/backup/excel — Dashboard Excel profesional ===
router.get("/excel", async (_req, res) => {
  try {
    const snap = await buildSnapshot();
    const buf = await buildFinanceExcel(snap as any);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="finance-dashboard-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buf);
  } catch (e) {
    fail(res, e);
  }
});

// === DELETE /api/finance/backup/wipe-all — Borra todos los datos finance ===
// Solo borra tablas Fin*, NO toca el módulo técnico.
// PROTEGIDO: requiere header X-Wipe-Password con la contraseña configurada.
const WIPE_PASSWORD = process.env.WIPE_PASSWORD;

router.delete("/wipe-all", async (req, res) => {
  try {
    // Validar contraseña de confirmación de reseteo
    const pwd = (req.headers["x-wipe-password"] as string) || (req.body && req.body.password) || "";
    if (pwd !== WIPE_PASSWORD) {
      return fail(res, "Contraseña de reseteo incorrecta. El reseteo total fue bloqueado por seguridad.", 403);
    }
    // Orden importante por foreign keys
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
    await logActivity("wipe-all", "FinanceDB", null, "Reset completo del módulo financiero (autorizado con password)");
    ok(res, { wiped: true, message: "Todos los datos del módulo financiero fueron borrados" });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
