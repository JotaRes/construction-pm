-- AlterTable
ALTER TABLE "Provider" ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ItemDocument" ADD COLUMN     "providerId" TEXT;

-- AddForeignKey
ALTER TABLE "ItemDocument" ADD CONSTRAINT "ItemDocument_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

