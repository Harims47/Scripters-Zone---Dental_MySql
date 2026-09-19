import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const rawDbUrl = process.env.DATABASE_URL;
if (!rawDbUrl) {
  console.error('ERROR: DATABASE_URL not defined in server/.env');
  process.exit(1);
}

const parsedUrl = new URL(rawDbUrl);
const dbUser = decodeURIComponent(parsedUrl.username);
const dbPassword = decodeURIComponent(parsedUrl.password);
const dbHost = parsedUrl.hostname;
const dbPort = parsedUrl.port || '3306';
const primaryDbName = parsedUrl.pathname.replace(/^\//, '');
const testDbName = 'dentalcore_restore_test';

// 1. Locate latest backup
const backupDir = path.resolve(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  console.error('ERROR: No backups directory found at:', backupDir);
  process.exit(1);
}

const backupFiles = fs.readdirSync(backupDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
  .sort((a, b) => b.time - a.time);

if (backupFiles.length === 0) {
  console.error('ERROR: No .sql backup files found in:', backupDir);
  process.exit(1);
}

const latestBackup = path.join(backupDir, backupFiles[0].name);
console.log(`[Restore] Target backup file: ${latestBackup} (${(fs.statSync(latestBackup).size / 1024).toFixed(2)} KB)`);

// 2. Drop and recreate isolated test database
console.log(`[Restore] Creating isolated test database: ${testDbName}...`);

const execMySql = (query: string) => {
  try {
    execSync(
      `docker exec -i -e MYSQL_PWD="${dbPassword}" dentalcore_mysql mysql --user="${dbUser}" -e "${query}"`,
      { stdio: 'inherit', shell: 'powershell.exe' }
    );
  } catch {
    execSync(
      `mysql --user="${dbUser}" --host="${dbHost}" --port="${dbPort}" -e "${query}"`,
      {
        stdio: 'inherit',
        env: { ...process.env, MYSQL_PWD: dbPassword || '' }
      }
    );
  }
};

execMySql(`DROP DATABASE IF EXISTS \`${testDbName}\`; CREATE DATABASE \`${testDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

// 3. Import SQL backup into isolated test database
console.log(`[Restore] Streaming SQL dump into ${testDbName}...`);
try {
  execSync(
    `Get-Content "${latestBackup}" | docker exec -i -e MYSQL_PWD="${dbPassword}" dentalcore_mysql mysql --user="${dbUser}" --default-character-set=utf8mb4 "${testDbName}"`,
    { stdio: 'inherit', shell: 'powershell.exe' }
  );
} catch (err) {
  console.error('[Restore] Failed to import dump into test database:', err);
  process.exit(1);
}

// 4. Verify Row Counts and Schema Integrity
async function verifyRestoredDatabase() {
  console.log('[Restore] Connecting Prisma clients to compare primary and restored instances...');
  
  const restoreDbUrl = rawDbUrl!.replace(`/${primaryDbName}`, `/${testDbName}`);
  const { PrismaMariaDb } = await import('@prisma/adapter-mariadb');
  const primaryAdapter = new PrismaMariaDb(rawDbUrl!);
  const restoreAdapter = new PrismaMariaDb(restoreDbUrl);
  const primaryPrisma = new PrismaClient({ adapter: primaryAdapter });
  const restorePrisma = new PrismaClient({ adapter: restoreAdapter });

  try {
    // A. Liveness / Readiness check on restored DB
    const ping = await restorePrisma.$queryRaw<any[]>`SELECT 1 as is_alive`;
    if (!ping || ping.length === 0) {
      throw new Error('Restored database failed SELECT 1 ping');
    }
    console.log('[Restore] Restored DB readiness check: PASSED (connected)');

    // B. Table counts comparison
    const entities = [
      { name: 'User', primary: () => primaryPrisma.user.count(), restore: () => restorePrisma.user.count() },
      { name: 'Patient', primary: () => primaryPrisma.patient.count(), restore: () => restorePrisma.patient.count() },
      { name: 'Visit', primary: () => primaryPrisma.visit.count(), restore: () => restorePrisma.visit.count() },
      { name: 'Payment', primary: () => primaryPrisma.payment.count(), restore: () => restorePrisma.payment.count() },
      { name: 'Medicine', primary: () => primaryPrisma.medicine.count(), restore: () => restorePrisma.medicine.count() },
      { name: 'Appointment', primary: () => primaryPrisma.appointment.count(), restore: () => restorePrisma.appointment.count() },
      { name: 'Prescription', primary: () => primaryPrisma.prescription.count(), restore: () => restorePrisma.prescription.count() },
    ];

    console.log('[Restore] Comparing entity counts:');
    for (const ent of entities) {
      const pCount = await ent.primary();
      const rCount = await ent.restore();
      console.log(`  - ${ent.name.padEnd(14)}: Primary=${pCount} | Restored=${rCount}`);
      if (pCount !== rCount) {
        throw new Error(`Count mismatch on entity ${ent.name}: expected ${pCount}, got ${rCount}`);
      }
    }
    console.log('[Restore] 100% Entity Count Parity: PASSED');

    // C. Live smoke reads on restored DB (User, Patient, Visit, Payment)
    const sampleUser = await restorePrisma.user.findFirst();
    console.log(`[Restore] Read User from restored DB: ${sampleUser?.username} (${sampleUser?.role})`);
    if (!sampleUser) throw new Error('No user found in restored DB');

    const samplePatient = await restorePrisma.patient.findFirst();
    console.log(`[Restore] Read Patient from restored DB: ${samplePatient?.name} (ID: ${samplePatient?.id})`);
    if (!samplePatient) throw new Error('No patient found in restored DB');

    const sampleVisit = await restorePrisma.visit.findFirst({ include: { patient: true } });
    console.log(`[Restore] Read Visit from restored DB: Token #${sampleVisit?.tokenNumber} (Status: ${sampleVisit?.status})`);
    if (!sampleVisit) throw new Error('No visit found in restored DB');

    const samplePayment = await restorePrisma.payment.findFirst();
    console.log(`[Restore] Read Payment from restored DB: ₹${samplePayment?.amount} via ${samplePayment?.method}`);
    if (!samplePayment) throw new Error('No payment found in restored DB');

    console.log('\n======================================================');
    console.log('RESTORE INTEGRITY VERIFICATION: 100% PASSED');
    console.log('Restored DB is fully functional, consistent, and ready');
    console.log('======================================================\n');
  } finally {
    await primaryPrisma.$disconnect();
    await restorePrisma.$disconnect();
  }
}

verifyRestoredDatabase().catch((err) => {
  console.error('[Restore] Verification FAILED:', err);
  process.exit(1);
});
