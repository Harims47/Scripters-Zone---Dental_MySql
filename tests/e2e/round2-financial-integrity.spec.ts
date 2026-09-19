import { test, expect } from '@playwright/test';

test.describe('Round 2: Financial Integrity & Cross-Contamination Prevention', () => {

  test('FIN-1: Patient Billing Calculation (Consultation + Treatment Fee + Medicine Cost)', async ({ request }) => {
    // 1. Authenticate as Receptionist & Head Doctor
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    const uniquePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const patRes = await request.post('http://localhost:3001/api/patients', {
      data: {
        name: `QA-FIN-Calc-${Date.now()}`,
        phone: uniquePhone,
        age: 35,
        gender: 'Female'
      }
    });
    const patient = await patRes.json();

    // Create walk-in visit
    const regRes = await request.post('http://localhost:3001/api/visits/walk-in', {
      data: { patientId: patient.id, reasonForVisit: 'Root Canal' }
    });
    const visit = await regRes.json();

    // Assign doctor
    const staffRes = await request.get('http://localhost:3001/api/staff');
    const staffJson = await staffRes.json();
    const doc = (staffJson.data || staffJson).find((s: any) => s.name === 'Dr. QA Duty Doctor') || (staffJson.data || staffJson)[0];

    await request.patch(`http://localhost:3001/api/visits/${visit.id}`, {
      data: { doctorId: doc.id }
    });

    // Doctor login
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'dutydoctor', password: 'demo123' }
    });

    // Start consultation
    if (visit.queueEntry?.id) {
      await request.patch(`http://localhost:3001/api/queue/${visit.queueEntry.id}/transition`, {
        data: { action: 'START_CONSULTATION' }
      });
    }

    // Save consultation with consultationFee = ₹500, treatmentFee = ₹1200
    await request.post('http://localhost:3001/api/consultations', {
      data: {
        visitId: visit.id,
        doctorId: doc.id,
        reasonForVisit: 'Root Canal',
        clinicalNotes: 'First stage completed',
        consultationFee: 500,
        treatmentFee: 1200
      }
    });

    // Complete consultation
    await request.post(`http://localhost:3001/api/consultations/visit/${visit.id}/complete`, {
      data: {}
    });

    // Switch back to Receptionist to inspect billing
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    // Verify billing calculation: 500 + 1200 = 1700
    const billRes = await request.get(`http://localhost:3001/api/billing`);
    expect(billRes.status()).toBe(200);
    const billingQueue = await billRes.json();
    const visitBill = (billingQueue.data || billingQueue).find((b: any) => b.id === visit.id || b.visitId === visit.id);
    expect(visitBill).toBeTruthy();
    expect(visitBill.amountDue).toBe(1700);
  });

  test('FIN-2: Sequential Partial Payments and Overpayment Rejection', async ({ request }) => {
    // 1. Authenticate as Receptionist
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    const uniquePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const patRes = await request.post('http://localhost:3001/api/patients', {
      data: {
        name: `QA-FIN-Partial-${Date.now()}`,
        phone: uniquePhone,
        age: 40,
        gender: 'Male'
      }
    });
    const patient = await patRes.json();

    const regRes = await request.post('http://localhost:3001/api/visits/walk-in', {
      data: { patientId: patient.id, reasonForVisit: 'Cleaning' }
    });
    const visit = await regRes.json();

    const staffRes = await request.get('http://localhost:3001/api/staff');
    const doc = (await staffRes.json()).data.find((s: any) => s.name === 'Dr. QA Duty Doctor');

    await request.patch(`http://localhost:3001/api/visits/${visit.id}`, {
      data: { doctorId: doc.id }
    });

    // Doctor login & complete
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'dutydoctor', password: 'demo123' }
    });
    if (visit.queueEntry?.id) {
      await request.patch(`http://localhost:3001/api/queue/${visit.queueEntry.id}/transition`, {
        data: { action: 'START_CONSULTATION' }
      });
    }
    await request.post('http://localhost:3001/api/consultations', {
      data: {
        visitId: visit.id,
        doctorId: doc.id,
        reasonForVisit: 'Cleaning',
        clinicalNotes: 'Scaling done',
        consultationFee: 500,
        treatmentFee: 500
      }
    });
    await request.post(`http://localhost:3001/api/consultations/visit/${visit.id}/complete`, {
      data: {}
    });

    // Receptionist processes partial payments (Total Due: ₹1,000)
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    // Payment 1: ₹300 (Cash)
    const pay1 = await request.post('http://localhost:3001/api/payments', {
      data: {
        visitId: visit.id,
        amount: 300,
        method: 'Cash',
        notes: 'Partial payment 1',
        isFinalPayment: false
      }
    });
    expect(pay1.status()).toBe(201);

    // Verify balance after Payment 1: 1000 - 300 = 700
    const billCheck1 = await request.get('http://localhost:3001/api/billing');
    const bData1 = (await billCheck1.json()).data.find((b: any) => b.id === visit.id);
    const totalPaid1 = (bData1.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
    const balance1 = bData1.amountDue - totalPaid1;
    expect(totalPaid1).toBe(300);
    expect(balance1).toBe(700);

    // Payment 2: Attempt Overpayment of ₹800 (Balance is only ₹700) -> MUST BE REJECTED
    const overpay = await request.post('http://localhost:3001/api/payments', {
      data: {
        visitId: visit.id,
        amount: 800,
        method: 'UPI',
        notes: 'Illegal overpayment attempt'
      }
    });
    expect(overpay.status()).toBe(400);

    // Payment 3: Exact remaining ₹700 (GPay)
    const pay2 = await request.post('http://localhost:3001/api/payments', {
      data: {
        visitId: visit.id,
        amount: 700,
        method: 'GPay',
        notes: 'Final balance settlement',
        isFinalPayment: true
      }
    });
    expect(pay2.status()).toBe(201);

    // Payment 4: Attempt payment when balance is ₹0 -> MUST BE REJECTED
    const payAfterZero = await request.post('http://localhost:3001/api/payments', {
      data: {
        visitId: visit.id,
        amount: 50,
        method: 'Cash',
        notes: 'Payment after zero balance'
      }
    });
    expect([400, 409]).toContain(payAfterZero.status());

    // Verify individual payment history
    const allPaymentsRes = await request.get('http://localhost:3001/api/payments');
    const allPayments = (await allPaymentsRes.json()).data.filter((p: any) => p.visitId === visit.id);
    expect(allPayments.length).toBe(2);
    expect(allPayments.map((p: any) => p.method)).toEqual(expect.arrayContaining(['Cash', 'GPay']));
  });

  test('FIN-3: Supplier Bill Lifecycle, Payments & Outstanding Payable Isolation', async ({ request }) => {
    // 1. Authenticate as Head Doctor
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'headdoctor', password: 'demo123' }
    });

    const supRes = await request.get('http://localhost:3001/api/suppliers');
    const supList = (await supRes.json()).data || (await supRes.json());
    const supplierId = supList[0].id;

    // Create a ₹10,000 bill
    const invNum = `INV-FIN-${Date.now()}`;
    const billRes = await request.post('http://localhost:3001/api/supplier-bills', {
      data: {
        supplierId,
        invoiceNumber: invNum,
        invoiceDate: new Date().toISOString().split('T')[0],
        amount: 10000,
        notes: 'Financial test bill ₹10,000'
      }
    });
    expect(billRes.status()).toBe(201);
    const bill = await billRes.json();
    const billId = bill.id || bill.bill?.id;

    // Payment 1: ₹4,000
    const pay1 = await request.post(`http://localhost:3001/api/supplier-bills/${billId}/payments`, {
      data: { amount: 4000, method: 'Bank Transfer', notes: 'Supplier payment 1' }
    });
    expect(pay1.status()).toBe(201);

    // Verify bill state: Paid: 4,000, Outstanding: 6,000, Status: Partial
    const check1 = await request.get(`http://localhost:3001/api/supplier-bills/${billId}`);
    const b1 = await check1.json();
    expect(b1.totalPaid).toBe(4000);
    expect(b1.balance).toBe(6000);
    expect(b1.status).toBe('Partial');

    // Payment 2: Remaining ₹6,000
    const pay2 = await request.post(`http://localhost:3001/api/supplier-bills/${billId}/payments`, {
      data: { amount: 6000, method: 'UPI', notes: 'Supplier payment 2 full settlement' }
    });
    expect(pay2.status()).toBe(201);

    // Verify bill state: Paid: 10,000, Outstanding: 0, Status: Paid
    const check2 = await request.get(`http://localhost:3001/api/supplier-bills/${billId}`);
    const b2 = await check2.json();
    expect(b2.totalPaid).toBe(10000);
    expect(b2.balance).toBe(0);
    expect(b2.status).toBe('Paid');

    // Payment 3: Overpayment attempt after fully paid -> MUST BE REJECTED
    const payOver = await request.post(`http://localhost:3001/api/supplier-bills/${billId}/payments`, {
      data: { amount: 500, method: 'Cash' }
    });
    expect(payOver.status()).toBe(400);

    // Verify Supplier Payments NEVER appear in Patient Revenue
    const revenueReport = await request.get('http://localhost:3001/api/reports/revenue?timeframe=all');
    if (revenueReport.status() === 200) {
      const revData = await revenueReport.json();
      console.log('Revenue Report Summary:', revData);
      // Ensure supplier payments are not listed as patient payments
      if (Array.isArray(revData.transactions)) {
        const leaked = revData.transactions.filter((t: any) => t.invoiceNumber === invNum || t.supplierId);
        expect(leaked.length).toBe(0);
      }
    }
  });

});
