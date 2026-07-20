import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/respond";
import { upsertCapitalFromMovement, removeCapitalForMovement } from "../services/capitalSync";
import { upsertLoanFromMovement, removeLoanForMovement, recalculateLoanRepayments } from "../services/loanSync";
import { syncTechFromMovement, removeTechForMovement } from "../services/techSync";
import { logActivity } from "../services/auditLog";
import { movementCreateSchema, movementUpdateSchema, parseOrError } from "../lib/validate";

const router = Router();

const includeAll = {
  account: true,
  destAccount: true,
  category: true,
  origin: true,
  provider: true,
  partner: true,
  lender: true,
  project: true,
  documents: true,
  // Vínculo con la obra (módulo técnico): actividad + fase + proyecto, para
  // mostrar "→ Obra: F01 · Fundación" en la tabla de movimientos.
  techItem: {
    select: {
      id: true,
      itemCode: true,
      activity: true,
      phase: { select: { id: true, code: true, name: true, project: { select: { id: true, name: true } } } },
    },
  },
} as const;

router.get("/", async (req, res) => {
  try {
    const { accountId, involvingAccountId, projectId, partnerId, categoryId, originId, providerId, lenderId, type, from, to, q, needsReview, isIntercompany, isReconciled, limit, offset } = req.query as Record<string, string>;
    const where: any = {};
    // involvingAccountId = bidireccional: incluye transferencias RECIBIDAS (destAccountId) además de las enviadas (accountId)
    // Si está presente, toma precedencia sobre accountId para evitar conflictos con Prisma OR
    if (involvingAccountId) {
      const aid = +involvingAccountId;
      where.OR = [
        { accountId: aid },
        { destAccountId: aid },
      ];
    } else if (accountId) {
      // accountId = solo movimientos donde esta cuenta es ORIGEN
      where.accountId = +accountId;
    }
    if (projectId) where.projectId = +projectId;
    if (partnerId) where.partnerId = +partnerId;
    if (categoryId) where.categoryId = +categoryId;
    if (originId) where.originId = +originId;
    if (providerId) where.providerId = +providerId;
    if (lenderId) where.lenderId = +lenderId;
    if (type) {
      // Normalize type to canonical form (handles case variations and synonyms)
      const t = type.toLowerCase().trim();
      const normalizedType = t.startsWith("ingr") || t === "income" || t === "entrada" ? "Ingreso"
        : t.startsWith("egr") || t === "expense" || t === "salida" ? "Egreso"
        : t.startsWith("inter") || t.startsWith("transfer") ? "Interbancario"
        : type;
      where.type = normalizedType;
    }
    if (needsReview === "true") where.needsReview = true;
    if (isIntercompany === "true") where.isIntercompany = true;
    if (isReconciled === "false") where.isReconciled = false;
    if (from || to) where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
    if (q) {
      // Combinar búsqueda con OR existente si ya hay (involvingAccountId)
      const searchOR = [
        { concept: { contains: q } },
        { notes: { contains: q } },
      ];
      if (where.OR) {
        // AND combinado: ambas condiciones deben cumplirse
        where.AND = [{ OR: where.OR }, { OR: searchOR }];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }
    const take = limit ? Math.min(+limit, 5000) : 500;
    const skip = offset ? +offset : 0;
    const [movements, total] = await Promise.all([
      prisma.finMovement.findMany({ where, include: includeAll, orderBy: { date: "desc" }, take, skip }),
      prisma.finMovement.count({ where }),
    ]);
    ok(res, { movements, total });
  } catch (e) { fail(res, e); }
});

// === Árbol del módulo técnico para asociar movimientos a la obra ===
// ⚠️ Definidas ANTES de "/:id" para que "tech-projects" no se interprete como id.

// Lista de proyectos técnicos (para el selector del formulario de movimientos)
router.get("/tech-projects", async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, spv: true },
      orderBy: { name: "asc" },
    });
    ok(res, projects);
  } catch (e) { fail(res, e); }
});

