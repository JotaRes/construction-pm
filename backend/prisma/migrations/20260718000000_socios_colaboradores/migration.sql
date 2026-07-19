-- ============================================================
-- SOCIOS Y COLABORADORES + tareas por persona
-- Migración 100% ADITIVA: solo CREATE TABLE / ADD COLUMN /
-- ADD CONSTRAINT. No contiene ningún DROP ni ALTER destructivo.
-- No toca datos existentes de ningún módulo.
-- ============================================================

-- AlterTable: tareas ahora pueden ligarse a una persona
ALTER TABLE "adm_task" ADD COLUMN "personId" INTEGER;

-- CreateTable
CREATE TABLE "adm_person" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SOCIO',
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "idNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adm_person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adm_person_requirement" (
    "id" SERIAL NOT NULL,
    "personId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "hasExpiry" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "adm_person_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adm_person_document" (
    "id" SERIAL NOT NULL,
    "personId" INTEGER NOT NULL,
    "requirementId" INTEGER,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "mimetype" TEXT,
    "size" INTEGER,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adm_person_document_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "adm_task" ADD CONSTRAINT "adm_task_personId_fkey" FOREIGN KEY ("personId") REFERENCES "adm_person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_person_requirement" ADD CONSTRAINT "adm_person_requirement_personId_fkey" FOREIGN KEY ("personId") REFERENCES "adm_person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_person_document" ADD CONSTRAINT "adm_person_document_personId_fkey" FOREIGN KEY ("personId") REFERENCES "adm_person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_person_document" ADD CONSTRAINT "adm_person_document_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "adm_person_requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
