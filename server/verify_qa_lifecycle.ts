import { prisma } from './src/db';
import assert from 'assert';

const API_URL = 'http://localhost:3001/api';

async function request(endpoint: string, method = 'GET', body: any = null, token: string | null = null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `token=${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err: any = new Error(res.statusText);
    err.response = { status: res.status, data };
    throw err;
  }
  
  let returnedToken = data?.token;
  if (!returnedToken) {
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/token=([^;]+)/);
      if (match) returnedToken = match[1];
    }
  }
  
  return { status: res.status, data, token: returnedToken };
}

async function runQaLifecycle() {
  console.log('=== QA LIFECYCLE: MULTI-STEP STOCK CONSISTENCY & DISPENSING INTEGRATION ===\n');

  // 1. Auth as Head Doctor
  const loginRes = await request('/auth/login', 'POST', { username: 'headdoctor', password: 'demo123' });
  const token = loginRes.token;
  assert(token, 'Doctor login failed');

  // 2. Create dedicated medicine: starts at 0 stock
  const medName = 'QA Composite Med ' + Date.now();
  const medRes = await request('/inventory', 'POST', {
    name: medName,
    genericName: 'QA Composite',
    categoryId: 'cat1',
    unit: 'Tablets',
    stockWarningLevel: 25,
    unitPrice: 20,
    form: 'Tablet'
  }, token);
  const medId = medRes.data.id;
  assert.strictEqual(medRes.data.currentStock, 0, 'Starting stock must be 0');
  console.log('Step 0: Starting stock = 0');

  // 3. Create active Supplier
  const supRes = await request('/suppliers', 'POST', {
    name: 'QA Supplier ' + Date.now(),
    contactPerson: 'QA Vendor',
    phone: '9876500000',
    email: 'vendor@qa.com'
  }, token);
  const supplierId = supRes.data.id;

  // 4. Create PO 1 for 100 units
  const po1Res = await request('/purchase-orders', 'POST', {
    supplierId,
    items: [{ medicineId: medId, orderedQuantity: 100, unitCost: 15 }]
  }, token);
  const po1Id = po1Res.data.id;
  const po1ItemId = po1Res.data.items[0].id;
  await request(`/purchase-orders/${po1Id}/status`, 'PATCH', { status: 'Ordered' }, token);

  // 5. Receive 100 -> Stock = 100
  await request(`/purchase-orders/${po1Id}/receive`, 'POST', {
    items: [{ itemId: po1ItemId, receiveQuantity: 100 }]
  }, token);
  let med = await prisma.medicine.findUnique({ where: { id: medId } });
  assert.strictEqual(med?.currentStock, 100);
  console.log('Step 1: Receive 100 -> Stock = 100 (Verified)');

  // 6. Adjust -2 Expired -> Stock = 98
  await request(`/inventory/${medId}/adjust`, 'PATCH', {
    quantity: 2,
    type: 'SUBTRACT',
    reason: 'Expired'
  }, token);
  med = await prisma.medicine.findUnique({ where: { id: medId } });
  assert.strictEqual(med?.currentStock, 98);
  console.log('Step 2: Adjust -2 Expired -> Stock = 98 (Verified)');

  // 7. Real Dispensing: Create Patient -> Visit -> Prescription -> Dispense 10
  const patient = await prisma.patient.create({
    data: {
      name: 'QA Dispense Patient ' + Date.now(),
      phone: '9888' + Math.floor(100000 + Math.random() * 900000),
      age: 28,
      gender: 'Female'
    }
  });

  const doctor = await prisma.staff.findFirst({ where: { role: 'Head Doctor' } });
  const visit = await prisma.visit.create({
    data: {
      patientId: patient.id,
      doctorId: doctor!.id,
      status: 'READY_FOR_RECEPTION'
    }
  });

  const prescription = await prisma.prescription.create({
    data: {
      visitId: visit.id,
      doctorId: doctor!.id,
      notes: 'Take after food',
      items: {
        create: [
          {
            medicineId: medId,
            quantity: 10,
            dosage: '1 tablet',
            frequency: 'Twice daily',
            duration: '5 days',
            instructions: 'After lunch'
          }
        ]
      }
    }
  });

  // Call official completeDispensing endpoint
  const dispenseRes = await request('/dispensings/complete', 'POST', {
    visitId: visit.id,
    prescriptionId: prescription.id,
    items: [
      {
        medicineId: medId,
        prescribedQuantity: 10,
        dispensedQuantity: 10
      }
    ]
  }, token);
  assert(dispenseRes.data.dispensing, 'Dispensing object should be returned');
  assert.strictEqual(dispenseRes.data.dispensing.status, 'Completed');

  med = await prisma.medicine.findUnique({ where: { id: medId } });
  assert.strictEqual(med?.currentStock, 88);
  console.log('Step 3: Dispense 10 -> Stock = 88 (Verified via Reception Desk API)');

  // 8. Create PO 2 for 50 units -> Place Order -> Receive 20 -> Stock = 108
  const po2Res = await request('/purchase-orders', 'POST', {
    supplierId,
    items: [{ medicineId: medId, orderedQuantity: 50, unitCost: 15 }]
  }, token);
  const po2Id = po2Res.data.id;
  const po2ItemId = po2Res.data.items[0].id;
  await request(`/purchase-orders/${po2Id}/status`, 'PATCH', { status: 'Ordered' }, token);

  await request(`/purchase-orders/${po2Id}/receive`, 'POST', {
    items: [{ itemId: po2ItemId, receiveQuantity: 20 }]
  }, token);
  med = await prisma.medicine.findUnique({ where: { id: medId } });
  assert.strictEqual(med?.currentStock, 108);
  console.log('Step 4: Receive 20 -> Stock = 108 (Verified)');

  // 9. Adjust +5 Opening Stock -> Stock = 113
  await request(`/inventory/${medId}/adjust`, 'PATCH', {
    quantity: 5,
    type: 'ADD',
    reason: 'Opening Stock'
  }, token);
  med = await prisma.medicine.findUnique({ where: { id: medId } });
  assert.strictEqual(med?.currentStock, 113);
  console.log('Step 5: Adjust +5 Opening Stock -> Stock = 113 (Verified)');

  // 10. Audit Ledger Verification: Check all 5 stock movements in exact descending order
  const historyRes = await request(`/inventory/${medId}/history`, 'GET', null, token);
  const movements = historyRes.data.data;
  assert.strictEqual(movements.length, 5, 'Should have exactly 5 movements');

  console.log('\n--- Final Stock History Audit Ledger ---');
  movements.forEach((m: any) => {
    console.log(`[${new Date(m.createdAt).toLocaleTimeString()}] ${m.movementType.padEnd(16)} | Qty: ${(m.quantity > 0 ? '+' : '') + m.quantity}`.padEnd(42) + `| Balance: ${m.balanceAfter}`);
  });

  // Verify running balances from newest (113) down to initial (100)
  assert.strictEqual(movements[0].movementType, 'ADJUSTMENT');
  assert.strictEqual(movements[0].quantity, 5);
  assert.strictEqual(movements[0].balanceAfter, 113);

  assert.strictEqual(movements[1].movementType, 'PURCHASE_RECEIPT');
  assert.strictEqual(movements[1].quantity, 20);
  assert.strictEqual(movements[1].balanceAfter, 108);

  assert.strictEqual(movements[2].movementType, 'DISPENSING');
  assert.strictEqual(movements[2].quantity, -10);
  assert.strictEqual(movements[2].balanceAfter, 88);

  assert.strictEqual(movements[3].movementType, 'ADJUSTMENT');
  assert.strictEqual(movements[3].quantity, -2);
  assert.strictEqual(movements[3].balanceAfter, 98);

  assert.strictEqual(movements[4].movementType, 'PURCHASE_RECEIPT');
  assert.strictEqual(movements[4].quantity, 100);
  assert.strictEqual(movements[4].balanceAfter, 100);

  console.log('\n=====================================================================');
  console.log('FULL SECTION 24 & 25 STOCK CONSISTENCY & AUDIT LEDGER PASSED (100%)!');
  console.log('=====================================================================\n');
}

runQaLifecycle().catch((err) => {
  console.error('QA LIFECYCLE FAILED:', err.response?.data || err);
  process.exit(1);
});