// Fases → actividades de un proyecto técnico (cascada fase → actividad)
router.get("/tech-tree/:projectId", async (req, res) => {
  try {
    const phases = await prisma.phase.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        items: {
          orderBy: { order: "asc" },
          select: { id: true, itemCode: true, activity: true, esNA: true, valorPresupuestado: true, valorEjecutado: true },
        },
      },
    });
    ok(res, phases);
  } catch (e) { fail(res, e); }
});

router.get("/:id", async (req, res) => {
  try {
    const m = await prisma.finMovement.findUnique({ where: { id: +req.params.id }, include: includeAll });
    if (!m) return fail(res, "not found", 404);
    ok(res, m);
  } catch (e) { fail(res, e); }
});

// Helpers de detección — defense in depth: el backend NO depende solo del frontend
async function detectIsEquity(originId?: number | null): Promise<boolean> {
  if (!originId) return false;
  const o = await prisma.finIncomeOrigin.findUnique({ where: { id: originId } });
  if (!o) return false;
  return /^31\d+/.test(o.code || "") || /equity|aporte|capital(?:izaci[oó]n)?|invers[ií]on\s*socio/i.test(o.name || "");
}
async function detectIsLoan(originId?: number | null): Promise<boolean> {
  if (!originId) return false;
  const o = await prisma.finIncomeOrigin.findUnique({ where: { id: originId } });
  if (!o) return false;
  return /^320[12]/.test(o.code || "") || /pr[ée]stamo|loan|deuda/i.test(o.name || "");
}
async function detectIsLoanRepayment(categoryId?: number | null): Promise<boolean> {
  if (!categoryId) return false;
  const c = await prisma.finExpenseCategory.findUnique({ where: { id: categoryId } });
  if (!c) return false;
  return /pago.*(deuda|pr[ée]stamo)|debt.*pay|amortizaci[oó]n/i.test(c.name || "");
}

router.post("/", async (req, res) => {
  try {
    // Validación Zod: rechaza montos no numéricos/negativos, tipos inventados,
    // IDs no enteros y descarta campos desconocidos ANTES de tocar la BD.
    const parsed = parseOrError(movementCreateSchema, req.body);
    if (parsed.error) return fail(res, parsed.error, 400);
    const data: any = { ...parsed.data };

    // === Validación + normalización para transferencias interbancarias ===
    if (data.type === "Interbancario") {
      if (!data.destAccountId) {
        return fail(res, "Transferencia interbancaria requiere cuenta destino", 400);
      }
      if (Number(data.accountId) === Number(data.destAccountId)) {
        return fail(res, "Cuenta origen y destino no pueden ser iguales", 400);
      }
      data.isIntercompany = true;
      data.categoryId = null;
      data.originId = null;
      data.providerId = null;
      data.partnerId = null;
      data.lenderId = null;
      data.isEquity = false;
      data.isLoan = false;
      data.isLoanRepayment = false;
      data.techItemId = null; // una transferencia interna no es gasto de obra
    }

    // === Defense in depth: si el frontend no setea las flags, las detectamos por código/nombre ===
    if (data.type === "Ingreso") {
      const eqBackend = await detectIsEquity(data.originId);
      const loanBackend = await detectIsLoan(data.originId);
      // Si el origen es claramente equity y hay socio → marcar
      if (eqBackend && data.partnerId) data.isEquity = true;
      // Si el origen es claramente loan y hay lender → marcar
      if (loanBackend && data.lenderId) data.isLoan = true;
    }
    if (data.type === "Egreso" && data.lenderId) {
      const repayBackend = await detectIsLoanRepayment(data.categoryId);
      if (repayBackend) data.isLoanRepayment = true;
    }

    const created = await prisma.finMovement.create({ data, include: includeAll });
    // Sync con módulos relacionados
    await upsertCapitalFromMovement(created.id);
    await upsertLoanFromMovement(created.id);
    if (created.isLoanRepayment) await recalculateLoanRepayments();
    // Engranaje con la obra: si viene asociado a una actividad técnica,
    // crear la subactividad espejo (gasto registrado en ambos módulos).
    await syncTechFromMovement(created.id);
    await logActivity("create", "FinMovement", created.id, `${created.type} ${created.amount} — ${created.concept}`);
    const withTech = await prisma.finMovement.findUnique({ where: { id: created.id }, include: includeAll });
    ok(res, withTech ?? created);
  } catch (e) { fail(res, e); }
});

