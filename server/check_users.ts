import { prisma } from './src/db';

async function main() {
  const cats = await prisma.medicineCategory.findMany();
  console.log('CATEGORIES:', cats.map(c => ({ id: c.id, name: c.name })));
}

main().finally(() => prisma.$disconnect());
