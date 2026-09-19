-- CreateEnum
CREATE TYPE "CommunicationPreference" AS ENUM ('AUTO', 'WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_CONFIRMATION', 'APPOINTMENT_REMINDER', 'PAYMENT_RECEIPT', 'INVOICE', 'PRESCRIPTION', 'PURCHASE_ORDER_SENT');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "email" TEXT;
ALTER TABLE "Patient" ADD COLUMN "preferredCommunicationChannel" "CommunicationPreference" NOT NULL DEFAULT 'AUTO';
ALTER TABLE "Patient" ADD COLUMN "whatsappAvailable" BOOLEAN;
ALTER TABLE "Patient" ADD COLUMN "whatsappCheckedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "patientId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "idempotencyKey" TEXT,
    "manualSendKey" TEXT,
    "isManualSend" BOOLEAN NOT NULL DEFAULT false,
    "sentByUserId" TEXT,
    "paymentOwner" TEXT,
    "templateName" TEXT,
    "payload" JSONB,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "providerReference" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledAt_idx" ON "Notification"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_patientId_idx" ON "Notification"("patientId");

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
