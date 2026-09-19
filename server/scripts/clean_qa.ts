import { prisma } from '../src/db';

async function cleanQA() {
  const dbUrl = process.env.DATABASE_URL || '';
  console.log(`Target database URL: ${dbUrl}`);

  // Safety Shield
  if (!dbUrl.includes('127.0.0.1:3306') && !dbUrl.includes('localhost:3306')) {
    throw new Error('SAFETY ABORT: DATABASE_URL does not point to local MySQL (port 3306)!');
  }
  if (!dbUrl.startsWith('mysql://')) {
    throw new Error('SAFETY ABORT: DATABASE_URL is not a MySQL connection string!');
  }

  console.log('Cleaning local operational and transactional data from MySQL...');

  // 1. Supplier & Procurement
  await prisma.supplierPayment.deleteMany({});
  await prisma.supplierBill.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.supplierMedicineCategory.deleteMany({});
  await prisma.supplier.deleteMany({});

  // 2. Clinical & Financial
  await prisma.dispensingItem.deleteMany({});
  await prisma.dispensing.deleteMany({});
  await prisma.prescriptionItem.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.queueEntry.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.treatmentPlanItem.deleteMany({});
  await prisma.treatmentPlan.deleteMany({});
  await prisma.reimbursementDocument.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.historicalMigrationRecord.deleteMany({});
  await prisma.historicalMigrationBatch.deleteMany({});
  await prisma.visit.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.patient.deleteMany({});

  // 3. Catalogues & Staff/Users
  await prisma.medicine.deleteMany({});
  await prisma.medicineCategory.deleteMany({});
  await prisma.treatmentCatalog.deleteMany({});

  await prisma.user.deleteMany({});
  await prisma.staff.deleteMany({});

  console.log('Clean complete. Verifying empty states...');
  const counts = {
    patients: await prisma.patient.count(),
    visits: await prisma.visit.count(),
    appointments: await prisma.appointment.count(),
    payments: await prisma.payment.count(),
    prescriptions: await prisma.prescription.count(),
    consultations: await prisma.consultation.count(),
    medicines: await prisma.medicine.count(),
    suppliers: await prisma.supplier.count(),
    users: await prisma.user.count(),
    staff: await prisma.staff.count()
  };

  console.log('Post-clean table counts:', counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total !== 0) {
    throw new Error(`Expected all tables to be 0, but found remaining rows: ${JSON.stringify(counts)}`);
  }
  console.log('✅ ALL OPERATIONAL TABLES CONFIRMED EMPTY.');
}

cleanQA().catch(console.error).finally(() => prisma.$disconnect());
