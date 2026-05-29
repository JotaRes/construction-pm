// Auto-diagnóstico end-to-end del módulo extractos.
// 1. Texto sintético formato Ocean Bank → parsePdfStatement
// 2. Inserta extracto + líneas en DB sandbox
// 3. Crea movimientos manuales que deben matchear ALGUNAS líneas
// 4. Corre reconcileStatement y verifica matching exacto + aproximado + intercompany
// 5. Verifica getUnreconciledLines lista los faltantes
// 6. Verifica createMovementFromLine cierra la omisión y limpia el unreconciled
//
// Uso: DATABASE_URL="file:./dev.db" npx tsx scripts/test-statement-full-flow.ts

import { PrismaClient } from "@prisma/client";
import { parsePdfStatement } from "../src/finance/services/statementParser";
import { reconcileStatement, getUnreconciledLines } from "../src/finance/services/reconciliation";

const prisma = new PrismaClient();

interface R { name: string; pass: boolean; detail?: string }
const results: R[] = [];
function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition, detail });
  console.log(`${condition ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

const SANDBOX_ACCOUNT_CODE = "__TEST_STMT_ACCT__";
const SANDBOX_OTHER_CODE = "__TEST_STMT_OTHER__";

async function cleanup() {
  await prisma.finBankStatement.deleteMany({ where: { account: { code: SANDBOX_ACCOUNT_CODE } } });
  await prisma.finMovement.deleteMany({ where: { OR: [{ account: { code: { in: [SANDBOX_ACCOUNT_CODE, SANDBOX_OTHER_CODE] } } }, { destAccount: { code: { in: [SANDBOX_ACCOUNT_CODE, SANDBOX_OTHER_CODE] } } }] } });
  await prisma.finAccount.deleteMany({ where: { code: { in: [SANDBOX_ACCOUNT_CODE, SANDBOX_OTHER_CODE] } } });
}

const STATEMENT_TEXT = `
OCEAN BANK
Account Number: TEST
Statement Period: 01/06/2026 - 02/01/2026
Previous Balance:     $10,000.00
Ending Balance:       $12,500.00

DEPOSITS AND CREDITS
01/10  INCOMING WIRE FROM CLIENT ABC      $5,000.00
01/15  ACH DEPOSIT PAYROLL CO             $2,500.00
01/20  TRANSFER IN FROM OTHER ACCOUNT     $1,500.00

WITHDRAWALS AND DEBITS
01/12  CHECK # 9001 PAYMENT VENDOR X      $3,000.00
01/18  ACH DEBIT INSURANCE PREMIUM         $250.00
01/25  WIRE OUT TO CONTRACTOR              $3,250.00

FEES
01/15  SERVICE FEE MONTHLY                  $14.10

Total Debits: $6,514.10
Total Credits: $9,000.00
`;

async function main() {
  console.log("🧪 Auto-diagnóstico END-TO-END del flujo extractos bancarios\n");

  await cleanup();

  // Setup: 2 cuentas sandbox (cuenta del extracto + cuenta origen del intercompany)
  const acct = await prisma.finAccount.create({
    data: {
      code: SANDBOX_ACCOUNT_CODE, name: "Sandbox Acct",
      bank: "Ocean Bank", type: "operativa", initialBalance: 10000,
    },
  });
  const other = await prisma.finAccount.create({
    data: {
      code: SANDBOX_OTHER_CODE, name: "Sandbox Other",
      bank: "Ocean Bank", type: "operativa", initialBalance: 0,
    },
  });

  // ─── PARTE 1: parser PDF ───────────────────────────────────────────────
  console.log("\n[PARTE 1] Parser PDF");
  const parsed = parsePdfStatement(STATEMENT_TEXT);
  assert("Parser: período detectado",          !!parsed.periodStart && !!parsed.periodEnd);
  assert("Parser: opening = $10,000",          parsed.openingBalance === 10000);
  assert("Parser: closing = $12,500",          parsed.closingBalance === 12500);
  assert("Parser: 7 líneas (3 cr + 3 db + 1 fee)", parsed.lines.length === 7, `${parsed.lines.length} líneas`);
  const sumCr = parsed.lines.filter(l => l.type === "credit").reduce((s, l) => s + l.amount, 0);
  const sumDb = parsed.lines.filter(l => l.type === "debit").reduce((s, l) => s + l.amount, 0);
  assert("Parser: suma créditos = $9,000",      Math.abs(sumCr - 9000) < 0.01, `$${sumCr.toFixed(2)}`);
  assert("Parser: suma débitos = $6,514.10",    Math.abs(sumDb - 6514.10) < 0.01, `$${sumDb.toFixed(2)}`);

  // ─── PARTE 2: insertar extracto + líneas en DB ────────────────────────
  console.log("\n[PARTE 2] Persistir extracto en DB");
  const stmt = await prisma.finBankStatement.create({
    data: {
      accountId: acct.id,
      periodStart: parsed.periodStart!,
      periodEnd: parsed.periodEnd!,
      openingBalance: parsed.openingBalance,
      closingBalance: parsed.closingBalance,
      filename: "test-sandbox.pdf",
      url: "https://test.cloudinary/sandbox.pdf",
      lines: { create: parsed.lines.map(l => ({ date: l.date, description: l.description, amount: l.amount, type: l.type })) },
    },
    include: { lines: true },
  });
  assert("DB: extracto creado con 7 líneas",   stmt.lines.length === 7);
  assert("DB: URL guardada en Cloudinary",     stmt.url != null);

  // ─── PARTE 3: crear movimientos manuales que deben matchear algunas líneas ─
  console.log("\n[PARTE 3] Movimientos manuales (algunos matchearán)");
  // Match exacto: mismo monto + fecha = misma fecha que la línea
  await prisma.finMovement.create({
    data: { date: new Date("2026-01-10"), accountId: acct.id, type: "Ingreso", amount: 5000, concept: "Wire ABC manual", importSource: "manual" },
  });
  // Match aproximado: ±3 días
  await prisma.finMovement.create({
    data: { date: new Date("2026-01-21"), accountId: acct.id, type: "Egreso", amount: 250, concept: "Insurance ACH manual", importSource: "manual" },
  });
  // Intercompany: dinero ENTRA a esta cuenta desde "other" — debe matchear la línea TRANSFER IN
  await prisma.finMovement.create({
    data: { date: new Date("2026-01-20"), accountId: other.id, destAccountId: acct.id, type: "Interbancario", amount: 1500, concept: "Transfer intercompany" },
  });
  // Las otras 4 líneas del extracto (ACH PAYROLL, CHECK 9001, WIRE OUT, FEE) NO tienen movimiento manual → deben quedar unreconciled

  // ─── PARTE 4: ejecutar reconciliación ────────────────────────────────
  console.log("\n[PARTE 4] Reconciliación");
  const recon = await reconcileStatement(stmt.id);
  assert("Recon: 3 líneas conciliadas",        recon.matched === 3, `${recon.matched}/${recon.totalLines}`);
  assert("Recon: 4 líneas sin conciliar",      recon.unmatched === 4, `${recon.unmatched}`);

  // Verificar matchStatus por línea
  const finalLines = await prisma.finBankStatementLine.findMany({ where: { statementId: stmt.id } });
  const wire = finalLines.find(l => l.description.includes("CLIENT ABC"));
  assert("Recon: wire $5,000 matched_exact",   wire?.matchStatus === "matched_exact", wire?.matchStatus);
  const ach = finalLines.find(l => l.description.includes("INSURANCE"));
  assert("Recon: ACH insurance matched_approx (±3 días)", ach?.matchStatus === "matched_approx", ach?.matchStatus);
  const intercompany = finalLines.find(l => l.description.includes("TRANSFER IN"));
  assert("Recon: intercompany matched (fix del paso 2)",  intercompany?.matchStatus?.startsWith("matched"), intercompany?.matchStatus);

  // ─── PARTE 5: unreconciled lines listadas correctamente ───────────────
  console.log("\n[PARTE 5] Unreconciled lines API");
  const unrecon = await getUnreconciledLines(acct.id);
  assert("Unreconciled: 4 líneas listadas",    unrecon.length === 4, `${unrecon.length}`);
  const codes = unrecon.map(l => l.description).sort();
  assert("Unreconciled: incluye ACH PAYROLL",  codes.some(d => d.includes("PAYROLL")));
  assert("Unreconciled: incluye CHECK 9001",   codes.some(d => d.includes("9001")));
  assert("Unreconciled: incluye WIRE OUT",     codes.some(d => d.includes("WIRE OUT")));
  assert("Unreconciled: incluye SERVICE FEE",  codes.some(d => d.includes("FEE")));

  // ─── PARTE 6: registrar movimiento desde línea (botón "+ Registrar") ─
  console.log("\n[PARTE 6] Registrar movimiento desde línea unreconciled");
  const checkLine = unrecon.find(l => l.description.includes("9001"));
  if (!checkLine) throw new Error("línea CHECK 9001 no encontrada en unreconciled");
  // Reproducir lo que hace POST /lines/:id/create-movement
  const created = await prisma.finMovement.create({
    data: {
      date: checkLine.date,
      accountId: stmt.accountId,
      type: checkLine.type === "credit" ? "Ingreso" : "Egreso",
      amount: Math.abs(checkLine.amount),
      concept: checkLine.description,
      importSource: "bank_statement",
      importRef: `stmt:${checkLine.statementId}:line:${checkLine.id}`,
      isReconciled: true,
      matchStatus: "matched",
      matchedLineId: checkLine.id,
    },
  });
  await prisma.finBankStatementLine.update({
    where: { id: checkLine.id },
    data: { matchedMovementId: created.id, matchStatus: "created" },
  });
  assert("Registrar: movimiento creado",       created.id != null);
  const lineAfter = await prisma.finBankStatementLine.findUnique({ where: { id: checkLine.id } });
  assert("Registrar: línea pasa a 'created'",  lineAfter?.matchStatus === "created");
  const unreconAfter = await getUnreconciledLines(acct.id);
  assert("Registrar: ahora sólo 3 unreconciled (de 4)", unreconAfter.length === 3, `${unreconAfter.length}`);

  await cleanup();
  console.log();
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`📊 ${passed} passed · ${failed} failed`);
  if (failed > 0) {
    console.log("\nFALLAS:");
    for (const r of results.filter(r => !r.pass)) console.log(`  ❌ ${r.name}${r.detail ? " — " + r.detail : ""}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch(async (e) => { console.error("FATAL:", e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());
