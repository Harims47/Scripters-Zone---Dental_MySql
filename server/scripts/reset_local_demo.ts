import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 1. Target Environment Resolution
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const rawDbUrl = process.env.DATABASE_URL;
if (!rawDbUrl) {
  console.error('CRITICAL SAFETY ERROR: DATABASE_URL is not defined in server/.env');
  process.exit(1);
}

// 2. Exact Database Target Safety Checks
const parsedUrl = new URL(rawDbUrl);
const hostname = parsedUrl.hostname;
const port = parsedUrl.port;
const dbName = parsedUrl.pathname.replace(/^\//, '');

console.log('====================================================');
console.log('       DENTALCORE LOCAL DEMO RESET UTILITY          ');
console.log('====================================================');
console.log('Target database configuration:');
console.log(`  Hostname : ${hostname}`);
console.log(`  Port     : ${port}`);
console.log(`  Database : ${dbName}`);

const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
const isLocalPort = port === '5433';
const isLocalDb = dbName === 'dentalcore';

if (!isLocalHost || !isLocalPort || !isLocalDb) {
  console.error('\nSAFETY VIOLATION: Target database does NOT match local Docker database!');
  console.error('Expected: localhost:5433/dentalcore');
  console.error(`Received: ${hostname}:${port}/${dbName}`);
  console.error('This script refuses to run against unexpected targets. Execution aborted.');
  process.exit(1);
}

if (process.env.RENDER_DATABASE_URL || rawDbUrl.includes('render.com') || rawDbUrl.includes('oregon-postgres')) {
  console.error('\nSAFETY VIOLATION: External/Render connection detected.');
  console.error('This script must NEVER connect to or target Render. Execution aborted.');
  process.exit(1);
}

console.log('Target Verified: Local Docker PostgreSQL database (dentalcore on port 5433).\n');

// 3. Setup Prisma Client
const pool = new Pool({ connectionString: rawDbUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 4. Backup Handler
function performBackup(backupFilePath: string): void {
  if (fs.existsSync(backupFilePath)) {
    console.error(`\nSAFETY ERROR: Backup file already exists at:\n  ${backupFilePath}`);
    console.error('Refusing to overwrite existing backup. Execution halted.');
    process.exit(1);
  }

  const backupDir = path.dirname(backupFilePath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`Creating pre-reset PostgreSQL backup...`);
  console.log(`Destination: ${backupFilePath}`);

  let backupSuccessful = false;

  // Primary Method: Docker pg_dump from local container
  try {
    const dumpBuffer = execSync('docker exec dentalcore_db pg_dump -U dental --data-only --format=plain dentalcore', {
      maxBuffer: 100 * 1024 * 1024
    });
    fs.writeFileSync(backupFilePath, dumpBuffer);
    if (fs.existsSync(backupFilePath) && fs.statSync(backupFilePath).size > 0) {
      backupSuccessful = true;
    }
  } catch (err) {
    console.warn('Notice: Docker direct dump unavailable or container busy, trying host pg_dump...');
  }

  // Fallback Method: Host pg_dump
  if (!backupSuccessful) {
    const cleanUrl = parsedUrl.origin + parsedUrl.pathname;
    const candidates = [
      'pg_dump',
      'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe'
    ];

    let hostDump = 'pg_dump';
    for (const cand of candidates) {
      if (cand === 'pg_dump') {
        try {
          execSync('pg_dump --version', { stdio: 'ignore' });
          hostDump = 'pg_dump';
          break;
        } catch {}
      } else if (fs.existsSync(cand)) {
        hostDump = `"${cand}"`;
        break;
      }
    }

    try {
      execSync(`${hostDump} --dbname="${cleanUrl}" --data-only --format=plain --file="${backupFilePath}"`, {
        stdio: 'inherit'
      });
      if (fs.existsSync(backupFilePath) && fs.statSync(backupFilePath).size > 0) {
        backupSuccessful = true;
      }
    } catch (hostErr) {
      console.error('Host pg_dump failed:', hostErr);
    }
  }

  if (!backupSuccessful || !fs.existsSync(backupFilePath) || fs.statSync(backupFilePath).size === 0) {
    console.error('\nCRITICAL BACKUP FAILURE: Could not create a valid backup file.');
    if (fs.existsSync(backupFilePath) && fs.statSync(backupFilePath).size === 0) {
      fs.unlinkSync(backupFilePath);
    }
    console.error('Reset aborted before any modifications took place.');
    process.exit(1);
  }

  const stats = fs.statSync(backupFilePath);
  console.log(`Backup completed successfully! Size: ${(stats.size / 1024).toFixed(2)} KB\n`);
}

// 5. Main Execution Flow
async function main() {
  const isConfirmed = process.env.CONFIRM_LOCAL_DEMO_RESET === 'true';

  // Fetch initial counts
  const headUser = await prisma.user.findUnique({
    where: { username: 'headdoctor' },
    include: { staff: true }
  });

  if (!headUser) {
    console.error('SAFETY ERROR: Head Doctor account (username: "headdoctor") does not exist in this database.');
    console.error('Cannot proceed with reset. Execution aborted.');
    process.exit(1);
  }

  if (!headUser.staffId || !headUser.staff) {
    console.error('SAFETY ERROR: Head Doctor account exists but has no linked Staff record.');
    console.error('Cannot proceed with reset. Execution aborted.');
    process.exit(1);
  }

  const headStaffId = headUser.staffId;

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

  const allUsers = await prisma.user.findMany({ select: { username: true, role: true } });
  const allStaff = await prisma.staff.findMany({ select: { id: true, name: true, role: true } });

  // PREVIEW / DRY-RUN OUTPUT
  console.log('----------------------------------------------------');
  console.log('              CURRENT DATABASE INVENTORY            ');
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
  console.log(`[PRESERVED] User             : ${headUser.username} (ID: ${headUser.id})`);
  console.log(`[PRESERVED] Staff            : ${headUser.staff?.name} (ID: ${headStaffId})`);
  console.log(`[PRESERVED] TreatmentCatalog : ${counts.treatmentCatalog} clinical procedures`);
  console.log(`[PRESERVED] MedicineCategory : ${counts.medicineCategory} categories`);
  console.log(`[PRESERVED] _prisma_migrations: ${migrationCount} applied migrations`);
  console.log('----------------------------------------------------');

  if (!isConfirmed) {
    console.log('\n>>> DRY-RUN / PREVIEW MODE ACTIVE <<<');
    console.log('CONFIRM_LOCAL_DEMO_RESET is NOT set to "true".');
    console.log('NO RECORDS WERE MODIFIED OR DELETED.\n');
    console.log('To execute the backup and actual destructive reset, run:');
    console.log('  $env:CONFIRM_LOCAL_DEMO_RESET="true"; npx tsx scripts/reset_local_demo.ts\n');
    return;
  }

  // CONFIRMED EXECUTION
  console.log('\nCONFIRM_LOCAL_DEMO_RESET="true" detected.');
  console.log('Proceeding with backup and atomic deletion...\n');

  // Step 1: Backup
  const rootDir = path.resolve(__dirname, '../../');
  const backupPath = path.join(rootDir, 'backups', 'dentalcore_before_local_clean_reset_20260911.sql');
  performBackup(backupPath);

  // Step 2: Atomic Transaction Deletion
  console.log('Executing transactional deletion in dependency order...');
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
      where: { id: { not: headStaffId } }
    });

    // 6. Normalize Head Doctor Staff Record
    await tx.staff.update({
      where: { id: headStaffId },
      data: {
        status: 'Active',
        attendance: 'Present'
      }
    });

    // Internal transaction assertions
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
  console.log(`Transaction committed successfully in ${duration}s.\n`);

  // Step 3: Post-Reset Verification
  console.log('----------------------------------------------------');
  console.log('              POST-RESET AUDIT VERIFICATION         ');
  console.log('----------------------------------------------------');

  const finalUsers = await prisma.user.findMany({ select: { id: true, username: true, role: true, staffId: true } });
  const finalStaff = await prisma.staff.findMany({ select: { id: true, name: true, role: true, status: true, attendance: true } });

  console.log('Surviving User  :', finalUsers);
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
  const userValid = finalUsers.length === 1 && finalUsers[0].username === 'headdoctor' && finalUsers[0].staffId === headStaffId;
  const staffValid = finalStaff.length === 1 && finalStaff[0].id === headStaffId && finalStaff[0].status === 'Active' && finalStaff[0].attendance === 'Present';
  const catalogValid = postCounts.treatmentCatalog > 0;
  const categoriesValid = postCounts.medicineCategory > 0;
  const migrationsValid = finalMigrationCount === migrationCount;

  const allOperationalZero = Object.entries(postCounts)
    .filter(([key]) => key !== 'treatmentCatalog' && key !== 'medicineCategory')
    .every(([, count]) => count === 0);

  console.log('\nVerification Checklist:');
  console.log(`  [${userValid ? 'PASS' : 'FAIL'}] Exactly 1 User (headdoctor) preserved`);
  console.log(`  [${staffValid ? 'PASS' : 'FAIL'}] Exactly 1 Staff (linked, Active, Present) preserved`);
  console.log(`  [${catalogValid ? 'PASS' : 'FAIL'}] TreatmentCatalog preserved (${postCounts.treatmentCatalog} procedures)`);
  console.log(`  [${categoriesValid ? 'PASS' : 'FAIL'}] MedicineCategory preserved (${postCounts.medicineCategory} categories)`);
  console.log(`  [${allOperationalZero ? 'PASS' : 'FAIL'}] All 18 operational/demo tables wiped to 0`);
  console.log(`  [${migrationsValid ? 'PASS' : 'FAIL'}] _prisma_migrations intact (${finalMigrationCount} records)`);

  if (!userValid || !staffValid || !catalogValid || !categoriesValid || !allOperationalZero || !migrationsValid) {
    console.error('\nPOST-RESET VERIFICATION FAILED: An inconsistency was detected.');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('  CLEAN LOCAL DEMO DATABASE IS READY FOR PRODUCTION ');
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