router.patch("/:id", async (req, res) => {
  try {
    // Validación Zod parcial: solo campos presentes; los objetos de relación
    // (account, category, etc.) y campos desconocidos se descartan automáticamente.
    const parsed = parseOrError(movementUpdateSchema, req.body);
    if (parsed.error) return fail(res, parsed.error, 400);
    const data: any = { ...parsed.data };

    // Defense in depth: detectar isEquity/isLoan/isLoanRepayment del origen/categoría
    // si vienen en el patch (o usar el valor existente)
    const existing = await prisma.finMovement.findUnique({ where: { id: +req.params.id } });
    const type = data.type ?? existing?.type;
    const originId = data.originId ?? existing?.originId;
    const partnerId = data.partnerId ?? existing?.partnerId;
    const lenderId = data.lenderId ?? existing?.lenderId;
    const categoryId = data.categoryId ?? existing?.categoryId;

    if (type === "Ingreso") {
      if (originId) {
        const eqBackend = await detectIsEquity(originId);
        const loanBackend = await detectIsLoan(originId);
        if (eqBackend && partnerId) data.isEquity = true;
        if (loanBackend && lenderId) data.isLoan = true;
      }
    }
    if (type === "Egreso" && lenderId) {
      const repayBackend = await detectIsLoanRepayment(categoryId);
      if (repayBackend) data.isLoanRepayment = true;
    }

    const updated = await prisma.finMovement.update({ where: { id: +req.params.id }, data, include: includeAll });
    await upsertCapitalFromMovement(updated.id);
    await upsertLoanFromMovement(updated.id);
    await recalculateLoanRepayments();
    // Engranaje con la obra: actualiza/mueve/retira la subactividad espejo
    // según el nuevo estado del movimiento (monto, fecha, concepto, vínculo).
    await syncTechFromMovement(updated.id);
    await logActivity("update", "FinMovement", updated.id, `Actualizado: ${updated.concept}`);
    const withTech = await prisma.finMovement.findUnique({ where: { id: updated.id }, include: includeAll });
    ok(res, withTech ?? updated);
  } catch (e) { fail(res, e); }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = +req.params.id;
    const m = await prisma.finMovement.findUnique({ where: { id } });
    await removeCapitalForMovement(id);
    await removeLoanForMovement(id);
    await removeTechForMovement(id); // retira la subactividad espejo de la obra
    await prisma.finMovement.delete({ where: { id } });
    await recalculateLoanRepayments();
    if (m) await logActivity("delete", "FinMovement", id, `Eliminado: ${m.type} ${m.amount} — ${m.concept}`);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// POST /api/movements/detect-intercompany — corre el detector automático
router.post("/detect-intercompany", async (_req, res) => {
  try {
    const { detectIntercompany } = await import("../services/intercompany");
    const result = await detectIntercompany();
    ok(res, result);
  } catch (e) { fail(res, e); }
});

// POST /api/movements/:id/link/:otherId — vincular manualmente
router.post("/:id/link/:otherId", async (req, res) => {
  try {
    const a = +req.params.id;
    const b = +req.params.otherId;
    await prisma.$transaction([
      prisma.finMovement.update({ where: { id: a }, data: { isIntercompany: true, linkedMovementId: b } }),
      prisma.finMovement.update({ where: { id: b }, data: { isIntercompany: true } }),
    ]);
    ok(res, { linked: [a, b] });
  } catch (e) { fail(res, e); }
});

router.post("/:id/unlink", async (req, res) => {
  try {
    const id = +req.params.id;
    const m = await prisma.finMovement.findUnique({ where: { id } });
    if (!m) return fail(res, "not found", 404);
    const other = m.linkedMovementId;
    await prisma.finMovement.update({ where: { id }, data: { isIntercompany: false, linkedMovementId: null } });
    if (other) await prisma.finMovement.update({ where: { id: other }, data: { isIntercompany: false, linkedMovementId: null } }).catch(() => {});
    ok(res, { unlinked: true });
  } catch (e) { fail(res, e); }
});

export default router;
