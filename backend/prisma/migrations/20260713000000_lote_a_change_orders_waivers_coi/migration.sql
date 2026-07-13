-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "builderRiskCarrier" TEXT,
ADD COLUMN     "builderRiskExpiresAt" TIMESTAMP(3),
ADD COLUMN     "builderRiskName" TEXT,
ADD COLUMN     "builderRiskPolicyNum" TEXT,
ADD COLUMN     "builderRiskUrl" TEXT,
ADD COLUMN     "gcLiabilityExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "coiExpiresAt" TIMESTAMP(3),
ADD COLUMN     "coiName" TEXT,
ADD COLUMN     "coiUrl" TEXT,
ADD COLUMN     "insuranceCarrier" TEXT;

-- AlterTable
ALTER TABLE "SubcontractorPayment" ADD COLUMN     "lienWaiverAt" TIMESTAMP(3),
ADD COLUMN     "lienWaiverName" TEXT,
ADD COLUMN     "lienWaiverUrl" TEXT,
ADD COLUMN     "waiverException" TEXT;

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "coNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reason" TEXT NOT NULL DEFAULT 'OTRO',
    "costDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysDelta" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "contractId" TEXT,
    "budgetLineId" TEXT,
    "docUrl" TEXT,
    "docName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeOrder_projectId_idx" ON "ChangeOrder"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrder_projectId_coNumber_key" ON "ChangeOrder"("projectId", "coNumber");

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SubcontractorContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

