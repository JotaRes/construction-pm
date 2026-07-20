-- ============================================================
-- ENGRANAJE v2 — ajustes de la revisión del usuario:
--   1. FinProject.admCompanyId → asignación DIRECTA de propiedades
--      financieras a una empresa del organigrama (propiedades sin SPV,
--      p.ej. Vero Beach y Holiday).
--   2. FinMovement.techSubAdopted → distingue subactividad espejo creada
--      por el sistema vs subactividad existente elegida por el usuario.
-- Migración 100% ADITIVA: solo ADD COLUMN / ADD CONSTRAINT. Sin DROPs.
-- ============================================================

-- AlterTable
ALTER TABLE "fin_project" ADD COLUMN "admCompanyId" INTEGER;

-- AlterTable
ALTER TABLE "fin_movement" ADD COLUMN "techSubAdopted" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "fin_project" ADD CONSTRAINT "fin_project_admCompanyId_fkey" FOREIGN KEY ("admCompanyId") REFERENCES "adm_company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
