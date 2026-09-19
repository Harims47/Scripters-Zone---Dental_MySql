import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function check(name: string, url: string) {
  console.log(`\n=== CHECKING ${name} ===`);
  const pool = new Pool({ connectionString: url, ssl: url.includes('render.com') ? { rejectUnauthorized: false } : undefined });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const patients = await prisma.patient.findMany();
    console.log(`Patients count: ${patients.length}`);
    for (const p of patients) {
      console.log(`  Patient: ${p.id} | ${p.name} | ${p.phone}`);
    }

    const visits = await prisma.visit.findMany({ include: { patient: true } });
    console.log(`Visits count: ${visits.length}`);
    for (const v of visits) {
      console.log(`  Visit: ${v.id} | Patient: ${v.patient?.name} | Status: ${v.status} | amountDue: ${v.amountDue} | consultationFee: ${v.consultationFee} | treatmentFee: ${v.treatmentFee}`);
    }

    const appointments = await prisma.appointment.findMany();
    console.log(`Appointments count: ${appointments.length}`);
    for (const a of appointments) {
      console.log(`  Appointment: ${a.id} | Date: ${a.date} | Status: ${a.status}`);
    }
  } catch (err) {
    console.error(`Error checking ${name}:`, err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  await check('LOCAL DB', 'postgresql://dental:dentalpassword@127.0.0.1:5433/dentalcore?schema=public');
  await check('RENDER DB', 'postgresql://dental:3OP1A78lqXv1Dt6bTqZKVEFHwojqjAk9@dpg-dahssoqjnfac73a1aaa0-a.singapore-postgres.render.com/dentalcore');
}

main();
