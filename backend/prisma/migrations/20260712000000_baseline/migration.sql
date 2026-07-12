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
    "contractSalesPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
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
    "expectedPricePerSqft" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contingencyPct" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "targetMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "benchmarkSfTarget" DOUBLE PRECISION NOT NULL DEFAULT 220,
    "loiUrl" TEXT,
    "loiName" TEXT,
    "approvalLetterUrl" TEXT,
    "approvalLetterName" TEXT,
    "hudUrl" TEXT,
    "hudName" TEXT,
    "otrosFinancieroUrl" TEXT,
    "otrosFinancieroName" TEXT,
    "drawsExcelUrl" TEXT,
    "drawsExcelName" TEXT,
    "drawValuesMode" TEXT NOT NULL DEFAULT 'ACUMULADO',
    "loiSalePrice" DOUBLE PRECISION,
    "loiOfferDate" TIMESTAMP(3),
    "loiExpectedClose" TIMESTAMP(3),
    "loiEarnestMoney" DOUBLE PRECISION,
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
    "quantity" DOUBLE PRECISION,
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
    "invoiceLenderUrl" TEXT,
    "invoiceLenderName" TEXT,
    "lenderApprovalUrl" TEXT,
    "lenderApprovalName" TEXT,
    "lenderExcelUrl" TEXT,
    "lenderExcelName" TEXT,

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawLineContribution" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "deltaAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawLineContribution_pkey" PRIMARY KEY ("id")
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
    "phoneCountry" TEXT DEFAULT '+1',
    "phone" TEXT,
    "email" TEXT,
    "license" TEXT,
    "address" TEXT,
    "notes" TEXT,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderDocument" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTRO',
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "fileUrl" TEXT,
    "mimetype" TEXT,
    "size" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDocument_pkey" PRIMARY KEY ("id")
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
    "kind" TEXT,
    "url" TEXT NOT NULL,
    "mimetype" TEXT,
    "size" INTEGER,
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
    "quantity" DOUBLE PRECISION,
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
    "tipo" TEXT NOT NULL DEFAULT 'TAREA',
    "title" TEXT NOT NULL,
    "responsable" TEXT,
    "responsableEmail" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "SubcontractorContract" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scopeDetails" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "contractUrl" TEXT,
    "contractName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractorPayment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "milestoneDesc" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubcontractorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_spv" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_spv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_account" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "yearsActive" TEXT,
    "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reportedBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accountNumber" TEXT,
    "routingNumber" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'operativa',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "spvId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_partner" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_lender" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FinLender',
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_lender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_provider" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_expense_category" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "isCorporate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_expense_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_income_origin" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_income_origin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_project" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "line" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Enlistado',
    "spvId" INTEGER,
    "address" TEXT,
    "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "arv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_movement" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "concept" TEXT NOT NULL,
    "notes" TEXT,
    "accountId" INTEGER NOT NULL,
    "destAccountId" INTEGER,
    "categoryId" INTEGER,
    "originId" INTEGER,
    "providerId" INTEGER,
    "isEquity" BOOLEAN NOT NULL DEFAULT false,
    "partnerId" INTEGER,
    "isLoan" BOOLEAN NOT NULL DEFAULT false,
    "lenderId" INTEGER,
    "isLoanRepayment" BOOLEAN NOT NULL DEFAULT false,
    "loanId" INTEGER,
    "projectId" INTEGER,
    "isIntercompany" BOOLEAN NOT NULL DEFAULT false,
    "linkedMovementId" INTEGER,
    "hasSupport" BOOLEAN NOT NULL DEFAULT false,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'pending',
    "matchedLineId" INTEGER,
    "importSource" TEXT,
    "importRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_capital_contribution" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "concept" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "destAccountCode" TEXT,
    "notes" TEXT,
    "sourceMovementId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_capital_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_loan" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "concept" TEXT NOT NULL,
    "lenderId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "destAccountCode" TEXT,
    "interestRate" DOUBLE PRECISION,
    "termMonths" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'activo',
    "classification" TEXT,
    "totalRepaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sourceMovementId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_nonbank_contribution" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "concept" TEXT NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_nonbank_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_movement_document" (
    "id" SERIAL NOT NULL,
    "movementId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "mimetype" TEXT,
    "size" INTEGER,
    "kind" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_movement_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_project_document" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "mimetype" TEXT,
    "size" INTEGER,
    "kind" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_project_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_bank_statement" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" DOUBLE PRECISION,
    "closingBalance" DOUBLE PRECISION,
    "filename" TEXT,
    "url" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_bank_statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_bank_statement_line" (
    "id" SERIAL NOT NULL,
    "statementId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchedMovementId" INTEGER,
    "diffNote" TEXT,

    CONSTRAINT "fin_bank_statement_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_activity_log" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "detail" TEXT,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrawLineContribution_budgetLineId_idx" ON "DrawLineContribution"("budgetLineId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawLineContribution_drawId_budgetLineId_key" ON "DrawLineContribution"("drawId", "budgetLineId");

