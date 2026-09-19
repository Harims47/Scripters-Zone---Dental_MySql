const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
