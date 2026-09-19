import { prisma } from '../server/src/db';

async function simulateTransferScenario() {
  console.log('=== SIMULATING TRANSFER SCENARIO ===');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log('Today:', today);
  console.log('Tomorrow:', tomorrowStr);

  // 1. Get or create 5 patients for the test
  const testPatients = [];
  for (let i = 1; i <= 5; i++) {
    const phone = `999000000${i}`;
    let p = await prisma.patient.findUnique({ where: { phone } });
    if (!p) {
      p = await prisma.patient.create({
        data: {
          name: `Test Patient ${i}`,
          phone,
          age: 25 + i,
          gender: i % 2 === 0 ? 'Female' : 'Male'
        }
      });
    }
    testPatients.push(p);
  }
  console.log(`Prepared 5 patients:`, testPatients.map(p => p.name));

  // Find a doctor
  const doctor = await prisma.staff.findFirst({ where: { role: { in: ['Duty Doctor', 'Head Doctor'] } } });
  const doctorId = doctor ? doctor.id : null;
  console.log(`Using doctor:`, doctor?.name);

  // Clear any existing active visits/queue entries for these test patients today
  for (const p of testPatients) {
    const activeVisits = await prisma.visit.findMany({ where: { patientId: p.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } } });
    for (const v of activeVisits) {
      await prisma.queueEntry.deleteMany({ where: { visitId: v.id } });
      await prisma.visit.delete({ where: { id: v.id } });
    }
  }

  // 2. Register all 5 patients today as walk-in visits into the queue
  const visits = [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  for (let i = 0; i < 5; i++) {
    const p = testPatients[i];
    const position = i + 1;
    const arrivalTime = `10:0${i} am`;

    const v = await prisma.visit.create({
      data: {
        patientId: p.id,
        doctorId: doctorId,
        status: 'WAITING',
        amountDue: 500,
        reasonForVisit: `Routine Consultation ${i + 1}`,
        queueEntry: {
          create: {
            patientId: p.id,
            assignedDoctorId: doctorId,
            position,
            status: 'Waiting',
            priority: false,
            arrivalTime
          }
        }
      },
      include: { queueEntry: true }
    });
    visits.push(v);
  }
  console.log(`Registered 5 patients into queue with tokens #1 to #5.`);

  // 3. Complete 3 of them (Visits 0, 1, 2)
  for (let i = 0; i < 3; i++) {
    const v = visits[i];
    // Update queue entry to Completed
    await prisma.queueEntry.update({
      where: { visitId: v.id },
      data: { status: 'Completed' }
    });
    // Create consultation
    await prisma.consultation.create({
      data: {
        visitId: v.id,
        doctorId: doctorId!,
        reasonForVisit: v.reasonForVisit || 'Consultation',
        clinicalNotes: 'Treatment completed successfully.',
        consultationFee: 500,
        status: 'Completed'
      }
    });
    // Record payment
    await prisma.payment.create({
      data: {
        visitId: v.id,
        patientId: v.patientId,
        amount: 500,
        method: 'Cash',
        notes: 'Paid in full'
      }
    });
    // Mark visit as COMPLETED
    await prisma.visit.update({
      where: { id: v.id },
      data: { status: 'COMPLETED' }
    });
    console.log(`Completed Patient ${i + 1} (${testPatients[i].name})`);
  }

  // 4. Now 2 patients remain waiting (Visits 3 and 4)
  const remainingVisits = [visits[3], visits[4]];
  console.log(`Remaining 2 patients in queue:`, remainingVisits.map(v => v.id));

  // 5. Transfer remaining 2 patients to tomorrow
  // Call the transfer logic (same as /api/visits/transfer)
  const transferPayload = {
    visitIds: remainingVisits.map(v => v.id),
    targetDate: tomorrowStr,
    reason: 'Doctor emergency leave'
  };

  const transferredAppointments = [];
  for (let i = 0; i < remainingVisits.length; i++) {
    const visit = remainingVisits[i];
    const priorityTime = `09:${String(i * 10).padStart(2, '0')}`;

    const newAppt = await prisma.appointment.create({
      data: {
        patientId: visit.patientId,
        providerId: visit.doctorId,
        date: tomorrowStr,
        time: priorityTime,
        type: visit.reasonForVisit || 'Consultation',
        status: 'Scheduled',
        notes: `[Transferred - Token #${i + 1}] Doctor emergency leave`
      }
    });

    await prisma.visit.update({
      where: { id: visit.id },
      data: {
        status: 'CANCELLED',
        reasonForVisit: `[Transferred to ${tomorrowStr}] ${visit.reasonForVisit || ''}`.trim()
      }
    });

    if (visit.queueEntry) {
      await prisma.queueEntry.update({
        where: { visitId: visit.id },
        data: { status: 'Cancelled' }
      });
    }

    transferredAppointments.push(newAppt);
  }

  console.log('Transferred 2 appointments created for tomorrow:', transferredAppointments.map(a => ({
    id: a.id,
    date: a.date,
    time: a.time,
    notes: a.notes
  })));

  // 6. Inspect what tomorrow's appointments list returns
  const tomorrowAppts = await prisma.appointment.findMany({
    where: { date: tomorrowStr, status: { not: 'Cancelled' } }
  });
  console.log(`Tomorrow's appointments count:`, tomorrowAppts.length);
  tomorrowAppts.forEach((a, idx) => {
    const isPriority = a.notes?.includes('[Transferred');
    const token = isPriority ? `P${idx + 1}` : `${idx + 1}`;
    console.log(`  Token: ${token} | Time: ${a.time} | Notes: ${a.notes}`);
  });

  console.log('=== TEST SIMULATION COMPLETE ===');
}

simulateTransferScenario().catch(console.error).finally(() => prisma.$disconnect());
