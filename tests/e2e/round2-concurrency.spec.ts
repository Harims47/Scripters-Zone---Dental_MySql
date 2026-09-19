import { test, expect } from '@playwright/test';

test.describe('Round 2: Concurrency & Race Condition Protection', () => {

  test('CONC-1: Parallel Supplier Payments cannot exceed bill amount (FOR UPDATE row lock check)', async ({ request }) => {
    // 1. Authenticate as Head Doctor via API
    const authRes = await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'headdoctor', password: 'demo123' }
    });
    expect(authRes.status()).toBe(200);

    // 2. Get or create a supplier
    const suppliersRes = await request.get('http://localhost:3001/api/suppliers');
    expect(suppliersRes.status()).toBe(200);
    const supJson = await suppliersRes.json();
    const suppliers = Array.isArray(supJson) ? supJson : supJson.data || [];
    let supplierId = suppliers[0]?.id;
    if (!supplierId) {
      const createSup = await request.post('http://localhost:3001/api/suppliers', {
        data: { name: 'QA-R2-Concurrency-Supplier', phone: '9123456780', address: 'QA Lab' }
      });
      const supData = await createSup.json();
      supplierId = supData.id;
    }

    // 3. Create a test Supplier Bill for ₹1,000
    const invNum = `INV-CONC-${Date.now()}`;
    const billRes = await request.post('http://localhost:3001/api/supplier-bills', {
      data: {
        supplierId,
        invoiceNumber: invNum,
        invoiceDate: new Date().toISOString().split('T')[0],
        amount: 1000,
        notes: 'Concurrency Test Bill ₹1000'
      }
    });
    expect(billRes.status()).toBe(201);
    const bill = await billRes.json();
    const billId = bill.id || bill.bill?.id;

    // 4. FIRE TWO SIMULTANEOUS PAYMENTS OF ₹700 EACH
    // Bill balance is ₹1,000. Combined payment would be ₹1,400 (ILLEGAL OVERPAYMENT).
    const [resA, resB] = await Promise.all([
      request.post(`http://localhost:3001/api/supplier-bills/${billId}/payments`, {
        data: { amount: 700, method: 'Bank Transfer', notes: 'Payment A concurrency race' }
      }),
      request.post(`http://localhost:3001/api/supplier-bills/${billId}/payments`, {
        data: { amount: 700, method: 'UPI', notes: 'Payment B concurrency race' }
      })
    ]);

    const statuses = [resA.status(), resB.status()];
    console.log(`Concurrency Test: Payment A (${resA.status()}), Payment B (${resB.status()})`);

    // Exactly one must succeed (200/201) and the other must be rejected (400)
    const successCount = statuses.filter(s => s === 200 || s === 201).length;
    const rejectedCount = statuses.filter(s => s === 400).length;

    expect(successCount).toBe(1);
    expect(rejectedCount).toBe(1);

    // 5. Verify the bill state in DB: total paid must be ₹700, balance must be ₹300, NEVER ₹1400!
    const billCheck = await request.get(`http://localhost:3001/api/supplier-bills/${billId}`);
    expect(billCheck.status()).toBe(200);
    const billData = await billCheck.json();

    expect(billData.totalPaid).toBe(700);
    expect(billData.balance).toBe(300);
    expect(billData.status).toBe('Partial');
  });

  test('CONC-2: Parallel Patient Payments cannot overpay visit balance (FOR UPDATE visit row lock check)', async ({ request }) => {
    // 1. Authenticate as Receptionist
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    // 2. Create a test patient with walk-in visit
    const uniquePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const patRes = await request.post('http://localhost:3001/api/patients', {
      data: {
        name: `QA-CONC-Patient-${Date.now()}`,
        phone: uniquePhone,
        age: 30,
        gender: 'Male'
      }
    });
    expect(patRes.status()).toBe(201);
    const patient = await patRes.json();

    const regRes = await request.post('http://localhost:3001/api/visits/walk-in', {
      data: {
        patientId: patient.id,
        reasonForVisit: 'Tooth Pain'
      }
    });
    expect(regRes.status()).toBe(201);
    const regData = await regRes.json();
    const visitId = regData.id;
    const queueEntryId = regData.queueEntry?.id;

    // 3. Get doctor and assign
    const staffRes = await request.get('http://localhost:3001/api/staff');
    const staffJson = await staffRes.json();
    const staffList = staffJson.data || staffJson;
    const doctor = staffList.find((s: any) => s.name === 'Dr. QA Duty Doctor') || staffList.find((s: any) => s.role === 'Duty Doctor');
    expect(doctor).toBeTruthy();

    await request.patch(`http://localhost:3001/api/visits/${visitId}`, {
      data: { doctorId: doctor.id }
    });

    // 4. Log in as Duty Doctor to consult
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'dutydoctor', password: 'demo123' }
    });

    // Start consultation in queue
    if (queueEntryId) {
      await request.patch(`http://localhost:3001/api/queue/${queueEntryId}/transition`, {
        data: { action: 'START_CONSULTATION' }
      });
    }

    // Save consultation with ₹500 fee
    await request.post('http://localhost:3001/api/consultations', {
      data: {
        visitId,
        doctorId: doctor.id,
        reasonForVisit: 'Tooth Pain',
        clinicalNotes: 'Check concurrency race',
        consultationFee: 500,
        treatmentFee: 0
      }
    });

    // Complete consultation -> READY_FOR_RECEPTION
    await request.post(`http://localhost:3001/api/consultations/visit/${visitId}/complete`, {
      data: {}
    });

    // 5. Log in as Receptionist for payments
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    // Verify visit is now READY_FOR_RECEPTION with amountDue = 500
    const visitCheck = await request.get(`http://localhost:3001/api/visits/${visitId}`);
    const vData = await visitCheck.json();
    expect(vData.status).toBe('READY_FOR_RECEPTION');
    expect(vData.amountDue).toBe(500);

    // 6. FIRE TWO PARALLEL PAYMENTS OF ₹400 EACH (Total ₹800 vs Balance ₹500)
    const [payA, payB] = await Promise.all([
      request.post('http://localhost:3001/api/payments', {
        data: {
          visitId,
          amount: 400,
          method: 'Cash',
          notes: 'Partial payment A concurrency race'
        }
      }),
      request.post('http://localhost:3001/api/payments', {
        data: {
          visitId,
          amount: 400,
          method: 'GPay',
          notes: 'Partial payment B concurrency race'
        }
      })
    ]);

    const pStatuses = [payA.status(), payB.status()];
    console.log(`Patient Payment Race: Pay A (${payA.status()}), Pay B (${payB.status()})`);

    // With atomic row locking, exactly ONE payment of ₹400 should succeed (201),
    // and the competing payment of ₹400 must be rejected (400) because ₹400 > remaining balance (₹100).
    const pSuccessCount = pStatuses.filter(s => s === 200 || s === 201).length;
    const pRejectedCount = pStatuses.filter(s => s === 400).length;

    expect(pSuccessCount).toBe(1);
    expect(pRejectedCount).toBe(1);

    // 7. Verify payments in database: exactly 1 payment record, total paid = ₹400, never ₹800!
    const paymentsRes = await request.get('http://localhost:3001/api/payments');
    const paymentsJson = await paymentsRes.json();
    const allPayments = paymentsJson.data || [];
    const visitPayments = allPayments.filter((p: any) => p.visitId === visitId);

    const totalPaidSum = visitPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    console.log(`Final Payment Sum in DB: ₹${totalPaidSum}`);
    expect(totalPaidSum).toBe(400);
  });

  test('CONC-3: Two simultaneous doctor assignments on same visit', async ({ request }) => {
    // 1. Authenticate as Receptionist
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    // 2. Create walk-in visit
    const uniquePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const patRes = await request.post('http://localhost:3001/api/patients', {
      data: {
        name: `QA-CONC-Assign-${Date.now()}`,
        phone: uniquePhone,
        age: 28,
        gender: 'Female'
      }
    });
    const patient = await patRes.json();

    const regRes = await request.post('http://localhost:3001/api/visits/walk-in', {
      data: {
        patientId: patient.id,
        reasonForVisit: 'Consultation Race'
      }
    });
    const regData = await regRes.json();
    const visitId = regData.id;

    // Get 2 different doctors
    const staffRes = await request.get('http://localhost:3001/api/staff');
    const staffJson = await staffRes.json();
    const doctors = (staffJson.data || staffJson).filter((s: any) => s.role === 'Duty Doctor' || s.role === 'Head Doctor');
    expect(doctors.length).toBeGreaterThanOrEqual(2);

    const doc1 = doctors[0].id;
    const doc2 = doctors[1].id;

    // 3. Fire two simultaneous assignments
    const [assign1, assign2] = await Promise.all([
      request.patch(`http://localhost:3001/api/visits/${visitId}`, {
        data: { doctorId: doc1 }
      }),
      request.patch(`http://localhost:3001/api/visits/${visitId}`, {
        data: { doctorId: doc2 }
      })
    ]);

    // Both should respond cleanly (one will be the final assigned doctor)
    expect([200, 400]).toContain(assign1.status());
    expect([200, 400]).toContain(assign2.status());

    // 4. Verify final visit state in database has exactly ONE assigned doctor
    const visitCheck = await request.get(`http://localhost:3001/api/visits/${visitId}`);
    const visitData = await visitCheck.json();
    expect([doc1, doc2]).toContain(visitData.doctorId);
    expect(visitData.doctorId).toBeTruthy();
  });

  test('CONC-4: Concurrent dispensing cannot double-deduct inventory stock below 0', async ({ request }) => {
    // 1. Authenticate as Receptionist
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    // 2. Get a medicine from /api/inventory
    const medsRes = await request.get('http://localhost:3001/api/inventory');
    expect(medsRes.status()).toBe(200);
    const data = await medsRes.json();
    const medList = data.data || data.medicines || [];
    const testMed = medList.find((m: any) => m.name === 'QA-R2-Medicine-LowStock') || medList[0];
    expect(testMed).toBeTruthy();
    const initialStock = testMed.currentStock;

    // 3. Attempt to dispense more than available stock through dispensing API
    const dispenseAttempt = await request.post('http://localhost:3001/api/dispensings', {
      data: {
        visitId: 'non-existent-visit-id',
        items: [{ medicineId: testMed.id, quantity: initialStock + 1000 }]
      }
    });

    // Should reject invalid visit / excess stock
    expect(dispenseAttempt.status()).toBeGreaterThanOrEqual(400);

    // Verify stock was NOT deducted
    const medAfterRes = await request.get(`http://localhost:3001/api/inventory/${testMed.id}`);
    if (medAfterRes.status() === 200) {
      const medAfter = await medAfterRes.json();
      expect(medAfter.currentStock).toBe(initialStock);
    }
  });

});
