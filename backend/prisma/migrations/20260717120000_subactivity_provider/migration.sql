-- ============================================================
-- SUBACTIVIDAD ↔ PROVEEDOR (récord por contratista)
-- Cada subactividad puede asociarse a un proveedor del catálogo
-- global — alimenta el historial de servicios y pagos en la
-- sección Proveedores.
-- Migración 100% ADITIVA: solo ADD COLUMN / CREATE INDEX /
-- ADD CONSTRAINT. Sin DROP. No toca ningún dato existente.
-- ============================================================

ALTER TABLE "SubActivity" ADD COLUMN "providerId" TEXT;

CREATE INDEX "SubActivity_providerId_idx" ON "SubActivity"("providerId");

-- SetNull: si se elimina el proveedor, la subactividad queda sin
-- asociar pero NO se pierde.
ALTER TABLE "SubActivity" ADD CONSTRAINT "SubActivity_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
