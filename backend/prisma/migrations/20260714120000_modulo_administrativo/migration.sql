-- ============================================================
-- MÓDULO ADMINISTRATIVO — GOBIERNO CORPORATIVO
-- Migración 100% ADITIVA: solo CREATE TABLE / CREATE INDEX /
-- ADD CONSTRAINT. No contiene ningún DROP ni ALTER destructivo.
-- No toca datos existentes de los módulos técnico ni financiero.
-- ============================================================

-- CreateTable
CREATE TABLE "adm_company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SUBSIDIARY_OWNER',
    "entityType" TEXT DEFAULT 'LLC',
    "stateOfFormation" TEXT,
    "ein" TEXT,
    "formationDate" TIMESTAMP(3),
    "registeredAgent" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "parentId" INTEGER,
    "finSpvId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adm_company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adm_doc_type" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "defaultRequired" BOOLEAN NOT NULL DEFAULT false,
    "hasExpiry" BOOLEAN NOT NULL DEFAULT false,
    "renewalMonths" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "adm_doc_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adm_document" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "docTypeId" INTEGER,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "mimetype" TEXT,
    "size" INTEGER,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adm_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adm_requirement" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "docTypeId" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "adm_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adm_task" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'media',
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "adm_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adm_company_finSpvId_key" ON "adm_company"("finSpvId");

-- CreateIndex
CREATE UNIQUE INDEX "adm_doc_type_code_key" ON "adm_doc_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "adm_requirement_companyId_docTypeId_key" ON "adm_requirement"("companyId", "docTypeId");

-- AddForeignKey
ALTER TABLE "adm_company" ADD CONSTRAINT "adm_company_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "adm_company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_company" ADD CONSTRAINT "adm_company_finSpvId_fkey" FOREIGN KEY ("finSpvId") REFERENCES "fin_spv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_document" ADD CONSTRAINT "adm_document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "adm_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_document" ADD CONSTRAINT "adm_document_docTypeId_fkey" FOREIGN KEY ("docTypeId") REFERENCES "adm_doc_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_requirement" ADD CONSTRAINT "adm_requirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "adm_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_requirement" ADD CONSTRAINT "adm_requirement_docTypeId_fkey" FOREIGN KEY ("docTypeId") REFERENCES "adm_doc_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_task" ADD CONSTRAINT "adm_task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "adm_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
