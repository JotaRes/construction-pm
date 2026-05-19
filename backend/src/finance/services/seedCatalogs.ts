import { prisma } from "../lib/prisma";
import {
  SPVS, ACCOUNTS, PARTNERS, LENDERS,
  EXPENSE_CATEGORIES, INCOME_ORIGINS, PROJECTS_SEED,
} from "../data/catalogs";

/**
 * Siembra catálogos por defecto (idempotente — usa upsert).
 * Útil para inicializar producción cuando la BD está vacía.
 *
 * Retorna conteo de cada tabla luego de sembrar.
 */
export async function seedFinanceCatalogs() {
  const counts = { spvs: 0, accounts: 0, partners: 0, lenders: 0, categories: 0, origins: 0, projects: 0 };

  for (const s of SPVS) {
    await prisma.finSPV.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: { code: s.code, name: s.name },
    });
  }
  counts.spvs = await prisma.finSPV.count();

  for (const a of ACCOUNTS) {
    const spv = a.spvCode ? await prisma.finSPV.findUnique({ where: { code: a.spvCode } }) : null;
    await prisma.finAccount.upsert({
      where: { code: a.code },
      update: { name: a.name, bank: a.bank, initialBalance: a.initialBalance, yearsActive: a.yearsActive, spvId: spv?.id ?? null },
      create: { code: a.code, name: a.name, bank: a.bank, initialBalance: a.initialBalance, yearsActive: a.yearsActive, spvId: spv?.id ?? null },
    });
  }
  counts.accounts = await prisma.finAccount.count();

  for (const p of PARTNERS) {
    await prisma.finPartner.upsert({
      where: { code: p.code },
      update: { fullName: p.fullName },
      create: { code: p.code, fullName: p.fullName },
    });
  }
  counts.partners = await prisma.finPartner.count();

  for (const l of LENDERS) {
    await prisma.finLender.upsert({
      where: { name: l.name },
      update: { type: l.type },
      create: { name: l.name, type: l.type },
    });
  }
  counts.lenders = await prisma.finLender.count();

  for (const c of EXPENSE_CATEGORIES) {
    await prisma.finExpenseCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, group: c.group, isCorporate: c.isCorporate },
      create: { code: c.code, name: c.name, group: c.group, isCorporate: c.isCorporate },
    });
  }
  counts.categories = await prisma.finExpenseCategory.count();

  for (const o of INCOME_ORIGINS) {
    await prisma.finIncomeOrigin.upsert({
      where: { code: o.code },
      update: { name: o.name },
      create: { code: o.code, name: o.name },
    });
  }
  counts.origins = await prisma.finIncomeOrigin.count();

  for (const p of PROJECTS_SEED) {
    const spv = p.spvCode ? await prisma.finSPV.findUnique({ where: { code: p.spvCode } }) : null;
    await prisma.finProject.upsert({
      where: { code: p.code },
      update: { name: p.name, line: p.line, model: p.model, status: p.status, spvId: spv?.id ?? null },
      create: { code: p.code, name: p.name, line: p.line, model: p.model, status: p.status, spvId: spv?.id ?? null },
    });
  }
  counts.projects = await prisma.finProject.count();

  return counts;
}
