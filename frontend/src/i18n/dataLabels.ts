/**
 * ETIQUETAS DE VALORES DE DATOS — Sistema Restrepo Acosta Global Holding LLC
 * ─────────────────────────────────────────────────────────────────────────────
 * El backend guarda ciertos enums como texto en español ("Egreso", "Contrato",
 * "En Construcción"). Ese texto es el DATO: viaja en la API, se compara, se
 * indexa y ya está escrito en la base. Traducirlo en el sitio donde se usa
 * rompería el programa en inglés — fue exactamente el error que estos mapas
 * previenen.
 *
 * REGLA: el valor crudo nunca cambia; solo su etiqueta visible.
 *
 *   <option value={raw}>{dataLabel(FILE_CATEGORY_LABELS, raw, t)}</option>
 *                ↑ dato            ↑ presentación
 *
 * Si llega un valor que no está en el mapa (una categoría nueva escrita por el
 * usuario, por ejemplo), `dataLabel` devuelve el crudo tal cual en vez de
 * mostrar un hueco.
 */
import type { TranslationKey } from './dictionary'

/** Traduce un valor de datos; si no está mapeado, lo devuelve sin tocar. */
export function dataLabel(
  map: Record<string, TranslationKey>,
  raw: string | null | undefined,
  t: (k: TranslationKey) => string,
): string {
  if (!raw) return ''
  const key = map[raw]
  return key ? t(key) : raw
}

/** Categorías del repositorio de archivos (módulo técnico). */
export const FILE_CATEGORY_LABELS: Record<string, TranslationKey> = {
  'Contrato': 'data.fileCat.contract',
  'Permiso': 'data.fileCat.permit',
  'Plano': 'data.fileCat.plan',
  'Seguro': 'data.fileCat.insurance',
  'Draw': 'data.fileCat.draw',
  'HOA': 'data.fileCat.hoa',
  'Legal': 'data.fileCat.legal',
  'Inspección': 'data.fileCat.inspection',
  'Otro': 'common.otro',
}

/** Categorías del directorio de proveedores. */
export const PROVIDER_CATEGORY_LABELS: Record<string, TranslationKey> = {
  'GC': 'data.provCat.gc',
  'Subcontratista': 'data.provCat.sub',
  'Lender': 'data.provCat.lender',
  'Inspector': 'data.provCat.inspector',
  'Title Company': 'data.provCat.title',
  'Utility': 'data.provCat.utility',
  'Authority': 'data.provCat.authority',
  'Realtor': 'data.provCat.realtor',
  'Architect': 'data.provCat.architect',
  'Engineer': 'data.provCat.engineer',
  'Surveyor': 'data.provCat.surveyor',
  'Otro': 'common.otro',
}

/** Estado de un proyecto en el portafolio financiero. */
export const FIN_PROJECT_STATUS_LABELS: Record<string, TranslationKey> = {
  'Enlistado': 'fin.projs.enlistado',
  'En Construcción': 'fin.projs.enConstruccion',
  'Vendido': 'fin.projs.vendido',
  'Pausado': 'fin.projs.pausado',
  'Cerrado': 'fin.projs.cerrado',
}

/** Tipo de cuenta bancaria (catálogo financiero). */
export const ACCOUNT_TYPE_LABELS: Record<string, TranslationKey> = {
  'operativa': 'data.acctType.operating',
  'proyecto': 'data.acctType.project',
  'personal': 'data.acctType.personal',
  'ahorro': 'data.acctType.savings',
}

/** Tipo de proveedor (catálogo financiero). */
export const PROVIDER_TYPE_LABELS: Record<string, TranslationKey> = {
  'Materiales': 'data.provType.materials',
  'Servicios': 'data.provType.services',
  'Mano de obra': 'data.provType.labor',
  'Profesional': 'data.provType.professional',
  'Permisos': 'data.provType.permits',
  'Otros': 'data.provType.other',
}

/** Categoría del expediente documental (módulo administrativo). */
export const ADMIN_CATEGORY_LABELS: Record<string, TranslationKey> = {
  FORMACION: 'data.admCat.formation',
  FISCAL: 'data.admCat.tax',
  BANCARIO: 'data.admCat.banking',
  SEGUROS: 'data.admCat.insurance',
  PROPIEDAD: 'data.admCat.property',
  LEGAL: 'data.admCat.legal',
  PERSONAL: 'data.admCat.hr',
  CUMPLIMIENTO: 'data.admCat.compliance',
  OTRO: 'data.admCat.other',
}

/** Rol de una empresa dentro del holding. */
export const COMPANY_ROLE_LABELS: Record<string, TranslationKey> = {
  HOLDING: 'data.role.holding',
  PROPERTY_MANAGER: 'data.role.propertyManager',
  SUBSIDIARY_OWNER: 'data.role.subsidiaryOwner',
  OTHER: 'data.role.other',
}

/** Rol de una persona (socios y colaboradores). */
export const PERSON_ROLE_LABELS_I18N: Record<string, TranslationKey> = {
  SOCIO: 'common.socio',
  COLABORADOR: 'adm.person.colaborador',
  OTRO: 'common.otro',
}

/** Estado de una empresa. */
export const COMPANY_STATUS_LABELS: Record<string, TranslationKey> = {
  ACTIVE: 'adm.company.activa',
  INACTIVE: 'adm.company.inactiva',
  DISSOLVED: 'adm.company.disuelta',
}

/** Motivo de un change order. */
export const CO_REASON_LABELS: Record<string, TranslationKey> = {
  CONDICION_OCULTA: 'tech.co.condicionOculta',
  ERROR_DISENO: 'tech.co.errorDeDiseno',
  SOLICITUD_PROPIETARIO: 'tech.co.solicitudDelPropietario',
  CODIGO: 'tech.co.requisitoDeCodigo',
  CLIMA: 'data.coReason.weather',
  OTRO: 'common.otro',
}
