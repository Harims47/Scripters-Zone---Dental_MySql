import { prisma } from '../src/db';

async function main() {
  const counts = {
    users: await prisma.user.count(),
    staff: await prisma.staff.count(),
    patients: await prisma.patient.count(),
    appointments: await prisma.appointment.count(),
    visits: await prisma.visit.count(),
    queueEntries: await prisma.queueEntry.count(),
    consultations: await prisma.consultation.count(),
    prescriptions: await prisma.prescription.count(),
    prescriptionItems: await prisma.prescriptionItem.count(),
    treatmentPlans: await prisma.treatmentPlan.count(),
    treatmentPlanItems: await prisma.treatmentPlanItem.count(),
    payments: await prisma.payment.count(),
    medicines: await prisma.medicine.count(),
    medicineCategories: await prisma.medicineCategory.count(),
    suppliers: await prisma.supplier.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    supplierBills: await prisma.supplierBill.count(),
    supplierPayments: await prisma.supplierPayment.count(),
    stockMovements: await prisma.stockMovement.count(),
    reimbursementDocuments: await prisma.reimbursementDocument.count(),
    notifications: await prisma.notification.count(),
    historicalBatches: await prisma.historicalMigrationBatch.count()
  };
  console.log('--- CURRENT MYSQL TABLE COUNTS ---');
  console.log(JSON.stringify(counts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
