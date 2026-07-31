-- ============================================================
-- AUDITORÍA DE SINCRONIZACIÓN DRAW ↔ CONSTRUCTION BUDGET
-- Draw.approvalSyncJson: resumen persistente de la última aplicación del
-- PDF de aprobación al budget (matched / unmatched / monto), para que las
-- líneas sin sincronizar sean VISIBLES en vez de perderse tras el upload.
-- Migración 100% ADITIVA: solo ADD COLUMN. Sin DROPs.
-- ============================================================

-- AlterTable
ALTER TABLE "Draw" ADD COLUMN "approvalSyncJson" TEXT;
