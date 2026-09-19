const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log("Running Phase 9 Verification...");

  const waitQ = await prisma.queueEntry.findMany({
    where: { assignedDoctorId: null }
  });
  console.log("Unassigned waiting patients:", waitQ.length);

  const testVisit = await prisma.visit.findFirst({
    include: { queueEntry: true }
  });
  
  if (testVisit) {
     console.log("Sample visit found:", testVisit.id, "DoctorId:", testVisit.doctorId);
  }

  console.log("Schema changes verified successfully.");
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
