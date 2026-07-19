// ============================================================
// DASHBOARD + ALERTAS DEL MÓDULO ADMINISTRATIVO
// ============================================================
// Todo derivado en tiempo real: vencimientos, faltantes y tareas
// atrasadas. No hay estado almacenado que pueda quedar obsoleto.
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { ok, fail } from "../../finance/lib/respond";
import { computeAllCompliance, computeAllPersonCompliance, EXPIRY_WARNING_DAYS } from "../lib/compliance";
import { ensureDocTypesSeeded } from "../lib/seedDocTypes";

const router = Router();

export const TASK_DUE_SOON_DAYS = 7;

export interface AdminAlert {
  severity: "critica" | "alta" | "media";
  kind:
    | "DOC_VENCIDO" | "DOC_POR_VENCER" | "DOC_FALTANTE"
    | "TAREA_VENCIDA" | "TAREA_PROXIMA"
    | "PERSONA_DOC_VENCIDO" | "PERSONA_DOC_POR_VENCER" | "PERSONA_DOC_FALTANTE";
  companyId?: number;
  companyName?: string;
  personId?: number;
  personName?: string;
  title: string;
  detail: string;
  docTypeId?: number;
  requirementId?: number;
  taskId?: number;
  daysToExpiry?: number | null;
}

