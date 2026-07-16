-- ============================================================
-- Item.valorEjecutadoBase — valor propio de la actividad
-- El total ejecutado = valorEjecutadoBase + Σ subactividades.
-- Migración ADITIVA: ADD COLUMN + backfill que PRESERVA los totales actuales.
-- ============================================================

ALTER TABLE "Item" ADD COLUMN "valorEjecutadoBase" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: base = ejecutado actual − subactividades ya cargadas, para que
-- (base + Σ subs) siga dando exactamente el valorEjecutado que había.
-- Items sin subactividades → base = valorEjecutado.
UPDATE "Item"
SET "valorEjecutadoBase" = GREATEST(
  0,
  "valorEjecutado" - COALESCE(
    (SELECT SUM(s."valorEjecutado") FROM "SubActivity" s WHERE s."itemId" = "Item"."id"),
    0
  )
);