-- CreateIndex
CREATE UNIQUE INDEX "fin_spv_code_key" ON "fin_spv"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_account_code_key" ON "fin_account"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_partner_code_key" ON "fin_partner"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_lender_name_key" ON "fin_lender"("name");

-- CreateIndex
CREATE UNIQUE INDEX "fin_provider_name_key" ON "fin_provider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "fin_expense_category_code_key" ON "fin_expense_category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_income_origin_code_key" ON "fin_income_origin"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_project_code_key" ON "fin_project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_movement_linkedMovementId_key" ON "fin_movement"("linkedMovementId");

-- CreateIndex
CREATE INDEX "fin_movement_date_idx" ON "fin_movement"("date");

-- CreateIndex
CREATE INDEX "fin_movement_accountId_idx" ON "fin_movement"("accountId");

-- CreateIndex
CREATE INDEX "fin_movement_projectId_idx" ON "fin_movement"("projectId");

-- CreateIndex
CREATE INDEX "fin_movement_partnerId_idx" ON "fin_movement"("partnerId");

-- CreateIndex
CREATE INDEX "fin_movement_categoryId_idx" ON "fin_movement"("categoryId");

-- CreateIndex
CREATE INDEX "fin_movement_type_idx" ON "fin_movement"("type");

-- CreateIndex
CREATE UNIQUE INDEX "fin_capital_contribution_sourceMovementId_key" ON "fin_capital_contribution"("sourceMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "fin_loan_sourceMovementId_key" ON "fin_loan"("sourceMovementId");

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawLineContribution" ADD CONSTRAINT "DrawLineContribution_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawLineContribution" ADD CONSTRAINT "DrawLineContribution_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDocument" ADD CONSTRAINT "ProviderDocument_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "SubcontractorContract" ADD CONSTRAINT "SubcontractorContract_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractorContract" ADD CONSTRAINT "SubcontractorContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractorPayment" ADD CONSTRAINT "SubcontractorPayment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SubcontractorContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_account" ADD CONSTRAINT "fin_account_spvId_fkey" FOREIGN KEY ("spvId") REFERENCES "fin_spv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_project" ADD CONSTRAINT "fin_project_spvId_fkey" FOREIGN KEY ("spvId") REFERENCES "fin_spv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "fin_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_destAccountId_fkey" FOREIGN KEY ("destAccountId") REFERENCES "fin_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "fin_expense_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_originId_fkey" FOREIGN KEY ("originId") REFERENCES "fin_income_origin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "fin_provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "fin_partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "fin_lender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "fin_loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "fin_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement" ADD CONSTRAINT "fin_movement_linkedMovementId_fkey" FOREIGN KEY ("linkedMovementId") REFERENCES "fin_movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_capital_contribution" ADD CONSTRAINT "fin_capital_contribution_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "fin_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_capital_contribution" ADD CONSTRAINT "fin_capital_contribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "fin_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_loan" ADD CONSTRAINT "fin_loan_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "fin_lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_loan" ADD CONSTRAINT "fin_loan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "fin_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_nonbank_contribution" ADD CONSTRAINT "fin_nonbank_contribution_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "fin_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_nonbank_contribution" ADD CONSTRAINT "fin_nonbank_contribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "fin_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_movement_document" ADD CONSTRAINT "fin_movement_document_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "fin_movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_project_document" ADD CONSTRAINT "fin_project_document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "fin_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_statement" ADD CONSTRAINT "fin_bank_statement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "fin_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_statement_line" ADD CONSTRAINT "fin_bank_statement_line_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "fin_bank_statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

