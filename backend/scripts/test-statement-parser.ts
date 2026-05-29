// Test del parser de extractos bancarios con texto sintético formato Ocean Bank.
// Verifica: skip de balances, detección de secciones débito/crédito, captura
// de período + opening/closing, descripciones reales (no IDs).
//
// Uso: npx tsx scripts/test-statement-parser.ts

import { parsePdfStatement } from "../src/finance/services/statementParser";

interface TestResult { name: string; pass: boolean; detail?: string }
const results: TestResult[] = [];
function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition, detail });
  console.log(`${condition ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

// Sintetizamos texto que pdf-parse extraería de un extracto Ocean Bank típico.
const sampleText = `
OCEAN BANK
RESTREPO ACOSTA GLOBAL HOLDINGS, LLC
Account Number: 252650928805
Statement Period: 01/06/2026 - 02/01/2026

Previous Balance:           $50,000.00
Ending Balance:             $62,834.61

DEPOSITS AND CREDITS
01/09  INCOMING WIRE FROM JUAN RESTREPO  $5,000.00
01/15  ACH DEPOSIT PAYROLL CO            $2,500.00
01/24  TRANSFER IN FROM CHECKING         $1,265.92
01/28  DEPOSIT MOBILE CHECK              $1,500.00

WITHDRAWALS AND DEBITS
01/10  CHECK # 1234 PAYMENT TO ABC LLC   $698.75
01/11  ACH DEBIT INSURANCE PREMIUM       $42.88
01/13  WIRE OUT TO CONTRACTOR XYZ        $210.27
01/19  PURCHASE STAPLES OFFICE SUPPLIES  $228.93

FEES
01/15  SERVICE FEE MONTHLY               $14.10
01/16  WIRE FEE OUTGOING                 $26.41

DAILY BALANCES
01/06  $50,000.00
01/31  $62,834.61

Total Debits: $1,221.34
Total Credits: $10,265.92
Page 1 of 2
`;

async function main() {
  console.log("🧪 Test parser PDF de extracto bancario (formato Ocean Bank sintético)\n");

  // Testeamos parsePdfStatement directamente con el texto que pdf-parse
  // entregaría. Así evitamos el bug famoso de pdf-parse al cargarse.
  const parsed = parsePdfStatement(sampleText);

  console.log(`\n  ${parsed.lines.length} líneas extraídas`);
  console.log(`  Período: ${parsed.periodStart?.toISOString().slice(0, 10)} → ${parsed.periodEnd?.toISOString().slice(0, 10)}`);
  console.log(`  Opening: $${parsed.openingBalance ?? "—"}  Closing: $${parsed.closingBalance ?? "—"}`);
  console.log();
  for (const ln of parsed.lines) {
    console.log(`  ${ln.date.toISOString().slice(0, 10)}  ${ln.type === "credit" ? "↑" : "↓"}  $${ln.amount.toFixed(2).padStart(10)}  ${ln.description}`);
  }
  console.log();

  // Asserts
  assert("Período detectado",                       !!parsed.periodStart && !!parsed.periodEnd,
    `${parsed.periodStart?.toISOString().slice(0, 10)} → ${parsed.periodEnd?.toISOString().slice(0, 10)}`);
  assert("Opening balance = $50,000",               parsed.openingBalance === 50000, `$${parsed.openingBalance}`);
  assert("Closing balance = $62,834.61",            parsed.closingBalance === 62834.61, `$${parsed.closingBalance}`);
  assert("10 movimientos extraídos (4 crédito + 4 débito + 2 fees)",
    parsed.lines.length === 10, `${parsed.lines.length}`);
  assert("NO captura PREVIOUS BALANCE como línea",
    !parsed.lines.some(l => /previous|beginning|opening/i.test(l.description)),
    parsed.lines.filter(l => /balance/i.test(l.description)).map(l => l.description).join(",") || "ok");
  assert("NO captura Total Debits/Credits como línea",
    !parsed.lines.some(l => /^total\s/i.test(l.description)));
  assert("NO captura Page N of M como línea",
    !parsed.lines.some(l => /^page\s+\d/i.test(l.description)));

  // Validar detección de débito vs crédito
  const credits = parsed.lines.filter(l => l.type === "credit");
  const debits  = parsed.lines.filter(l => l.type === "debit");
  assert("4 créditos detectados (wires + ACH + deposit)",
    credits.length === 4, `${credits.length} créditos`);
  assert("6 débitos detectados (check + ACH + wire + purchase + 2 fees)",
    debits.length === 6, `${debits.length} débitos`);

  // Validar montos específicos
  const wire5k = credits.find(l => l.description.includes("JUAN RESTREPO"));
  assert("Wire IN $5,000 reconocido como crédito",
    wire5k != null && Math.abs(wire5k.amount - 5000) < 0.01,
    wire5k ? `$${wire5k.amount}` : "no encontrado");

  const checkPay = debits.find(l => l.description.includes("CHECK # 1234"));
  assert("Check #1234 $698.75 reconocido como débito",
    checkPay != null && Math.abs(checkPay.amount - 698.75) < 0.01,
    checkPay ? `$${checkPay.amount}` : "no encontrado");

  const feeWire = debits.find(l => l.description.includes("WIRE FEE"));
  assert("Wire fee $26.41 reconocido como débito (sección FEES)",
    feeWire != null && Math.abs(feeWire.amount - 26.41) < 0.01,
    feeWire ? `$${feeWire.amount}` : "no encontrado");

  // Suma de créditos y débitos debe coincidir con totales declarados (excluyendo fees)
  const sumCredits = credits.reduce((s, l) => s + l.amount, 0);
  const sumDebits  = debits.reduce((s, l) => s + l.amount, 0);
  assert("Suma créditos = $10,265.92 (Total Credits declarado)",
    Math.abs(sumCredits - 10265.92) < 0.01, `$${sumCredits.toFixed(2)}`);
  // El total de débitos incluye los 4 débitos principales + 2 fees
  // = 698.75 + 42.88 + 210.27 + 228.93 + 14.10 + 26.41 = 1221.34
  assert("Suma débitos = $1,221.34 (Total Debits declarado)",
    Math.abs(sumDebits - 1221.34) < 0.01, `$${sumDebits.toFixed(2)}`);

  // Descripciones NO son sólo IDs cortos
  const shortIds = parsed.lines.filter(l => /^[A-Z0-9]{6,10}$/.test(l.description.trim()));
  assert("Descripciones NO son sólo IDs (DBxxxx)",
    shortIds.length === 0, `${shortIds.length} IDs sospechosos`);

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`📊 ${passed} passed · ${failed} failed`);
  if (failed > 0) {
    console.log("\nFALLAS:");
    for (const r of results.filter(r => !r.pass)) console.log(`  ❌ ${r.name}${r.detail ? " — " + r.detail : ""}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
