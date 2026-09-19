import { prisma } from './src/db';

async function main() {
  console.log('Cleaning database...');
  await prisma.payment.deleteMany({});
  await prisma.queueEntry.deleteMany({});
  await prisma.dispensingItem.deleteMany({});
  await prisma.dispensing.deleteMany({});
  await prisma.prescriptionItem.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.treatmentPlanItem.deleteMany({});
  await prisma.treatmentPlan.deleteMany({});
  await prisma.visit.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.patient.deleteMany({});
  console.log('Database cleaned successfully! Mock operational data has been wiped.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
