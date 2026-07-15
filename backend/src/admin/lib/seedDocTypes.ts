// ============================================================
// CATÁLOGO BASE DE DUE DILIGENCE CORPORATIVO
// ============================================================
// Tipos documentales que una LLC en EE. UU. debe mantener al día.
// Se siembran una sola vez (si adm_doc_type está vacía) y el usuario
// puede editarlos/ampliarlos desde la interfaz.
import { prisma } from "../../lib/prisma";

type SeedType = {
  code: string;
  name: string;
  category: string;
  description?: string;
  defaultRequired?: boolean;
  hasExpiry?: boolean;
  renewalMonths?: number;
};

export const DEFAULT_DOC_TYPES: SeedType[] = [
  // === FORMACIÓN / CORPORATIVO ===
  { code: "articles_organization", name: "Articles of Organization / Certificate of Formation", category: "FORMACION", defaultRequired: true, description: "Documento de creación de la LLC ante el estado" },
  { code: "operating_agreement", name: "Operating Agreement", category: "FORMACION", defaultRequired: true, description: "Acuerdo operativo entre los miembros — clave para el blindaje (corporate veil)" },
  { code: "ein_letter", name: "Carta EIN (IRS CP-575)", category: "FORMACION", defaultRequired: true, description: "Número de identificación fiscal federal" },
  { code: "good_standing", name: "Certificate of Good Standing / Existence", category: "FORMACION", defaultRequired: true, hasExpiry: true, renewalMonths: 12, description: "Certificado estatal de que la empresa está al día" },
  { code: "annual_report", name: "Annual Report estatal", category: "CUMPLIMIENTO", defaultRequired: true, hasExpiry: true, renewalMonths: 12, description: "Reporte anual obligatorio — no presentarlo disuelve la LLC administrativamente" },
  { code: "registered_agent", name: "Registered Agent (contrato/renovación)", category: "CUMPLIMIENTO", defaultRequired: true, hasExpiry: true, renewalMonths: 12, description: "Agente registrado vigente en el estado de formación" },
  { code: "business_license", name: "Business License", category: "CUMPLIMIENTO", hasExpiry: true, renewalMonths: 12, description: "Licencia comercial local/estatal si aplica" },
  { code: "minutes_resolutions", name: "Actas y resoluciones de miembros", category: "FORMACION", description: "Resoluciones firmadas de decisiones relevantes" },

  // === FISCAL ===
  { code: "tax_certificate", name: "Certificado de Tax / Tax Compliance", category: "FISCAL", defaultRequired: true, hasExpiry: true, renewalMonths: 12, description: "Certificado de cumplimiento tributario" },
  { code: "federal_tax_return", name: "Declaración federal de renta (1065/1120)", category: "FISCAL", defaultRequired: true, hasExpiry: true, renewalMonths: 12, description: "Última declaración presentada al IRS" },
  { code: "state_tax_filing", name: "Declaración estatal de impuestos", category: "FISCAL", hasExpiry: true, renewalMonths: 12 },
  { code: "w9", name: "Formulario W-9", category: "FISCAL", description: "Para entregar a clientes/pagadores" },
  { code: "property_tax", name: "Property Tax (recibo/paz y salvo)", category: "FISCAL", hasExpiry: true, renewalMonths: 12, description: "Impuesto predial de las propiedades de la empresa" },

  // === BANCARIO ===
  { code: "bank_certificate", name: "Certificado bancario", category: "BANCARIO", defaultRequired: true, hasExpiry: true, renewalMonths: 12, description: "Certificación de cuenta emitida por el banco" },
  { code: "bank_account_docs", name: "Documentos de apertura de cuenta", category: "BANCARIO", description: "Resolución de apertura, firmantes autorizados" },
  { code: "signature_card", name: "Tarjeta de firmas", category: "BANCARIO" },

  // === SEGUROS ===
  { code: "general_liability", name: "Póliza General Liability", category: "SEGUROS", defaultRequired: true, hasExpiry: true, renewalMonths: 12, description: "Responsabilidad civil general — crítica para operar" },
  { code: "property_insurance", name: "Seguro de propiedad (Hazard/Dwelling)", category: "SEGUROS", hasExpiry: true, renewalMonths: 12, description: "Seguro de cada propiedad de la empresa" },
  { code: "builders_risk", name: "Póliza Builder's Risk", category: "SEGUROS", hasExpiry: true, renewalMonths: 12, description: "Cobertura durante construcción" },
  { code: "workers_comp", name: "Workers' Compensation", category: "SEGUROS", hasExpiry: true, renewalMonths: 12 },

  // === PROPIEDAD ===
  { code: "deed", name: "Escritura / Deed", category: "PROPIEDAD", description: "Título de propiedad registrado a nombre de la empresa" },
  { code: "title_insurance", name: "Title Insurance Policy", category: "PROPIEDAD" },
  { code: "survey", name: "Survey / Plat del lote", category: "PROPIEDAD" },
  { code: "hoa_docs", name: "Documentos HOA (reglamento, paz y salvo)", category: "PROPIEDAD", hasExpiry: true, renewalMonths: 12 },

  // === LEGAL ===
  { code: "intercompany_agreement", name: "Acuerdos intercompany", category: "LEGAL", description: "Contratos entre holding y subsidiarias (management agreement, préstamos internos)" },
  { code: "poa", name: "Poderes (Power of Attorney)", category: "LEGAL" },
  { code: "contracts", name: "Contratos vigentes con terceros", category: "LEGAL" },

  // === PERSONAL ===
  { code: "resume", name: "Hojas de vida / CVs del equipo", category: "PERSONAL" },
  { code: "payroll_docs", name: "Documentación laboral/nómina", category: "PERSONAL" },
];

/** Siembra el catálogo si está vacío. Idempotente y no destructivo. */
export async function ensureDocTypesSeeded(): Promise<void> {
  const count = await prisma.admDocType.count();
  if (count > 0) return;
  await prisma.admDocType.createMany({
    data: DEFAULT_DOC_TYPES.map((t, i) => ({
      code: t.code,
      name: t.name,
      category: t.category,
      description: t.description ?? null,
      defaultRequired: t.defaultRequired ?? false,
      hasExpiry: t.hasExpiry ?? false,
      renewalMonths: t.renewalMonths ?? null,
      sortOrder: i,
    })),
    skipDuplicates: true,
  });
  console.log(`[admin] Catálogo due diligence sembrado: ${DEFAULT_DOC_TYPES.length} tipos documentales`);
}
