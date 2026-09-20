-- AlterTable
ALTER TABLE `TreatmentPlanItem` ADD COLUMN `toothNumber` INTEGER NULL;

-- CreateIndex
CREATE INDEX `TreatmentPlanItem_toothNumber_idx` ON `TreatmentPlanItem`(`toothNumber`);
