-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "spv" TEXT NOT NULL,
    "holding" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "hoa" TEXT,
    "parcelId" TEXT,
    "lotAcres" REAL,
    "sfHeated" INTEGER NOT NULL DEFAULT 2400,
    "sfGarage" INTEGER NOT NULL DEFAULT 0,
    "sfPorches" INTEGER NOT NULL DEFAULT 0,
    "bedrooms" INTEGER NOT NULL DEFAULT 3,
    "bathrooms" TEXT NOT NULL DEFAULT '2.5',
    "architecturalPlan" TEXT,
    "foundationType" TEXT,
    "permitNumber" TEXT,
    "permitIssued" DATETIME,
    "permitExpires" DATETIME,
    "inspectorPhone" TEXT,
    "hoaPhone" TEXT,
    "gcName" TEXT,
    "gcPhone" TEXT,
    "gcLicense" TEXT,
    "gcEmail" TEXT,
    "lender" TEXT,
    "loanNumber" TEXT,
    "loanAmount" REAL NOT NULL DEFAULT 0,
    "day1Disbursement" REAL NOT NULL DEFAULT 0,
    "interestReserve" REAL NOT NULL DEFAULT 0,
    "holdback" REAL NOT NULL DEFAULT 0,
    "interestRate" REAL NOT NULL DEFAULT 0.085,
    "loanTermMonths" INTEGER NOT NULL DEFAULT 18,
    "settlementDate" DATETIME,
    "cashAtSettlement" REAL NOT NULL DEFAULT 0,
    "closingCosts" REAL NOT NULL DEFAULT 0,
    "settlementAgent" TEXT,
    "arv" REAL NOT NULL DEFAULT 0,
    "constructionBudget" REAL NOT NULL DEFAULT 0,
    "trinityName" TEXT,
    "trinityPhone" TEXT,
    "trinityEmail" TEXT,
    "targetCompletionDate" DATETIME,
    "startDate" DATETIME,
    "realtorName" TEXT,
    "realtorBrokerage" TEXT,
    "realtorPhone" TEXT,
    "realtorEmail" TEXT,
    "listingCommission" REAL NOT NULL DEFAULT 0.03,
    "buyerCommission" REAL NOT NULL DEFAULT 0.03,
    "targetListingPrice" REAL NOT NULL DEFAULT 0,
    "contingencyPct" REAL NOT NULL DEFAULT 0.08,
    "targetMarginPct" REAL NOT NULL DEFAULT 0.20,
    "benchmarkSfTarget" REAL NOT NULL DEFAULT 220,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Phase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "description" TEXT,
    "responsable" TEXT,
    "unit" TEXT,
    "esNA" BOOLEAN NOT NULL DEFAULT false,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "valorPresupuestado" REAL NOT NULL DEFAULT 0,
    "valorEjecutado" REAL NOT NULL DEFAULT 0,
    "providerId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaInicioReal" DATETIME,
    "fechaFinReal" DATETIME,
    "observaciones" TEXT,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Item_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Item_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "drawNumber" INTEGER NOT NULL,
    "fechaSolicitud" DATETIME,
    "fechaInspeccion" DATETIME,
    "fechaWire" DATETIME,
    "montoSolicitado" REAL NOT NULL DEFAULT 0,
    "elegibleTrinity" REAL NOT NULL DEFAULT 0,
    "porcentajeFunded" REAL NOT NULL DEFAULT 0,
    "netWire" REAL NOT NULL DEFAULT 0,
    "upbPre" REAL NOT NULL DEFAULT 0,
    "upbPost" REAL NOT NULL DEFAULT 0,
    "saldoHoldback" REAL NOT NULL DEFAULT 0,
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EMPTY',
    CONSTRAINT "Draw_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownershipPct" REAL NOT NULL,
    "capitalAporte" REAL NOT NULL DEFAULT 0,
    "phone" TEXT,
    "email" TEXT,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Partner_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "license" TEXT,
    "notes" TEXT,
    CONSTRAINT "Provider_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "wbs" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "prerrequisitos" TEXT,
    "fase" TEXT,
    "fechaSolicitada" DATETIME,
    "fechaRealizada" DATETIME,
    "resultado" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
