import { prisma } from '../src/db';

async function check() {
  console.log('=== CHECKING RECEPTION DESK DATA IN MYSQL ===');

  const queue = await prisma.queueEntry.findMany({
    include: {
      visit: {
        include: {
          patient: true
        }
      }
    }
  });

  console.log(`\nFound ${queue.length} queue entries:`);
  for (const q of queue) {
    console.log({
      id: q.id,
      position: q.position,
      status: q.status,
      patientId: q.patientId,
      visitId: q.visitId,
      visitPatientId: q.visit?.patientId,
      patientName: q.visit?.patient?.name || 'NULL',
      createdAt: q.createdAt
    });
  }

  const visits = await prisma.visit.findMany({
    include: {
      patient: true
    }
  });
  console.log(`\nFound ${visits.length} visits:`);
  for (const v of visits) {
    console.log({
      id: v.id,
      patientId: v.patientId,
      patientName: v.patient?.name || 'NULL',
      status: v.status,
      createdAt: v.createdAt
    });
  }

  // Check SQL JOIN directly as requested in Section 6
  console.log('\n--- Direct SQL verification ---');
  const sqlCheck: any[] = await prisma.$queryRawUnsafe(`
    SELECT q.id AS queueId, q.position, q.status AS queueStatus, q.patientId AS queuePatientId,
           v.id AS visitId, v.status AS visitStatus, v.patientId AS visitPatientId,
           p.id AS patientId, p.name AS patientName
    FROM QueueEntry q
    LEFT JOIN Visit v ON q.visitId = v.id
    LEFT JOIN Patient p ON q.patientId = p.id
  `);
  console.table(sqlCheck);

  const missingPatientInQueue = sqlCheck.filter(r => !r.patientName);
  if (missingPatientInQueue.length > 0) {
    console.error('❌ Missing patient in QueueEntry:', missingPatientInQueue);
  } else {
    console.log('✅ All QueueEntries successfully join to a valid Patient in MySQL!');
  }

  await prisma.$disconnect();
}

check().catch(console.error);
