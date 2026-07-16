-- ============================================================
-- SUBACTIVIDADES + ENLACE FASE ↔ CONSTRUCTION BUDGET
-- Migración 100% ADITIVA: solo CREATE TABLE / ADD COLUMN /
-- ADD CONSTRAINT / CREATE INDEX. Sin DROP ni ALTER destructivo.
-- No toca datos existentes del módulo técnico ni financiero.
-- ============================================================

-- Enlace fase ↔ budget (divCode(s) coma-separados, editable)
ALTER TABLE "Phase" ADD COLUMN "budgetDivCode" TEXT;

-- Subactividades de una actividad de Ejecución (valor = ejecutado)
CREATE TABLE "SubActivity" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "valorEjecutado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubActivity_itemId_idx" ON "SubActivity"("itemId");

ALTER TABLE "SubActivity" ADD CONSTRAINT "SubActivity_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
