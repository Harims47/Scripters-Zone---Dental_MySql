import { prisma } from './src/db';

async function main() {
  try {
    const payment = await prisma.payment.create({
      data: {
        visitId: 'invalid-id',
        patientId: 'invalid-id',
        amount: 245,
        method: 'Cash',
        notes: null,
        status: 'Completed',
        date: new Date().toISOString()
      }
    });
    console.log(payment);
  } catch (e) {
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
