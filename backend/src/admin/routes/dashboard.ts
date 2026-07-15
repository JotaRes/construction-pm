// ============================================================
// DASHBOARD + ALERTAS DEL MÓDULO ADMINISTRATIVO
// ============================================================
// Todo derivado en tiempo real: vencimientos, faltantes y tareas
// atrasadas. No hay estado almacenado que pueda quedar obsoleto.
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { ok, fail } from "../../finance/lib/respond";
import { computeAllCompliance, EXPIRY_WARNING_DAYS } from "../lib/compliance";
import { ensureDocTypesSeeded } from "../lib/seedDocTypes";

const router = Router();

export interface AdminAlert {
  severity: "critica" | "alta" | "media";
  kind: "DOC_VENCIDO" | "DOC_POR_VENCER" | "DOC_FALTANTE" | "TAREA_VENCIDA";
  companyId: number;
  companyName: string;
  title: string;
  detail: string;
  docTypeId?: number;
  taskId?: number;
  daysToExpiry?: number | null;
}

async function buildAlerts(): Promise<AdminAlert[]> {
  const [companies, compliance, overdueTasks] = await Promise.all([
    prisma.admCompany.findMany({ select: { id: true, name: true } }),
    computeAllCompliance(),
    prisma.admTask.findMany({
      where: { status: { not: "completada" }, dueDate: { lt: new Date() } },
      include: { company: { select: { id: true, name: true } } },
    }),
  ]);
  const nameOf = new Map(companies.map((c) => [c.id, c.name]));
  const alerts: AdminAlert[] = [];

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

  for (const t of overdueTasks) {
    alerts.push({
      severity: t.priority === "alta" ? "critica" : "alta",
      kind: "TAREA_VENCIDA",
      companyId: t.company?.id ?? 0,
      companyName: t.company?.name ?? "General",
      title: `Tarea vencida: ${t.title}`,
      detail: `Vencía el ${t.dueDate?.toISOString().slice(0, 10)}. Prioridad ${t.priority}.`,
      taskId: t.id,
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
    const [companies, compliance, alerts, pendingTasks, docCount] = await Promise.all([
      prisma.admCompany.findMany({ select: { id: true, name: true, role: true, status: true } }),
      computeAllCompliance(),
      buildAlerts(),
      prisma.admTask.count({ where: { status: { not: "completada" } } }),
      prisma.admDocument.count(),
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

    const globalPct = perCompany.length === 0
      ? 100
      : Math.round(perCompany.reduce((s, c) => s + c.compliancePct, 0) / perCompany.length);

    ok(res, {
      totalCompanies: companies.length,
      totalDocuments: docCount,
      pendingTasks,
      globalCompliancePct: globalPct,
      alertCounts: {
        criticas: alerts.filter((a) => a.severity === "critica").length,
        altas: alerts.filter((a) => a.severity === "alta").length,
        medias: alerts.filter((a) => a.severity === "media").length,
      },
      perCompany,
    });
  } catch (e) { fail(res, e); }
});

export default router;
