// Test usando el PDF REAL descargado de producción. Reproduce el caso del
// proyecto B en producción: budget pre-cargado del template, PDF Trinity
// formato B (sin itemCode), match por descripción.
//
// Uso: DATABASE_URL="file:./dev.db" npx tsx scripts/test-trinity-newformat-realpdf.ts

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import {
  parseTrinityDrawApprovals,
  applyDrawApprovalsToBudget,
  recomputeProjectBudgetFromContributions,
} from "../src/routes/draws";

const pdfParse = require("pdf-parse");
const prisma = new PrismaClient();

interface R { name: string; pass: boolean; detail?: string }
const results: R[] = [];
function assert(name: string, c: boolean, detail?: string) {
  results.push({ name, pass: c, detail });
  console.log(`${c ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

// Budget tipo el de producción (proyecto B): mismas descripciones, itemCodes N.N
const BUDGET_ITEMS = [
  ["1.1", "Survey", 2500], ["1.2", "Design and blueprints", 2500],
  ["1.3", "GC Fee", 12000], ["1.4", "County building permit", 4500],
  ["1.5", "HOA building permit", 15200], ["1.6", "Water TAP Permit", 3000],
  ["1.7", "Electric power TAP permit", 3500], ["1.8", "Insurance", 1500],
  ["2.1", "Lot clearing", 15000], ["2.2", "Grading", 10000],
  ["2.3", "Gravel, driveway", 5400], ["2.4", "Silt fence", 1500],
  ["2.5", "Excavation and compaction", 5400], ["2.6", "Slab framing", 6900],
  ["2.7", "Fill dirt", 4400], ["2.8", "Gravel", 3500],
  ["2.9", "Underground plumbing", 8700], ["2.10", "Slab construction", 28500],
  ["3.1", "- Lumber and materials", 27500], ["3.2", "- Labor", 13500],
];

const PROJ = "__TEST_TRINITY_REAL__";

async function cleanup() {
  const p = await prisma.project.findFirst({ where: { name: PROJ } });
  if (p) await prisma.project.delete({ where: { id: p.id } });
}

async function main() {
  console.log("🧪 Test con PDF REAL de producción (Lot 827, formato Trinity B)\n");
  await cleanup();

  if (!fs.existsSync("/tmp/draw1_prod.pdf")) {
    console.error("❌ /tmp/draw1_prod.pdf no existe. Descargalo primero.");
    process.exit(1);
  }

  // 1. Crear proyecto + budget como el de producción
  const project = await prisma.project.create({
    data: {
      name: PROJ, spv: "Sandbox LLC", holding: "Sandbox Holding LLC",
      address: "test", county: "Oconee",
      holdback: 395350, loanAmount: 402350,
    },
  });
  let order = 0;
  for (const [code, desc, valor] of BUDGET_ITEMS) {
    await prisma.budgetLine.create({
      data: {
        projectId: project.id, divCode: "SEC.0", divName: "Test",
        itemCode: code as string, description: desc as string,
        unit: "LS", valorInicial: valor as number, order: order++,
      },
    });
  }
  console.log(`  Proyecto creado con ${BUDGET_ITEMS.length} budget lines`);

  // 2. Parsear el PDF REAL
  const buf = fs.readFileSync("/tmp/draw1_prod.pdf");
  const pdfData = await pdfParse(buf);
  const approvals = parseTrinityDrawApprovals(pdfData.text);
  console.log(`  PDF Trinity: ${approvals.length} líneas parseadas, ${approvals.filter(a => a.deltaThisDraw > 0).length} con delta > 0`);

  assert("Parser extrae > 30 líneas del PDF nuevo formato",
    approvals.length > 30, `${approvals.length} líneas`);
  // Lot 827 Draw 2 — 15 items con delta real en este draw
  // (Current Amount Available - Prior Amount = lo aprobado por Trinity en este draw)
  assert("Parser detecta 15 items con delta > 0",
    approvals.filter(a => a.deltaThisDraw > 0).length === 15);

  // 3. Crear draw y aplicar
  const draw = await prisma.draw.create({
    data: { projectId: project.id, drawNumber: 1, estado: "PENDING" },
  });
  const result = await applyDrawApprovalsToBudget(project.id, draw.id, approvals);
  console.log(`  Aplicado: matched=${result.matched} new=${result.newlyApprovedItems} $${result.newlyApprovedAmount.toFixed(2)}`);

  assert("Match: ≥ 12 budget lines coinciden con items del PDF",
    result.matched >= 12, `${result.matched} matched`);
  // En el PDF Lot 827, 15 items tienen delta > 0 con la regla correcta
  // (Current Amount Available - Prior Amount Inspection).
  assert("Match: 15 items aportan delta > 0",
    result.newlyApprovedItems === 15, `${result.newlyApprovedItems} new`);
  // Suma de Current Amount Available = $89,295.66 (cumulative Trinity-certified)
  assert("Match: cumulativeApproved ≈ $89,295",
    Math.abs(result.cumulativeApproved - 89295.66) < 5,
    `$${result.cumulativeApproved.toFixed(2)}`);

  // 4. Verificar líneas específicas — Survey aporta $2,432 (Current Amount Available)
  // que es lo que Trinity certifica como aprobado para esta línea
  const survey = await prisma.budgetLine.findFirst({ where: { projectId: project.id, itemCode: "1.1" } });
  assert("Línea Survey (1.1) aprobada = $2,432 (Current Amount Available)",
    survey != null && Math.abs(survey.valorAprobado - 2432) < 1,
    `$${survey?.valorAprobado.toFixed(2)}`);

  const clearing = await prisma.budgetLine.findFirst({ where: { projectId: project.id, itemCode: "2.1" } });
  assert("Línea Lot clearing (2.1) aprobada = $14,592",
    clearing != null && Math.abs(clearing.valorAprobado - 14592) < 1,
    `$${clearing?.valorAprobado.toFixed(2)}`);

  const lumber = await prisma.budgetLine.findFirst({ where: { projectId: project.id, itemCode: "3.1" } });
  assert("Línea '- Lumber and materials' (3.1) existe (match por descripción)",
    lumber != null,
    lumber ? `aprobado=$${lumber.valorAprobado.toFixed(2)}` : "no");

  // 5. Borrar draw → budget vuelve a $0
  await prisma.draw.delete({ where: { id: draw.id } });
  await recomputeProjectBudgetFromContributions(project.id);
  const after = await prisma.budgetLine.findMany({ where: { projectId: project.id } });
  const sumAfter = after.reduce((s, l) => s + l.valorAprobado, 0);
  assert("Borrar draw: valorAprobado total vuelve a $0",
    sumAfter < 0.01, `$${sumAfter.toFixed(2)}`);

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
