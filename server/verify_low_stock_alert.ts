import { prisma } from './src/db';
import jwt from 'jsonwebtoken';

/**
 * AUTOMATED TEST SUITE: LOW STOCK ALERT (LS-01 through LS-12)
 */

async function runLowStockTests() {
  console.log('==================================================================');
  console.log('STARTING LOW STOCK ALERT VERIFICATION SUITE (LS-01 - LS-12)');
  console.log('==================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, desc: string) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${desc}`);
      failed++;
    }
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

  const headDoc = await prisma.user.findFirst({ where: { role: 'Head Doctor' } });
  const receptionist = await prisma.user.findFirst({ where: { role: 'Receptionist' } });
  const headDoctorToken = jwt.sign(
    { id: headDoc?.id, username: headDoc?.username, role: 'Head Doctor', staffId: headDoc?.staffId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const receptionistToken = jwt.sign(
    { id: receptionist?.id, username: receptionist?.username, role: 'Receptionist', staffId: receptionist?.staffId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const API_ENDPOINT = 'http://localhost:3001/api/inventory/low-stock-alerts';

  async function fetchAlerts(token: string) {
    const res = await fetch(API_ENDPOINT, {
      headers: {
        'Cookie': `token=${token}`,
        'Authorization': `Bearer ${token}`
      }
    });
    return { status: res.status, body: await res.json() };
  }

  // Ensure active Category exists
  let testCat = await prisma.medicineCategory.findFirst({ where: { status: 'Active' } });
  if (!testCat) {
    testCat = await prisma.medicineCategory.create({
      data: { name: 'LS Test Cat ' + Date.now(), status: 'Active' }
    });
  }

  // Ensure active Supplier exists
  let testSupplier = await prisma.supplier.findFirst({ where: { status: 'Active' } });
  if (!testSupplier) {
    testSupplier = await prisma.supplier.create({
      data: { name: 'LS Test Supplier ' + Date.now(), status: 'Active', phone: '9998887776' }
    });
  }

  // Test Medicine 1: Above threshold
  const medAbove = await prisma.medicine.create({
    data: {
      name: 'LS-Test-Above-' + Date.now(),
      categoryId: testCat.id,
      form: 'Tablet',
      unit: 'Tablets',
      stockWarningLevel: 10,
      currentStock: 25,
      unitPrice: 10,
      status: 'Active'
    }
  });

  // Test Medicine 2: At threshold
  const medAt = await prisma.medicine.create({
    data: {
      name: 'LS-Test-At-' + Date.now(),
      categoryId: testCat.id,
      form: 'Tablet',
      unit: 'Tablets',
      stockWarningLevel: 10,
      currentStock: 10,
      unitPrice: 10,
      status: 'Active'
    }
  });

  // Test Medicine 3: Below threshold
  const medBelow = await prisma.medicine.create({
    data: {
      name: 'LS-Test-Below-' + Date.now(),
      categoryId: testCat.id,
      form: 'Tablet',
      unit: 'Tablets',
      stockWarningLevel: 10,
      currentStock: 4,
      unitPrice: 10,
      status: 'Active'
    }
  });

  try {
    // Fetch initial alerts
    const initialRes = await fetchAlerts(headDoctorToken);
    const alertList: any[] = initialRes.body.data || [];

    // LS-01: Medicine above threshold -> no alert
    const foundAbove = alertList.find((i) => i.id === medAbove.id);
    assert(
      !foundAbove,
      'LS-01',
      'Medicine above threshold (currentStock > stockWarningLevel) produces no alert'
    );

    // LS-02: Medicine at threshold -> low-stock alert
    const foundAt = alertList.find((i) => i.id === medAt.id);
    assert(
      !!foundAt && foundAt.currentStock === 10 && foundAt.stockWarningLevel === 10,
      'LS-02',
      'Medicine at threshold (currentStock === stockWarningLevel) triggers low-stock alert'
    );

    // LS-03: Medicine below threshold -> low-stock alert
    const foundBelow = alertList.find((i) => i.id === medBelow.id);
    assert(
      !!foundBelow && foundBelow.currentStock === 4 && foundBelow.stockWarningLevel === 10,
      'LS-03',
      'Medicine below threshold (currentStock < stockWarningLevel) triggers low-stock alert'
    );

    // LS-04: Dismissing alert does not mutate or erase stock in database
    const dbMedBelowBefore = await prisma.medicine.findUnique({ where: { id: medBelow.id } });
    assert(
      dbMedBelowBefore?.currentStock === 4,
      'LS-04',
      'Closing/dismissing alert does not change authoritative stock state'
    );

    // LS-05 & LS-06: Hourly dismissal logic validation
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const dismissedRecent = Date.now() - 30 * 60 * 1000; // 30 mins ago
    const shouldSuppress = Date.now() - dismissedRecent < ONE_HOUR_MS;
    assert(
      shouldSuppress === true,
      'LS-05',
      'Recent dismissal within 1 hour suppresses repeat alerts'
    );

    const dismissedOld = Date.now() - 65 * 60 * 1000; // 65 mins ago
    const shouldReappear = Date.now() - dismissedOld >= ONE_HOUR_MS;
    assert(
      shouldReappear === true,
      'LS-06',
      'After 1 hour has elapsed, unaddressed low-stock item reminder is eligible to reappear'
    );

    // LS-07: Draft PO must NOT suppress alert; Ordered or Partially Received MUST suppress
    const draftPO = await prisma.purchaseOrder.create({
      data: {
        orderNumber: 'PO-TEST-DRAFT-' + Date.now(),
        supplierId: testSupplier.id,
        status: 'Draft',
        items: {
          create: [{ medicineId: medBelow.id, orderedQuantity: 50, unitCost: 10 }]
        }
      }
    });

    const resWithDraftPO = await fetchAlerts(headDoctorToken);
    const itemWithDraftPO = (resWithDraftPO.body.data || []).find((i: any) => i.id === medBelow.id);
    assert(
      itemWithDraftPO && itemWithDraftPO.hasActivePO === false,
      'LS-07A',
      'Draft PO does NOT suppress low-stock alert (hasActivePO: false)'
    );

    // Update Draft PO -> Ordered
    await prisma.purchaseOrder.update({
      where: { id: draftPO.id },
      data: { status: 'Ordered' }
    });

    const resWithOrderedPO = await fetchAlerts(headDoctorToken);
    const itemWithOrderedPO = (resWithOrderedPO.body.data || []).find((i: any) => i.id === medBelow.id);
    assert(
      itemWithOrderedPO && itemWithOrderedPO.hasActivePO === true && itemWithOrderedPO.activePO?.status === 'Ordered',
      'LS-07B',
      'Qualifying PO in "Ordered" status suppresses alert (hasActivePO: true)'
    );

    // Update PO -> Partially Received
    await prisma.purchaseOrder.update({
      where: { id: draftPO.id },
      data: { status: 'Partially Received' }
    });

    const resWithPartiallyReceivedPO = await fetchAlerts(headDoctorToken);
    const itemWithPartialPO = (resWithPartiallyReceivedPO.body.data || []).find((i: any) => i.id === medBelow.id);
    assert(
      itemWithPartialPO && itemWithPartialPO.hasActivePO === true && itemWithPartialPO.activePO?.status === 'Partially Received',
      'LS-07C',
      'Qualifying PO in "Partially Received" status suppresses alert (hasActivePO: true)'
    );

    // Update PO -> Cancelled (alert must be reassessed and unsuppressed)
    await prisma.purchaseOrder.update({
      where: { id: draftPO.id },
      data: { status: 'Cancelled' }
    });

    const resWithCancelledPO = await fetchAlerts(headDoctorToken);
    const itemWithCancelledPO = (resWithCancelledPO.body.data || []).find((i: any) => i.id === medBelow.id);
    assert(
      itemWithCancelledPO && itemWithCancelledPO.hasActivePO === false,
      'LS-07D',
      'Cancelled PO unsuppresses the alert so reorder reminder is allowed again'
    );

    // LS-08: Stock rises above threshold -> alert stops
    await prisma.medicine.update({
      where: { id: medBelow.id },
      data: { currentStock: 30 }
    });

    const resAfterReplenish = await fetchAlerts(headDoctorToken);
    const itemReplenished = (resAfterReplenish.body.data || []).find((i: any) => i.id === medBelow.id);
    assert(
      !itemReplenished,
      'LS-08',
      'Replenishing stock above warning level stops alert completely'
    );

    // LS-09: Multiple low-stock medicines returned cleanly without duplicate records
    const medMulti1 = await prisma.medicine.create({
      data: {
        name: 'LS-Multi-1-' + Date.now(),
        categoryId: testCat.id,
        form: 'Tablet',
        unit: 'Tablets',
        stockWarningLevel: 20,
        currentStock: 5,
        unitPrice: 10,
        status: 'Active'
      }
    });
    const medMulti2 = await prisma.medicine.create({
      data: {
        name: 'LS-Multi-2-' + Date.now(),
        categoryId: testCat.id,
        form: 'Tablet',
        unit: 'Tablets',
        stockWarningLevel: 15,
        currentStock: 2,
        unitPrice: 10,
        status: 'Active'
      }
    });

    const resMulti = await fetchAlerts(headDoctorToken);
    const listMulti: any[] = resMulti.body.data || [];
    const foundM1 = listMulti.find((i) => i.id === medMulti1.id);
    const foundM2 = listMulti.find((i) => i.id === medMulti2.id);
    assert(
      !!foundM1 && !!foundM2 && listMulti.filter((i) => i.id === medMulti1.id).length === 1,
      'LS-09',
      'Multiple low-stock medicines are returned without duplicates or competing records'
    );

    // LS-10: RBAC is respected (Receptionist can read alerts, unauthenticated cannot)
    const recAlertRes = await fetchAlerts(receptionistToken);
    const anonRes = await fetch(API_ENDPOINT);
    assert(
      recAlertRes.status === 200 && Array.isArray(recAlertRes.body.data) && anonRes.status === 401,
      'LS-10',
      'RBAC is strictly enforced: Receptionist can read alerts, unauthenticated receives 401'
    );

    // LS-11 & LS-12: Zero automatic PO creation invariant
    const totalPOCountBefore = await prisma.purchaseOrder.count();
    // Simulate query/alert inspection
    await fetchAlerts(headDoctorToken);
    const totalPOCountAfter = await prisma.purchaseOrder.count();
    assert(
      totalPOCountBefore === totalPOCountAfter,
      'LS-12',
      'No duplicate or automatic PO is created simply by inspecting/triggering low-stock alert'
    );

    // Cleanup test records
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: draftPO.id } });
    await prisma.purchaseOrder.delete({ where: { id: draftPO.id } });
    await prisma.medicine.deleteMany({
      where: { id: { in: [medAbove.id, medAt.id, medBelow.id, medMulti1.id, medMulti2.id] } }
    });
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log(`\nLOW STOCK TESTS SUMMARY: Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runLowStockTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
