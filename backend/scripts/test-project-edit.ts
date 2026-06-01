// Test PATCH /projects/:id — edición + whitelist de campos.
// Cubre: campos editables se aplican, mass-assignment de campos NO permitidos
// se bloquea silenciosamente, payload vacío devuelve 400.
//
// Uso: DATABASE_URL=file:./dev.db npx tsx scripts/test-project-edit.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PROJ = "__TEST_PROJ_EDIT__";

interface R { name: string; pass: boolean; detail?: string }
const results: R[] = [];
function check(name: string, c: boolean, detail?: string) {
  results.push({ name, pass: c, detail });
  console.log(`${c ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function cleanup() {
  const p = await prisma.project.findFirst({ where: { name: PROJ } });
  if (p) await prisma.project.delete({ where: { id: p.id } });
}

const PROJECT_EDITABLE_FIELDS = new Set([
  'name', 'spv', 'holding', 'address', 'county', 'hoa', 'parcelId',
  'lotAcres', 'sfHeated', 'sfGarage', 'sfPorches', 'bedrooms', 'bathrooms',
  'architecturalPlan', 'foundationType',
  'permitNumber', 'permitIssued', 'permitExpires', 'inspectorPhone', 'hoaPhone',
  'gcName', 'gcPhone', 'gcLicense', 'gcEmail',
  'lender', 'loanNumber', 'loanAmount', 'day1Disbursement', 'interestReserve',
  'holdback', 'interestRate', 'loanTermMonths', 'settlementDate',
  'cashAtSettlement', 'closingCosts', 'contractSalesPrice', 'settlementAgent',
  'arv', 'constructionBudget',
  'trinityName', 'trinityPhone', 'trinityEmail',
  'targetCompletionDate', 'startDate',
  'realtorName', 'realtorBrokerage', 'realtorPhone', 'realtorEmail',
  'listingCommission', 'buyerCommission', 'targetListingPrice', 'expectedPricePerSqft',
  'contingencyPct', 'targetMarginPct', 'benchmarkSfTarget',
  'loiUrl', 'loiName', 'approvalLetterUrl', 'approvalLetterName',
  'hudUrl', 'hudName', 'otrosFinancieroUrl', 'otrosFinancieroName',
  'loiSalePrice', 'loiOfferDate', 'loiExpectedClose', 'loiEarnestMoney',
]);

// Reproduce el endpoint PATCH del backend para probar la whitelist sin levantar server
async function patchProject(projectId: string, body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (PROJECT_EDITABLE_FIELDS.has(k)) data[k] = v;
  }
  if (Object.keys(data).length === 0) {
    return { status: 400, error: "No hay campos editables en el payload" };
  }
  const project = await prisma.project.update({ where: { id: projectId }, data });
  return { status: 200, data: project };
}

async function main() {
  console.log("🧪 Test PATCH /projects/:id — edición + whitelist\n");
  await cleanup();

  const project = await prisma.project.create({
    data: {
      name: PROJ, spv: "Original SPV LLC", holding: "Original Holding LLC",
      address: "100 Original St", county: "Oconee",
    },
  });

  // ─── 1. Edición de campos válidos ────────────────────────────────
  console.log("[1] Edición de campos válidos");
  const r1 = await patchProject(project.id, {
    name: "Lote 88 Highland Rd",
    spv: "Highland 88 LLC",
    holding: "Restrepo Acosta Global Holding LLC",
    address: "123 N Highland Rd, Westminster SC",
    sfHeated: 2400,
    holdback: 395350,
    lender: "Hera Holdings LLC",
    interestRate: 0.085,
  });
  check("Edición válida: status 200",          r1.status === 200);
  check("name actualizado",                    r1.data?.name === "Lote 88 Highland Rd", String(r1.data?.name));
  check("spv actualizado",                     r1.data?.spv === "Highland 88 LLC");
  check("holding actualizado",                 r1.data?.holding === "Restrepo Acosta Global Holding LLC");
  check("address actualizado",                 r1.data?.address === "123 N Highland Rd, Westminster SC");
  check("sfHeated actualizado",                r1.data?.sfHeated === 2400);
  check("holdback actualizado",                r1.data?.holdback === 395350);
  check("lender actualizado",                  r1.data?.lender === "Hera Holdings LLC");
  check("interestRate actualizado",            r1.data?.interestRate === 0.085);

  // ─── 2. Mass-assignment de campos blacklisted se bloquea ────────
  console.log("\n[2] Bloqueo de mass-assignment");
  const r2 = await patchProject(project.id, {
    id: "hacked-id",
    createdAt: new Date("2020-01-01"),
    name: "Nombre Nuevo Legitimo",
  });
  check("Sólo name aplicó (id y createdAt ignorados)",
    r2.status === 200 && r2.data?.id === project.id && r2.data?.name === "Nombre Nuevo Legitimo",
    `id=${r2.data?.id} name=${r2.data?.name}`);

  // ─── 3. Payload SOLO con campos blacklisted devuelve 400 ────────
  console.log("\n[3] Payload con solo campos blacklisted");
  const r3 = await patchProject(project.id, { id: "hack", createdAt: new Date() });
  check("Sólo blacklisted: 400 error",  r3.status === 400, `status=${r3.status}`);

  // ─── 4. Edición de campos físicos/permisos/GC ────────────────────
  console.log("\n[4] Edición de campos físicos/permisos/GC");
  const r4 = await patchProject(project.id, {
    lotAcres: 0.5, sfGarage: 1013, sfPorches: 687, bedrooms: 3, bathrooms: "2.5",
    foundationType: "crawlspace", permitNumber: "BR26-000029",
    gcName: "AMA, LLC", gcPhone: "+1-864-787-3290",
  });
  check("Campos físicos + permit + GC aplicados",
    r4.status === 200 && r4.data?.sfGarage === 1013 && r4.data?.permitNumber === "BR26-000029" && r4.data?.gcName === "AMA, LLC");

  await cleanup();
  console.log();
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`📊 ${passed} passed · ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch(async (e) => { console.error("FATAL:", e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());
