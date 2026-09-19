import { prisma } from './src/db';

async function cleanup() {
  const testPrefix = 'TEST-REP-';
  const patients = await prisma.patient.findMany({
    where: { phone: { startsWith: '999888' } },
    select: { id: true }
  });
  const patientIds = patients.map(p => p.id);

  await prisma.payment.deleteMany({ where: { OR: [{ notes: { startsWith: testPrefix } }, { patientId: { in: patientIds } }] } });
  await prisma.dispensingItem.deleteMany({ where: { dispensing: { visit: { reasonForVisit: { startsWith: testPrefix } } } } });
  await prisma.dispensing.deleteMany({ where: { visit: { reasonForVisit: { startsWith: testPrefix } } } });
  await prisma.prescriptionItem.deleteMany({ where: { prescription: { visit: { reasonForVisit: { startsWith: testPrefix } } } } });
  await prisma.prescription.deleteMany({ where: { visit: { reasonForVisit: { startsWith: testPrefix } } } });
  await prisma.treatmentPlanItem.deleteMany({ where: { OR: [{ notes: { startsWith: testPrefix } }, { treatmentPlan: { patientId: { in: patientIds } } }] } });
  await prisma.treatmentPlan.deleteMany({ where: { patientId: { in: patientIds } } });
  await prisma.stockMovement.deleteMany({ where: { reason: { startsWith: testPrefix } } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { orderNumber: { startsWith: testPrefix } } } });
  await prisma.purchaseOrder.deleteMany({ where: { orderNumber: { startsWith: testPrefix } } });
  await prisma.queueEntry.deleteMany({ where: { OR: [{ visit: { reasonForVisit: { startsWith: testPrefix } } }, { patientId: { in: patientIds } }] } });
  await prisma.appointment.deleteMany({ where: { patientId: { in: patientIds } } });
  await prisma.visit.deleteMany({ where: { OR: [{ reasonForVisit: { startsWith: testPrefix } }, { patientId: { in: patientIds } }] } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  console.log('Cleaned up successfully');
}

cleanup().finally(() => prisma.$disconnect());
