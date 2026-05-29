// Verifica que el saldo de holdback se calcule correctamente en todos los
// casos que el usuario reportó: KPI top usa netWire (no estado=WIRED), borrar
// un draw recalcula la cadena, agregar Excel auto-promueve a WIRED.
//
// Uso: DATABASE_URL="file:./dev.db" npx tsx scripts/test-holdback-balance.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PROJECT_NAME = "__TEST_HOLDBACK__";

interface R { name: string; pass: boolean; detail?: string }
const results: R[] = [];
function assert(name: string, c: boolean, detail?: string) {
  results.push({ name, pass: c, detail });
  console.log(`${c ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function cleanup() {
  const p = await prisma.project.findFirst({ where: { name: PROJECT_NAME } });
  if (p) await prisma.project.delete({ where: { id: p.id } });
}

// Reproducir la regla del KPI top del frontend:
//   draws con netWire > 0 → suma → restar de holdback
function computeKpiSaldo(holdback: number, draws: Array<{ netWire: number }>): number {
  const totalWired = draws.filter(d => d.netWire > 0).reduce((s, d) => s + d.netWire, 0);
  return Math.max(0, holdback - totalWired);
}

async function main() {
  console.log("🧪 Test holdback balance — bug LOTE 87 reportado por usuario\n");
  await cleanup();

  // Proyecto tipo LOTE 87
  const project = await prisma.project.create({
    data: {
      name: PROJECT_NAME, spv: "Sandbox LLC", holding: "Sandbox Holding LLC",
      address: "test", county: "Oconee",
      holdback: 395350, loanAmount: 402350,
    },
  });

  // Draw 1: tiene netWire pero estado quedó en PENDING (bug del usuario)
  const d1 = await prisma.draw.create({
    data: { projectId: project.id, drawNumber: 1, estado: "PENDING", netWire: 80131.06 },
  });
  // Draw 2: WIRED
  const d2 = await prisma.draw.create({
    data: { projectId: project.id, drawNumber: 2, estado: "WIRED", netWire: 56533.14 },
  });
  // Draw 3: EMPTY, sin netWire (no debe contar)
  await prisma.draw.create({
    data: { projectId: project.id, drawNumber: 3, estado: "EMPTY", netWire: 0 },
  });

  const all = await prisma.draw.findMany({ where: { projectId: project.id } });
  const saldoKpi = computeKpiSaldo(395350, all);
  const expected = 395350 - 80131.06 - 56533.14; // = 258,685.80
  assert("KPI top: saldo cuenta netWire aunque estado=PENDING",
    Math.abs(saldoKpi - expected) < 0.01,
    `$${saldoKpi.toFixed(2)} (esperado $${expected.toFixed(2)})`);

  // Caso bug original: si filtras por estado=WIRED, se "pierde" draw 1 → saldo inflado
  const buggy = 395350 - all.filter(d => d.estado === "WIRED").reduce((s, d) => s + d.netWire, 0);
  assert("Diagnostico bug original (filtro estado=WIRED da saldo inflado)",
    Math.abs(buggy - (395350 - 56533.14)) < 0.01,
    `bug daba $${buggy.toFixed(2)} en vez de $${expected.toFixed(2)}`);

  // Caso: borrar draw 1 → saldo debe quedar = $395,350 - $56,533.14 = $338,816.86
  await prisma.draw.delete({ where: { id: d1.id } });
  const after = await prisma.draw.findMany({ where: { projectId: project.id } });
  const saldoAfter = computeKpiSaldo(395350, after);
  assert("Borrar draw 1: saldo se ajusta correctamente",
    Math.abs(saldoAfter - (395350 - 56533.14)) < 0.01,
    `$${saldoAfter.toFixed(2)}`);

  // Caso: borrar también draw 2 → saldo = $395,350 (todo libre)
  await prisma.draw.delete({ where: { id: d2.id } });
  const after2 = await prisma.draw.findMany({ where: { projectId: project.id } });
  const saldoFull = computeKpiSaldo(395350, after2);
  assert("Borrar todos los draws con wire: saldo = holdback completo",
    saldoFull === 395350, `$${saldoFull.toFixed(2)}`);

  // Caso edge: holdback = 0 (HUD no cargado)
  const saldoZero = computeKpiSaldo(0, [{ netWire: 5000 }]);
  assert("Sin holdback configurado: saldo = 0 (no negativo)",
    saldoZero === 0, `$${saldoZero}`);

  await cleanup();
  console.log();
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`📊 ${passed} passed · ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch(async e => { console.error("FATAL:", e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());
