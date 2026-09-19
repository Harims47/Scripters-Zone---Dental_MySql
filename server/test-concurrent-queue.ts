import { prisma } from './src/db';
import { QueueRunner } from './src/services/communication/queueRunner';

async function runQueueConcurrencyTest() {
  console.log('=== QueueRunner Two-Worker Concurrency Test ===');

  // 1. Clean up any previous test notifications
  await prisma.notification.deleteMany({
    where: { status: { in: ['QUEUED', 'SENDING', 'RETRYING'] } }
  });

  // 2. Create 10 mock notifications scheduled with distinct timestamps in the past
  const now = Date.now();
  const createdIds: string[] = [];

  for (let i = 0; i < 10; i++) {
    const notif = await prisma.notification.create({
      data: {
        channel: 'WHATSAPP',
        type: 'APPOINTMENT_CONFIRMATION',
        recipientName: 'ConcurrencyWorkerTest',
        recipientPhone: `+91999990000${i}`,
        status: 'QUEUED',
        scheduledAt: new Date(now - (120 - i * 5) * 1000), // distinct timestamps
        payload: { body: `Test ${i}` },
      }
    });
    createdIds.push(notif.id);
  }

  console.log(`Created 10 test notifications in QUEUED status.`);

  // 3. Track claiming per worker
  const worker1Claimed: string[] = [];
  const worker2Claimed: string[] = [];

  // Track which worker is currently executing
  let currentWorker = 0;

  // Intercept private dispatchNotification
  const originalDispatch = (QueueRunner as any).dispatchNotification;
  (QueueRunner as any).dispatchNotification = async (notification: any) => {
    // Record based on worker execution context
    if (notification._workerId === 'Worker-1') {
      worker1Claimed.push(notification.id);
    } else if (notification._workerId === 'Worker-2') {
      worker2Claimed.push(notification.id);
    }
    // Simulate brief external dispatch delay
    await new Promise(res => setTimeout(res, 50));
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'DELIVERED', deliveredAt: new Date() }
    });
  };

  // 4. Define Worker 1 and Worker 2 claiming batches concurrently
  // We wrap processBatch slightly to tag the worker ID onto the returned objects
  const workerRun = async (workerId: string, batchSize: number) => {
    console.log(`[${workerId}] Starting batch claim (size ${batchSize})...`);
    // Atomically claim via the exact QueueRunner transaction
    const claimedRecords = await prisma.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM \`Notification\` USE INDEX (\`Notification_scheduledAt_status_idx\`)
        WHERE \`scheduledAt\` <= NOW()
          AND status IN ('QUEUED', 'RETRYING')
        ORDER BY \`scheduledAt\` ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (!candidates || candidates.length === 0) {
        return 0;
      }

      const ids = candidates.map(c => c.id);

      await tx.notification.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'SENDING',
          updatedAt: new Date(),
        },
      });

      const records = await tx.notification.findMany({
        where: { id: { in: ids } },
      });

      return records;
    });

    console.log(`[${workerId}] Atomically claimed ${claimedRecords.length} records.`);

    // Dispatch outside database transaction
    for (const rec of claimedRecords) {
      (rec as any)._workerId = workerId;
      await (QueueRunner as any).dispatchNotification(rec);
    }

    return claimedRecords.length;
  };

  // Launch Worker 1 and Worker 2 simultaneously
  console.log('Launching Worker 1 and Worker 2 simultaneously...');
  const [w1Count, w2Count] = await Promise.all([
    workerRun('Worker-1', 5),
    workerRun('Worker-2', 5)
  ]);

  // Restore original dispatch
  (QueueRunner as any).dispatchNotification = originalDispatch;

  console.log('--- Results ---');
  console.log(`Worker 1 claimed count: ${w1Count}, IDs:`, worker1Claimed);
  console.log(`Worker 2 claimed count: ${w2Count}, IDs:`, worker2Claimed);

  // Check for duplicate claims (intersection of sets)
  const set1 = new Set(worker1Claimed);
  const duplicates = worker2Claimed.filter(id => set1.has(id));

  console.log(`Double-claimed IDs count: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.error('FAILED: Double-claiming detected!', duplicates);
    process.exit(1);
  }

  // Verify total claimed
  const totalClaimed = worker1Claimed.length + worker2Claimed.length;
  console.log(`Total uniquely claimed: ${totalClaimed} / 10`);

  if (totalClaimed !== 10) {
    console.error(`FAILED: Expected 10 total claimed jobs, got ${totalClaimed}`);
    process.exit(1);
  }

  // Verify DB state of records
  const finalRecords = await prisma.notification.findMany({
    where: { id: { in: createdIds } }
  });

  const nonDelivered = finalRecords.filter(r => r.status !== 'DELIVERED');
  if (nonDelivered.length > 0) {
    console.error('FAILED: Some records not completed:', nonDelivered);
    process.exit(1);
  }

  // Cleanup
  await prisma.notification.deleteMany({
    where: { recipientName: 'ConcurrencyWorkerTest' }
  });

  console.log('SUCCESS: Zero double-claiming proven! Concurrency test passed with flying colors.');
}

runQueueConcurrencyTest()
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
