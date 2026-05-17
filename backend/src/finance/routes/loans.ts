import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";

const router = Router();

function classifyLoan(rate: number | null | undefined): string {
  if (rate == null) return "sin clasificar";
  if (rate <= 7) return "competitiva";
  if (rate <= 10) return "razonable";
  if (rate <= 13) return "cara";
  if (rate <= 16) return "agresiva";
  return "peligrosa";
}

router.get("/", async (_req, res) => {
  try {
    const loans = await prisma.loan.findMany({
      include: { lender: true, project: true, movements: true },
      orderBy: { date: "desc" },
    });
    const enriched = loans.map((l) => ({
      ...l,
      outstanding: l.amount - (l.totalRepaid || 0),
      classification: l.classification || classifyLoan(l.interestRate),
    }));
    ok(res, enriched);
  } catch (e) { fail(res, e); }
});

router.post("/", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (!data.classification) data.classification = classifyLoan(data.interestRate);
    ok(res, await prisma.loan.create({ data }));
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (data.interestRate != null && !data.classification) data.classification = classifyLoan(data.interestRate);
    ok(res, await prisma.loan.update({ where: { id: +req.params.id }, data }));
  } catch (e) { fail(res, e); }
});

router.delete("/:id", async (req, res) => {
  try { await prisma.loan.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

export default router;
