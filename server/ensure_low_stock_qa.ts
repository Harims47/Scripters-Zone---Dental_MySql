import { prisma } from './src/db';

async function main() {
  const cat = await prisma.medicineCategory.findFirst();
  if (!cat) {
    console.error('No category found');
    return;
  }
  const existing = await prisma.medicine.findFirst({ where: { name: 'QA-R2-Medicine-LowStock' } });
  if (!existing) {
    const med = await prisma.medicine.create({
      data: {
        name: 'QA-R2-Medicine-LowStock',
        genericName: 'QA Low Stock Test',
        categoryId: cat.id,
        form: 'Tablet',
        unit: 'Strip',
        currentStock: 3,
        stockWarningLevel: 10,
        unitPrice: 25.0,
        status: 'Active'
      }
    });
    console.log('Created low-stock QA medicine:', med.id);
  } else {
    await prisma.medicine.update({
      where: { id: existing.id },
      data: { currentStock: 3, stockWarningLevel: 10, status: 'Active' }
    });
    console.log('Updated low-stock QA medicine:', existing.id);
  }
}

main().finally(() => prisma.$disconnect());
