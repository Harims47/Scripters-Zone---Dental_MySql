import { prisma } from './src/db';
const API_BASE = 'http://localhost:3001/api';

// Simple fetch wrapper with cookie support
class ApiSession {
  private cookie: string = '';

  async post(path: string, body: any) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {})
      },
      body: JSON.stringify(body)
    });
    this.extractCookie(res);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  async put(path: string, body: any) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {})
      },
      body: JSON.stringify(body)
    });
    this.extractCookie(res);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  async patch(path: string, body?: any) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    this.extractCookie(res);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  async delete(path: string) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {})
      }
    });
    this.extractCookie(res);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  private extractCookie(res: Response) {
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      // grab token=xxx
      const tokenMatch = setCookie.match(/token=[^;]+/);
      if (tokenMatch) {
        this.cookie = tokenMatch[0];
      }
    }
  }
}

async function loginAs(username: string, password = 'demo123') {
  const session = new ApiSession();
  const res = await session.post('/auth/login', { username, password });
  if (res.status !== 200) {
    throw new Error(`Failed to login as ${username}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return session;
}

async function runTests() {
  console.log('=== STARTING PHASE B COMPREHENSIVE VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    const users = await prisma.user.findMany({ include: { staff: true } });
    console.log(`Found ${users.length} users in DB`);
    
    const headDocUser = users.find(u => u.role === 'Head Doctor');
    const receptionistUser = users.find(u => u.role === 'Receptionist');
    const dutyDocUser = users.find(u => u.role === 'Duty Doctor');

    if (!headDocUser) throw new Error('No Head Doctor user found in DB');
    console.log(`Head Doctor: ${headDocUser.username}`);
    console.log(`Duty Doctor: ${dutyDocUser?.username || 'N/A'}`);
    console.log(`Receptionist: ${receptionistUser?.username || 'N/A'}`);

    const headDocClient = await loginAs(headDocUser.username);
    let recepClient: ApiSession | null = null;
    if (receptionistUser) {
      recepClient = await loginAs(receptionistUser.username);
    }

    // Get an active category
    let category = await prisma.medicineCategory.findFirst({ where: { status: 'Active' } });
    if (!category) {
      category = await prisma.medicineCategory.create({
        data: { name: 'Verification Cat ' + Date.now(), status: 'Active' }
      });
    }

    // ==========================================
    // TEST 1: Stock > 0 + DELETE -> 400, no change
    // ==========================================
    console.log('\n--- TEST 1: Stock > 0 + DELETE -> HTTP 400 ---');
    const medStock = await prisma.medicine.create({
      data: {
        name: 'Test Med Stock ' + Date.now(),
        categoryId: category.id,
        form: 'Tablet',
        unit: 'Strip',
        stockWarningLevel: 10,
        unitPrice: 25.0,
        currentStock: 15,
        status: 'Active'
      }
    });

    const res1 = await headDocClient.delete(`/inventory/${medStock.id}`);
    assert(res1.status === 400, `Stock > 0 returns HTTP 400 (Got: ${res1.status})`);
    assert(res1.data?.error?.includes('Cannot delete a medicine with available stock'), `Error message mentions available stock: ${res1.data?.error}`);

    const check1 = await prisma.medicine.findUnique({ where: { id: medStock.id } });
    assert(check1 !== null && check1.currentStock === 15, 'Medicine remains unchanged in DB');

    // Clean up test 1
    await prisma.medicine.delete({ where: { id: medStock.id } });

    // ==========================================
    // TEST 2: Stock = 0 + no dependencies + DELETE -> 200, hard deleted
    // ==========================================
    console.log('\n--- TEST 2: Stock = 0 + No Dependencies + DELETE -> HTTP 200 hard deleted ---');
    const medNoDep = await prisma.medicine.create({
      data: {
        name: 'Test Med Clean ' + Date.now(),
        categoryId: category.id,
        form: 'Injection',
        unit: 'Vial',
        stockWarningLevel: 5,
        unitPrice: 150.0,
        currentStock: 0,
        status: 'Active'
      }
    });

    const res2 = await headDocClient.delete(`/inventory/${medNoDep.id}`);
    assert(res2.status === 200, `Deletable medicine returns HTTP 200 (Got: ${res2.status})`);
    
    const check2 = await prisma.medicine.findUnique({ where: { id: medNoDep.id } });
    assert(check2 === null, 'Medicine was hard deleted from database');

    // ==========================================
    // TEST 3: Stock = 0 + PrescriptionItem dependency + DELETE -> 409
    // ==========================================
    console.log('\n--- TEST 3: Stock = 0 + PrescriptionItem dependency -> HTTP 409 ---');
    const medWithRx = await prisma.medicine.create({
      data: {
        name: 'Test Med Rx ' + Date.now(),
        categoryId: category.id,
        form: 'Tablet',
        unit: 'Tab',
        stockWarningLevel: 10,
        unitPrice: 5.0,
        currentStock: 0,
        status: 'Active'
      }
    });

    const patient = await prisma.patient.findFirst() || await prisma.patient.create({
      data: { name: 'Test P', phone: '9999999999', gender: 'Male', age: 30 }
    });
    const visit = await prisma.visit.create({
      data: {
        patientId: patient.id,
        doctorId: headDocUser.staffId || 'staff-1',
        reasonForVisit: 'Check',
        status: 'IN_CONSULTATION'
      }
    });
    const rx = await prisma.prescription.create({
      data: {
        visitId: visit.id,
        doctorId: headDocUser.staffId || 'staff-1',
        status: 'Draft',
        notes: 'Take with food'
      }
    });
    const rxItem = await prisma.prescriptionItem.create({
      data: {
        prescriptionId: rx.id,
        medicineId: medWithRx.id,
        quantity: 5,
        dosage: '1-0-1',
        instructions: 'After meals'
      }
    });

    const res3 = await headDocClient.delete(`/inventory/${medWithRx.id}`);
    assert(res3.status === 409, `Prescription dependency returns HTTP 409 (Got: ${res3.status})`);
    assert(res3.data?.error?.includes('prescription'), `Error message mentions prescription records: ${res3.data?.error}`);
    
    const check3 = await prisma.medicine.findUnique({ where: { id: medWithRx.id } });
    assert(check3 !== null, 'Medicine was NOT deleted or altered silently');

    // ==========================================
    // TEST 4: Stock = 0 + DispensingItem dependency + DELETE -> 409
    // ==========================================
    console.log('\n--- TEST 4: Stock = 0 + DispensingItem dependency -> HTTP 409 ---');
    const medWithDisp = await prisma.medicine.create({
      data: {
        name: 'Test Med Disp ' + Date.now(),
        categoryId: category.id,
        form: 'Tablet',
        unit: 'Tab',
        stockWarningLevel: 10,
        unitPrice: 5.0,
        currentStock: 0,
        status: 'Active'
      }
    });
    const disp = await prisma.dispensing.create({
      data: {
        visitId: visit.id,
        prescriptionId: rx.id,
        status: 'Pending'
      }
    });
    const dispItem = await prisma.dispensingItem.create({
      data: {
        dispensingId: disp.id,
        medicineId: medWithDisp.id,
        prescribedQuantity: 2,
        dispensedQuantity: 2
      }
    });

    const res4 = await headDocClient.delete(`/inventory/${medWithDisp.id}`);
    assert(res4.status === 409, `Dispensing dependency returns HTTP 409 (Got: ${res4.status})`);
    
    const check4 = await prisma.medicine.findUnique({ where: { id: medWithDisp.id } });
    assert(check4 !== null, 'Medicine was NOT deleted or altered silently');

    // ==========================================
    // TEST 5: Stock = 0 + StockMovement dependency + DELETE -> 409
    // ==========================================
    console.log('\n--- TEST 5: Stock = 0 + StockMovement dependency -> HTTP 409 ---');
    const medWithSm = await prisma.medicine.create({
      data: {
        name: 'Test Med SM ' + Date.now(),
        categoryId: category.id,
        form: 'Syrup',
        unit: 'Bottle',
        stockWarningLevel: 5,
        unitPrice: 60.0,
        currentStock: 0,
        status: 'Active'
      }
    });
    const sm = await prisma.stockMovement.create({
      data: {
        medicineId: medWithSm.id,
        movementType: 'ADJUSTMENT',
        quantity: -5,
        balanceAfter: 0,
        referenceType: 'MANUAL',
        reason: 'Zeroed out'
      }
    });

    const res5 = await headDocClient.delete(`/inventory/${medWithSm.id}`);
    assert(res5.status === 409, `StockMovement dependency returns HTTP 409 (Got: ${res5.status})`);
    
    const check5 = await prisma.medicine.findUnique({ where: { id: medWithSm.id } });
    assert(check5 !== null, 'Medicine was NOT deleted or altered silently');

    // ==========================================
    // TEST 6: Stock = 0 + PurchaseOrderItem dependency + DELETE -> 409
    // ==========================================
    console.log('\n--- TEST 6: Stock = 0 + PurchaseOrderItem dependency -> HTTP 409 ---');
    const medWithPo = await prisma.medicine.create({
      data: {
        name: 'Test Med PO ' + Date.now(),
        categoryId: category.id,
        form: 'Capsule',
        unit: 'Box',
        stockWarningLevel: 10,
        unitPrice: 120.0,
        currentStock: 0,
        status: 'Active'
      }
    });
    let supplier = await prisma.supplier.findFirst();
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: { name: 'Test Sup ' + Date.now(), phone: '1234567890', status: 'Active' }
      });
    }
    const po = await prisma.purchaseOrder.create({
      data: {
        orderNumber: 'PO-TEST-' + Date.now(),
        supplierId: supplier.id,
        status: 'Ordered',
        orderDate: new Date()
      }
    });
    const poi = await prisma.purchaseOrderItem.create({
      data: {
        purchaseOrderId: po.id,
        medicineId: medWithPo.id,
        orderedQuantity: 10,
        unitCost: 20
      }
    });

    const res6 = await headDocClient.delete(`/inventory/${medWithPo.id}`);
    assert(res6.status === 409, `PurchaseOrder dependency returns HTTP 409 (Got: ${res6.status})`);
    
    const check6 = await prisma.medicine.findUnique({ where: { id: medWithPo.id } });
    assert(check6 !== null, 'Medicine was NOT deleted or altered silently');

    // ==========================================
    // TEST 7: Explicit DEACTIVATE -> status becomes Inactive
    // ==========================================
    console.log('\n--- TEST 7: Explicit DEACTIVATE -> status becomes Inactive ---');
    const res7 = await headDocClient.patch(`/inventory/${medWithRx.id}/deactivate`);
    assert(res7.status === 200, `PATCH deactivate returns HTTP 200 (Got: ${res7.status})`);
    assert(res7.data?.medicine?.status === 'Inactive', `Returned medicine status is Inactive: ${res7.data?.medicine?.status}`);
    
    const check7 = await prisma.medicine.findUnique({ where: { id: medWithRx.id } });
    assert(check7?.status === 'Inactive', 'Database medicine status updated to Inactive');
    
    // Check historical records were preserved
    const rxItemCheck = await prisma.prescriptionItem.findUnique({ where: { id: rxItem.id } });
    assert(rxItemCheck !== null, 'PrescriptionItem historical record preserved intact');

    // ==========================================
    // TEST 8: Explicit REACTIVATE -> status becomes Active
    // ==========================================
    console.log('\n--- TEST 8: Explicit REACTIVATE -> status becomes Active ---');
    const res8 = await headDocClient.patch(`/inventory/${medWithRx.id}/reactivate`);
    assert(res8.status === 200, `PATCH reactivate returns HTTP 200 (Got: ${res8.status})`);
    assert(res8.data?.medicine?.status === 'Active', `Returned medicine status is Active: ${res8.data?.medicine?.status}`);
    
    const check8 = await prisma.medicine.findUnique({ where: { id: medWithRx.id } });
    assert(check8?.status === 'Active', 'Database medicine status updated to Active');

    // Deactivate it again for subsequent inactive selection testing
    await headDocClient.patch(`/inventory/${medWithRx.id}/deactivate`);

    // ==========================================
    // TEST 9: Inactive medicine cannot be selected for NEW prescription
    // ==========================================
    console.log('\n--- TEST 9: Inactive medicine cannot be prescribed ---');
    // Ensure visit is in WITH_DOCTOR state for prescription creation
    await prisma.visit.update({ where: { id: visit.id }, data: { status: 'WITH_DOCTOR' } });
    const res9 = await headDocClient.post('/prescriptions', {
      visitId: visit.id,
      notes: 'Test Rx notes',
      items: [
        { medicineId: medWithRx.id, quantity: 10, dosage: '1-1-1', instructions: 'After lunch' }
      ]
    });
    assert(res9.status === 400, `Prescribing inactive medicine returns HTTP 400 (Got: ${res9.status})`);
    assert(res9.data?.error?.includes('inactive medicine'), `Error indicates inactive medicine cannot be prescribed: ${res9.data?.error}`);

    // ==========================================
    // TEST 10: Inactive medicine cannot be added to NEW Purchase Order
    // ==========================================
    console.log('\n--- TEST 10: Inactive medicine cannot be added to NEW Purchase Order ---');
    const res10 = await headDocClient.post('/purchase-orders', {
      supplierId: supplier.id,
      orderDate: new Date().toISOString(),
      items: [
        { medicineId: medWithRx.id, orderedQuantity: 20, unitCost: 10 }
      ]
    });
    assert(res10.status === 400, `PO with inactive medicine returns HTTP 400 (Got: ${res10.status})`);
    assert(res10.data?.error?.includes('inactive medicine'), `Error indicates inactive medicine: ${res10.data?.error}`);

    // ==========================================
    // TEST 11: Multiple Receptionists Attendance Independence
    // ==========================================
    console.log('\n--- TEST 11: Multiple Receptionists Attendance Independence ---');
    let recA = await prisma.staff.findFirst({ where: { role: 'Receptionist', name: 'Receptionist Alpha' } });
    if (!recA) {
      recA = await prisma.staff.create({
        data: { name: 'Receptionist Alpha', role: 'Receptionist', phone: '9000000001', attendance: 'Present', status: 'Active' }
      });
    }
    let recB = await prisma.staff.findFirst({ where: { role: 'Receptionist', name: 'Receptionist Beta' } });
    if (!recB) {
      recB = await prisma.staff.create({
        data: { name: 'Receptionist Beta', role: 'Receptionist', phone: '9000000002', attendance: 'Present', status: 'Active' }
      });
    }

    const res11_A = await headDocClient.put(`/staff/${recA.id}/attendance`, { attendance: 'Present' });
    const res11_B = await headDocClient.put(`/staff/${recB.id}/attendance`, { attendance: 'Leave' });
    assert(res11_A.status === 200, 'Receptionist A attendance updated to Present');
    assert(res11_B.status === 200, 'Receptionist B attendance updated to Leave');

    const freshA = await prisma.staff.findUnique({ where: { id: recA.id } });
    const freshB = await prisma.staff.findUnique({ where: { id: recB.id } });
    assert(freshA?.attendance === 'Present', `Receptionist A attendance is Present (${freshA?.attendance})`);
    assert(freshB?.attendance === 'Leave', `Receptionist B attendance is Leave (${freshB?.attendance})`);

    // Changing B must NOT change A
    await headDocClient.put(`/staff/${recB.id}/attendance`, { attendance: 'Present' });
    const freshA2 = await prisma.staff.findUnique({ where: { id: recA.id } });
    const freshB2 = await prisma.staff.findUnique({ where: { id: recB.id } });
    assert(freshA2?.attendance === 'Present', 'Changing Receptionist B did NOT affect Receptionist A');
    assert(freshB2?.attendance === 'Present', 'Receptionist B updated to Present');

    // ==========================================
    // TEST 12: RBAC - Receptionist CANNOT modify attendance
    // ==========================================
    console.log('\n--- TEST 12: RBAC - Receptionist CANNOT modify attendance ---');
    if (recepClient) {
      const res12 = await recepClient.put(`/staff/${recA.id}/attendance`, { attendance: 'Leave' });
      assert(res12.status === 403, `Receptionist modifying attendance rejected with HTTP 403 (Got: ${res12.status})`);
    } else {
      console.log('Skipping receptionist client test (no receptionist user in DB)');
    }

    // ==========================================
    // TEST 13: RBAC - Receptionist CANNOT delete medicine
    // ==========================================
    console.log('\n--- TEST 13: RBAC - Receptionist CANNOT delete medicine ---');
    if (recepClient) {
      const res13 = await recepClient.delete(`/inventory/${medWithSm.id}`);
      assert(res13.status === 403, `Receptionist deleting medicine rejected with HTTP 403 (Got: ${res13.status})`);
    }

    // ==========================================
    // Clean up created test entities
    // ==========================================
    console.log('\nCleaning up test records...');
    await prisma.prescriptionItem.deleteMany({ where: { prescriptionId: rx.id } }).catch(() => {});
    await prisma.prescription.delete({ where: { id: rx.id } }).catch(() => {});
    await prisma.dispensingItem.deleteMany({ where: { dispensingId: disp.id } }).catch(() => {});
    await prisma.dispensing.delete({ where: { id: disp.id } }).catch(() => {});
    await prisma.stockMovement.deleteMany({ where: { medicineId: medWithSm.id } }).catch(() => {});
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id } }).catch(() => {});
    await prisma.purchaseOrder.delete({ where: { id: po.id } }).catch(() => {});
    await prisma.visit.delete({ where: { id: visit.id } }).catch(() => {});
    await prisma.medicine.deleteMany({
      where: {
        id: { in: [medWithRx.id, medWithDisp.id, medWithSm.id, medWithPo.id] }
      }
    }).catch(() => {});

    console.log(`\n==========================================`);
    console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==========================================\n`);

  } catch (err: any) {
    console.error('Fatal error during test run:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
