import { prisma } from './src/db';
import {
  getOverviewReportData,
  getVisitsReportData,
  getVisitsExportData,
  getRevenueReportData,
  getRevenueExportData,
  getPatientsReportData,
  getPatientsExportData,
  getTreatmentsReportData,
  getTreatmentsExportData,
  getDoctorActivityReportData,
  getMedicinesReportData,
  getMedicinesExportData,
  getInventoryMovementsReportData,
  getInventoryMovementsExportData,
  getProcurementReportData,
  getProcurementExportData
} from './src/services/reportsService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
}

async function runReportTests() {
  console.log('====================================================');
  console.log('STARTING DENTALCORE REPORTS BACKEND VERIFICATION');
  console.log('====================================================\n');

  const testPrefix = 'TEST-REP-';

  async function performCleanup() {
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
    await prisma.treatmentCatalog.deleteMany({ where: { name: { startsWith: testPrefix } } });
    await prisma.stockMovement.deleteMany({ where: { reason: { startsWith: testPrefix } } });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { orderNumber: { startsWith: testPrefix } } } });
    await prisma.purchaseOrder.deleteMany({ where: { orderNumber: { startsWith: testPrefix } } });
    await prisma.queueEntry.deleteMany({ where: { OR: [{ visit: { reasonForVisit: { startsWith: testPrefix } } }, { patientId: { in: patientIds } }] } });
    await prisma.appointment.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.visit.deleteMany({ where: { OR: [{ reasonForVisit: { startsWith: testPrefix } }, { patientId: { in: patientIds } }] } });
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  }

  // Initial cleanup
  await performCleanup();

  // 1. SETUP DOCTOR & PATIENTS
  let doc = await prisma.staff.findFirst({ where: { role: 'Head Doctor' } });
  if (!doc) {
    doc = await prisma.staff.create({
      data: { name: 'Dr. Test Head', phone: '9998887700', role: 'Head Doctor', status: 'Active' }
    });
  }

  // Patient A (New Patient - created now, first visit today)
  const patientA = await prisma.patient.create({
    data: { name: `${testPrefix}Patient A (New)`, phone: '9998880001', age: 30, gender: 'Male', status: 'Active' }
  });

  // Patient B (Existing Patient - has a historical visit from last year)
  const patientB = await prisma.patient.create({
    data: {
      name: `${testPrefix}Patient B (Existing)`,
      phone: '9998880002',
      age: 45,
      gender: 'Female',
      status: 'Active',
      createdAt: new Date('2025-01-01T10:00:00.000Z')
    }
  });

  // Historical visit for Patient B (Jan 2025)
  await prisma.visit.create({
    data: {
      patientId: patientB.id,
      doctorId: doc.id,
      status: 'COMPLETED',
      amountDue: 500,
      reasonForVisit: `Old Visit from 2025`,
      createdAt: new Date('2025-01-02T10:00:00.000Z')
    }
  });

  // 2. SETUP VISITS IN CURRENT WINDOW (Today)
  const d1 = new Date();
  d1.setHours(10, 0, 0, 0);

  // Visit 1: Walk-in for Patient A (New Patient), 3 multiple payments
  const visit1 = await prisma.visit.create({
    data: {
      patientId: patientA.id,
      doctorId: doc.id,
      appointmentId: null, // Walk-in
      status: 'COMPLETED',
      amountDue: 1200,
      reasonForVisit: `${testPrefix}Cleaning`,
      createdAt: d1
    }
  });

  // 3 MULTIPLE PAYMENTS FOR VISIT 1:
  // ₹400 Cash, ₹700 GPay, ₹100 Cash => Total = ₹1,200
  await prisma.payment.create({
    data: {
      visitId: visit1.id,
      patientId: patientA.id,
      amount: 400,
      method: 'Cash',
      status: 'Completed',
      notes: `${testPrefix}Payment 1`,
      date: d1.toISOString(),
      createdAt: d1
    }
  });
  await prisma.payment.create({
    data: {
      visitId: visit1.id,
      patientId: patientA.id,
      amount: 700,
      method: 'GPay',
      status: 'Completed',
      notes: `${testPrefix}Payment 2`,
      date: d1.toISOString(),
      createdAt: d1
    }
  });
  await prisma.payment.create({
    data: {
      visitId: visit1.id,
      patientId: patientA.id,
      amount: 100,
      method: 'Cash',
      status: 'Completed',
      notes: `${testPrefix}Payment 3`,
      date: d1.toISOString(),
      createdAt: d1
    }
  });

  // Visit 2: Appointment for Patient B (Existing Patient), Partial Payment
  const appt = await prisma.appointment.create({
    data: {
      patientId: patientB.id,
      providerId: doc.id,
      date: d1.toISOString().split('T')[0],
      time: '11:00 AM',
      type: 'Follow-up',
      status: 'Checked In'
    }
  });

  const visit2 = await prisma.visit.create({
    data: {
      patientId: patientB.id,
      doctorId: doc.id,
      appointmentId: appt.id, // Appointment visit
      status: 'READY_FOR_PAYMENT',
      amountDue: 2000,
      reasonForVisit: `${testPrefix}Root Canal Stage 1`,
      createdAt: d1
    }
  });

  // Partial payment of ₹800 on visit 2 (Balance = ₹1,200)
  await prisma.payment.create({
    data: {
      visitId: visit2.id,
      patientId: patientB.id,
      amount: 800,
      method: 'Credit Card',
      status: 'Completed',
      notes: `${testPrefix}Partial Advance`,
      date: d1.toISOString(),
      createdAt: d1
    }
  });

  // Visit 3: Cancelled Visit
  await prisma.visit.create({
    data: {
      patientId: patientA.id,
      doctorId: doc.id,
      status: 'CANCELLED',
      amountDue: 1500,
      reasonForVisit: `${testPrefix}Cancelled Consultation`,
      createdAt: d1
    }
  });

  // 3. SETUP TREATMENTS
  // Create a dedicated catalog item with testPrefix so search isolates it
  const catalogItem = await prisma.treatmentCatalog.create({
    data: { category: 'Endodontics', name: `${testPrefix}RCT Test`, variant: 'Molar', isActive: true }
  });

  let planA = await prisma.treatmentPlan.findUnique({ where: { patientId: patientA.id } });
  if (!planA) {
    planA = await prisma.treatmentPlan.create({ data: { patientId: patientA.id } });
  }

  // 1 Planned Treatment
  await prisma.treatmentPlanItem.create({
    data: {
      treatmentPlanId: planA.id,
      treatmentCatalogId: catalogItem.id,
      status: 'Planned',
      notes: `${testPrefix}Planned item`,
      createdAt: d1
    }
  });

  // 1 Completed Treatment
  await prisma.treatmentPlanItem.create({
    data: {
      treatmentPlanId: planA.id,
      treatmentCatalogId: catalogItem.id,
      status: 'Completed',
      completedVisitId: visit1.id,
      completedAt: d1,
      notes: `${testPrefix}Completed item`,
      createdAt: d1
    }
  });

  // 4. SETUP PRESCRIPTION & DISPENSING
  let med = await prisma.medicine.findFirst();
  if (!med) {
    let cat = await prisma.medicineCategory.findFirst();
    if (!cat) {
      cat = await prisma.medicineCategory.create({ data: { name: `${testPrefix}Antibiotics` } });
    }
    med = await prisma.medicine.create({
      data: {
        name: `${testPrefix}Amoxicillin 500mg`,
        categoryId: cat.id,
        form: 'Capsule',
        unit: 'Strip',
        stockWarningLevel: 10,
        currentStock: 50,
        unitPrice: 85
      }
    });
  }

  const presc = await prisma.prescription.create({
    data: {
      visitId: visit1.id,
      doctorId: doc.id,
      status: 'Dispensed',
      notes: `${testPrefix}Take twice daily`,
      items: {
        create: [
          {
            medicineId: med.id,
            quantity: 10, // Prescribed 10
            dosage: '500mg',
            instructions: 'After food'
          }
        ]
      }
    }
  });

  // Actual Dispensing: Prescribed 10, but ONLY 6 dispensed
  await prisma.dispensing.create({
    data: {
      visitId: visit1.id,
      prescriptionId: presc.id,
      status: 'Completed',
      createdAt: d1,
      items: {
        create: [
          {
            medicineId: med.id,
            prescribedQuantity: 10,
            dispensedQuantity: 6 // Actual dispensed 6
          }
        ]
      }
    }
  });

  // 5. SETUP INVENTORY MOVEMENTS
  await prisma.stockMovement.create({
    data: {
      medicineId: med.id,
      movementType: 'PURCHASE_RECEIPT',
      quantity: 100,
      balanceAfter: 150,
      referenceType: 'PURCHASE_ORDER',
      referenceId: 'PO-TEST-001',
      reason: `${testPrefix}Stock Intake`,
      createdAt: d1
    }
  });

  await prisma.stockMovement.create({
    data: {
      medicineId: med.id,
      movementType: 'DISPENSING',
      quantity: -10,
      balanceAfter: 140,
      referenceType: 'VISIT',
      referenceId: visit1.id,
      reason: `${testPrefix}Patient Dispensing`,
      createdAt: d1
    }
  });

  await prisma.stockMovement.create({
    data: {
      medicineId: med.id,
      movementType: 'ADJUSTMENT',
      quantity: -2,
      balanceAfter: 138,
      referenceType: 'MANUAL',
      reason: `${testPrefix}Broken Capsule Adjustment`,
      createdAt: d1
    }
  });

  // 6. SETUP PROCUREMENT / PURCHASE ORDER
  let supplier = await prisma.supplier.findFirst({ where: { status: 'Active' } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: { name: `${testPrefix}MedSupplies Co`, phone: '9876543210', status: 'Active' }
    });
  }

  await prisma.purchaseOrder.create({
    data: {
      orderNumber: `${testPrefix}PO-202609-001`,
      supplierId: supplier.id,
      orderDate: d1,
      status: 'Partially Received',
      items: {
        create: [
          {
            medicineId: med.id,
            orderedQuantity: 100,
            receivedQuantity: 60,
            unitCost: 50
          }
        ]
      }
    }
  });

  // ==========================================
  // RUN AUDIT & VERIFICATION TESTS
  // ==========================================
  const todayStr = d1.toISOString().split('T')[0];

  // TEST 1: Overview Report Metrics & Double-Count Avoidance
  console.log('\n--- Test 1: Overview Report ---');
  const overview = await getOverviewReportData({
    startDate: todayStr,
    endDate: todayStr
  });

  assert(overview.summary.totalVisits >= 3, 'Overview totalVisits includes created test visits', overview.summary);
  assert(overview.summary.completedVisits >= 1, 'Overview completedVisits >= 1');
  assert(overview.summary.cancelledVisits >= 1, 'Overview cancelledVisits >= 1');
  assert(overview.summary.walkInVisits >= 1, 'Overview walkInVisits accurately counted');
  assert(overview.summary.appointmentVisits >= 1, 'Overview appointmentVisits accurately counted');
  assert(overview.summary.newPatients >= 1, 'Overview newPatients identifies Patient A as New');

  // TEST 2: Revenue & Financial Double-Counting Verification
  console.log('\n--- Test 2: Revenue & Payments Report ---');
  const revReport = await getRevenueReportData({
    startDate: todayStr,
    endDate: todayStr,
    search: testPrefix
  });

  const testPaymentRows = revReport.data.filter(r => r.notes.startsWith(testPrefix));
  assert(testPaymentRows.length === 4, 'Detailed payment report returns 4 distinct payment records (NO aggregation)', testPaymentRows.length);

  const visit1Rows = testPaymentRows.filter(r => r.visitId === visit1.id);
  assert(visit1Rows.length === 3, 'Visit 1 correctly returns exactly 3 payment rows for 1 visit', visit1Rows);
  const visit1Collected = visit1Rows.reduce((sum, r) => sum + r.amount, 0);
  assert(visit1Collected === 1200, 'Visit 1 total collected is exactly ₹1,200 (₹400+₹700+₹100)', visit1Collected);

  assert(revReport.methodBreakdown.Cash.amount >= 500, 'Cash breakdown includes ₹400 + ₹100');
  assert(revReport.methodBreakdown.GPay.amount >= 700, 'GPay breakdown includes ₹700');
  assert(revReport.methodBreakdown['Credit Card'].amount >= 800, 'Credit Card breakdown includes ₹800');

  // TEST 3: Visits Report Verification
  console.log('\n--- Test 3: Visits Report ---');
  const visitsReport = await getVisitsReportData({
    startDate: todayStr,
    endDate: todayStr,
    search: testPrefix
  });
  assert(visitsReport.data.length === 3, 'Visits report returns exactly 3 test visits', visitsReport.data.length);
  const v1Row = visitsReport.data.find(v => v.id === visit1.id);
  assert(v1Row?.visitType === 'Walk-in' && v1Row?.amountDue === 1200 && v1Row?.totalPaid === 1200 && v1Row?.balance === 0,
    'Visit 1 Walk-in financials: Due ₹1200, Paid ₹1200, Balance ₹0', v1Row);

  const v2Row = visitsReport.data.find(v => v.id === visit2.id);
  assert(v2Row?.visitType === 'Appointment' && v2Row?.amountDue === 2000 && v2Row?.totalPaid === 800 && v2Row?.balance === 1200,
    'Visit 2 Appointment financials: Due ₹2000, Paid ₹800, Balance ₹1200', v2Row);

  // TEST 4: Patients Report & Chronological New vs Existing Verification
  console.log('\n--- Test 4: Patients Report (New vs Existing) ---');
  const patientsReport = await getPatientsReportData({
    startDate: todayStr,
    endDate: todayStr,
    search: testPrefix
  });
  const patARow = patientsReport.data.find(p => p.patientId === patientA.id);
  const patBRow = patientsReport.data.find(p => p.patientId === patientB.id);
  assert(patARow?.patientType === 'New', 'Patient A is classified as New (first visit is today)', patARow);
  assert(patBRow?.patientType === 'Returning', 'Patient B is classified as Returning (had 2025 visit)', patBRow);

  // TEST 5: Treatments Report (Planned vs Completed)
  console.log('\n--- Test 5: Treatments Report ---');
  const treatmentsReport = await getTreatmentsReportData({
    startDate: todayStr,
    endDate: todayStr,
    search: testPrefix
  });
  const tRow = treatmentsReport.data.find(t => t.id === catalogItem.id);
  assert(tRow?.plannedCount === 1, 'Treatments report shows 1 Planned treatment', tRow);
  assert(tRow?.completedCount === 1, 'Treatments report shows 1 Completed treatment', tRow);

  // TEST 6: Medicine Dispensing Report (Prescribed vs Actual Dispensed)
  console.log('\n--- Test 6: Medicines & Dispensing Report ---');
  const medReport = await getMedicinesReportData({
    startDate: todayStr,
    endDate: todayStr,
    medicineId: med.id
  });
  const mRow = medReport.data.find(m => m.id === med.id);
  assert(mRow?.totalPrescribedQuantity === 10, 'Medicine shows 10 units prescribed', mRow);
  assert(mRow?.totalDispensedQuantity === 6, 'Medicine shows strictly 6 units dispensed (NOT 10)', mRow);

  // TEST 7: Inventory Movements Report
  console.log('\n--- Test 7: Inventory Movements Ledger ---');
  const invReport = await getInventoryMovementsReportData({
    startDate: todayStr,
    endDate: todayStr,
    medicineId: med.id
  });
  assert(invReport.summary.stockReceived === 100, 'Inventory summary: Stock Received = 100', invReport.summary);
  assert(invReport.summary.stockDispensed === 10, 'Inventory summary: Stock Dispensed = 10', invReport.summary);
  assert(invReport.summary.adjustmentCount === 1 && invReport.summary.netAdjustmentQuantity === -2,
    'Inventory summary: 1 adjustment with net -2 qty', invReport.summary);

  // TEST 8: Procurement Report (Ordered vs Received)
  console.log('\n--- Test 8: Procurement & Purchase Orders Report ---');
  const procReport = await getProcurementReportData({
    startDate: todayStr,
    endDate: todayStr,
    supplierId: supplier.id
  });
  const poRow = procReport.data.find(p => p.orderNumber.startsWith(testPrefix));
  assert(poRow?.orderedQuantity === 100, 'PO orderedQuantity = 100', poRow);
  assert(poRow?.receivedQuantity === 60, 'PO receivedQuantity = 60', poRow);
  assert(poRow?.totalCostValue === 5000, 'PO totalCostValue = ₹5,000 (100 * ₹50)', poRow);

  // TEST 9: Doctor Activity Report
  console.log('\n--- Test 9: Doctor Activity Report ---');
  const docReport = await getDoctorActivityReportData(todayStr, todayStr);
  const docRow = docReport.find(d => d.doctorId === doc?.id);
  assert(docRow !== undefined && docRow.totalAssignedVisits >= 3,
    'Doctor activity returns workload without arbitrary scores', docRow);

  // TEST 10: Date Range Boundary & Exclusion Test
  console.log('\n--- Test 10: Date Range Filter Boundaries ---');
  const pastReport = await getOverviewReportData({
    startDate: '2020-01-01',
    endDate: '2020-01-02'
  });
  assert(pastReport.summary.totalVisits === 0, 'Past date range outside data returns 0 visits', pastReport.summary);

  // TEST 11: Export Data Generation
  console.log('\n--- Test 11: Export Generators (Full Dataset Integrity) ---');
  const visitsExport = await getVisitsExportData({
    startDate: todayStr,
    endDate: todayStr,
    search: testPrefix
  });
  assert(visitsExport.length === 3, 'Visits export produces all 3 matching rows regardless of page size', visitsExport.length);

  const revenueExport = await getRevenueExportData({
    startDate: todayStr,
    endDate: todayStr,
    search: testPrefix
  });
  assert(revenueExport.length === 4, 'Revenue export produces all 4 individual payment rows', revenueExport.length);

  // FINAL CLEANUP
  console.log('\n--- Cleaning up test records ---');
  await performCleanup();
  console.log('Cleanup complete.');

  console.log('\n====================================================');
  console.log(`REPORTS VERIFICATION FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runReportTests()
  .catch(err => {
    console.error('Fatal error during report tests:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
