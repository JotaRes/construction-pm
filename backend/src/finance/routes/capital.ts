import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [contribs, loans, nonBank, partners] = await Promise.all([
      prisma.capitalContribution.findMany({ include: { partner: true, project: true }, orderBy: { date: "asc" } }),
      prisma.loan.findMany({ include: { lender: true, project: true }, orderBy: { date: "asc" } }),
      prisma.nonBankContribution.findMany({ include: { partner: true, project: true }, orderBy: { date: "asc" } }),
      prisma.partner.findMany(),
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
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    const created = await prisma.capitalContribution.create({ data });
    ok(res, created);
  } catch (e) { fail(res, e); }
});

router.patch("/contributions/:id", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    const updated = await prisma.capitalContribution.update({ where: { id: +req.params.id }, data });
    ok(res, updated);
  } catch (e) { fail(res, e); }
});

router.delete("/contributions/:id", async (req, res) => {
  try {
    await prisma.capitalContribution.delete({ where: { id: +req.params.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

router.post("/non-bank", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    ok(res, await prisma.nonBankContribution.create({ data }));
  } catch (e) { fail(res, e); }
});
router.patch("/non-bank/:id", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    ok(res, await prisma.nonBankContribution.update({ where: { id: +req.params.id }, data }));
  } catch (e) { fail(res, e); }
});
router.delete("/non-bank/:id", async (req, res) => {
  try { await prisma.nonBankContribution.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

export default router;
