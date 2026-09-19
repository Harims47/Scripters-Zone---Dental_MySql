import { prisma } from './src/db';

async function testConcurrency() {
  console.log('Setting up mock data...');
  const patient = await prisma.patient.create({
    data: {
      name: 'Concurrent Test Patient',
      phone: `99${Math.floor(Math.random() * 100000000)}`,
      age: 30,
      gender: 'Male',
      status: 'Active',
    }
  });

  const visit = await prisma.visit.create({
    data: {
      patientId: patient.id,
      status: 'READY_FOR_PAYMENT',
      amountDue: 100,
    }
  });

  console.log(`Created visit ${visit.id} with amountDue 100.`);

  const createPaymentFn = async (amount: number, methodName: string) => {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock Row
      await tx.$executeRaw`SELECT 1 FROM \`Visit\` WHERE id = ${visit.id} FOR UPDATE`;

      // 2. Read state
      const v = await tx.visit.findUnique({
        where: { id: visit.id },
        include: { payments: true }
      });

      const totalPaid = v!.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = v!.amountDue - totalPaid;

      if (balance <= 0) {
        throw new Error(`[${methodName}] Payment already completed.`);
      }

      if (amount > balance) {
        throw new Error(`[${methodName}] Payment amount (${amount}) exceeds remaining balance (${balance}).`);
      }

      // 3. Create payment
      const payment = await tx.payment.create({
        data: {
          visitId: visit.id,
          patientId: patient.id,
          amount,
          method: methodName,
          status: 'Completed',
          date: new Date().toISOString()
        }
      });

      // 4. Update visit status if fully paid
      const newBalance = balance - amount;
      if (newBalance === 0) {
        await tx.visit.update({
          where: { id: visit.id },
          data: { status: 'COMPLETED' }
        });
      }

      return payment;
    });
  };

  console.log('Attempting two simultaneous payments of 100...');
  
  try {
    const results = await Promise.allSettled([
      createPaymentFn(100, 'Request A (Cash)'),
      createPaymentFn(100, 'Request B (GPay)'),
    ]);

    console.log('Results:');
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        console.log(`Request ${idx + 1} Succeeded: Added ${res.value.amount} via ${res.value.method}`);
      } else {
        console.log(`Request ${idx + 1} Failed: ${res.reason.message}`);
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
  }

  // Verify Final State
  const finalVisit = await prisma.visit.findUnique({
    where: { id: visit.id },
    include: { payments: true }
  });

  console.log('\n--- Final State ---');
  console.log('Visit Status:', finalVisit?.status);
  console.log('Total Payments Count:', finalVisit?.payments.length);
  const total = finalVisit?.payments.reduce((s,p) => s + p.amount, 0);
  console.log('Total Paid:', total);

  // Cleanup
  await prisma.payment.deleteMany({ where: { patientId: patient.id } });
  await prisma.visit.delete({ where: { id: visit.id } });
  await prisma.patient.delete({ where: { id: patient.id } });
  
  await prisma.$disconnect();
}

testConcurrency().catch(console.error);
