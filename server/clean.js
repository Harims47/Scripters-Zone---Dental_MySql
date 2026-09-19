const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Cleaning operational/transactional data...');
  
  // 1. Operational transactions & dispensing
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

  // 2. Inventory movements & purchase orders
  await prisma.stockMovement.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});

  // 3. Reset medicine currentStock to 0 so the user can enter real stock
  await prisma.medicine.updateMany({
    data: { currentStock: 0 }
  });

  // 4. Reset staff attendance
  await prisma.staff.updateMany({
    data: { attendance: 'Present' }
  });

  console.log('Database cleaned successfully! All operational records, visits, patients, payments, movements, and POs wiped.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
