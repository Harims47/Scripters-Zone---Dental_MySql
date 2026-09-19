-- CreateEnum
CREATE TYPE "HistoricalBatchStatus" AS ENUM ('UPLOADED', 'OCR_PROCESSING', 'AWAITING_REVIEW', 'IMPORTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "HistoricalRecordStatus" AS ENUM ('PENDING_OCR', 'NEEDS_REVIEW', 'APPROVED', 'SKIPPED', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('UNIQUE', 'EXACT_MATCH', 'PHONE_CONFLICT', 'POSSIBLE_DUPLICATE');

-- CreateEnum
CREATE TYPE "DuplicateResolution" AS ENUM ('CREATE_NEW', 'USE_EXISTING', 'SKIP');

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "age" DROP NOT NULL,
ALTER COLUMN "gender" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "visitDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HistoricalMigrationBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "HistoricalBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "approvedRecords" INTEGER NOT NULL DEFAULT 0,
    "importedRecords" INTEGER NOT NULL DEFAULT 0,
    "skippedRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalMigrationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalMigrationRecord" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL DEFAULT 1,
    "sourceFileKey" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "status" "HistoricalRecordStatus" NOT NULL DEFAULT 'PENDING_OCR',
    "rawOcrText" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "proposedName" TEXT,
    "proposedPhone" TEXT,
    "proposedAge" INTEGER,
    "proposedGender" TEXT,
    "proposedVisitDate" TIMESTAMP(3),
    "proposedReason" TEXT,
    "reviewedName" TEXT,
    "reviewedPhone" TEXT,
    "reviewedAge" INTEGER,
    "reviewedGender" TEXT,
    "reviewedVisitDate" TIMESTAMP(3),
    "reviewedReason" TEXT,
    "duplicateStatus" "DuplicateStatus",
    "duplicateResolution" "DuplicateResolution",
    "matchedPatientId" TEXT,
    "importedPatientId" TEXT,
    "importedVisitId" TEXT,
    "importedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalMigrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricalMigrationBatch_status_idx" ON "HistoricalMigrationBatch"("status");

-- CreateIndex
CREATE INDEX "HistoricalMigrationBatch_createdAt_idx" ON "HistoricalMigrationBatch"("createdAt");

-- CreateIndex
CREATE INDEX "HistoricalMigrationRecord_batchId_status_idx" ON "HistoricalMigrationRecord"("batchId", "status");

-- CreateIndex
CREATE INDEX "HistoricalMigrationRecord_status_idx" ON "HistoricalMigrationRecord"("status");

-- CreateIndex
CREATE INDEX "Visit_visitDate_idx" ON "Visit"("visitDate");

-- AddForeignKey
ALTER TABLE "HistoricalMigrationRecord" ADD CONSTRAINT "HistoricalMigrationRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HistoricalMigrationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalMigrationRecord" ADD CONSTRAINT "HistoricalMigrationRecord_matchedPatientId_fkey" FOREIGN KEY ("matchedPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalMigrationRecord" ADD CONSTRAINT "HistoricalMigrationRecord_importedPatientId_fkey" FOREIGN KEY ("importedPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalMigrationRecord" ADD CONSTRAINT "HistoricalMigrationRecord_importedVisitId_fkey" FOREIGN KEY ("importedVisitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
