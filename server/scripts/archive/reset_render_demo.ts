import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 1. Environment & Target Resolution
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const renderDbUrl = process.env.RENDER_DATABASE_URL;

console.log('====================================================');
console.log('       DENTALCORE RENDER DEMO RESET UTILITY         ');
console.log('====================================================');

// SAFETY CHECK 1: RENDER_DATABASE_URL is strictly required
if (!renderDbUrl) {
  console.error('\nCRITICAL CONFIGURATION ERROR: RENDER_DATABASE_URL is not defined.');
  console.error('This utility requires an explicit RENDER_DATABASE_URL pointing to Render PostgreSQL.');
  console.error('It deliberately does NOT fall back to DATABASE_URL to avoid accidental local resets.');
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
  dbName === 'dentalcore_migration_test'
) {
  console.error('\nSAFETY VIOLATION: Target matches local database or local port!');
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
  const isConfirmed = process.env.CONFIRM_RENDER_DEMO_RESET === 'true';

  // 1. Verify Head Doctor on Render
  const headUser = await prisma.user.findUnique({
    where: { username: 'headdoctor' },
    include: { staff: true }
  });

  if (!headUser) {
    console.error('SAFETY ERROR: User "headdoctor" was not found on the Render database.');
    console.error('Cannot reset without preserving Head Doctor. Execution aborted.');
    process.exit(1);
  }

  if (!headUser.staffId || !headUser.staff) {
    console.error('SAFETY ERROR: User "headdoctor" has no linked Staff record on Render.');
    console.error('Cannot reset without linked Staff. Execution aborted.');
    process.exit(1);
  }

  const preservedStaffId = headUser.staffId;
  const initialUserId = headUser.id;
  const initialUsername = headUser.username;
  const initialPasswordHash = headUser.passwordHash;
  const initialRole = headUser.role;

  // 2. Query initial counts
  const allUsers = await prisma.user.findMany({ select: { username: true, role: true } });
  const allStaff = await prisma.staff.findMany({ select: { id: true, name: true, role: true } });

  const counts = {
    users: await prisma.user.count(),
    staff: await prisma.staff.count(),
    patients: await prisma.patient.count(),
    visits: await prisma.visit.count(),
    appointments: await prisma.appointment.count(),
    consultations: await prisma.consultation.count(),
    queueEntries: await prisma.queueEntry.count(),
    payments: await prisma.payment.count(),
    treatmentPlans: await prisma.treatmentPlan.count(),
    treatmentPlanItems: await prisma.treatmentPlanItem.count(),
    prescriptions: await prisma.prescription.count(),
    prescriptionItems: await prisma.prescriptionItem.count(),
    dispensings: await prisma.dispensing.count(),
    dispensingItems: await prisma.dispensingItem.count(),
    suppliers: await prisma.supplier.count(),
    supplierCategories: await prisma.supplierMedicineCategory.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    purchaseOrderItems: await prisma.purchaseOrderItem.count(),
    supplierBills: await prisma.supplierBill.count(),
    supplierPayments: await prisma.supplierPayment.count(),
    stockMovements: await prisma.stockMovement.count(),
    medicines: await prisma.medicine.count(),
    treatmentCatalog: await prisma.treatmentCatalog.count(),
    medicineCategory: await prisma.medicineCategory.count(),
  };

  const migrationRows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM "_prisma_migrations"`;
  const migrationCount = Number(migrationRows[0]?.count ?? 0);

  const usersToDelete = allUsers.filter(u => u.username !== 'headdoctor');
  const staffToDelete = allStaff.filter(s => s.id !== preservedStaffId);
  const totalOperationalToDelete =
    counts.patients +
    counts.visits +
    counts.appointments +
    counts.consultations +
    counts.queueEntries +
    counts.payments +
    counts.treatmentPlans +
    counts.treatmentPlanItems +
    counts.prescriptions +
    counts.prescriptionItems +
    counts.dispensings +
    counts.dispensingItems +
    counts.suppliers +
    counts.supplierCategories +
    counts.purchaseOrders +
    counts.purchaseOrderItems +
    counts.supplierBills +
    counts.supplierPayments +
    counts.stockMovements +
    counts.medicines;

  // 3. PREVIEW / DRY-RUN OUTPUT
  console.log('----------------------------------------------------');
  console.log('         CURRENT RENDER DATABASE INVENTORY          ');
  console.log('----------------------------------------------------');
  console.log(`Users total              : ${counts.users} (1 headdoctor, ${counts.users - 1} to delete)`);
  console.log(`  Usernames in DB        : ${allUsers.map(u => `${u.username} (${u.role})`).join(', ')}`);
  console.log(`Staff total              : ${counts.staff} (1 linked staff, ${counts.staff - 1} to delete)`);
  console.log(`  Staff in DB            : ${allStaff.map(s => `${s.name} [${s.role}]`).join(', ')}`);
  console.log(`Patients                 : ${counts.patients}`);
  console.log(`Visits                   : ${counts.visits}`);
  console.log(`Appointments             : ${counts.appointments}`);
  console.log(`Consultations            : ${counts.consultations}`);
  console.log(`Queue Entries            : ${counts.queueEntries}`);
  console.log(`Payments                 : ${counts.payments}`);
  console.log(`Treatment Plans          : ${counts.treatmentPlans}`);
  console.log(`Treatment Plan Items     : ${counts.treatmentPlanItems}`);
  console.log(`Prescriptions            : ${counts.prescriptions}`);
  console.log(`Prescription Items       : ${counts.prescriptionItems}`);
  console.log(`Dispensings              : ${counts.dispensings}`);
  console.log(`Dispensing Items         : ${counts.dispensingItems}`);
  console.log(`Suppliers                : ${counts.suppliers}`);
  console.log(`Supplier-Categories      : ${counts.supplierCategories}`);
  console.log(`Purchase Orders          : ${counts.purchaseOrders}`);
  console.log(`Purchase Order Items     : ${counts.purchaseOrderItems}`);
  console.log(`Supplier Bills           : ${counts.supplierBills}`);
  console.log(`Supplier Payments        : ${counts.supplierPayments}`);
  console.log(`Stock Movements          : ${counts.stockMovements}`);
  console.log(`Medicines                : ${counts.medicines}`);
  console.log('----------------------------------------------------');
  console.log('              PRESERVATION SPECIFICATION            ');
  console.log('----------------------------------------------------');
  console.log(`[PRESERVED] User             : ${headUser.username} (ID: ${headUser.id}, Role: ${headUser.role})`);
  console.log(`[PRESERVED] Staff            : ${headUser.staff?.name} (ID: ${preservedStaffId}, Role: ${headUser.staff?.role})`);
  console.log(`[PRESERVED] TreatmentCatalog : ${counts.treatmentCatalog} clinical procedures`);
  console.log(`[PRESERVED] MedicineCategory : ${counts.medicineCategory} categories`);
  console.log(`[PRESERVED] _prisma_migrations: ${migrationCount} applied migrations`);
  console.log('----------------------------------------------------');
  console.log('        EXACT RECORDS PLANNED FOR DELETION          ');
  console.log('----------------------------------------------------');
  console.log(`Users to delete (${usersToDelete.length})  : ${usersToDelete.map(u => `${u.username} (${u.role})`).join(', ') || 'None'}`);
  console.log(`Staff to delete (${staffToDelete.length})  : ${staffToDelete.map(s => `${s.name} [${s.role}]`).join(', ') || 'None'}`);
  console.log(`Operational records to delete:`);
  console.log(`  - Patients               : ${counts.patients}`);
  console.log(`  - Visits                 : ${counts.visits}`);
  console.log(`  - Appointments           : ${counts.appointments}`);
  console.log(`  - Consultations          : ${counts.consultations}`);
  console.log(`  - Queue Entries          : ${counts.queueEntries}`);
  console.log(`  - Payments               : ${counts.payments}`);
  console.log(`  - Treatment Plans        : ${counts.treatmentPlans}`);
  console.log(`  - Treatment Plan Items   : ${counts.treatmentPlanItems}`);
  console.log(`  - Prescriptions          : ${counts.prescriptions}`);
  console.log(`  - Prescription Items     : ${counts.prescriptionItems}`);
  console.log(`  - Dispensings            : ${counts.dispensings}`);
  console.log(`  - Dispensing Items       : ${counts.dispensingItems}`);
  console.log(`  - Suppliers              : ${counts.suppliers}`);
  console.log(`  - Supplier-Categories    : ${counts.supplierCategories}`);
  console.log(`  - Purchase Orders        : ${counts.purchaseOrders}`);
  console.log(`  - Purchase Order Items   : ${counts.purchaseOrderItems}`);
  console.log(`  - Supplier Bills         : ${counts.supplierBills}`);
  console.log(`  - Supplier Payments      : ${counts.supplierPayments}`);
  console.log(`  - Stock Movements        : ${counts.stockMovements}`);
  console.log(`  - Medicines              : ${counts.medicines}`);
  console.log(`Total operational records planned for deletion: ${totalOperationalToDelete}`);
  console.log('----------------------------------------------------');

  if (!isConfirmed) {
    console.log('\n>>> DRY-RUN / PREVIEW MODE ACTIVE <<<');
    console.log('CONFIRM_RENDER_DEMO_RESET is NOT set to "true".');
    console.log('CONFIRMATION: Zero modifications were performed on Render (READ-ONLY PREVIEW).\n');
    console.log('To execute the confirmed transactional wipe on Render, run:');
    console.log('  $env:CONFIRM_RENDER_DEMO_RESET="true"; npx tsx scripts/reset_render_demo.ts\n');
    return;
  }

  // CONFIRMED EXECUTION
  console.log('\nCONFIRM_RENDER_DEMO_RESET="true" detected.');
  console.log('Proceeding with atomic transactional reset on Render...\n');

  const startTime = Date.now();

  await prisma.$transaction(async (tx) => {
    // 1. Supplier & Procurement Transactions
    await tx.supplierPayment.deleteMany({});
    await tx.supplierBill.deleteMany({});
    await tx.purchaseOrderItem.deleteMany({});
    await tx.purchaseOrder.deleteMany({});
    await tx.stockMovement.deleteMany({});
    await tx.supplierMedicineCategory.deleteMany({});
    await tx.supplier.deleteMany({});

    // 2. Pharmacy & Dispensing Transactions
    await tx.dispensingItem.deleteMany({});
    await tx.dispensing.deleteMany({});
    await tx.prescriptionItem.deleteMany({});
    await tx.prescription.deleteMany({});

    // 3. Clinical & Patient Transactions
    await tx.payment.deleteMany({});
    await tx.queueEntry.deleteMany({});
    await tx.consultation.deleteMany({});
    await tx.treatmentPlanItem.deleteMany({});
    await tx.treatmentPlan.deleteMany({});
    await tx.visit.deleteMany({});
    await tx.appointment.deleteMany({});
    await tx.patient.deleteMany({});

    // 4. Inventory Medicines (Category is preserved)
    await tx.medicine.deleteMany({});

    // 5. Identities & Access Control
    await tx.user.deleteMany({
      where: { username: { not: 'headdoctor' } }
    });

    await tx.staff.deleteMany({
      where: { id: { not: preservedStaffId } }
    });

    // 6. Normalize Head Doctor Staff Record
    await tx.staff.update({
      where: { id: preservedStaffId },
      data: {
        status: 'Active',
        attendance: 'Present'
      }
    });

    // In-transaction assertions
    const remainingUsers = await tx.user.count();
    if (remainingUsers !== 1) {
      throw new Error(`Transaction assertion failed: Expected exactly 1 User, found ${remainingUsers}`);
    }

    const remainingStaff = await tx.staff.count();
    if (remainingStaff !== 1) {
      throw new Error(`Transaction assertion failed: Expected exactly 1 Staff, found ${remainingStaff}`);
    }
  }, { timeout: 60000 });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Transaction committed successfully on Render in ${duration}s.\n`);

  // 4. POST-RESET VERIFICATION
  console.log('----------------------------------------------------');
  console.log('         POST-RESET VERIFICATION (RENDER)           ');
  console.log('----------------------------------------------------');

  const finalUsers = await prisma.user.findMany({ select: { id: true, username: true, role: true, staffId: true, passwordHash: true } });
  const finalStaff = await prisma.staff.findMany({ select: { id: true, name: true, role: true, status: true, attendance: true } });

  console.log('Surviving User  :', finalUsers.map(u => ({ id: u.id, username: u.username, role: u.role, staffId: u.staffId })));
  console.log('Surviving Staff :', finalStaff);

  const postCounts = {
    patients: await prisma.patient.count(),
    visits: await prisma.visit.count(),
    appointments: await prisma.appointment.count(),
    consultations: await prisma.consultation.count(),
    queueEntries: await prisma.queueEntry.count(),
    payments: await prisma.payment.count(),
    treatmentPlans: await prisma.treatmentPlan.count(),
    treatmentPlanItems: await prisma.treatmentPlanItem.count(),
    prescriptions: await prisma.prescription.count(),
    prescriptionItems: await prisma.prescriptionItem.count(),
    dispensings: await prisma.dispensing.count(),
    dispensingItems: await prisma.dispensingItem.count(),
    suppliers: await prisma.supplier.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    supplierBills: await prisma.supplierBill.count(),
    supplierPayments: await prisma.supplierPayment.count(),
    stockMovements: await prisma.stockMovement.count(),
    medicines: await prisma.medicine.count(),
    treatmentCatalog: await prisma.treatmentCatalog.count(),
    medicineCategory: await prisma.medicineCategory.count(),
  };

  const finalMigrations = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM "_prisma_migrations"`;
  const finalMigrationCount = Number(finalMigrations[0]?.count ?? 0);

  // Assertions
  const userValid =
    finalUsers.length === 1 &&
    finalUsers[0].id === initialUserId &&
    finalUsers[0].username === initialUsername &&
    finalUsers[0].role === initialRole &&
    finalUsers[0].staffId === preservedStaffId &&
    finalUsers[0].passwordHash === initialPasswordHash;

  const staffValid =
    finalStaff.length === 1 &&
    finalStaff[0].id === preservedStaffId &&
    finalStaff[0].status === 'Active' &&
    finalStaff[0].attendance === 'Present';

  const catalogValid = postCounts.treatmentCatalog === 26;
  const categoriesValid = postCounts.medicineCategory === 3;
  const migrationsValid = finalMigrationCount === 3;

  const allOperationalZero = Object.entries(postCounts)
    .filter(([key]) => key !== 'treatmentCatalog' && key !== 'medicineCategory')
    .every(([, count]) => count === 0);

  console.log('\nVerification Checklist:');
  console.log(`  [${userValid ? 'PASS' : 'FAIL'}] Exactly 1 User (headdoctor) with intact ID, credentials & role`);
  console.log(`  [${staffValid ? 'PASS' : 'FAIL'}] Exactly 1 Staff (linked, Active, Present) preserved`);
  console.log(`  [${catalogValid ? 'PASS' : 'FAIL'}] TreatmentCatalog preserved (exactly 26 procedures)`);
  console.log(`  [${categoriesValid ? 'PASS' : 'FAIL'}] MedicineCategory preserved (exactly 3 categories)`);
  console.log(`  [${allOperationalZero ? 'PASS' : 'FAIL'}] All 18 operational/demo tables wiped to 0`);
  console.log(`  [${migrationsValid ? 'PASS' : 'FAIL'}] _prisma_migrations intact (exactly ${finalMigrationCount} records)`);

  if (!userValid || !staffValid || !catalogValid || !categoriesValid || !allOperationalZero || !migrationsValid) {
    console.error('\nPOST-RESET VERIFICATION FAILED: Inconsistency detected on Render.');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('   RENDER DATABASE IS CLEAN AND READY FOR IMPORT    ');
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
