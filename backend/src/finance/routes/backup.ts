import { Router } from "express";
import archiver from "archiver";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/respond";
import { logActivity } from "../services/auditLog";

const router = Router();

// === Snapshot completo de todos los datos del módulo finance ===
async function buildSnapshot() {
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

// === GET /api/finance/backup/excel — Export en formato Excel multi-hoja ===
router.get("/excel", async (_req, res) => {
  try {
    const snap = await buildSnapshot();

    const wb = XLSX.utils.book_new();

    // Helper para construir sheet legible
    const addSheet = (name: string, rows: any[], pick?: (r: any) => any) => {
      if (rows.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([["(sin datos)"]]);
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
        return;
      }
      const flat = rows.map((r) => {
        const o = pick ? pick(r) : r;
        // Aplanar fechas
        const result: any = {};
        for (const [k, v] of Object.entries(o)) {
          if (v instanceof Date) result[k] = v.toISOString().slice(0, 10);
          else if (v && typeof v === "object" && !Array.isArray(v)) result[k] = (v as any).name || (v as any).code || JSON.stringify(v);
          else result[k] = v;
        }
        return result;
      });
      const ws = XLSX.utils.json_to_sheet(flat);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };

    addSheet("SPVs", snap.spvs);
    addSheet("Cuentas bancarias", snap.accounts, (a: any) => ({
      Código: a.code, Nombre: a.name, Banco: a.bank, Tipo: a.type,
      "# Cuenta": a.accountNumber, "Routing": a.routingNumber,
      "Dirección": a.address, "SPV": a.spv?.name,
      "Saldo inicial": a.initialBalance, "Saldo actual (manual)": a.currentBalance,
    }));
    addSheet("Socios", snap.partners);
    addSheet("Lenders", snap.lenders);
    addSheet("Proveedores", snap.providers);
    addSheet("Categorías gasto", snap.categories);
    addSheet("Orígenes ingreso", snap.origins);
    addSheet("Proyectos", snap.projects, (p: any) => ({
      Código: p.code, Nombre: p.name, SPV: p.spv?.name,
      Línea: p.line, Modelo: p.model, Estado: p.status,
      Dirección: p.address,
      "Precio compra": p.purchasePrice, ARV: p.arv,
      "Costo esperado": p.expectedCost, "Cash In": p.cashIn,
    }));
    addSheet("Movimientos", snap.movements, (m: any) => ({
      Fecha: m.date instanceof Date ? m.date.toISOString().slice(0, 10) : m.date,
      Tipo: m.type, Monto: m.amount, Concepto: m.concept,
      Cuenta: m.account?.name, "Cuenta destino": m.destAccount?.name,
      Categoría: m.category?.name, Origen: m.origin?.name,
      Proveedor: m.provider?.name, Socio: m.partner?.fullName,
      Lender: m.lender?.name, Proyecto: m.project?.name,
      "Es intercompany": m.isIntercompany,
      "Es equity": m.isEquity, "Es préstamo": m.isLoan,
      Notas: m.notes,
    }));
    addSheet("Capital aportado", snap.capital, (c: any) => ({
      Fecha: c.date instanceof Date ? c.date.toISOString().slice(0, 10) : c.date,
      Socio: c.partner?.fullName, Proyecto: c.project?.name,
      Monto: c.amount, Concepto: c.concept, Origen: c.origin,
    }));
    addSheet("Préstamos", snap.loans, (l: any) => ({
      Fecha: l.date instanceof Date ? l.date.toISOString().slice(0, 10) : l.date,
      Lender: l.lender?.name, Proyecto: l.project?.name,
      Monto: l.amount, "Tasa %": l.interestRate, "Plazo meses": l.termMonths,
      Estado: l.status, "Total pagado": l.totalRepaid, Notas: l.notes,
    }));
    addSheet("Extractos", snap.statements, (s: any) => ({
      Archivo: s.filename, Cuenta: s.account?.name,
      "Período inicio": s.periodStart instanceof Date ? s.periodStart.toISOString().slice(0, 10) : s.periodStart,
      "Período fin": s.periodEnd instanceof Date ? s.periodEnd.toISOString().slice(0, 10) : s.periodEnd,
      "Saldo inicial": s.openingBalance, "Saldo final": s.closingBalance,
    }));
    addSheet("Líneas extractos", snap.lines, (l: any) => ({
      Fecha: l.date instanceof Date ? l.date.toISOString().slice(0, 10) : l.date,
      Descripción: l.description, Monto: l.amount, Tipo: l.type,
      Estado: l.matchStatus, "ID statement": l.statementId,
    }));

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="finance-export-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buf);
  } catch (e) {
    fail(res, e);
  }
});

// === DELETE /api/finance/backup/wipe-all — Borra todos los datos finance ===
// Solo borra tablas Fin*, NO toca el módulo técnico.
// PROTEGIDO: requiere header X-Wipe-Password con la contraseña configurada.
const WIPE_PASSWORD = process.env.WIPE_PASSWORD || "18418598";

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
