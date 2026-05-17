import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";

interface ImportResult {
  movements: number;
  capitalContribs: number;
  loans: number;
  nonBank: number;
  projectsTouched: number;
  accountsTouched: number;
  warnings: string[];
}

function cell(v: any): any {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "(no aplica)" || s === "0" && typeof v === "string") return null;
  return v;
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(v).trim();
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function parseAmount(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[\s$,]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function normalize(s: string | null | undefined): string {
  return (s || "").toString().trim().toLowerCase();
}

async function ensureCatalogs() {
  // Asegura que catálogos base existan (idempotente)
  const { SPVS, ACCOUNTS, PARTNERS, LENDERS, EXPENSE_CATEGORIES, INCOME_ORIGINS, PROJECTS_SEED } = await import("../data/catalogs");
  for (const s of SPVS) await prisma.finSPV.upsert({ where: { code: s.code }, update: {}, create: s });
  for (const a of ACCOUNTS) {
    const spv = a.spvCode ? await prisma.finSPV.findUnique({ where: { code: a.spvCode } }) : null;
    await prisma.finAccount.upsert({
      where: { code: a.code },
      update: { name: a.name, bank: a.bank, initialBalance: a.initialBalance, yearsActive: a.yearsActive, spvId: spv?.id ?? null },
      create: { code: a.code, name: a.name, bank: a.bank, initialBalance: a.initialBalance, yearsActive: a.yearsActive, spvId: spv?.id ?? null },
    });
  }
  for (const p of PARTNERS) await prisma.finPartner.upsert({ where: { code: p.code }, update: {}, create: p });
  for (const l of LENDERS) await prisma.finLender.upsert({ where: { name: l.name }, update: {}, create: l });
  for (const c of EXPENSE_CATEGORIES) await prisma.finExpenseCategory.upsert({ where: { code: c.code }, update: {}, create: c });
  for (const o of INCOME_ORIGINS) await prisma.finIncomeOrigin.upsert({ where: { code: o.code }, update: {}, create: o });
  for (const p of PROJECTS_SEED) {
    const spv = p.spvCode ? await prisma.finSPV.findUnique({ where: { code: p.spvCode } }) : null;
    await prisma.finProject.upsert({
      where: { code: p.code },
      update: { name: p.name, line: p.line, model: p.model, status: p.status, spvId: spv?.id ?? null },
      create: { code: p.code, name: p.name, line: p.line, model: p.model, status: p.status, spvId: spv?.id ?? null },
    });
  }
}

export async function importExcelFromBuffer(
  buffer: Buffer,
  opts: { wipe?: boolean } = {}
): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const result: ImportResult = {
    movements: 0,
    capitalContribs: 0,
    loans: 0,
    nonBank: 0,
    projectsTouched: 0,
    accountsTouched: 0,
    warnings: [],
  };

  if (opts.wipe) {
    await prisma.finMovementDocument.deleteMany({});
    await prisma.finBankStatementLine.deleteMany({});
    await prisma.finBankStatement.deleteMany({});
    await prisma.finMovement.deleteMany({});
    await prisma.finCapitalContribution.deleteMany({});
    await prisma.finLoan.deleteMany({});
    await prisma.finNonBankContribution.deleteMany({});
  }

  await ensureCatalogs();

  // Indexar catálogos por nombre/code para lookups rápidos
  const [accounts, partners, lenders, providers, categories, origins, projects] = await Promise.all([
    prisma.finAccount.findMany(),
    prisma.finPartner.findMany(),
    prisma.finLender.findMany(),
    prisma.finProvider.findMany(),
    prisma.finExpenseCategory.findMany(),
    prisma.finIncomeOrigin.findMany(),
    prisma.finProject.findMany(),
  ]);

  const accountByName = new Map<string, number>();
  for (const a of accounts) {
    accountByName.set(normalize(a.code), a.id);
    accountByName.set(normalize(a.name), a.id);
    // Alias comunes
    const stripped = normalize(a.name).replace(/\s+/g, " ").trim();
    accountByName.set(stripped, a.id);
    // Trim suffixes / variations
    if (a.name.includes("DEVELOPMENTS")) accountByName.set(normalize(a.name.replace("DEVELOPMENTS", "DEVELOPERS")), a.id);
    if (a.name.includes("ALLIANCE")) accountByName.set(normalize(a.name.replace("ALLIANCE", "ALLI")), a.id);
  }
  // Fuzzy fallback: match by prefix
  function findAccountFuzzy(name: string): number | null {
    const n = normalize(name);
    if (accountByName.has(n)) return accountByName.get(n)!;
    // probar primeros 15 caracteres
    const prefix = n.slice(0, 15);
    for (const [k, v] of accountByName) {
      if (k.startsWith(prefix) || prefix.startsWith(k.slice(0, 15))) return v;
    }
    return null;
  }
  const partnerByCode = new Map<string, number>();
  for (const p of partners) partnerByCode.set(normalize(p.code), p.id);
  const lenderByName = new Map<string, number>();
  for (const l of lenders) lenderByName.set(normalize(l.name), l.id);
  const categoryByName = new Map<string, number>();
  for (const c of categories) categoryByName.set(normalize(c.name), c.id);
  const originByName = new Map<string, number>();
  for (const o of origins) originByName.set(normalize(o.name), o.id);
  const providerByName = new Map<string, number>();
  for (const p of providers) providerByName.set(normalize(p.name), p.id);
  const projectByName = new Map<string, number>();
  for (const p of projects) {
    projectByName.set(normalize(p.code), p.id);
    projectByName.set(normalize(p.name), p.id);
  }

  async function getOrCreateProvider(name: string | null): Promise<number | null> {
    if (!name) return null;
    const key = normalize(name);
    if (providerByName.has(key)) return providerByName.get(key)!;
    const created = await prisma.finProvider.create({ data: { name } });
    providerByName.set(key, created.id);
    return created.id;
  }

  async function getOrCreateLender(name: string | null): Promise<number | null> {
    if (!name) return null;
    const key = normalize(name);
    if (lenderByName.has(key)) return lenderByName.get(key)!;
    const created = await prisma.finLender.create({ data: { name } });
    lenderByName.set(key, created.id);
    return created.id;
  }

  async function getOrCreateProject(name: string | null): Promise<number | null> {
    if (!name) return null;
    const key = normalize(name);
    if (projectByName.has(key)) return projectByName.get(key)!;
    // intentar match parcial
    for (const [k, v] of projectByName) {
      if (k.includes(key) || key.includes(k)) return v;
    }
    return null;
  }

  // ----- MOVIMIENTOS (MOV 2025 + MOV 2026) -----
  for (const sheetName of ["MOV 2025", "MOV 2026"]) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      result.warnings.push(`hoja ${sheetName} no encontrada`);
      continue;
    }
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null });
    // Header en row 13 (index 12), data desde row 14 (index 13)
    let headerIdx = -1;
    for (let i = 10; i < Math.min(rows.length, 20); i++) {
      const row = (rows[i] || []).map((c) => String(c || "").toUpperCase());
      if (row.includes("FECHA") && row.some((c) => c.includes("CUENTA"))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) {
      result.warnings.push(`no se encontró header en ${sheetName}`);
      continue;
    }

    const headers = (rows[headerIdx] || []).map((c) => String(c || "").toUpperCase().trim());
    const col = (name: string) => headers.findIndex((h) => h.includes(name));
    const idx = {
      fecha: col("FECHA"),
      cuenta: col("CUENTA"),
      tipo: col("TIPO"),
      valor: col("VALOR"),
      concepto: col("CONCEPTO"),
      categoria: col("CATEG"),
      origen: col("ORIGEN"),
      ctaDest: col("CTA DEST"),
      tercero: col("TERCERO"),
      equity: col("EQUITY"),
      socio: col("SOCIO"),
      prestamo: col("PRÉSTAMO"),
      entidad: col("ENTIDAD"),
      devolucion: col("DEVOLU"),
      asocProyecto: col("ASOC"),
      proyecto: col("PROYECTO"),
      notas: col("NOTAS"),
    };

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const fecha = parseDate(row[idx.fecha]);
      const tipoRaw = cell(row[idx.tipo]);
      const valor = parseAmount(row[idx.valor]);
      if (!fecha || !tipoRaw || !valor) continue;

      const cuentaName = cell(row[idx.cuenta]);
      const accountId = cuentaName ? findAccountFuzzy(String(cuentaName)) : null;
      if (!accountId) {
        result.warnings.push(`${sheetName} R${i + 1}: cuenta no encontrada "${cuentaName}"`);
        continue;
      }

      const tipo = String(tipoRaw);
      const concepto = String(cell(row[idx.concepto]) || "(sin concepto)");
      const ctaDestName = cell(row[idx.ctaDest]);
      const destAccountId = ctaDestName ? findAccountFuzzy(String(ctaDestName)) : null;
      const categoriaName = cell(row[idx.categoria]);
      const categoryId = categoriaName ? categoryByName.get(normalize(categoriaName)) || null : null;
      const origenName = cell(row[idx.origen]);
      const originId = origenName ? originByName.get(normalize(origenName)) || null : null;
      const terceroName = cell(row[idx.tercero]);
      const providerId = terceroName ? await getOrCreateProvider(String(terceroName)) : null;
      const isEquity = normalize(cell(row[idx.equity])) === "sí" || normalize(cell(row[idx.equity])) === "si";
      const socioCode = cell(row[idx.socio]);
      const partnerId = socioCode ? partnerByCode.get(normalize(socioCode)) || null : null;
      const isLoan = normalize(cell(row[idx.prestamo])) === "sí" || normalize(cell(row[idx.prestamo])) === "si";
      const entidadName = cell(row[idx.entidad]);
      const lenderId = entidadName ? await getOrCreateLender(String(entidadName)) : null;
      const isRepayment = normalize(cell(row[idx.devolucion])) === "sí" || normalize(cell(row[idx.devolucion])) === "si";
      const proyectoName = cell(row[idx.proyecto]);
      const projectId = proyectoName ? await getOrCreateProject(String(proyectoName)) : null;
      const notas = cell(row[idx.notas]);

      await prisma.finMovement.create({
        data: {
          date: fecha,
          type: tipo,
          amount: valor,
          concept: concepto,
          accountId,
          destAccountId,
          categoryId,
          originId,
          providerId,
          isEquity,
          partnerId,
          isLoan,
          lenderId,
          isLoanRepayment: isRepayment,
          projectId,
          isIntercompany: tipo === "Interbancario",
          notes: notas ? String(notas) : null,
          importSource: "excel",
          importRef: `${sheetName}:row${i + 1}`,
        },
      });
      result.movements++;
    }
  }

  // ----- CAPITALIZACIÓN -----
  const wsCap = wb.Sheets["CAPITALIZACION"];
  if (wsCap) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wsCap, { header: 1, raw: false, defval: null });
    // Sección A1 — equity (row 10+)
    // Sección A2 — préstamos (row 32+)
    // Sección B — no bancarizado (row ~46+)
    let section: "A1" | "A2" | "B" | null = null;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const first = String(row[0] || "").toUpperCase();
      if (first.includes("A  ·") || first.startsWith("A ·") || first.startsWith("A1") || first.includes("APORTES BANCARIZADO")) section = "A1";
      else if (first.includes("A2") || first.includes("PRÉSTAMOS RECIBIDO") || first.includes("PRESTAMOS RECIBIDO")) section = "A2";
      else if (first.startsWith("B ") || first.includes("APORTES NO BANCARIZ")) section = "B";

      const num = row[0];
      const numParsed = typeof num === "number" ? num : (typeof num === "string" && /^\d+$/.test(num.trim()) ? parseInt(num) : null);
      if (numParsed == null) continue;

      const fecha = parseDate(row[1]);
      const valor = parseAmount(row[2]);
      const concepto = String(cell(row[3]) || "");
      if (!fecha || !valor) continue;

      if (section === "A1") {
        const origenName = cell(row[4]);
        const socioCode = cell(row[5]);
        const proyectoName = cell(row[6]);
        const ctaDestName = cell(row[7]);
        const notas = cell(row[8]);
        const partnerId = socioCode ? partnerByCode.get(normalize(socioCode)) : null;
        if (!partnerId) {
          result.warnings.push(`CAPITALIZACION A1 R${i + 1}: socio no encontrado "${socioCode}"`);
          continue;
        }
        const projectId = proyectoName ? await getOrCreateProject(String(proyectoName)) : null;
        await prisma.finCapitalContribution.create({
          data: {
            date: fecha,
            amount: valor,
            concept: concepto,
            origin: origenName ? String(origenName) : "Equity Socio",
            partnerId,
            projectId: projectId || null,
            destAccountCode: ctaDestName ? String(ctaDestName) : null,
            notes: notas ? String(notas) : null,
          },
        });
        result.capitalContribs++;
      } else if (section === "A2") {
        const entidadName = cell(row[4]);
        const proyectoName = cell(row[6]);
        const ctaDestName = cell(row[7]);
        const notas = cell(row[8]);
        const lenderId = entidadName ? await getOrCreateLender(String(entidadName)) : null;
        if (!lenderId) {
          result.warnings.push(`CAPITALIZACION A2 R${i + 1}: lender no encontrado "${entidadName}"`);
          continue;
        }
        const projectId = proyectoName ? await getOrCreateProject(String(proyectoName)) : null;
        await prisma.finLoan.create({
          data: {
            date: fecha,
            amount: valor,
            concept: concepto,
            lenderId,
            projectId: projectId || null,
            destAccountCode: ctaDestName ? String(ctaDestName) : null,
            notes: notas ? String(notas) : null,
            status: "activo",
          },
        });
        result.loans++;
      } else if (section === "B") {
        const socioCode = cell(row[5]);
        const proyectoName = cell(row[6]);
        const notas = cell(row[8]);
        const partnerId = socioCode ? partnerByCode.get(normalize(socioCode)) : null;
        if (!partnerId) continue;
        const projectId = proyectoName ? await getOrCreateProject(String(proyectoName)) : null;
        await prisma.finNonBankContribution.create({
          data: {
            date: fecha,
            amount: valor,
            concept: concepto,
            partnerId,
            projectId: projectId || null,
            notes: notas ? String(notas) : null,
          },
        });
        result.nonBank++;
      }
    }
  }

  // ----- PROYECTOS (sheet PROYECTOS) -----
  const wsProj = wb.Sheets["PROYECTOS"];
  if (wsProj) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wsProj, { header: 1, raw: false, defval: null });
    let headerIdx = -1;
    for (let i = 5; i < Math.min(rows.length, 15); i++) {
      const row = (rows[i] || []).map((c) => String(c || "").toUpperCase());
      if (row.includes("CÓDIGO") || row.includes("CODIGO")) { headerIdx = i; break; }
    }
    if (headerIdx >= 0) {
      const headers = (rows[headerIdx] || []).map((c) => String(c || "").toUpperCase().trim());
      const col = (name: string) => headers.findIndex((h) => h.includes(name));
      const idxCode = col("CÓDIGO") >= 0 ? col("CÓDIGO") : col("CODIGO");
      const idxName = col("PROYECTO");
      const idxSPV = col("SUBSIDIARIA");
      const idxModel = col("MODELO");
      const idxStatus = col("ESTADO");
      const idxCompra = col("COMPRA");
      const idxARV = col("ARV");
      const idxCashIn = col("CASH IN");
      const idxCostoReal = col("COSTO");

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const code = cell(row[idxCode]);
        const name = cell(row[idxName]);
        if (!code || !name) continue;
        const compra = parseAmount(row[idxCompra]);
        const arv = parseAmount(row[idxARV]);
        const cashIn = parseAmount(row[idxCashIn]);
        const expectedCost = parseAmount(row[idxCostoReal]);
        const status = cell(row[idxStatus]);
        const model = cell(row[idxModel]);
        await prisma.finProject.upsert({
          where: { code: String(code) },
          update: {
            name: String(name),
            model: model ? String(model) : undefined,
            status: status ? String(status) : undefined,
            purchasePrice: compra || 0,
            arv: arv || 0,
            cashIn: cashIn || 0,
            expectedCost: expectedCost || 0,
          },
          create: {
            code: String(code),
            name: String(name),
            model: model ? String(model) : null,
            status: status ? String(status) : "Enlistado",
            purchasePrice: compra || 0,
            arv: arv || 0,
            cashIn: cashIn || 0,
            expectedCost: expectedCost || 0,
            line: String(name).includes("SC") ? "Carolina del Sur" : String(name).includes("FL") ? "Florida" : null,
          },
        });
        result.projectsTouched++;
      }
    }
  }

  // Reportar cuentas tocadas
  result.accountsTouched = accounts.length;

  return result;
}