async function buildAlerts(): Promise<AdminAlert[]> {
  const now = new Date();
  const soon = new Date(now.getTime() + TASK_DUE_SOON_DAYS * 86_400_000);
  const [companies, compliance, persons, personCompliance, overdueTasks, dueSoonTasks] = await Promise.all([
    prisma.admCompany.findMany({ select: { id: true, name: true } }),
    computeAllCompliance(),
    prisma.admPerson.findMany({ select: { id: true, name: true, status: true } }),
    computeAllPersonCompliance(),
    prisma.admTask.findMany({
      where: { status: { not: "completada" }, dueDate: { lt: now } },
      include: {
        company: { select: { id: true, name: true } },
        person: { select: { id: true, name: true } },
      },
    }),
    prisma.admTask.findMany({
      where: { status: { not: "completada" }, dueDate: { gte: now, lte: soon } },
      include: {
        company: { select: { id: true, name: true } },
        person: { select: { id: true, name: true } },
      },
    }),
  ]);
  const nameOf = new Map(companies.map((c) => [c.id, c.name]));
  const personNameOf = new Map(persons.map((p) => [p.id, p.name]));
  const activePersons = new Set(persons.filter((p) => p.status === "ACTIVO").map((p) => p.id));
  const alerts: AdminAlert[] = [];

  // ── Documentos de empresas ──
  for (const [companyId, comp] of compliance) {
    const companyName = nameOf.get(companyId) ?? `Empresa ${companyId}`;
    for (const item of comp.items) {
      if (item.status === "VENCIDO") {
        alerts.push({
          severity: "critica", kind: "DOC_VENCIDO", companyId, companyName,
          title: `${item.name} VENCIDO`,
          detail: `Venció hace ${Math.abs(item.daysToExpiry ?? 0)} día(s). Renovar de inmediato.`,
          docTypeId: item.docTypeId, daysToExpiry: item.daysToExpiry,
        });
      } else if (item.status === "POR_VENCER") {
        alerts.push({
          severity: "alta", kind: "DOC_POR_VENCER", companyId, companyName,
          title: `${item.name} vence pronto`,
          detail: `Vence en ${item.daysToExpiry} día(s) (umbral: ${EXPIRY_WARNING_DAYS} días).`,
          docTypeId: item.docTypeId, daysToExpiry: item.daysToExpiry,
        });
      } else if (item.status === "FALTANTE") {
        alerts.push({
          severity: "media", kind: "DOC_FALTANTE", companyId, companyName,
          title: `Falta: ${item.name}`,
          detail: "Requisito del due diligence sin documento cargado.",
          docTypeId: item.docTypeId,
        });
      }
    }
  }

  // ── Documentos de socios/colaboradores (solo personas activas) ──
  for (const [personId, comp] of personCompliance) {
    if (!activePersons.has(personId)) continue;
    const personName = personNameOf.get(personId) ?? `Persona ${personId}`;
    for (const item of comp.items) {
      if (item.status === "VENCIDO") {
        alerts.push({
          severity: "critica", kind: "PERSONA_DOC_VENCIDO", personId, personName,
          title: `${item.name} de ${personName} VENCIDO`,
          detail: `Venció hace ${Math.abs(item.daysToExpiry ?? 0)} día(s). Renovar de inmediato.`,
          requirementId: item.requirementId, daysToExpiry: item.daysToExpiry,
        });
      } else if (item.status === "POR_VENCER") {
        alerts.push({
          severity: "alta", kind: "PERSONA_DOC_POR_VENCER", personId, personName,
          title: `${item.name} de ${personName} vence pronto`,
          detail: `Vence en ${item.daysToExpiry} día(s) (umbral: ${EXPIRY_WARNING_DAYS} días).`,
          requirementId: item.requirementId, daysToExpiry: item.daysToExpiry,
        });
      } else if (item.status === "FALTANTE") {
        alerts.push({
          severity: "media", kind: "PERSONA_DOC_FALTANTE", personId, personName,
          title: `Falta: ${item.name} (${personName})`,
          detail: "Documento requerido en la carpeta personal sin cargar.",
          requirementId: item.requirementId,
        });
      }
    }
  }

  // ── Tareas vencidas ──
  for (const t of overdueTasks) {
    alerts.push({
      severity: t.priority === "alta" ? "critica" : "alta",
      kind: "TAREA_VENCIDA",
      companyId: t.company?.id,
      companyName: t.company?.name ?? (t.person ? undefined : "General"),
      personId: t.person?.id,
      personName: t.person?.name,
      title: `Tarea vencida: ${t.title}`,
      detail: `Vencía el ${t.dueDate?.toISOString().slice(0, 10)}. Prioridad ${t.priority}.`,
      taskId: t.id,
    });
  }

  // ── Tareas próximas a vencer (ventana de 7 días) ──
  for (const t of dueSoonTasks) {
    const days = t.dueDate ? Math.ceil((t.dueDate.getTime() - now.getTime()) / 86_400_000) : null;
    alerts.push({
      severity: t.priority === "alta" ? "alta" : "media",
      kind: "TAREA_PROXIMA",
      companyId: t.company?.id,
      companyName: t.company?.name ?? (t.person ? undefined : "General"),
      personId: t.person?.id,
      personName: t.person?.name,
      title: `Próxima: ${t.title}`,
      detail: `Vence en ${days} día(s) — ${t.dueDate?.toISOString().slice(0, 10)}. Prioridad ${t.priority}.`,
      taskId: t.id,
      daysToExpiry: days,
    });
  }

  const order = { critica: 0, alta: 1, media: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

router.get("/alerts", async (_req, res) => {
  try {
    await ensureDocTypesSeeded();
    ok(res, await buildAlerts());
  } catch (e) { fail(res, e); }
});

router.get("/", async (_req, res) => {
  try {
    await ensureDocTypesSeeded();
    const now = new Date();
    const soon = new Date(now.getTime() + TASK_DUE_SOON_DAYS * 86_400_000);
    const [companies, compliance, persons, personCompliance, alerts, pendingTasks, overdueTasks, dueSoonTasks, docCount, personDocCount] = await Promise.all([
      prisma.admCompany.findMany({ select: { id: true, name: true, role: true, status: true } }),
      computeAllCompliance(),
      prisma.admPerson.findMany({ select: { id: true, name: true, role: true, status: true } }),
      computeAllPersonCompliance(),
      buildAlerts(),
      prisma.admTask.count({ where: { status: { not: "completada" } } }),
      prisma.admTask.count({ where: { status: { not: "completada" }, dueDate: { lt: now } } }),
      prisma.admTask.count({ where: { status: { not: "completada" }, dueDate: { gte: now, lte: soon } } }),
      prisma.admDocument.count(),
      prisma.admPersonDocument.count(),
    ]);

    const perCompany = companies.map((c) => {
      const comp = compliance.get(c.id);
      return {
        ...c,
        compliancePct: comp?.compliancePct ?? 100,
        vencidos: comp?.vencidos ?? 0,
        porVencer: comp?.porVencer ?? 0,
        faltantes: comp?.faltantes ?? 0,
      };
    });

    const perPerson = persons.map((p) => {
      const comp = personCompliance.get(p.id);
      return {
        ...p,
        compliancePct: comp?.compliancePct ?? 100,
        vencidos: comp?.vencidos ?? 0,
        porVencer: comp?.porVencer ?? 0,
        faltantes: comp?.faltantes ?? 0,
      };
    });

    const globalPct = perCompany.length === 0
      ? 100
      : Math.round(perCompany.reduce((s, c) => s + c.compliancePct, 0) / perCompany.length);

    ok(res, {
      totalCompanies: companies.length,
      totalPersons: persons.length,
      totalDocuments: docCount,
      totalPersonDocuments: personDocCount,
      pendingTasks,
      overdueTasks,
      dueSoonTasks,
      globalCompliancePct: globalPct,
      alertCounts: {
        criticas: alerts.filter((a) => a.severity === "critica").length,
        altas: alerts.filter((a) => a.severity === "alta").length,
        medias: alerts.filter((a) => a.severity === "media").length,
      },
      perCompany,
      perPerson,
    });
  } catch (e) { fail(res, e); }
});

export default router;
