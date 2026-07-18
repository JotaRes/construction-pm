-- ============================================================
-- EJECUCIÓN UNIFICADA: enlace actividad ↔ Construction Budget
-- + control administrativo de subactividades (invoice, fecha,
--   responsable, observaciones).
-- Migración 100% ADITIVA: solo ADD COLUMN / CREATE INDEX /
-- ADD CONSTRAINT. Sin DROP. No toca ningún dato existente.
-- ============================================================

-- Asociación opcional de una actividad de Ejecución con una línea
-- del Construction Budget (permite comparar gasto real vs budget
-- del lender aunque los nombres no coincidan).
ALTER TABLE "Item" ADD COLUMN "budgetLineId" TEXT;

CREATE INDEX "Item_budgetLineId_idx" ON "Item"("budgetLineId");

-- SetNull: si se elimina la línea del budget, la actividad queda
-- sin asociar pero NO se pierde ni se borra.
ALTER TABLE "Item" ADD CONSTRAINT "Item_budgetLineId_fkey"
    FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Control administrativo por subactividad
ALTER TABLE "SubActivity" ADD COLUMN "fecha" TIMESTAMP(3);
ALTER TABLE "SubActivity" ADD COLUMN "responsable" TEXT;
ALTER TABLE "SubActivity" ADD COLUMN "observaciones" TEXT;
ALTER TABLE "SubActivity" ADD COLUMN "invoiceUrl" TEXT;
ALTER TABLE "SubActivity" ADD COLUMN "invoiceName" TEXT;
