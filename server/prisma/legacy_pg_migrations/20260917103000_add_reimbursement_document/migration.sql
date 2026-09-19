-- CreateTable
CREATE TABLE "ReimbursementDocument" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "visitId" TEXT,
    "documentDate" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT 'Reimbursement of Dental Treatment Expenses',
    "content" TEXT NOT NULL,
    "treatmentDescription" TEXT,
    "amount" DOUBLE PRECISION,
    "patientNameSnapshot" TEXT NOT NULL,
    "patientAgeSnapshot" INTEGER,
    "patientGenderSnapshot" TEXT,
    "patientPhoneSnapshot" TEXT,
    "doctorNameSnapshot" TEXT,
    "doctorRegNoSnapshot" TEXT,
    "clinicNameSnapshot" TEXT,
    "clinicAddressSnapshot" TEXT,
    "clinicPhoneSnapshot" TEXT,
    "clinicLogoSnapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Issued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementDocument_documentNumber_key" ON "ReimbursementDocument"("documentNumber");

-- CreateIndex
CREATE INDEX "ReimbursementDocument_patientId_idx" ON "ReimbursementDocument"("patientId");

-- CreateIndex
CREATE INDEX "ReimbursementDocument_documentDate_idx" ON "ReimbursementDocument"("documentDate");

-- CreateIndex
CREATE INDEX "ReimbursementDocument_documentNumber_idx" ON "ReimbursementDocument"("documentNumber");

-- AddForeignKey
ALTER TABLE "ReimbursementDocument" ADD CONSTRAINT "ReimbursementDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
