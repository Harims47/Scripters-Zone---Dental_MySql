const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const payment = await prisma.payment.create({
      data: {
        visitId: 'f0f73f7c-3f41-48f8-b4b3-3a1b02316e6d', // some dummy UUID
        patientId: 'f0f73f7c-3f41-48f8-b4b3-3a1b02316e6d', // dummy UUID
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
