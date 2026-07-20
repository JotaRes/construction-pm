-- ============================================================
-- ENGRANAJE ENTRE MÓDULOS (v1.1)
--   1. FinMovement ↔ actividad/subactividad del módulo técnico
--      (gasto financiero alimenta la obra en simultáneo)
--   2. Project (técnico) ↔ AdmCompany (LLC responsable)
-- Migración 100% ADITIVA: solo ADD COLUMN / CREATE INDEX /
-- ADD CONSTRAINT. Sin DROPs. No toca ningún dato existente.
-- ============================================================

-- AlterTable: vínculo del movimiento financiero a la obra
ALTER TABLE "fin_movement" ADD COLUMN "techItemId" TEXT;
ALTER TABLE "fin_movement" ADD COLUMN "techSubActivityId" TEXT;

-- AlterTable: LLC responsable del proyecto técnico
ALTER TABLE "Project" ADD COLUMN "admCompanyId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "fin_movement_techSubActivityId_key" ON "fin_movement"("techSubActivityId");

-- CreateIndex
CREATE INDEX "fin_movement_techItemId_idx" ON "fin_movement"("techItemId");

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_techItemId_fkey" FOREIGN KEY ("techItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_techSubActivityId_fkey" FOREIGN KEY ("techSubActivityId") REFERENCES "SubActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_admCompanyId_fkey" FOREIGN KEY ("admCompanyId") REFERENCES "adm_company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
