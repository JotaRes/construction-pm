import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";
import {
  parseOrError,
  capitalContributionCreateSchema,
  capitalContributionUpdateSchema,
  nonBankContributionCreateSchema,
  nonBankContributionUpdateSchema,
} from "../lib/validate";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [contribs, loans, nonBank, partners] = await Promise.all([
      prisma.finCapitalContribution.findMany({ include: { partner: true, project: true }, orderBy: { date: "asc" } }),
      prisma.finLoan.findMany({ include: { lender: true, project: true }, orderBy: { date: "asc" } }),
      prisma.finNonBankContribution.findMany({ include: { partner: true, project: true }, orderBy: { date: "asc" } }),
      prisma.finPartner.findMany(),
    ]);

    const byPartner = partners.map((p) => {
      const bank = contribs.filter((c) => c.partnerId === p.id).reduce((s, c) => s + c.amount, 0);
      const nonBankAmt = nonBank.filter((c) => c.partnerId === p.id).reduce((s, c) => s + c.amount, 0);
      return { partner: p, bankContrib: bank, nonBankContrib: nonBankAmt, totalEquity: bank + nonBankAmt };
    });

    const totalEquity = byPartner.reduce((s, p) => s + p.totalEquity, 0);
    const totalLoans = loans.reduce((s, l) => s + l.amount, 0);
    const totalRepaid = loans.reduce((s, l) => s + (l.totalRepaid || 0), 0);
    const outstandingDebt = totalLoans - totalRepaid;

    ok(res, {
      contribs,
      loans,
      nonBank,
      byPartner,
      kpis: { totalEquity, totalLoans, totalRepaid, outstandingDebt },
    });
  } catch (e) { fail(res, e); }
});

router.post("/contributions", async (req, res) => {
  try {
    const { data, error } = parseOrError(capitalContributionCreateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const created = await prisma.finCapitalContribution.create({ data });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

router.patch("/contributions/:id", async (req, res) => {
  try {
    const { data, error } = parseOrError(capitalContributionUpdateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    const updated = await prisma.finCapitalContribution.update({ where: { id: +req.params.id }, data });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

router.delete("/contributions/:id", async (req, res) => {
  try {
    await prisma.finCapitalContribution.delete({ where: { id: +req.params.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

router.post("/non-bank", async (req, res) => {
  try {
    const { data, error } = parseOrError(nonBankContributionCreateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    ok(res, await prisma.finNonBankContribution.create({ data }));
  } catch (e) { fail(res, e); }
});
router.patch("/non-bank/:id", async (req, res) => {
  try {
    const { data, error } = parseOrError(nonBankContributionUpdateSchema, req.body);
    if (error !== null) return fail(res, error, 400);
    ok(res, await prisma.finNonBankContribution.update({ where: { id: +req.params.id }, data }));
  } catch (e) { fail(res, e); }
});
router.delete("/non-bank/:id", async (req, res) => {
  try { await prisma.finNonBankContribution.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

export default router;
