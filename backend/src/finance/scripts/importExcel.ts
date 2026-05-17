import "dotenv/config";
import fs from "fs";
import { importExcelFromBuffer } from "../services/excelImporter";
import { prisma } from "../lib/prisma";

const DEFAULT_PATH = "/Users/juandavid/Desktop/CLAUDE/DIRECTOR FINANCIERO /DOC FINANCIERO 2025-2026 .xlsx";

async function main() {
  const args = process.argv.slice(2);
  const pathArg = args.find((a) => !a.startsWith("--"));
  const path = pathArg || DEFAULT_PATH;
  const wipe = args.includes("--wipe");
  if (!fs.existsSync(path)) {
    console.error(`✗ no se encontró el archivo: ${path}`);
    process.exit(1);
  }
  console.log(`→ Importando: ${path} ${wipe ? "(wipe=true)" : ""}`);
  const buffer = fs.readFileSync(path);
  const result = await importExcelFromBuffer(buffer, { wipe });
  console.log("✓ Resultado:", JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
