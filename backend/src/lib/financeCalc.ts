// ============================================================
// FACTOR DE DESEMBOLSO DEL LENDER — fuente única de verdad
// ============================================================
// Cuánto FINANCIA el lender del Construction Budget = holdback / budget.
// Ej. verificado en LOTE 87 (Hera): 395,350 / 465,750 = 0.84884 ≈ LTC 84%.
// El 84.88% NO es un recorte por draw — es la razón préstamo/costo; el resto
// (≈15.12%) es equity del dueño. Reutilizado por Const. Budget, Draws y Dashboard
// para que "Desembolsado" sea coherente en todo el sistema.

export const DEFAULT_DISBURSEMENT_FACTOR = 0.8488;

export interface DisbursementFactorInput {
  holdback?: number | null;
  constructionBudget?: number | null;
  /** Σ valorInicial de las BudgetLines — respaldo si constructionBudget no está seteado. */
  budgetLinesInicialSum?: number | null;
}

/**
 * Devuelve el factor de desembolso (0..1) del proyecto. Usa holdback/budget
 * cuando ambos son válidos; si no, cae al DEFAULT_DISBURSEMENT_FACTOR observado.
 */
export function disbursementFactor(input: DisbursementFactorInput): number {
  const holdback = input.holdback ?? 0;
  const budget =
    input.constructionBudget && input.constructionBudget > 0
      ? input.constructionBudget
      : input.budgetLinesInicialSum ?? 0;
  if (holdback > 0 && budget > 0) {
    const f = holdback / budget;
    if (f > 0 && f <= 1) return f;
  }
  return DEFAULT_DISBURSEMENT_FACTOR;
}
