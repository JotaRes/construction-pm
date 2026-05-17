import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  SPVS,
  ACCOUNTS,
  PARTNERS,
  LENDERS,
  EXPENSE_CATEGORIES,
  INCOME_ORIGINS,
  PROJECTS_SEED,
} from "../data/catalogs";

async function main() {
  console.log("→ Seeding SPVs...");
  for (const s of SPVS) {
    await prisma.finSPV.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: { code: s.code, name: s.name },
    });
  }

  console.log("→ Seeding Accounts...");
  for (const a of ACCOUNTS) {
    const spv = a.spvCode ? await prisma.finSPV.findUnique({ where: { code: a.spvCode } }) : null;
    await prisma.finAccount.upsert({
      where: { code: a.code },
      update: {
        name: a.name,
        bank: a.bank,
        initialBalance: a.initialBalance,
        yearsActive: a.yearsActive,
        spvId: spv?.id ?? null,
      },
      create: {
        code: a.code,
        name: a.name,
        bank: a.bank,
        initialBalance: a.initialBalance,
        yearsActive: a.yearsActive,
        spvId: spv?.id ?? null,
      },
    });
  }

  console.log("→ Seeding Partners...");
  for (const p of PARTNERS) {
    await prisma.finPartner.upsert({
      where: { code: p.code },
      update: { fullName: p.fullName },
      create: { code: p.code, fullName: p.fullName },
    });
  }

  console.log("→ Seeding Lenders...");
  for (const l of LENDERS) {
    await prisma.finLender.upsert({
      where: { name: l.name },
      update: { type: l.type },
      create: { name: l.name, type: l.type },
    });
  }

  console.log("→ Seeding Expense Categories...");
  for (const c of EXPENSE_CATEGORIES) {
    await prisma.finExpenseCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, group: c.group, isCorporate: c.isCorporate },
      create: { code: c.code, name: c.name, group: c.group, isCorporate: c.isCorporate },
    });
  }

  console.log("→ Seeding Income Origins...");
  for (const o of INCOME_ORIGINS) {
    await prisma.finIncomeOrigin.upsert({
      where: { code: o.code },
      update: { name: o.name },
      create: { code: o.code, name: o.name },
    });
  }

  console.log("→ Seeding Projects...");
  for (const p of PROJECTS_SEED) {
    const spv = p.spvCode ? await prisma.finSPV.findUnique({ where: { code: p.spvCode } }) : null;
    await prisma.finProject.upsert({
      where: { code: p.code },
      update: { name: p.name, line: p.line, model: p.model, status: p.status, spvId: spv?.id ?? null },
      create: {
        code: p.code,
        name: p.name,
        line: p.line,
        model: p.model,
        status: p.status,
        spvId: spv?.id ?? null,
      },
    });
  }

  console.log("✓ Catálogos cargados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
