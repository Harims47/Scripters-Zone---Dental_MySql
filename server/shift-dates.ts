import { prisma } from './src/db.js';

async function main() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.queueEntry.updateMany({
    data: {
      createdAt: yesterday
    }
  });
  
  await prisma.visit.updateMany({
    data: {
      createdAt: yesterday
    }
  });

  console.log("Successfully shifted all existing queue entries and visits to yesterday!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
