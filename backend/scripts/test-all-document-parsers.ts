// AUDITORÍA UNIVERSAL: cada parser de documentos del sistema se prueba con su
// PDF real del LOTE 87. Si algún parser falla en extraer un campo crítico, el
// test falla. Esto evita el bug que el usuario reportó: items ignorados,
// extractores que silenciosamente devuelven 0.
//
// Uso: DATABASE_URL=file:./dev.db npx tsx scripts/test-all-document-parsers.ts

import * as fs from "fs";
import {
  parseTrinityDrawApprovals, parseDrawText, parseHUDText, parseLoanText,
  parseSurveyText, parsePlansText, parsePermitText, parseLOIText,
  parseAppraisalText,
} from "../src/routes/draws";
import { extractPdfText } from "../src/lib/pdfOcr";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

interface R { name: string; pass: boolean; detail?: string }
const results: R[] = [];
function check(name: string, c: boolean, detail?: string) {
  results.push({ name, pass: c, detail });
  console.log(`${c ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

const LOTE87 = "/Users/juandavid/Desktop/CLAUDE/DIRECTOR CONSTRUCTIVO/LOTES/LOTE 87";

async function readPdf(path: string): Promise<string> {
  if (!fs.existsSync(path)) { console.log(`SKIP: ${path} no existe`); return ""; }
  const buf = fs.readFileSync(path);
  const d = await pdfParse(buf);
  return d.text || "";
}

async function main() {
  console.log("🧪 AUDITORÍA UNIVERSAL de parsers de documentos\n");

  // ─── 1. Trinity Draw Report (formato A — LOTE 87 Draw 1) ───────────────
  console.log("[1] Trinity Draw Report — LOTE 87 Draw 1 (formato A legacy)");
  const trinityA = await readPdf(`${LOTE87}/HERA LENDER/DRAW 1/Draw_1_Lot 87.pdf`);
  if (trinityA) {
    const apps = parseTrinityDrawApprovals(trinityA);
    const withDelta = apps.filter(a => a.deltaThisDraw > 0);
    const sumCurrent = apps.reduce((s, a) => s + a.currentAmountAvailable, 0);
    check("Trinity A: ≥ 50 items parseados (LOTE 87)",   apps.length >= 50, `${apps.length}`);
    check("Trinity A: ≥ 10 items con delta > 0",         withDelta.length >= 10, `${withDelta.length}`);
    check("Trinity A: Survey extraído",                  apps.some(a => a.description === "Survey"));
    check("Trinity A: sum current = $94,400 (LOTE 87)",  Math.abs(sumCurrent - 94400) < 5, `$${sumCurrent.toFixed(2)}`);
    // Verificación del header
    const header = parseDrawText(trinityA);
    check("Trinity A: drawNumber = 1",                   header.drawNumber === 1);
    check("Trinity A: elegibleTrinity > 0 (TOTAL row)",  (header.elegibleTrinity as number) > 0, `$${header.elegibleTrinity}`);
  }

  // ─── 2. Trinity Draw Report (formato B — Lot 827 Draw 2) ──────────────
  console.log("\n[2] Trinity Draw Report — Lot 827 Draw 2 (formato B 2026)");
  if (fs.existsSync("/tmp/draw1_prod.pdf")) {
    const trinityB = await readPdf("/tmp/draw1_prod.pdf");
    const apps = parseTrinityDrawApprovals(trinityB);
    const withDelta = apps.filter(a => a.deltaThisDraw > 0);
    const sumCurrent = withDelta.reduce((s, a) => s + a.currentAmountAvailable, 0);
    check("Trinity B: ≥ 60 items parseados",             apps.length >= 60, `${apps.length}`);
    check("Trinity B: GC Fee — 5% (descripción con %)",  apps.some(a => a.description.includes("GC Fee") && a.currentAmountAvailable > 11000),
      `GC Fee aprobado = $${apps.find(a => a.description.includes("GC Fee"))?.currentAmountAvailable.toFixed(2) ?? "no encontrado"}`);
    check("Trinity B: Contingency — 10% (descripción con %)", apps.some(a => a.description.includes("Contingency") && a.currentAmountAvailable > 10000),
      `Contingency aprobado = $${apps.find(a => a.description.includes("Contingency"))?.currentAmountAvailable.toFixed(2) ?? "no encontrado"}`);
    check("Trinity B: 17 items con delta > 0",           withDelta.length === 17, `${withDelta.length}`);
    check("Trinity B: sum current ≈ $111,364 (TOTAL row del PDF)",
      Math.abs(sumCurrent - 111364.85) < 1, `$${sumCurrent.toFixed(2)}`);
    const header = parseDrawText(trinityB);
    check("Trinity B: elegibleTrinity = $111,364.85",    Math.abs((header.elegibleTrinity as number) - 111364.85) < 1, `$${header.elegibleTrinity}`);
  }

  // ─── 3. HUD-1 ──────────────────────────────────────────────────────────
  console.log("\n[3] HUD-1");
  const hudText = await readPdf(`${LOTE87}/HERA LENDER/1986 HUD-1.pdf`);
  if (hudText) {
    const hud = parseHUDText(hudText);
    check("HUD-1: settlementDate detectado",             !!hud.settlementDate, `${hud.settlementDate}`);
    check("HUD-1: closingCosts > 0",                     (hud.closingCosts as number) > 0, `$${hud.closingCosts}`);
    check("HUD-1: loanAmount > 0",                       (hud.loanAmount as number) > 0, `$${hud.loanAmount}`);
    check("HUD-1: holdback > 0 (línea 109)",             (hud.holdback as number) > 0, `$${hud.holdback}`);
    check("HUD-1: cashAtSettlement > 0",                 (hud.cashAtSettlement as number) > 0, `$${hud.cashAtSettlement}`);
  }

  // ─── 4. Loan Approval Letter ──────────────────────────────────────────
  console.log("\n[4] Loan Approval Letter");
  const loanText = await readPdf(`${LOTE87}/HERA LENDER/Loan Approval Letter Lot 87 North Foxglove Road, Westminster, SC 29693.pdf`);
  if (loanText) {
    const loan = parseLoanText(loanText);
    check("Loan: lender detectado",                      !!loan.lender, `${loan.lender}`);
    check("Loan: loanAmount > 0",                        (loan.loanAmount as number) > 0, `$${loan.loanAmount}`);
    check("Loan: holdback > 0",                          (loan.holdback as number) > 0, `$${loan.holdback}`);
    check("Loan: interestRate > 0",                      (loan.interestRate as number) > 0, `${loan.interestRate}`);
  }

  // ─── 5. Survey (PDF escaneado — usa OCR) ──────────────────────────────
  console.log("\n[5] Survey (escaneado, requiere OCR — tarda ~12s)");
  const surveyPath = `${LOTE87}/SURVEY LOTE 87 .pdf`;
  if (fs.existsSync(surveyPath)) {
    const buf = fs.readFileSync(surveyPath);
    const { text: surveyText, ocrUsed } = await extractPdfText(buf);
    check("Survey: OCR se activó (PDF escaneado)", ocrUsed, ocrUsed ? "ocr=on" : "ocr=off");
    const sv = parseSurveyText(surveyText);
    const hasAny = sv.parcelId || sv.lotAcres || sv.address || sv.county;
    check("Survey: extrae al menos un campo (parcelId/acres/address/county) — vía OCR",
      !!hasAny, JSON.stringify(sv));
  }

  // ─── 6. Plans (planos de obra) ────────────────────────────────────────
  console.log("\n[6] Plans");
  const plansText = await readPdf(`${LOTE87}/PLANOS LOTE 87/2400-5 CRAWLSPACE.pdf`);
  if (plansText) {
    const pl = parsePlansText(plansText);
    const hasAny = pl.sfHeated || pl.sfGarage || pl.sfPorches || pl.bedrooms || pl.bathrooms || pl.foundationType;
    check("Plans: extrae al menos un campo físico (sfHeated/bedrooms/foundation)",
      !!hasAny, JSON.stringify(pl));
    if (pl.foundationType) check("Plans: foundationType = crawlspace (del filename)", /crawl/i.test(pl.foundationType as string));
  }

  // ─── 7. Permit ────────────────────────────────────────────────────────
  console.log("\n[7] Permit");
  const permitText = await readPdf(`${LOTE87}/PERMISOS/Permit Card 218NFoxgloveDr.pdf`);
  if (permitText) {
    const pe = parsePermitText(permitText);
    const hasAny = pe.permitNumber || pe.permitIssued || pe.permitExpires || pe.county;
    check("Permit: extrae al menos un campo",
      !!hasAny, JSON.stringify(pe));
  }

  // ─── 8. LOI ───────────────────────────────────────────────────────────
  console.log("\n[8] LOI");
  const loiText = await readPdf(`${LOTE87}/ALTO CAPITAL/LOI LOT 87.pdf`);
  if (loiText) {
    const lo = parseLOIText(loiText);
    const hasAny = lo.loiSalePrice || lo.loiOfferDate || lo.loiExpectedClose || lo.loiEarnestMoney;
    check("LOI: extrae al menos un campo financiero",
      !!hasAny, JSON.stringify(lo));
  }

  // ─── 9. Appraisal ─────────────────────────────────────────────────────
  console.log("\n[9] Appraisal");
  const appraisalText = await readPdf(`${LOTE87}/ALTO CAPITAL/Apreciacion lot 87 .pdf`);
  if (appraisalText) {
    const ap = parseAppraisalText(appraisalText);
    const hasAny = ap.arv || ap.sfHeated || ap.targetListingPrice;
    check("Appraisal: extrae al menos un campo (arv/sf/list price)",
      !!hasAny, JSON.stringify(ap));
  }

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

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
