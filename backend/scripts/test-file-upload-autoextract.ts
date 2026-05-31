// E2E test: simula el flow real de upload de plano del checklist documental
// y verifica que sfHeated/sfGarage/etc se aplican al Project automáticamente.
// Esto cierra el bug del usuario: "subí el plano pero el CFO Dashboard sigue
// mostrando sfHeated=0".
//
// Uso: DATABASE_URL=file:./dev.db npx tsx scripts/test-file-upload-autoextract.ts

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import { extractPdfText } from "../src/lib/pdfOcr";
import {
  parsePlansText, parseHUDText, parseSurveyText, parseLoanText, parsePermitText,
} from "../src/routes/draws";

const prisma = new PrismaClient();

interface R { name: string; pass: boolean; detail?: string }
const results: R[] = [];
function check(name: string, c: boolean, detail?: string) {
  results.push({ name, pass: c, detail });
  console.log(`${c ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

const PROJ = "__TEST_FILE_AUTOEXTRACT__";
const LOTE87 = "/Users/juandavid/Desktop/CLAUDE/DIRECTOR CONSTRUCTIVO/LOTES/LOTE 87";

async function cleanup() {
  const p = await prisma.project.findFirst({ where: { name: PROJ } });
  if (p) await prisma.project.delete({ where: { id: p.id } });
}

// Mismo mapeo + función que el endpoint real
const KIND_PARSER_MAP: Record<string, { parser: (text: string) => Record<string, unknown>; fields: string[]; }> = {
  planos:         { parser: parsePlansText,     fields: ['sfHeated', 'sfGarage', 'sfPorches', 'bedrooms', 'bathrooms', 'foundationType', 'architecturalPlan'] },
  survey:         { parser: parseSurveyText,    fields: ['parcelId', 'lotAcres', 'address', 'county'] },
  hud_cierre:     { parser: parseHUDText,       fields: ['settlementDate', 'closingCosts', 'cashAtSettlement', 'contractSalesPrice', 'loanAmount', 'holdback'] },
  carta_lender:   { parser: parseLoanText,      fields: ['lender', 'loanNumber', 'loanAmount', 'interestRate', 'loanTermMonths', 'holdback', 'day1Disbursement', 'interestReserve', 'settlementDate'] },
  permiso_construccion: { parser: parsePermitText, fields: ['permitNumber', 'permitIssued', 'permitExpires', 'county'] },
};

async function applyExtracted(projectId: string, extracted: Record<string, unknown>, fields: string[]): Promise<string[]> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return [];
  const update: Record<string, unknown> = {};
  const applied: string[] = [];
  for (const k of fields) {
    const v = extracted[k];
    if (v === undefined || v === null || v === '') continue;
    const current = (project as Record<string, unknown>)[k];
    const isEmpty = current === null || current === undefined || current === '' || current === 0;
    if (!isEmpty) continue;
    update[k] = v;
    applied.push(k);
  }
  if (applied.length > 0) {
    await prisma.project.update({ where: { id: projectId }, data: update });
  }
  return applied;
}

async function simulateUpload(projectId: string, kind: string, path: string) {
  if (!fs.existsSync(path)) return { ok: false, applied: [], reason: 'file not exists' };
  const cfg = KIND_PARSER_MAP[kind];
  if (!cfg) return { ok: false, applied: [], reason: 'no parser for kind' };
  const buf = fs.readFileSync(path);
  const pdfData = await extractPdfText(buf);
  const extracted = cfg.parser(pdfData.text);
  const applied = await applyExtracted(projectId, extracted, cfg.fields);
  return { ok: true, applied, extracted, ocrUsed: pdfData.ocrUsed };
}

async function main() {
  console.log("🧪 E2E: upload de documentos → auto-aplicar al Project\n");
  await cleanup();

  // 1. Proyecto sandbox VACÍO (como el del usuario en producción: sfHeated=0).
  // Explícito sfHeated=0 para evitar que Prisma aplique el default del schema (2400).
  const project = await prisma.project.create({
    data: {
      name: PROJ, spv: "Sandbox LLC", holding: "Sandbox Holding LLC",
      address: "test", county: "",
      sfHeated: 0, sfGarage: 0, sfPorches: 0, bedrooms: 0,
    },
  });
  console.log(`  Proyecto creado vacío: sfHeated=${project.sfHeated}, holdback=${project.holdback}`);

  // 2. UPLOAD PLANO — debe poblar sfHeated/sfGarage/sfPorches
  console.log("\n[1] Upload PLANOS 2400-5 CRAWLSPACE.pdf");
  const r1 = await simulateUpload(project.id, 'planos', `${LOTE87}/PLANOS LOTE 87/2400-5 CRAWLSPACE.pdf`);
  console.log(`   Aplicados: ${(r1 as any).applied?.join(', ')}`);
  check("Plano: sfHeated aplicado al proyecto",
    (r1 as any).applied?.includes('sfHeated'), `applied=${JSON.stringify((r1 as any).applied)}`);

  // Verificar que el proyecto AHORA tiene sfHeated=2400
  const after1 = await prisma.project.findUnique({ where: { id: project.id } });
  check("Project.sfHeated = 2400 después del upload de plano",
    after1?.sfHeated === 2400, `sfHeated=${after1?.sfHeated}`);
  check("Project.sfGarage = 1013",   after1?.sfGarage === 1013, `sfGarage=${after1?.sfGarage}`);
  check("Project.sfPorches = 687",   after1?.sfPorches === 687, `sfPorches=${after1?.sfPorches}`);

  // 3. UPLOAD HUD — debe poblar holdback/loanAmount/closingCosts
  console.log("\n[2] Upload HUD-1");
  const r2 = await simulateUpload(project.id, 'hud_cierre', `${LOTE87}/HERA LENDER/1986 HUD-1.pdf`);
  console.log(`   Aplicados: ${(r2 as any).applied?.join(', ')}`);
  const after2 = await prisma.project.findUnique({ where: { id: project.id } });
  check("HUD: holdback = $395,350",      after2?.holdback === 395350, `holdback=${after2?.holdback}`);
  check("HUD: loanAmount = $402,350",    after2?.loanAmount === 402350, `loanAmount=${after2?.loanAmount}`);
  check("HUD: cashAtSettlement > 0",     (after2?.cashAtSettlement ?? 0) > 0, `$${after2?.cashAtSettlement}`);
  check("HUD: closingCosts > 0",         (after2?.closingCosts ?? 0) > 0, `$${after2?.closingCosts}`);

  // 4. UPLOAD LOAN APPROVAL — debe poblar lender, no sobrescribir holdback ya aplicado
  console.log("\n[3] Upload Loan Approval Letter");
  const r3 = await simulateUpload(project.id, 'carta_lender', `${LOTE87}/HERA LENDER/Loan Approval Letter Lot 87 North Foxglove Road, Westminster, SC 29693.pdf`);
  console.log(`   Aplicados: ${(r3 as any).applied?.join(', ')}`);
  const after3 = await prisma.project.findUnique({ where: { id: project.id } });
  check("Loan: lender = 'Hera Holdings LLC' aplicado",
    after3?.lender === 'Hera Holdings LLC', `lender=${after3?.lender}`);
  check("Loan: interestRate aplicado",   (after3?.interestRate ?? 0) > 0, `${after3?.interestRate}`);
  check("Loan: holdback NO sobrescrito (ya estaba del HUD)",
    after3?.holdback === 395350, `holdback=${after3?.holdback}`);

  // 5. UPLOAD PERMIT — debe poblar permitNumber
  console.log("\n[4] Upload Permit");
  const r4 = await simulateUpload(project.id, 'permiso_construccion', `${LOTE87}/PERMISOS/Permit Card 218NFoxgloveDr.pdf`);
  console.log(`   Aplicados: ${(r4 as any).applied?.join(', ')}`);
  const after4 = await prisma.project.findUnique({ where: { id: project.id } });
  check("Permit: permitNumber = 'BR26-000029'",
    after4?.permitNumber === 'BR26-000029', `permitNumber=${after4?.permitNumber}`);
  check("Permit: permitIssued aplicado",  !!after4?.permitIssued);
  check("Permit: permitExpires aplicado", !!after4?.permitExpires);

  // 6. UPLOAD SURVEY (escaneado, requiere OCR) — debe poblar parcelId via OCR
  console.log("\n[5] Upload Survey (escaneado — OCR, tarda ~12s)");
  const r5 = await simulateUpload(project.id, 'survey', `${LOTE87}/SURVEY LOTE 87 .pdf`);
  console.log(`   Aplicados: ${(r5 as any).applied?.join(', ')} | OCR usado: ${(r5 as any).ocrUsed}`);
  check("Survey: OCR activado (PDF escaneado)", (r5 as any).ocrUsed === true, `ocr=${(r5 as any).ocrUsed}`);
  const after5 = await prisma.project.findUnique({ where: { id: project.id } });
  check("Survey via OCR: parcelId aplicado",
    !!after5?.parcelId, `parcelId=${after5?.parcelId}`);

  // ─── RESUMEN: state del proyecto después de TODOS los uploads ─────────
  console.log("\n=== Estado final del proyecto ===");
  const final = await prisma.project.findUnique({ where: { id: project.id } });
  console.log(`  sfHeated:    ${final?.sfHeated}`);
  console.log(`  sfGarage:    ${final?.sfGarage}`);
  console.log(`  sfPorches:   ${final?.sfPorches}`);
  console.log(`  holdback:    $${final?.holdback}`);
  console.log(`  loanAmount:  $${final?.loanAmount}`);
  console.log(`  lender:      ${final?.lender}`);
  console.log(`  permitNumber: ${final?.permitNumber}`);
  console.log(`  parcelId:    ${final?.parcelId}`);

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
