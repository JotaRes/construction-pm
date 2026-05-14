-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spv" TEXT NOT NULL,
    "holding" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "hoa" TEXT,
    "parcelId" TEXT,
    "lotAcres" DOUBLE PRECISION,
    "sfHeated" INTEGER NOT NULL DEFAULT 2400,
    "sfGarage" INTEGER NOT NULL DEFAULT 0,
    "sfPorches" INTEGER NOT NULL DEFAULT 0,
    "bedrooms" INTEGER NOT NULL DEFAULT 3,
    "bathrooms" TEXT NOT NULL DEFAULT '2.5',
    "architecturalPlan" TEXT,
    "foundationType" TEXT,
    "permitNumber" TEXT,
    "permitIssued" TIMESTAMP(3),
    "permitExpires" TIMESTAMP(3),
    "inspectorPhone" TEXT,
    "hoaPhone" TEXT,
    "gcName" TEXT,
    "gcPhone" TEXT,
    "gcLicense" TEXT,
    "gcEmail" TEXT,
    "lender" TEXT,
    "loanNumber" TEXT,
    "loanAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "day1Disbursement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestReserve" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "holdback" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0.085,
    "loanTermMonths" INTEGER NOT NULL DEFAULT 18,
    "settlementDate" TIMESTAMP(3),
    "cashAtSettlement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingCosts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settlementAgent" TEXT,
    "arv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "constructionBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trinityName" TEXT,
    "trinityPhone" TEXT,
    "trinityEmail" TEXT,
    "targetCompletionDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "realtorName" TEXT,
    "realtorBrokerage" TEXT,
    "realtorPhone" TEXT,
    "realtorEmail" TEXT,
    "listingCommission" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "buyerCommission" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "targetListingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contingencyPct" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "targetMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "benchmarkSfTarget" DOUBLE PRECISION NOT NULL DEFAULT 220,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "description" TEXT,
    "responsable" TEXT,
    "unit" TEXT,
    "esNA" BOOLEAN NOT NULL DEFAULT false,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "valorPresupuestado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorEjecutado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "providerId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaInicioReal" TIMESTAMP(3),
    "fechaFinReal" TIMESTAMP(3),
    "observaciones" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "drawNumber" INTEGER NOT NULL,
    "fechaSolicitud" TIMESTAMP(3),
    "fechaInspeccion" TIMESTAMP(3),
    "fechaWire" TIMESTAMP(3),
    "montoSolicitado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elegibleTrinity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "porcentajeFunded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netWire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "upbPre" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "upbPost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saldoHoldback" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notas" TEXT,
    "pdfUrl" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EMPTY',

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownershipPct" DOUBLE PRECISION NOT NULL,
    "capitalAporte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phone" TEXT,
    "email" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "license" TEXT,
    "notes" TEXT,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderQuote" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3),
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbs" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "prerrequisitos" TEXT,
    "fase" TEXT,
    "fechaSolicitada" TIMESTAMP(3),
    "fechaRealizada" TIMESTAMP(3),
    "resultado" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "divCode" TEXT NOT NULL,
    "divName" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'LS',
    "vendor" TEXT,
    "valorInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorPresentado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorAprobado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pagadoSubs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "responsable" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDocument" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTRO',
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "amount" DOUBLE PRECISION,
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRef" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'LS',
    "priceLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT,
    "region" TEXT DEFAULT 'SC Upstate',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRef_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderQuote" ADD CONSTRAINT "ProviderQuote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDocument" ADD CONSTRAINT "ItemDocument_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
