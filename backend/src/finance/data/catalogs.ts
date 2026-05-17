// Datos maestros derivados de DOC FINANCIERO 2025-2026.xlsx (hoja CATEGORIAS)
// Reglas: ordenados como en el Excel para mantener afinidad con el archivo original.

export const SPVS = [
  { code: "HOLDING", name: "Restrepo Acosta Global Holding LLC" },
  { code: "RLA", name: "Restrepo Living Alliance" },
  { code: "ARR", name: "Acosta Restrepo Realty" },
  { code: "RRP", name: "Restrepo Realty Partners" },
  { code: "AUD", name: "Acosta Urban Developments" },
  { code: "ATH", name: "Acosta Trust Homes LLC" },
  { code: "AHS", name: "Acosta Housing Solutions" },
];

export const ACCOUNTS = [
  { code: "OB_HOLDING", name: "OB HOLDING", bank: "Ocean Bank", spvCode: "HOLDING", initialBalance: 0, yearsActive: "2025, 2026" },
  { code: "OB_RLA", name: "OB RESTREPO LIVING ALLIANCE", bank: "Ocean Bank", spvCode: "RLA", initialBalance: 0, yearsActive: "2025, 2026" },
  { code: "OB_ARR", name: "OB ACOSTA RESTREPO REALTY", bank: "Ocean Bank", spvCode: "ARR", initialBalance: 0, yearsActive: "2025, 2026" },
  { code: "OB_RRP", name: "OB RESTREPO REALTY PARTNERS", bank: "Ocean Bank", spvCode: "RRP", initialBalance: 0, yearsActive: "2025, 2026" },
  { code: "OB_AUD", name: "OB ACOSTA URBAN DEVELOPMENTS", bank: "Ocean Bank", spvCode: "AUD", initialBalance: 0, yearsActive: "2025, 2026" },
  { code: "OB_ATH", name: "OB ACOSTA TRUST HOMES", bank: "Ocean Bank", spvCode: "ATH", initialBalance: 0, yearsActive: "2025, 2026" },
  { code: "OB_AHS", name: "OB ACOSTA HOUSING SOLUTIONS", bank: "Ocean Bank", spvCode: "AHS", initialBalance: 0, yearsActive: "2025, 2026" },
  { code: "CASH", name: "DINERO EN CASH", bank: "Cash", spvCode: null, initialBalance: 0, yearsActive: "2025" },
  { code: "CHASE_DEP", name: "CHASE DEPOSITS", bank: "Chase", spvCode: null, initialBalance: 0, yearsActive: "2025" },
  { code: "CHASE_RET", name: "CHASE RETIROS", bank: "Chase", spvCode: null, initialBalance: 0, yearsActive: "2025" },
  { code: "BOA_HOLDING", name: "BOA HOLDING", bank: "Bank of America", spvCode: "HOLDING", initialBalance: 0, yearsActive: "2026" },
];

export const PARTNERS = [
  { code: "JD", fullName: "Juan David Restrepo" },
  { code: "OC", fullName: "Oscar Cuervo" },
];

export const LENDERS = [
  { name: "Lender 1", type: "Lender" },
  { name: "Lender 2", type: "Lender" },
  { name: "Lender 3", type: "Lender" },
  { name: "Banco Prestamista 1", type: "Banco Prestamista" },
  { name: "Banco Prestamista 2", type: "Banco Prestamista" },
  { name: "Privado 1", type: "Privado" },
  { name: "Privado 2", type: "Privado" },
];

export const EXPENSE_CATEGORIES = [
  { code: "CAT_01", name: "Construcción / Hard Costs", group: "Proyecto", isCorporate: false },
  { code: "CAT_02", name: "Materiales", group: "Proyecto", isCorporate: false },
  { code: "CAT_03", name: "Mano de Obra / Subcontratistas", group: "Proyecto", isCorporate: false },
  { code: "CAT_04", name: "Permisos / Licencias", group: "Proyecto", isCorporate: false },
  { code: "CAT_05", name: "Inspecciones / Surveys", group: "Proyecto", isCorporate: false },
  { code: "CAT_06", name: "Closing Costs", group: "Proyecto", isCorporate: false },
  { code: "CAT_07", name: "Holding Costs (impuestos, HOA, utilities)", group: "Proyecto", isCorporate: false },
  { code: "CAT_08", name: "Seguros", group: "Proyecto", isCorporate: false },
  { code: "CAT_09", name: "Marketing / Listing", group: "Proyecto", isCorporate: false },
  { code: "CAT_10", name: "Comisiones de Venta", group: "Proyecto", isCorporate: false },
  { code: "CAT_11", name: "Gastos Administrativos", group: "Corporativo", isCorporate: true },
  { code: "CAT_12", name: "Viáticos / Viajes", group: "Corporativo", isCorporate: true },
  { code: "CAT_13", name: "CPA / Contabilidad", group: "Corporativo", isCorporate: true },
  { code: "CAT_14", name: "Legal / Abogados", group: "Corporativo", isCorporate: true },
  { code: "CAT_15", name: "Visa E-2 / Migración", group: "Corporativo", isCorporate: true },
  { code: "CAT_16", name: "Fees Bancarios", group: "Corporativo", isCorporate: true },
  { code: "CAT_17", name: "Renovación Empresas / Compliance", group: "Corporativo", isCorporate: true },
  { code: "CAT_18", name: "Intereses de Préstamo", group: "Financiero", isCorporate: false },
  { code: "CAT_19", name: "Capital / Principal de Préstamo", group: "Financiero", isCorporate: false },
  { code: "CAT_20", name: "Intercompany (transferencia)", group: "Interno", isCorporate: false },
  { code: "CAT_21", name: "Otros", group: "Otros", isCorporate: false },
];

export const INCOME_ORIGINS = [
  { code: "ORI_01", name: "Equity Socio" },
  { code: "ORI_02", name: "Préstamo Lender" },
  { code: "ORI_03", name: "Préstamo Banco" },
  { code: "ORI_04", name: "Préstamo Tercero Privado" },
  { code: "ORI_05", name: "Ingreso Operativo / Venta" },
  { code: "ORI_06", name: "Devolución de Préstamo" },
  { code: "ORI_07", name: "Reembolso" },
  { code: "ORI_08", name: "Transferencia Interbancaria" },
  { code: "ORI_09", name: "Otro" },
];

export const PROJECTS_SEED = [
  { code: "P.1", name: "P.1 Holiday FL", line: "Florida", model: "Fix & Flip", status: "Enlistado", spvCode: "RLA" },
  { code: "P.2", name: "P.2 Vero Beach FL", line: "Florida", model: "Fix & Flip", status: "Enlistado", spvCode: "AUD" },
  { code: "P.3", name: "P.3 Lot 954 SC", line: "Carolina del Sur", model: "Land Sell", status: "Vendido", spvCode: "RRP" },
  { code: "P.4", name: "P.4 Lot 87 SC", line: "Carolina del Sur", model: "New Construction", status: "En Construcción", spvCode: "ATH" },
];
