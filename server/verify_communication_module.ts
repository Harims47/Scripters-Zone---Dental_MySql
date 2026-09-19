process.env.NOTIFICATION_ENV = 'development';
process.env.NODE_ENV = 'test';

import { prisma } from './src/db';
import { NotificationService } from './src/services/communication/NotificationService';
import { QueueRunner } from './src/services/communication/queueRunner';
import { ChannelRouter } from './src/services/communication/ChannelRouter';
import {
  generateInvoicePDF,
  generatePurchaseOrderPDF,
  generateReceiptPDF,
  generatePrescriptionPDF,
} from './src/services/documentService';

async function runTests() {
  console.log('===========================================================');
  console.log('🧪 RUNNING COMPREHENSIVE COMMUNICATION MODULE TEST SUITE');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // Setup test patient
  const testPhone = '9876543210';
  let patient = await prisma.patient.findUnique({ where: { phone: testPhone } });
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        name: 'Communication Test Patient',
        phone: testPhone,
        age: 30,
        gender: 'Female',
        email: 'patient@testclinic.com',
        preferredCommunicationChannel: 'AUTO',
        status: 'Active',
      },
    });
  }

  // -------------------------------------------------------------
  // Test 1: Doctor-Owned Visit Payment-Data Masking
  // -------------------------------------------------------------
  console.log('\n--- Test 1: Doctor-Owned Visit Payment-Data Masking ---');
  const mockDoctorVisitNotification = {
    id: 'test-notif-1',
    type: 'PAYMENT_RECEIPT',
    channel: 'WHATSAPP',
    status: 'SENT',
    patientId: patient.id,
    entityType: 'PAYMENT',
    entityId: 'pay-123',
    paymentOwner: 'DOCTOR',
    recipientPhone: '9876543210',
    recipientName: 'Test Patient',
    templateName: 'payment_receipt_v1',
    payload: { amount: 5000, receiptNumber: 'RCPT-5000', note: 'Doctor payment' },
    createdAt: new Date(),
  };

  const maskedForReception = NotificationService.maskSensitiveNotificationForRole(
    mockDoctorVisitNotification,
    'Receptionist'
  );
  assert(
    maskedForReception.payload.message === 'Handled by Doctor' &&
      maskedForReception.templateName === 'RESTRICTED' &&
      !maskedForReception.payload.amount &&
      !maskedForReception.recipientPhone,
    'Receptionist receives masked neutral status for doctor-owned payment notification'
  );

  const doctorView = NotificationService.maskSensitiveNotificationForRole(
    mockDoctorVisitNotification,
    'Head Doctor'
  );
  assert(
    doctorView.payload.amount === 5000 && doctorView.templateName === 'payment_receipt_v1',
    'Doctor receives unmasked payment notification data'
  );

  // -------------------------------------------------------------
  // Test 2: Reception Notification Authorization & Security
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Reception Notification Authorization & Security ---');
  const receptionPaymentCheck = ChannelRouter.validateAuthorization({
    userRole: 'Receptionist',
    type: 'PAYMENT_RECEIPT',
    paymentOwner: 'DOCTOR',
  });
  assert(
    receptionPaymentCheck.authorized === false,
    'Receptionist is rejected from triggering payment notification for doctor-owned visit'
  );

  const receptionPoCheck = ChannelRouter.validateAuthorization({
    userRole: 'Receptionist',
    type: 'PURCHASE_ORDER_SENT',
  });
  assert(
    receptionPoCheck.authorized === false,
    'Receptionist is rejected from triggering Purchase Order email'
  );

  const doctorPaymentCheck = ChannelRouter.validateAuthorization({
    userRole: 'Head Doctor',
    type: 'PAYMENT_RECEIPT',
    paymentOwner: 'DOCTOR',
  });
  assert(
    doctorPaymentCheck.authorized === true,
    'Head Doctor is authorized to send doctor-owned payment notification'
  );

  // -------------------------------------------------------------
  // Test 3: Queue Crash Recovery Sweep
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Queue Crash Recovery Sweep ---');
  const stuckJob = await prisma.notification.create({
    data: {
      type: 'APPOINTMENT_REMINDER',
      channel: 'WHATSAPP',
      status: 'SENDING',
      recipientPhone: testPhone,
      recipientName: 'Recovery Test',
      scheduledAt: new Date(Date.now() - 60000),
    },
  });

  await QueueRunner.recoverStaleJobs();
  const recoveredJob = await prisma.notification.findUnique({ where: { id: stuckJob.id } });
  assert(
    recoveredJob?.status === 'RETRYING',
    'Jobs stuck in SENDING are recovered to RETRYING upon worker restart'
  );

  // Clean up
  await prisma.notification.delete({ where: { id: stuckJob.id } });

  // -------------------------------------------------------------
  // Test 4: Atomic Concurrent Notification Claiming (FOR UPDATE SKIP LOCKED)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Concurrent Notification Claiming ---');
  const jobs = await Promise.all([
    prisma.notification.create({
      data: {
        type: 'APPOINTMENT_CONFIRMATION',
        channel: 'WHATSAPP',
        status: 'QUEUED',
        recipientPhone: '919876543201',
        scheduledAt: new Date(Date.now() - 5000),
      },
    }),
    prisma.notification.create({
      data: {
        type: 'APPOINTMENT_CONFIRMATION',
        channel: 'WHATSAPP',
        status: 'QUEUED',
        recipientPhone: '919876543202',
        scheduledAt: new Date(Date.now() - 5000),
      },
    }),
  ]);

  // Execute two batch claims concurrently
  const [claimBatch1, claimBatch2] = await Promise.all([
    QueueRunner.processBatch(1),
    QueueRunner.processBatch(1),
  ]);

  assert(
    claimBatch1 === 1 && claimBatch2 === 1,
    'Concurrent workers atomically claim distinct jobs without double-processing'
  );

  // Clean up
  await prisma.notification.deleteMany({
    where: { id: { in: jobs.map((j) => j.id) } },
  });

  // -------------------------------------------------------------
  // Test 5: Temporary WhatsApp Failure -> Exponential Backoff & NO SMS
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Temporary Failure -> Exponential Backoff & NO SMS ---');
  const tempFailJob = await prisma.notification.create({
    data: {
      type: 'APPOINTMENT_REMINDER',
      channel: 'WHATSAPP',
      status: 'QUEUED',
      recipientPhone: '919876549999', // Triggers mock 504 gateway timeout
      scheduledAt: new Date(Date.now() - 5000),
      patientId: patient.id,
    },
  });

  await QueueRunner.processBatch(1);
  const updatedTempJob = await prisma.notification.findUnique({ where: { id: tempFailJob.id } });
  assert(
    updatedTempJob?.status === 'RETRYING' && updatedTempJob.attempts === 1,
    'Temporary WhatsApp failure enters RETRYING with exponential backoff'
  );

  const prematureSms = await prisma.notification.findFirst({
    where: {
      patientId: patient.id,
      channel: 'SMS',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(!prematureSms, 'Temporary failure does NOT trigger immediate SMS fallback');

  // Clean up
  await prisma.notification.delete({ where: { id: tempFailJob.id } });

  // -------------------------------------------------------------
  // Test 6: Genuine WhatsApp Unavailability -> SMS Fallback (AUTO)
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Genuine WhatsApp Unavailability -> SMS Fallback (AUTO) ---');
  await prisma.patient.update({
    where: { id: patient.id },
    data: { preferredCommunicationChannel: 'AUTO', whatsappAvailable: null },
  });

  const permFailJob = await prisma.notification.create({
    data: {
      type: 'APPOINTMENT_CONFIRMATION',
      channel: 'WHATSAPP',
      status: 'QUEUED',
      recipientPhone: '919876540000', // Triggers mock unregistered user (131026)
      patientId: patient.id,
      scheduledAt: new Date(Date.now() - 5000),
    },
  });

  await QueueRunner.processBatch(1);

  const updatedPermJob = await prisma.notification.findUnique({ where: { id: permFailJob.id } });
  assert(
    updatedPermJob?.status === 'FAILED',
    'Permanent WhatsApp failure marks WhatsApp notification as FAILED'
  );

  const updatedPatient = await prisma.patient.findUnique({ where: { id: patient.id } });
  assert(
    updatedPatient?.whatsappAvailable === false,
    'Patient record updated to whatsappAvailable = false upon confirmed provider failure'
  );

  const fallbackSms = await prisma.notification.findFirst({
    where: {
      patientId: patient.id,
      channel: 'SMS',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(!!fallbackSms, 'AUTO preference triggers automatic SMS fallback on genuine WhatsApp unavailability');

  // Clean up
  await prisma.notification.delete({ where: { id: permFailJob.id } });
  if (fallbackSms) await prisma.notification.delete({ where: { id: fallbackSms.id } });

  // -------------------------------------------------------------
  // Test 7: Patient Preference Honor (Explicit WHATSAPP - No Silent Fallback)
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Explicit WHATSAPP Preference - No Silent Fallback ---');
  await prisma.patient.update({
    where: { id: patient.id },
    data: { preferredCommunicationChannel: 'WHATSAPP' },
  });

  const explicitJob = await prisma.notification.create({
    data: {
      type: 'APPOINTMENT_CONFIRMATION',
      channel: 'WHATSAPP',
      status: 'QUEUED',
      recipientPhone: '919876540000',
      patientId: patient.id,
      scheduledAt: new Date(Date.now() - 5000),
    },
  });

  await QueueRunner.processBatch(1);

  const silentFallbackCheck = await prisma.notification.findFirst({
    where: {
      patientId: patient.id,
      channel: 'SMS',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(
    !silentFallbackCheck,
    'Explicit WHATSAPP preference NEVER triggers silent SMS fallback'
  );

  // Clean up
  await prisma.notification.delete({ where: { id: explicitJob.id } });

  // -------------------------------------------------------------
  // Test 8: Manual Resend Rate Limiting (60-second Cooldown)
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Manual Resend Rate Limiting (60s Cooldown) ---');
  const manual1 = await NotificationService.requestNotification({
    type: 'APPOINTMENT_REMINDER',
    patientId: patient.id,
    entityType: 'APPOINTMENT',
    entityId: 'apt-cooldown-test',
    recipientPhone: testPhone,
    isManualSend: true,
  });
  assert(manual1.status === 'QUEUED', 'First manual notification request succeeds');

  let rejected = false;
  try {
    await NotificationService.requestNotification({
      type: 'APPOINTMENT_REMINDER',
      patientId: patient.id,
      entityType: 'APPOINTMENT',
      entityId: 'apt-cooldown-test',
      recipientPhone: testPhone,
      isManualSend: true,
    });
  } catch (err: any) {
    rejected = err.message.includes('wait') && err.message.includes('seconds');
  }
  assert(rejected, 'Second manual resend within 60 seconds is rejected by cooldown guard');

  // Clean up
  if (manual1.notification?.id) {
    await prisma.notification.delete({ where: { id: manual1.notification.id } });
  }

  // -------------------------------------------------------------
  // Test 9: Automatic Event Idempotency
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Automatic Event Idempotency ---');
  const auto1 = await NotificationService.requestNotification({
    type: 'PAYMENT_RECEIPT',
    patientId: patient.id,
    entityType: 'PAYMENT',
    entityId: 'pay-idempotency-test',
    recipientPhone: testPhone,
    isManualSend: false,
  });
  assert(auto1.status === 'QUEUED', 'First automatic event queues successfully');

  const auto2 = await NotificationService.requestNotification({
    type: 'PAYMENT_RECEIPT',
    patientId: patient.id,
    entityType: 'PAYMENT',
    entityId: 'pay-idempotency-test',
    recipientPhone: testPhone,
    isManualSend: false,
  });
  assert(
    auto2.status === 'ALREADY_EXISTS' && auto2.notification?.id === auto1.notification?.id,
    'Duplicate automatic event returns ALREADY_EXISTS without inserting new record'
  );

  // Clean up
  if (auto1.notification?.id) {
    await prisma.notification.delete({ where: { id: auto1.notification.id } });
  }

  // -------------------------------------------------------------
  // Test 10: PDF Generators Verification
  // -------------------------------------------------------------
  console.log('\n--- Test 10: PDF Document Generators Verification ---');
  const invoicePdf = await generateInvoicePDF({
    clinicName: 'DentalCore Clinic',
    patientName: 'Test Patient',
    patientId: patient.id,
    patientPhone: testPhone,
    visitId: 'v-test',
    visitDate: '13/09/2026',
    consultationFee: 500,
    treatmentFee: 1500,
    medicineCost: 200,
    totalAmount: 2200,
    amountPaid: 2200,
    amountDue: 0,
    status: 'Fully Paid',
  });
  assert(Buffer.isBuffer(invoicePdf) && invoicePdf.length > 1000, 'generateInvoicePDF produces valid PDF buffer');

  const poPdf = await generatePurchaseOrderPDF({
    clinicName: 'DentalCore Clinic',
    orderNumber: 'PO-202609-001',
    orderDate: '13/09/2026',
    supplierName: 'Apex Medical Supplies',
    supplierEmail: 'orders@apex.com',
    items: [
      { medicineName: 'Amoxicillin 500mg', quantity: 100, unitPrice: 5.5, total: 550 },
      { medicineName: 'Paracetamol 650mg', quantity: 200, unitPrice: 2.0, total: 400 },
    ],
    totalAmount: 950,
  });
  assert(Buffer.isBuffer(poPdf) && poPdf.length > 1000, 'generatePurchaseOrderPDF produces valid PDF buffer');

  const receiptPdf = await generateReceiptPDF({
    clinicName: 'DentalCore Clinic',
    patientName: 'Test Patient',
    patientId: patient.id,
    patientPhone: testPhone,
    visitId: 'v-test',
    visitDate: '13/09/2026',
    doctorName: 'Dr. Test',
    consultationFee: 500,
    medicineCost: 200,
    totalAmount: 700,
    amountPaid: 700,
    paymentMethod: 'UPI',
    paymentDate: '13/09/2026',
    paymentStatus: 'Paid',
    receiptNo: 'RCPT-001',
    receivedBy: 'Reception',
  });
  assert(Buffer.isBuffer(receiptPdf) && receiptPdf.length > 1000, 'generateReceiptPDF produces valid PDF buffer');

  const prescriptionPdf = await generatePrescriptionPDF({
    clinicName: 'DentalCore Clinic',
    patientName: 'Test Patient',
    patientAge: 30,
    patientGender: 'Female',
    patientId: patient.id,
    patientPhone: testPhone,
    visitDate: '13/09/2026',
    visitId: 'v-test',
    doctorName: 'Dr. Test',
    items: [
      { medicineName: 'Amoxicillin 500mg', quantity: 10, dosage: '1-0-1', duration: '5 days' },
    ],
  });
  assert(Buffer.isBuffer(prescriptionPdf) && prescriptionPdf.length > 1000, 'generatePrescriptionPDF produces valid PDF buffer');

  console.log('\n===========================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Fatal error in test runner:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
