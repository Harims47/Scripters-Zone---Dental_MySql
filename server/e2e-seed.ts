import dotenv from 'dotenv';
dotenv.config();
import { prisma } from './src/db';

async function seed() {
  console.log('Seeding E2E test data...');

  await prisma.dispensingItem.deleteMany();
  await prisma.dispensing.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.queueEntry.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany({ where: { name: { startsWith: 'Patient ' } }});
  await prisma.medicine.deleteMany({ where: { name: { startsWith: 'Extra Med' } }});

  // Create 15 patients
  const patientData = Array.from({ length: 15 }).map((_, i) => ({
    name: `Patient ${i + 1}`,
    phone: `555000${i.toString().padStart(3, '0')}`,
    age: 30 + i,
    gender: 'Male'
  }));
  await prisma.patient.createMany({ data: patientData });
  const patients = await prisma.patient.findMany({ orderBy: { createdAt: 'desc' } });

  // Create 15 appointments
  const doctor = await prisma.staff.findFirst({ where: { role: 'Head Doctor' } });
  if (!doctor) throw new Error("Doctor not found in seed");

  const appointmentData = patients.map((p, i) => ({
    patientId: p.id,
    providerId: doctor.id,
    date: new Date().toISOString().split('T')[0],
    time: `${10 + (i % 8)}:00 AM`,
    type: 'General Checkup',
    status: 'Scheduled',
    notes: ''
  }));
  await prisma.appointment.createMany({ data: appointmentData });

  // Create 15 visits (READY_FOR_PAYMENT)
  for (let i = 0; i < 15; i++) {
    const p = patients[i];
    const visit = await prisma.visit.create({
      data: {
        patientId: p.id,
        doctorId: doctor.id,
        status: 'READY_FOR_PAYMENT',
        amountDue: 1000 + i,
        reasonForVisit: 'Test'
      }
    });
    // Prescription
    const prescription = await prisma.prescription.create({
      data: {
        visit: { connect: { id: visit.id } },
        doctorId: doctor.id,
        notes: 'Test Prescription'
      }
    });

    // Dispensing
    await prisma.dispensing.create({
      data: {
        visit: { connect: { id: visit.id } },
        prescription: { connect: { id: prescription.id } },
        status: 'Completed'
      }
    });
  }

  // Insert extra inventory items to exceed 10
  const extraMeds = Array.from({ length: 15 }).map((_, i) => ({
    name: `Extra Med ${i + 1}`,
    categoryId: 'cat1',
    currentStock: 100 + i,
    stockWarningLevel: 10,
    unit: 'Tablets',
    form: 'Tablet',
    unitPrice: 10
  }));
  await prisma.medicine.createMany({ data: extraMeds });
  
  console.log('E2E seeding done.');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
