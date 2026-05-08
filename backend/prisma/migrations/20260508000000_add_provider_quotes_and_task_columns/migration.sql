-- CreateTable: ProviderQuote (was in schema.prisma but never had a migration)
CREATE TABLE IF NOT EXISTS "ProviderQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "date" DATETIME,
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderQuote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable: Add responsable to Task (column was in schema but not in original migration)
ALTER TABLE "Task" ADD COLUMN "responsable" TEXT;

-- AlterTable: Add updatedAt to Task
ALTER TABLE "Task" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
