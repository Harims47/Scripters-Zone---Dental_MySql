const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function cleanup() {
  console.log('Starting Phase 9 E2E test data cleanup...');

  // 1. Get initial counts
  const beforeCounts = {
    patient: await prisma.patient.count(),
    visit: await prisma.visit.count(),
    queueEntry: await prisma.queueEntry.count(),
    appointment: await prisma.appointment.count(),
    consultation: await prisma.consultation.count(),
    prescription: await prisma.prescription.count(),
    prescriptionItem: await prisma.prescriptionItem.count(),
    treatmentPlan: await prisma.treatmentPlan.count(),
    treatmentPlanItem: await prisma.treatmentPlanItem.count(),
    payment: await prisma.payment.count(),
    dispensing: await prisma.dispensing.count(),
    dispensingItem: await prisma.dispensingItem.count(),
  };

  console.log('Before cleanup:', beforeCounts);

  // 2. Perform deletions in the correct order to respect foreign key constraints
  try {
    // Delete transactional dependencies of Visit/Patient first
    await prisma.payment.deleteMany({});
    
    await prisma.dispensingItem.deleteMany({});
    await prisma.dispensing.deleteMany({});
    
    await prisma.prescriptionItem.deleteMany({});
    await prisma.prescription.deleteMany({});
    
    await prisma.queueEntry.deleteMany({});
    await prisma.consultation.deleteMany({});
    
    await prisma.treatmentPlanItem.deleteMany({});
    await prisma.treatmentPlan.deleteMany({});

    // Delete Visits (depends on Appointments/Patients)
    await prisma.visit.deleteMany({});
    
    // Delete Appointments
    await prisma.appointment.deleteMany({});

    // Finally, delete Patients
    await prisma.patient.deleteMany({});

    console.log('Successfully cleared all patient and transaction data.');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }

  // 3. Verify counts after cleanup
  const afterCounts = {
    patient: await prisma.patient.count(),
    visit: await prisma.visit.count(),
    queueEntry: await prisma.queueEntry.count(),
    appointment: await prisma.appointment.count(),
    consultation: await prisma.consultation.count(),
    prescription: await prisma.prescription.count(),
    prescriptionItem: await prisma.prescriptionItem.count(),
    treatmentPlan: await prisma.treatmentPlan.count(),
    treatmentPlanItem: await prisma.treatmentPlanItem.count(),
    payment: await prisma.payment.count(),
    dispensing: await prisma.dispensing.count(),
    dispensingItem: await prisma.dispensingItem.count(),
  };

  console.log('After cleanup:', afterCounts);
  
  // Verify master data is intact
  const masterCounts = {
    staff: await prisma.staff.count(),
    users: await prisma.user.count(),
    medicines: await prisma.medicine.count(),
    treatmentCatalog: await prisma.treatmentCatalog.count()
  };
  
  console.log('Master data preserved:', masterCounts);
}

cleanup()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
