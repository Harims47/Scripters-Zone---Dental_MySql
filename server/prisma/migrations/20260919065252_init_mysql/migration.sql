-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_staffId_key`(`staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Staff` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `attendance` VARCHAR(191) NOT NULL DEFAULT 'Present',
    `roomNumber` VARCHAR(191) NULL,
    `permissions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Patient` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `age` INTEGER NULL,
    `gender` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `photoUrl` LONGTEXT NULL,
    `address` TEXT NULL,
    `email` VARCHAR(191) NULL,
    `preferredCommunicationChannel` ENUM('AUTO', 'WHATSAPP', 'SMS', 'EMAIL') NOT NULL DEFAULT 'AUTO',
    `whatsappAvailable` BOOLEAN NULL,
    `whatsappCheckedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Patient_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appointment` (
    `id` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NULL,
    `date` VARCHAR(191) NOT NULL,
    `time` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Scheduled',
    `notes` TEXT NULL,
    `photoUrl` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Visit` (
    `id` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `amountDue` DOUBLE NOT NULL DEFAULT 0,
    `consultationFee` DOUBLE NULL,
    `treatmentFee` DOUBLE NULL,
    `medicineCost` DOUBLE NULL,
    `reasonForVisit` TEXT NULL,
    `paymentOwner` VARCHAR(191) NOT NULL DEFAULT 'RECEPTION',
    `visitDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Visit_appointmentId_key`(`appointmentId`),
    INDEX `Visit_visitDate_idx`(`visitDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QueueEntry` (
    `id` VARCHAR(191) NOT NULL,
    `visitId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `assignedDoctorId` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `priority` BOOLEAN NOT NULL DEFAULT false,
    `arrivalTime` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QueueEntry_visitId_key`(`visitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Consultation` (
    `id` VARCHAR(191) NOT NULL,
    `visitId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `reasonForVisit` TEXT NOT NULL,
    `clinicalNotes` TEXT NOT NULL,
    `consultationFee` DOUBLE NOT NULL,
    `treatmentFee` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'In Progress',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Consultation_visitId_key`(`visitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MedicineCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MedicineCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Medicine` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `genericName` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `form` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `stockWarningLevel` INTEGER NOT NULL,
    `currentStock` INTEGER NOT NULL DEFAULT 0,
    `unitPrice` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prescription` (
    `id` VARCHAR(191) NOT NULL,
    `visitId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `notes` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Prescription_visitId_key`(`visitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrescriptionItem` (
    `id` VARCHAR(191) NOT NULL,
    `prescriptionId` VARCHAR(191) NOT NULL,
    `medicineId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `dosage` VARCHAR(191) NULL,
    `frequency` VARCHAR(191) NULL,
    `duration` VARCHAR(191) NULL,
    `instructions` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dispensing` (
    `id` VARCHAR(191) NOT NULL,
    `visitId` VARCHAR(191) NOT NULL,
    `prescriptionId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Dispensing_visitId_key`(`visitId`),
    UNIQUE INDEX `Dispensing_prescriptionId_key`(`prescriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DispensingItem` (
    `id` VARCHAR(191) NOT NULL,
    `dispensingId` VARCHAR(191) NOT NULL,
    `medicineId` VARCHAR(191) NOT NULL,
    `prescribedQuantity` INTEGER NOT NULL,
    `dispensedQuantity` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `visitId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `notes` TEXT NULL,
    `date` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreatmentCatalog` (
    `id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `variant` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreatmentPlan` (
    `id` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TreatmentPlan_patientId_key`(`patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreatmentPlanItem` (
    `id` VARCHAR(191) NOT NULL,
    `treatmentPlanId` VARCHAR(191) NOT NULL,
    `treatmentCatalogId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Planned',
    `notes` TEXT NULL,
    `completedVisitId` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierMedicineCategory` (
    `id` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `medicineCategoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SupplierMedicineCategory_supplierId_medicineCategoryId_key`(`supplierId`, `medicineCategoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseOrder_orderNumber_key`(`orderNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `medicineId` VARCHAR(191) NOT NULL,
    `orderedQuantity` INTEGER NOT NULL,
    `receivedQuantity` INTEGER NOT NULL DEFAULT 0,
    `unitCost` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierBill` (
    `id` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `invoiceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `amount` DOUBLE NOT NULL,
    `billImageUrl` TEXT NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Unpaid',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierPayment` (
    `id` VARCHAR(191) NOT NULL,
    `supplierBillId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockMovement` (
    `id` VARCHAR(191) NOT NULL,
    `medicineId` VARCHAR(191) NOT NULL,
    `movementType` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `performedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('APPOINTMENT_CONFIRMATION', 'APPOINTMENT_REMINDER', 'PAYMENT_RECEIPT', 'INVOICE', 'PRESCRIPTION', 'PURCHASE_ORDER_SENT') NOT NULL,
    `channel` ENUM('WHATSAPP', 'SMS', 'EMAIL') NOT NULL,
    `status` ENUM('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING') NOT NULL DEFAULT 'QUEUED',
    `recipientPhone` VARCHAR(191) NULL,
    `recipientEmail` VARCHAR(191) NULL,
    `recipientName` VARCHAR(191) NULL,
    `patientId` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `manualSendKey` VARCHAR(191) NULL,
    `isManualSend` BOOLEAN NOT NULL DEFAULT false,
    `sentByUserId` VARCHAR(191) NULL,
    `paymentOwner` VARCHAR(191) NULL,
    `templateName` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `provider` VARCHAR(191) NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `providerReference` VARCHAR(191) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `lastError` TEXT NULL,
    `scheduledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Notification_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Notification_status_scheduledAt_idx`(`status`, `scheduledAt`),
    INDEX `Notification_scheduledAt_status_idx`(`scheduledAt`, `status`),
    INDEX `Notification_patientId_idx`(`patientId`),
    INDEX `Notification_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistoricalMigrationBatch` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('UPLOADED', 'OCR_PROCESSING', 'AWAITING_REVIEW', 'IMPORTING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'UPLOADED',
    `totalPages` INTEGER NOT NULL DEFAULT 0,
    `processedRecords` INTEGER NOT NULL DEFAULT 0,
    `approvedRecords` INTEGER NOT NULL DEFAULT 0,
    `importedRecords` INTEGER NOT NULL DEFAULT 0,
    `skippedRecords` INTEGER NOT NULL DEFAULT 0,
    `failedRecords` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HistoricalMigrationBatch_status_idx`(`status`),
    INDEX `HistoricalMigrationBatch_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistoricalMigrationRecord` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `pageNumber` INTEGER NOT NULL DEFAULT 1,
    `sourceFileKey` VARCHAR(191) NOT NULL,
    `sourceFileName` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_OCR', 'NEEDS_REVIEW', 'APPROVED', 'SKIPPED', 'IMPORTED', 'FAILED') NOT NULL DEFAULT 'PENDING_OCR',
    `rawOcrText` TEXT NULL,
    `ocrConfidence` DOUBLE NULL,
    `proposedName` VARCHAR(191) NULL,
    `proposedPhone` VARCHAR(191) NULL,
    `proposedAge` INTEGER NULL,
    `proposedGender` VARCHAR(191) NULL,
    `proposedVisitDate` DATETIME(3) NULL,
    `proposedReason` TEXT NULL,
    `reviewedName` VARCHAR(191) NULL,
    `reviewedPhone` VARCHAR(191) NULL,
    `reviewedAge` INTEGER NULL,
    `reviewedGender` VARCHAR(191) NULL,
    `reviewedVisitDate` DATETIME(3) NULL,
    `reviewedReason` TEXT NULL,
    `duplicateStatus` ENUM('UNIQUE', 'EXACT_MATCH', 'PHONE_CONFLICT', 'POSSIBLE_DUPLICATE') NULL,
    `duplicateResolution` ENUM('CREATE_NEW', 'USE_EXISTING', 'SKIP') NULL,
    `matchedPatientId` VARCHAR(191) NULL,
    `importedPatientId` VARCHAR(191) NULL,
    `importedVisitId` VARCHAR(191) NULL,
    `importedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HistoricalMigrationRecord_batchId_status_idx`(`batchId`, `status`),
    INDEX `HistoricalMigrationRecord_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReimbursementDocument` (
    `id` VARCHAR(191) NOT NULL,
    `documentNumber` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `visitId` VARCHAR(191) NULL,
    `documentDate` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL DEFAULT 'Reimbursement of Dental Treatment Expenses',
    `content` TEXT NOT NULL,
    `treatmentDescription` TEXT NULL,
    `amount` DOUBLE NULL,
    `patientNameSnapshot` VARCHAR(191) NOT NULL,
    `patientAgeSnapshot` INTEGER NULL,
    `patientGenderSnapshot` VARCHAR(191) NULL,
    `patientPhoneSnapshot` VARCHAR(191) NULL,
    `doctorNameSnapshot` VARCHAR(191) NULL,
    `doctorRegNoSnapshot` VARCHAR(191) NULL,
    `clinicNameSnapshot` VARCHAR(191) NULL,
    `clinicAddressSnapshot` VARCHAR(191) NULL,
    `clinicPhoneSnapshot` VARCHAR(191) NULL,
    `clinicLogoSnapshot` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Issued',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReimbursementDocument_documentNumber_key`(`documentNumber`),
    INDEX `ReimbursementDocument_patientId_idx`(`patientId`),
    INDEX `ReimbursementDocument_documentDate_idx`(`documentDate`),
    INDEX `ReimbursementDocument_documentNumber_idx`(`documentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visit` ADD CONSTRAINT `Visit_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visit` ADD CONSTRAINT `Visit_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueueEntry` ADD CONSTRAINT `QueueEntry_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Medicine` ADD CONSTRAINT `Medicine_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `MedicineCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prescription` ADD CONSTRAINT `Prescription_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrescriptionItem` ADD CONSTRAINT `PrescriptionItem_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `Medicine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrescriptionItem` ADD CONSTRAINT `PrescriptionItem_prescriptionId_fkey` FOREIGN KEY (`prescriptionId`) REFERENCES `Prescription`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dispensing` ADD CONSTRAINT `Dispensing_prescriptionId_fkey` FOREIGN KEY (`prescriptionId`) REFERENCES `Prescription`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dispensing` ADD CONSTRAINT `Dispensing_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispensingItem` ADD CONSTRAINT `DispensingItem_dispensingId_fkey` FOREIGN KEY (`dispensingId`) REFERENCES `Dispensing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispensingItem` ADD CONSTRAINT `DispensingItem_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `Medicine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPlan` ADD CONSTRAINT `TreatmentPlan_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPlanItem` ADD CONSTRAINT `TreatmentPlanItem_treatmentPlanId_fkey` FOREIGN KEY (`treatmentPlanId`) REFERENCES `TreatmentPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPlanItem` ADD CONSTRAINT `TreatmentPlanItem_treatmentCatalogId_fkey` FOREIGN KEY (`treatmentCatalogId`) REFERENCES `TreatmentCatalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPlanItem` ADD CONSTRAINT `TreatmentPlanItem_completedVisitId_fkey` FOREIGN KEY (`completedVisitId`) REFERENCES `Visit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierMedicineCategory` ADD CONSTRAINT `SupplierMedicineCategory_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierMedicineCategory` ADD CONSTRAINT `SupplierMedicineCategory_medicineCategoryId_fkey` FOREIGN KEY (`medicineCategoryId`) REFERENCES `MedicineCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `Medicine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierBill` ADD CONSTRAINT `SupplierBill_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierBill` ADD CONSTRAINT `SupplierBill_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPayment` ADD CONSTRAINT `SupplierPayment_supplierBillId_fkey` FOREIGN KEY (`supplierBillId`) REFERENCES `SupplierBill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `Medicine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoricalMigrationRecord` ADD CONSTRAINT `HistoricalMigrationRecord_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `HistoricalMigrationBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoricalMigrationRecord` ADD CONSTRAINT `HistoricalMigrationRecord_matchedPatientId_fkey` FOREIGN KEY (`matchedPatientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoricalMigrationRecord` ADD CONSTRAINT `HistoricalMigrationRecord_importedPatientId_fkey` FOREIGN KEY (`importedPatientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoricalMigrationRecord` ADD CONSTRAINT `HistoricalMigrationRecord_importedVisitId_fkey` FOREIGN KEY (`importedVisitId`) REFERENCES `Visit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReimbursementDocument` ADD CONSTRAINT `ReimbursementDocument_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
