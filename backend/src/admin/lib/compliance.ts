// ============================================================
// MOTOR DE CUMPLIMIENTO — semáforo documental por empresa
// ============================================================
// Calcula, para cada requisito documental de una empresa, su estado:
//   OK          → documento presente y vigente
//   POR_VENCER  → vence dentro de los próximos 30 días
//   VENCIDO     → la fecha de vencimiento ya pasó
//   FALTANTE    → requisito activo sin documento cargado
// Todo es DERIVADO de datos reales (no se almacena estado), así el
// semáforo nunca queda desactualizado.
import { prisma } from "../../lib/prisma";

export const EXPIRY_WARNING_DAYS = 30;

export type RequirementStatus = "OK" | "POR_VENCER" | "VENCIDO" | "FALTANTE";

export interface ComplianceItem {
  docTypeId: number;
  code: string;
  name: string;
  category: string;
  hasExpiry: boolean;
  status: RequirementStatus;
  document: {
    id: number;
    filename: string;
    url: string;
    issueDate: Date | null;
    expiryDate: Date | null;
    uploadedAt: Date;
  } | null;
  daysToExpiry: number | null;
}

export interface CompanyCompliance {
  companyId: number;
  totalRequired: number;
  ok: number;
  porVencer: number;
  vencidos: number;
  faltantes: number;
  /** % de requisitos cubiertos y vigentes (OK + POR_VENCER cuentan como cubiertos) */
  compliancePct: number;
  items: ComplianceItem[];
}

function statusFor(hasExpiry: boolean, expiryDate: Date | null, now: Date): { status: RequirementStatus; days: number | null } {
  if (!hasExpiry || !expiryDate) return { status: "OK", days: null };
  const days = Math.ceil((expiryDate.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return { status: "VENCIDO", days };
  if (days <= EXPIRY_WARNING_DAYS) return { status: "POR_VENCER", days };
  return { status: "OK", days };
}

/** Cumplimiento documental de UNA empresa. */
export async function computeCompliance(companyId: number): Promise<CompanyCompliance> {
  const [requirements, documents] = await Promise.all([
    prisma.admRequirement.findMany({
      where: { companyId, required: true },
      include: { docType: true },
    }),
    prisma.admDocument.findMany({
      where: { companyId },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);

  const now = new Date();
  const items: ComplianceItem[] = requirements.map((req) => {
    // Documento más relevante del tipo: el de vencimiento más lejano
    // (si renovaste la póliza, manda la nueva aunque la vieja siga cargada)
    const docs = documents.filter((d) => d.docTypeId === req.docTypeId);
    const doc =
      docs.length === 0
        ? null
        : docs.slice().sort((a, b) => {
            const ea = a.expiryDate?.getTime() ?? 0;
            const eb = b.expiryDate?.getTime() ?? 0;
            if (ea !== eb) return eb - ea;
            return b.uploadedAt.getTime() - a.uploadedAt.getTime();
          })[0];

    if (!doc) {
      return {
        docTypeId: req.docTypeId,
        code: req.docType.code,
        name: req.docType.name,
        category: req.docType.category,
        hasExpiry: req.docType.hasExpiry,
        status: "FALTANTE" as const,
        document: null,
        daysToExpiry: null,
      };
    }

    const { status, days } = statusFor(req.docType.hasExpiry, doc.expiryDate, now);
    return {
      docTypeId: req.docTypeId,
      code: req.docType.code,
      name: req.docType.name,
      category: req.docType.category,
      hasExpiry: req.docType.hasExpiry,
      status,
      document: {
        id: doc.id,
        filename: doc.filename,
        url: doc.url,
        issueDate: doc.issueDate,
        expiryDate: doc.expiryDate,
        uploadedAt: doc.uploadedAt,
      },
      daysToExpiry: days,
    };
  });

  const ok = items.filter((i) => i.status === "OK").length;
  const porVencer = items.filter((i) => i.status === "POR_VENCER").length;
  const vencidos = items.filter((i) => i.status === "VENCIDO").length;
  const faltantes = items.filter((i) => i.status === "FALTANTE").length;
  const total = items.length;

  return {
    companyId,
    totalRequired: total,
    ok,
    porVencer,
    vencidos,
    faltantes,
    compliancePct: total === 0 ? 100 : Math.round(((ok + porVencer) / total) * 100),
    items,
  };
}

/** Cumplimiento de TODAS las empresas activas (para organigrama y dashboard). */
export async function computeAllCompliance(): Promise<Map<number, CompanyCompliance>> {
  const companies = await prisma.admCompany.findMany({ select: { id: true } });
  const result = new Map<number, CompanyCompliance>();
  for (const c of companies) {
    result.set(c.id, await computeCompliance(c.id));
  }
  return result;
}
