/**
 * Catálogo del checklist documental por proyecto.
 *
 * Cada proyecto debe tener al menos un archivo de cada categoría requerida
 * para considerarse "documentalmente completo". Las opcionales son útiles
 * pero no disparan alertas.
 *
 * El campo `kind` en ProjectFile referencia el `key` de este catálogo.
 */

export interface DocChecklistItem {
  key: string;
  label: string;
  description: string;
  required: boolean;
  group: "diseno" | "lote" | "financiamiento" | "construccion" | "seguros" | "otros";
}

export const PROJECT_DOC_CHECKLIST: DocChecklistItem[] = [
  // Grupo: Diseño y planos
  { key: "planos", label: "Planos arquitectónicos", description: "Plano principal del diseño de la casa", required: true, group: "diseno" },
  { key: "licencia_plano", label: "Licencia del plano", description: "Licencia profesional del arquitecto/diseñador", required: true, group: "diseno" },
  { key: "siteplan", label: "Site plan", description: "Plano del sitio con ubicación de la construcción", required: true, group: "diseno" },
  { key: "drenaje", label: "Drainage plan", description: "Plano de drenajes pluviales y sanitarios", required: true, group: "diseno" },
  { key: "landscape", label: "Landscaping plan", description: "Plano paisajístico (jardín, accesos)", required: false, group: "diseno" },
  { key: "imagenes_3d", label: "Imágenes 3D / Renders", description: "Renders del proyecto terminado", required: false, group: "diseno" },

  // Grupo: Lote
  { key: "survey", label: "Survey del lote", description: "Levantamiento topográfico oficial", required: true, group: "lote" },
  { key: "hud_lote", label: "HUD de compra del lote", description: "HUD-1 / Closing disclosure de la compra del lote", required: true, group: "lote" },
  { key: "deed_lote", label: "Deed del lote", description: "Escritura legal del lote (registrada)", required: true, group: "lote" },

  // Grupo: Financiamiento
  { key: "loi_lender", label: "LOI del lender", description: "Letter of Intent del prestamista", required: true, group: "financiamiento" },
  { key: "carta_lender", label: "Carta de aprobación lender", description: "Commitment letter con las condiciones finales", required: true, group: "financiamiento" },
  { key: "hud_cierre", label: "HUD del cierre con lender", description: "HUD-1 / Closing disclosure del cierre del préstamo", required: true, group: "financiamiento" },

  // Grupo: Construcción
  { key: "construction_budget", label: "Construction Budget", description: "Presupuesto detallado de construcción (PDF del lender o GC)", required: true, group: "construccion" },
  { key: "licencia_gc", label: "Licencia del GC", description: "Licencia del general contractor responsable", required: true, group: "construccion" },
  { key: "permiso_construccion", label: "Permiso de construcción", description: "Building permit emitido por el condado", required: true, group: "construccion" },
  { key: "permiso_electrico", label: "Permiso de electricidad", description: "Electrical permit", required: true, group: "construccion" },
  { key: "permiso_hoa", label: "Permisos del HOA", description: "Aprobación del Home Owners Association", required: false, group: "construccion" },

  // Grupo: Seguros
  { key: "seguros", label: "Pólizas de seguros", description: "Builder's risk + general liability del proyecto", required: true, group: "seguros" },

  // Grupo: Otros
  { key: "otros", label: "Otros documentos", description: "Cualquier documento adicional relevante", required: false, group: "otros" },
];

export const DOC_KEYS = PROJECT_DOC_CHECKLIST.map((d) => d.key);

export const GROUP_LABELS: Record<string, string> = {
  diseno: "Diseño y planos",
  lote: "Lote",
  financiamiento: "Financiamiento",
  construccion: "Construcción",
  seguros: "Seguros",
  otros: "Otros",
};
