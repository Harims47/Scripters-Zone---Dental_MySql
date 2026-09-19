import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 1. Environment & Target Resolution
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const renderDbUrl = process.env.RENDER_DATABASE_URL;

console.log('====================================================');
console.log('   DENTALCORE RENDER FULL DEMO RESET & SEED UTILITY ');
console.log('====================================================');

// SAFETY CHECK 1: RENDER_DATABASE_URL is strictly required
if (!renderDbUrl) {
  console.error('\nCRITICAL CONFIGURATION ERROR: RENDER_DATABASE_URL is not defined.');
  console.error('This utility requires an explicit RENDER_DATABASE_URL pointing to Render PostgreSQL.');
  console.error('It deliberately does NOT fall back to DATABASE_URL to prevent accidental local resets.');
  console.error('Execution aborted.');
  process.exit(1);
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(renderDbUrl);
} catch {
  console.error('\nCRITICAL ERROR: Failed to parse RENDER_DATABASE_URL as a valid URL.');
  process.exit(1);
}

const hostname = parsedUrl.hostname.toLowerCase();
const port = parsedUrl.port;
const dbName = parsedUrl.pathname.replace(/^\//, '');

// SAFETY CHECK 2: Absolute refusal to target localhost or local Docker ports
if (
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '0.0.0.0' ||
  port === '5433' ||
  dbName === 'dentalcore_shadow' ||
  dbName === 'dentalcore_migration_test' ||
  dbName === 'dentalcore_dev'
) {
  console.error('\nSAFETY VIOLATION: Target matches local development database or port!');
  console.error(`  Received: ${hostname}:${port}/${dbName}`);
  console.error('This utility is strictly for Render PostgreSQL. Aborting immediately.');
  process.exit(1);
}

// SAFETY CHECK 3: Verify hostname contains Render domain markers
const isRenderHost =
  hostname.includes('render.com') ||
  hostname.includes('oregon-postgres') ||
  hostname.includes('frankfurt-postgres') ||
  hostname.includes('dpg-');

if (!isRenderHost) {
  console.error('\nSAFETY VIOLATION: Hostname does not match expected Render PostgreSQL domain markers.');
  console.error(`  Received: ${hostname}`);
  console.error('Refusing to run against non-Render targets. Execution aborted.');
  process.exit(1);
}

// Print sanitized connection details (hide password)
const sanitizedUrl = new URL(renderDbUrl);
sanitizedUrl.password = '******';
console.log('Verified Render Target:');
console.log(`  Host                : ${hostname}`);
console.log(`  Port                : ${port || '5432'}`);
console.log(`  Database            : ${dbName}`);
console.log(`  Endpoint            : ${sanitizedUrl.toString()}`);
console.log(`  Target Verification : CONFIRMED NOT localhost / NOT 127.0.0.1 / NOT local Docker port 5433\n`);

// Setup Prisma Client for Render PostgreSQL with SSL
const pool = new Pool({
  connectionString: renderDbUrl,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const isConfirmed = process.env.CONFIRM_RENDER_FULL_RESET === 'true';

  // 1. Fetch Current State Across All 28 Models
  const allUsers = await prisma.user.findMany({ select: { username: true, role: true } });
  const allStaff = await prisma.staff.findMany({ select: { id: true, name: true, role: true } });

  // 26 Application Data Models + 2 Structural/Master Models = 28 Models
  const counts = {
    // Communication & Notifications (1)
    notifications: await prisma.notification.count(),

    // Historical Migration (2)
    historicalBatches: await prisma.historicalMigrationBatch.count(),
    historicalRecords: await prisma.historicalMigrationRecord.count(),

    // Reimbursement (1)
    reimbursementDocuments: await prisma.reimbursementDocument.count(),

    // Procurement & Suppliers (6)
    suppliers: await prisma.supplier.count(),
    supplierCategories: await prisma.supplierMedicineCategory.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    purchaseOrderItems: await prisma.purchaseOrderItem.count(),
    supplierBills: await prisma.supplierBill.count(),
    supplierPayments: await prisma.supplierPayment.count(),

    // Inventory & Pharmacy (6)
    medicines: await prisma.medicine.count(),
    stockMovements: await prisma.stockMovement.count(),
    dispensings: await prisma.dispensing.count(),
    dispensingItems: await prisma.dispensingItem.count(),
    prescriptions: await prisma.prescription.count(),
    prescriptionItems: await prisma.prescriptionItem.count(),

    // Clinical Treatment Plans (2)
    treatmentPlans: await prisma.treatmentPlan.count(),
    treatmentPlanItems: await prisma.treatmentPlanItem.count(),

    // Operational Visits & Clinical Operations (6)
    patients: await prisma.patient.count(),
    visits: await prisma.visit.count(),
    appointments: await prisma.appointment.count(),
    consultations: await prisma.consultation.count(),
    queueEntries: await prisma.queueEntry.count(),
    payments: await prisma.payment.count(),

    // User Identities & Staff (2)
    users: await prisma.user.count(),
    staff: await prisma.staff.count(),

    // Structural / Master Catalogs (2 - PRESERVED)
    treatmentCatalog: await prisma.treatmentCatalog.count(),
    medicineCategory: await prisma.medicineCategory.count(),
  };

  const migrationRows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM "_prisma_migrations"`;
  const migrationCount = Number(migrationRows[0]?.count ?? 0);

  const totalApplicationRecordsToDelete =
    counts.notifications +
    counts.historicalBatches +
    counts.historicalRecords +
    counts.reimbursementDocuments +
    counts.suppliers +
    counts.supplierCategories +
    counts.purchaseOrders +
    counts.purchaseOrderItems +
    counts.supplierBills +
    counts.supplierPayments +
    counts.medicines +
    counts.stockMovements +
    counts.dispensings +
    counts.dispensingItems +
    counts.prescriptions +
    counts.prescriptionItems +
    counts.treatmentPlans +
    counts.treatmentPlanItems +
    counts.patients +
    counts.visits +
    counts.appointments +
    counts.consultations +
    counts.queueEntries +
    counts.payments +
    counts.users +
    counts.staff;

  // 2. Report Current Inventory
  console.log('----------------------------------------------------');
  console.log('         CURRENT RENDER DATABASE INVENTORY          ');
  console.log('----------------------------------------------------');
  console.log('A. APPLICATION DATA MODELS TO BE CLEARED (26 Models):');
  console.log(`  1.  Notification               : ${counts.notifications}`);
  console.log(`  2.  HistoricalMigrationRecord  : ${counts.historicalRecords}`);
  console.log(`  3.  HistoricalMigrationBatch   : ${counts.historicalBatches}`);
  console.log(`  4.  ReimbursementDocument      : ${counts.reimbursementDocuments}`);
  console.log(`  5.  SupplierPayment            : ${counts.supplierPayments}`);
  console.log(`  6.  SupplierBill               : ${counts.supplierBills}`);
  console.log(`  7.  PurchaseOrderItem          : ${counts.purchaseOrderItems}`);
  console.log(`  8.  PurchaseOrder              : ${counts.purchaseOrders}`);
  console.log(`  9.  SupplierMedicineCategory   : ${counts.supplierCategories}`);
  console.log(`  10. Supplier                   : ${counts.suppliers}`);
  console.log(`  11. StockMovement              : ${counts.stockMovements}`);
  console.log(`  12. DispensingItem             : ${counts.dispensingItems}`);
  console.log(`  13. Dispensing                 : ${counts.dispensings}`);
  console.log(`  14. PrescriptionItem           : ${counts.prescriptionItems}`);
  console.log(`  15. Prescription               : ${counts.prescriptions}`);
  console.log(`  16. Medicine                   : ${counts.medicines}`);
  console.log(`  17. TreatmentPlanItem          : ${counts.treatmentPlanItems}`);
  console.log(`  18. TreatmentPlan              : ${counts.treatmentPlans}`);
  console.log(`  19. Payment                    : ${counts.payments}`);
  console.log(`  20. QueueEntry                 : ${counts.queueEntries}`);
  console.log(`  21. Consultation               : ${counts.consultations}`);
  console.log(`  22. Visit                      : ${counts.visits}`);
  console.log(`  23. Appointment                : ${counts.appointments}`);
  console.log(`  24. Patient                    : ${counts.patients}`);
  console.log(`  25. User                       : ${counts.users} (${allUsers.map(u => `${u.username} [${u.role}]`).join(', ') || 'None'})`);
  console.log(`  26. Staff                      : ${counts.staff} (${allStaff.map(s => `${s.name} [${s.role}]`).join(', ') || 'None'})`);
  console.log(`Total Application Records Planned for Deletion: ${totalApplicationRecordsToDelete}`);
  console.log('----------------------------------------------------');
  console.log('B. MASTER / STRUCTURAL CATALOGS TO BE PRESERVED (2 Models):');
  console.log(`  1. TreatmentCatalog            : ${counts.treatmentCatalog} clinical procedures`);
  console.log(`  2. MedicineCategory            : ${counts.medicineCategory} categories`);
  console.log('----------------------------------------------------');
  console.log('C. MIGRATION SYSTEM TABLE TO BE PRESERVED:');
  console.log(`  1. _prisma_migrations          : ${migrationCount} applied migrations`);
  console.log('----------------------------------------------------');
  console.log('D. SEEDING SPECIFICATION (AFTER RESET):');
  console.log('Exactly ONE Doctor account will be seeded:');
  console.log('  Staff:');
  console.log('    name       : DR N MOHAMED RAFI B D S');
  console.log('    role       : Head Doctor');
  console.log('    status     : Active');
  console.log('    attendance : Present');
  console.log(`    phone      : ${process.env.HEAD_DOCTOR_PHONE ? '[Provided via HEAD_DOCTOR_PHONE]' : '[REQUIRED BY SCHEMA - NOT NULL]'}`);
  console.log('  User:');
  console.log('    username   : mohamed');
  console.log('    role       : Head Doctor');
  console.log('    password   : [PROTECTED - Bcrypt Hash (cost 10)]');
  console.log('    staffId    : [Linked to created Staff]');
  console.log('----------------------------------------------------');

  // DRY-RUN GUARD
  if (!isConfirmed) {
    console.log('\n>>> DRY-RUN / PREVIEW MODE ACTIVE <<<');
    console.log('CONFIRM_RENDER_FULL_RESET is NOT set to "true".');
    console.log('CONFIRMATION: ZERO modifications were performed on Render (READ-ONLY PREVIEW).\n');
    console.log('To execute the confirmed destructive wipe and seed on Render:');
    console.log('  1. Provide HEAD_DOCTOR_PHONE if required (Staff.phone is NOT NULL in schema)');
    console.log('  2. Run:');
    console.log('     $env:HEAD_DOCTOR_PHONE="<PHONE>"; $env:CONFIRM_RENDER_FULL_RESET="true"; npx tsx scripts/reset_render_full.ts\n');
    return;
  }

  // Schema requirement check for Staff.phone:
  // In Prisma schema: `phone String` on Staff is NOT NULL.
  const staffPhone = process.env.HEAD_DOCTOR_PHONE;
  if (staffPhone === undefined || staffPhone === null) {
    console.error('\nCRITICAL SCHEMA REQUIREMENT ERROR:');
    console.error('Staff.phone is defined as "String" (NOT NULL) in server/prisma/schema.prisma.');
    console.error('PostgreSQL will reject inserting a Staff record without a phone string.');
    console.error('Please specify HEAD_DOCTOR_PHONE environment variable (e.g. $env:HEAD_DOCTOR_PHONE="<phone>") to proceed.');
    process.exit(1);
  }

  // CONFIRMED EXECUTION
  console.log('\nCONFIRM_RENDER_FULL_RESET="true" detected.');
  console.log('Proceeding with atomic transactional full reset & seed on Render...\n');

  const startTime = Date.now();

  await prisma.$transaction(async (tx) => {
    // 1. Communication & Notification Records
    await tx.notification.deleteMany({});

    // 2. Historical Migration Records & Batches
    await tx.historicalMigrationRecord.deleteMany({});
    await tx.historicalMigrationBatch.deleteMany({});

    // 3. Reimbursement Documents
    await tx.reimbursementDocument.deleteMany({});

    // 4. Procurement & Supplier Records
    await tx.supplierPayment.deleteMany({});
    await tx.supplierBill.deleteMany({});
    await tx.purchaseOrderItem.deleteMany({});
    await tx.purchaseOrder.deleteMany({});
    await tx.supplierMedicineCategory.deleteMany({});
    await tx.supplier.deleteMany({});

    // 5. Stock Movements
    await tx.stockMovement.deleteMany({});

    // 6. Pharmacy & Dispensing
    await tx.dispensingItem.deleteMany({});
    await tx.dispensing.deleteMany({});
    await tx.prescriptionItem.deleteMany({});
    await tx.prescription.deleteMany({});

    // 7. Inventory Medicines (Category is preserved)
    await tx.medicine.deleteMany({});

    // 8. Clinical Treatment Plans
    await tx.treatmentPlanItem.deleteMany({});
    await tx.treatmentPlan.deleteMany({});

    // 9. Visits, Consultations, Queue, Payments, Appointments & Patients
    await tx.payment.deleteMany({});
    await tx.queueEntry.deleteMany({});
    await tx.consultation.deleteMany({});
    await tx.visit.deleteMany({});
    await tx.appointment.deleteMany({});
    await tx.patient.deleteMany({});

    // 10. Users & Staff (Delete ALL)
    await tx.user.deleteMany({});
    await tx.staff.deleteMany({});

    // 11. Seed Exactly ONE Doctor Account
    const newStaff = await tx.staff.create({
      data: {
        name: 'DR N MOHAMED RAFI B D S',
        phone: staffPhone,
        role: 'Head Doctor',
        status: 'Active',
        attendance: 'Present'
      }
    });

    const passwordHash = await bcrypt.hash('1234', 10);

    await tx.user.create({
      data: {
        username: 'mohamed',
        passwordHash,
        role: 'Head Doctor',
        staffId: newStaff.id
      }
    });

    // In-transaction assertions
    const seededUserCount = await tx.user.count();
    if (seededUserCount !== 1) {
      throw new Error(`Transaction assertion failed: Expected exactly 1 User, found ${seededUserCount}`);
    }

    const seededStaffCount = await tx.staff.count();
    if (seededStaffCount !== 1) {
      throw new Error(`Transaction assertion failed: Expected exactly 1 Staff, found ${seededStaffCount}`);
    }
  }, { timeout: 60000 });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Transaction committed successfully on Render in ${duration}s.\n`);

  // 3. POST-RESET VERIFICATION
  console.log('----------------------------------------------------');
  console.log('         POST-RESET VERIFICATION (RENDER)           ');
  console.log('----------------------------------------------------');

  const finalUsers = await prisma.user.findMany({
    select: { id: true, username: true, role: true, staffId: true, passwordHash: true }
  });
  const finalStaff = await prisma.staff.findMany({
    select: { id: true, name: true, role: true, phone: true, status: true, attendance: true }
  });

  const postCounts = {
    // 24 Cleared Operational Models (Expected: 0)
    notifications: await prisma.notification.count(),
    historicalRecords: await prisma.historicalMigrationRecord.count(),
    historicalBatches: await prisma.historicalMigrationBatch.count(),
    reimbursementDocuments: await prisma.reimbursementDocument.count(),
    supplierPayments: await prisma.supplierPayment.count(),
    supplierBills: await prisma.supplierBill.count(),
    purchaseOrderItems: await prisma.purchaseOrderItem.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    supplierCategories: await prisma.supplierMedicineCategory.count(),
    suppliers: await prisma.supplier.count(),
    stockMovements: await prisma.stockMovement.count(),
    dispensingItems: await prisma.dispensingItem.count(),
    dispensings: await prisma.dispensing.count(),
    prescriptionItems: await prisma.prescriptionItem.count(),
    prescriptions: await prisma.prescription.count(),
    medicines: await prisma.medicine.count(),
    treatmentPlanItems: await prisma.treatmentPlanItem.count(),
    treatmentPlans: await prisma.treatmentPlan.count(),
    payments: await prisma.payment.count(),
    queueEntries: await prisma.queueEntry.count(),
    consultations: await prisma.consultation.count(),
    visits: await prisma.visit.count(),
    appointments: await prisma.appointment.count(),
    patients: await prisma.patient.count(),

    // 2 Cleared then Seeded Models (Expected: 1)
    users: await prisma.user.count(),
    staff: await prisma.staff.count(),

    // 2 Preserved Master Catalogs
    treatmentCatalog: await prisma.treatmentCatalog.count(),
    medicineCategory: await prisma.medicineCategory.count(),
  };

  const finalMigrations = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM "_prisma_migrations"`;
  const finalMigrationCount = Number(finalMigrations[0]?.count ?? 0);

  // Validate User
  const singleUser = finalUsers[0];
  const isPasswordValid = singleUser ? await bcrypt.compare('1234', singleUser.passwordHash) : false;
  const userValid =
    finalUsers.length === 1 &&
    singleUser.username === 'mohamed' &&
    singleUser.role === 'Head Doctor' &&
    isPasswordValid &&
    !!singleUser.staffId;

  // Validate Staff
  const singleStaff = finalStaff[0];
  const staffValid =
    finalStaff.length === 1 &&
    singleStaff.name === 'DR N MOHAMED RAFI B D S' &&
    singleStaff.role === 'Head Doctor' &&
    singleStaff.status === 'Active' &&
    singleStaff.attendance === 'Present';

  // Validate 24 Zero-Record Models
  const operationalChecklist = [
    { name: 'Notification', count: postCounts.notifications },
    { name: 'HistoricalMigrationRecord', count: postCounts.historicalRecords },
    { name: 'HistoricalMigrationBatch', count: postCounts.historicalBatches },
    { name: 'ReimbursementDocument', count: postCounts.reimbursementDocuments },
    { name: 'SupplierPayment', count: postCounts.supplierPayments },
    { name: 'SupplierBill', count: postCounts.supplierBills },
    { name: 'PurchaseOrderItem', count: postCounts.purchaseOrderItems },
    { name: 'PurchaseOrder', count: postCounts.purchaseOrders },
    { name: 'SupplierMedicineCategory', count: postCounts.supplierCategories },
    { name: 'Supplier', count: postCounts.suppliers },
    { name: 'StockMovement', count: postCounts.stockMovements },
    { name: 'DispensingItem', count: postCounts.dispensingItems },
    { name: 'Dispensing', count: postCounts.dispensings },
    { name: 'PrescriptionItem', count: postCounts.prescriptionItems },
    { name: 'Prescription', count: postCounts.prescriptions },
    { name: 'Medicine', count: postCounts.medicines },
    { name: 'TreatmentPlanItem', count: postCounts.treatmentPlanItems },
    { name: 'TreatmentPlan', count: postCounts.treatmentPlans },
    { name: 'Payment', count: postCounts.payments },
    { name: 'QueueEntry', count: postCounts.queueEntries },
    { name: 'Consultation', count: postCounts.consultations },
    { name: 'Visit', count: postCounts.visits },
    { name: 'Appointment', count: postCounts.appointments },
    { name: 'Patient', count: postCounts.patients },
  ];

  const allOperationalZero = operationalChecklist.every(t => t.count === 0);
  const migrationsValid = finalMigrationCount > 0;

  console.log('Post-Reset Counts:');
  console.log(`  Users (Seeded)                : ${postCounts.users} (Expected: 1)`);
  console.log(`  Staff (Seeded)                : ${postCounts.staff} (Expected: 1)`);
  console.log(`  24 Operational Data Models    : ${allOperationalZero ? 'All 24 are 0' : 'FAILED - non-zero detected'}`);
  console.log(`  TreatmentCatalog (Preserved)  : ${postCounts.treatmentCatalog}`);
  console.log(`  MedicineCategory (Preserved)  : ${postCounts.medicineCategory}`);
  console.log(`  _prisma_migrations (Preserved): ${finalMigrationCount} applied migrations`);

  console.log('\nVerification Checklist:');
  console.log(`  [${userValid ? 'PASS' : 'FAIL'}] User: Exactly 1 record (mohamed, Head Doctor, password verified)`);
  console.log(`  [${staffValid ? 'PASS' : 'FAIL'}] Staff: Exactly 1 record (DR N MOHAMED RAFI B D S, Head Doctor, Active, Present)`);
  console.log(`  [${allOperationalZero ? 'PASS' : 'FAIL'}] All 24 operational application tables wiped to 0`);
  console.log(`  [${postCounts.treatmentCatalog > 0 ? 'PASS' : 'FAIL'}] TreatmentCatalog master data preserved`);
  console.log(`  [${postCounts.medicineCategory > 0 ? 'PASS' : 'FAIL'}] MedicineCategory master data preserved`);
  console.log(`  [${migrationsValid ? 'PASS' : 'FAIL'}] _prisma_migrations intact (${finalMigrationCount} applied migrations)`);

  if (!userValid || !staffValid || !allOperationalZero || !migrationsValid) {
    console.error('\nPOST-RESET VERIFICATION FAILED: Database state did not match expected targets.');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('   RENDER DATABASE IS CLEAN AND READY FOR DEMO RUN  ');
  console.log('====================================================\n');
}

main()
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
