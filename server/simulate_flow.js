const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function simulateFlow() {
  console.log('Simulating end-to-end patient workflow data...');

  const doctors = await prisma.staff.findMany({
    where: { role: { in: ['Head Doctor', 'Duty Doctor'] } }
  });
  
  if (doctors.length === 0) {
    console.error('No doctors found in the database. Please run seed script first.');
    process.exit(1);
  }

  const doctor = doctors[0];
  const medicines = await prisma.medicine.findMany({ take: 2 });

  const createPatient = async (name, phone) => {
    let p = await prisma.patient.findUnique({ where: { phone } });
    if (!p) {
      p = await prisma.patient.create({
        data: { name, phone, gender: 'Male', age: 35, status: 'Active' }
      });
    }
    return p;
  };

  // 1. Walk-in Patient -> WAITING (Unassigned)
  const p1 = await createPatient('Alice Walkin', '9999000001');
  await prisma.visit.create({
    data: {
      patientId: p1.id,
      doctorId: null,
      status: 'WAITING',
      amountDue: 500,
      queueEntry: {
        create: {
          patientId: p1.id,
          assignedDoctorId: null,
          status: 'Waiting',
          arrivalTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          position: 101,
          priority: false
        }
      }
    }
  });

  // 2. Appointment Patient -> Checked In -> WAITING (Unassigned)
  const p2 = await createPatient('Bob Appointment', '9999000002');
  const appt = await prisma.appointment.create({
    data: {
      patientId: p2.id,
      date: new Date().toISOString().split('T')[0],
      time: '14:30',
      type: 'Consultation',
      status: 'Checked In'
    }
  });
  await prisma.visit.create({
    data: {
      patientId: p2.id,
      doctorId: null,
      appointmentId: appt.id,
      status: 'WAITING',
      amountDue: 500,
      queueEntry: {
        create: {
          patientId: p2.id,
          assignedDoctorId: null,
          status: 'Waiting',
          arrivalTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          position: 102,
          priority: false
        }
      }
    }
  });

  // 3. With Doctor Patient (In Progress)
  const p3 = await createPatient('Charlie Engaged', '9999000003');
  await prisma.visit.create({
    data: {
      patientId: p3.id,
      doctorId: doctor.id,
      status: 'WITH_DOCTOR',
      amountDue: 1500,
      queueEntry: {
        create: {
          patientId: p3.id,
          assignedDoctorId: doctor.id,
          status: 'In Progress',
          arrivalTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          position: 103,
          priority: true
        }
      }
    }
  });

  // 4. Ready at Reception (Dispensing/Payment phase)
  const p4 = await createPatient('Diana Checkout', '9999000004');
  const v4 = await prisma.visit.create({
    data: {
      patientId: p4.id,
      doctorId: doctor.id,
      status: 'READY_FOR_RECEPTION',
      amountDue: 2500,
      queueEntry: {
        create: {
          patientId: p4.id,
          assignedDoctorId: doctor.id,
          status: 'Dispensing', // Maps to Ready at Reception
          arrivalTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          position: 104,
          priority: false
        }
      }
    }
  });
  
  if (medicines.length > 0) {
    await prisma.prescription.create({
      data: {
        visitId: v4.id,
        doctorId: doctor.id,
        status: 'Finalized',
        notes: 'Take with food',
        items: {
          create: [
            {
              medicineId: medicines[0].id,
              dosage: '1-0-1',
              duration: '5 days',
              instructions: 'After meals',
              quantity: 10
            }
          ]
        }
      }
    });
  }

  console.log('Successfully generated simulation data!');
}

simulateFlow().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
