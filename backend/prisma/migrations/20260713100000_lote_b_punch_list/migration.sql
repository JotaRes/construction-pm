-- CreateTable
CREATE TABLE "PunchListItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "responsable" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "notes" TEXT,
    "photoUrl" TEXT,
    "photoName" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PunchListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PunchListItem_projectId_idx" ON "PunchListItem"("projectId");

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

