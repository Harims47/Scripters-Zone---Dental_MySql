const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Simulating 2 more visits...');
  
  const staff = await prisma.staff.findFirst();
  const medicines = await prisma.medicine.findMany({ take: 2 });
  
  // Patient 2
  let p2 = await prisma.patient.findUnique({ where: { phone: '1234567890' } });
  if (!p2) {
    p2 = await prisma.patient.create({
      data: {
        name: 'Jane Doe Simulator',
        phone: '1234567890',
        gender: 'Female',
        age: 28,
        status: 'Active'
      }
    });
  }

  const v2 = await prisma.visit.create({
    data: {
      patientId: p2.id,
      doctorId: staff.id,
      status: 'READY_FOR_PAYMENT',
      amountDue: 1800
    }
  });

  await prisma.prescription.create({
    data: {
      visitId: v2.id,
      doctorId: staff.id,
      notes: 'Take before sleep',
      items: {
        create: [
          {
            medicineId: medicines[0].id,
            dosage: '0-0-1',
            duration: '3 days',
            instructions: 'Before meals',
            quantity: 3
          }
        ]
      }
    }
  });

  // Patient 3
  let p3 = await prisma.patient.findUnique({ where: { phone: '0987654321' } });
  if (!p3) {
    p3 = await prisma.patient.create({
      data: {
        name: 'Bob Simulator',
        phone: '0987654321',
        gender: 'Male',
        age: 45,
        status: 'Active'
      }
    });
  }

  const v3 = await prisma.visit.create({
    data: {
      patientId: p3.id,
      doctorId: staff.id,
      status: 'READY_FOR_PAYMENT',
      amountDue: 3500
    }
  });

  await prisma.prescription.create({
    data: {
      visitId: v3.id,
      doctorId: staff.id,
      notes: 'Painkiller',
      items: {
        create: [
          {
            medicineId: medicines[1] ? medicines[1].id : medicines[0].id,
            dosage: '1-1-1',
            duration: '7 days',
            instructions: 'After meals',
            quantity: 21
          }
        ]
      }
    }
  });

  console.log('Simulation complete! Added 2 more records.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
