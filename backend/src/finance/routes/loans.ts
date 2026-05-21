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
    const loans = await prisma.finLoan.findMany({
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
    ok(res, await prisma.finLoan.create({ data }));
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (data.interestRate != null && !data.classification) data.classification = classifyLoan(data.interestRate);
    ok(res, await prisma.finLoan.update({ where: { id: +req.params.id }, data }));
  } catch (e) { fail(res, e); }
});

router.delete("/:id", async (req, res) => {
  try { await prisma.finLoan.delete({ where: { id: +req.params.id } }); ok(res, { deleted: true }); }
  catch (e) { fail(res, e); }
});

// === POST /upsert-from-tech ===
// Endpoint llamado desde el módulo técnico cuando se sube una carta de aprobación
// del lender. Crea/actualiza el lender y el préstamo en el módulo financiero.
//
// Body: {
//   lender: string (nombre del prestamista),
//   loanNumber?: string,
//   loanAmount: number,
//   interestRate?: number (decimal, ej 0.085),
//   loanTermMonths?: number,
//   settlementDate?: string (ISO),
//   day1Disbursement?: number,
//   holdback?: number,
//   interestReserve?: number,
//   techProjectName?: string (nombre del proyecto técnico para emparejar con FinProject)
// }
router.post("/upsert-from-tech", async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.lender || !b.loanAmount) {
      return fail(res, "Se requiere al menos 'lender' y 'loanAmount'", 400);
    }

    // 1. Upsert del lender (por nombre — único en el schema)
    const lenderName = String(b.lender).trim();
    const existingLender = await prisma.finLender.findUnique({ where: { name: lenderName } });
    const lender = existingLender || await prisma.finLender.create({
      data: {
        name: lenderName,
        type: b.lenderType || "Bank",
        notes: "Creado automáticamente desde upload de carta de aprobación (módulo técnico)",
      },
    });

    // 2. Buscar proyecto financiero asociado (si techProjectName matchea con FinProject.name)
    let finProjectId: number | null = null;
    if (b.techProjectName) {
      const finProject = await prisma.finProject.findFirst({
        where: { name: { contains: String(b.techProjectName) } },
      });
      if (finProject) finProjectId = finProject.id;
    }

    // 3. Buscar si ya existe un préstamo con este lender + loanNumber (evitar duplicados)
    const loanDate = b.settlementDate ? new Date(b.settlementDate) : new Date();
    const interestPct = b.interestRate != null ? Number(b.interestRate) * 100 : null; // backend usa % entero
    const classification = classifyLoan(interestPct);

    const existingLoan = b.loanNumber
      ? await prisma.finLoan.findFirst({
          where: { lenderId: lender.id, notes: { contains: `loanNumber:${b.loanNumber}` } },
        })
      : null;

    let loan;
    if (existingLoan) {
      // Update
      loan = await prisma.finLoan.update({
        where: { id: existingLoan.id },
        data: {
          amount: Number(b.loanAmount),
          interestRate: interestPct,
          termMonths: b.loanTermMonths ? Number(b.loanTermMonths) : null,
          startDate: loanDate,
          classification,
          projectId: finProjectId || existingLoan.projectId,
          notes: `loanNumber:${b.loanNumber || "—"} · auto-sync desde módulo técnico`,
        },
      });
    } else {
      loan = await prisma.finLoan.create({
        data: {
          date: loanDate,
          amount: Number(b.loanAmount),
          concept: `Carta de aprobación ${lenderName}${b.loanNumber ? " #" + b.loanNumber : ""}`,
          lenderId: lender.id,
          projectId: finProjectId,
          interestRate: interestPct,
          termMonths: b.loanTermMonths ? Number(b.loanTermMonths) : null,
          startDate: loanDate,
          status: "activo",
          classification,
          notes: `loanNumber:${b.loanNumber || "—"} · auto-sync desde módulo técnico`,
        },
      });
    }

    ok(res, {
      lender,
      loan,
      action: existingLoan ? "updated" : "created",
      finProjectMatched: !!finProjectId,
    });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
