import { test, expect } from '@playwright/test';

test.describe('Round 2: Data Persistence, Cancellation Safety & Session Retention', () => {

  test('PERSIST-1: Patient Demographic & Contact Integrity Across Revisit', async ({ request }) => {
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    const phone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const originalAddress = '123 Anna Salai, Chennai, Tamil Nadu 600002';
    
    // Register patient with full fields
    const createRes = await request.post('http://localhost:3001/api/patients', {
      data: {
        name: `QA-Patient-Persist-${Date.now()}`,
        phone,
        age: 45,
        gender: 'Male',
        address: originalAddress
      }
    });
    expect(createRes.status()).toBe(201);
    const pat = await createRes.json();
    expect(pat.address).toBe(originalAddress);

    // Re-fetch patient
    const fetchRes = await request.get(`http://localhost:3001/api/patients/${pat.id}`);
    expect(fetchRes.status()).toBe(200);
    const fetched = await fetchRes.json();
    expect(fetched.address).toBe(originalAddress);
    expect(fetched.phone).toBe(phone);

    // Update patient address using PATCH
    const updatedAddress = '456 OMR IT Highway, Sholinganallur, Chennai 600119';
    const updateRes = await request.patch(`http://localhost:3001/api/patients/${pat.id}`, {
      data: {
        name: pat.name,
        phone: pat.phone,
        age: pat.age,
        gender: pat.gender,
        address: updatedAddress
      }
    });
    expect(updateRes.status()).toBe(200);

    // Verify updated address persisted
    const fetchAfterUpdate = await request.get(`http://localhost:3001/api/patients/${pat.id}`);
    expect((await fetchAfterUpdate.json()).address).toBe(updatedAddress);
  });

  test('PERSIST-2: Cancellation Safety: Complete Non-Destructive Lifecycle', async ({ request }) => {
    // 1. Receptionist login & setup patient + visit
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    const phone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const patRes = await request.post('http://localhost:3001/api/patients', {
      data: {
        name: `QA-CancelSafety-${Date.now()}`,
        phone,
        age: 50,
        gender: 'Female'
      }
    });
    const patient = await patRes.json();

    const staffRes = await request.get('http://localhost:3001/api/staff');
    const doc = (await staffRes.json()).data.find((s: any) => s.name === 'Dr. QA Duty Doctor');

    const vRes = await request.post('http://localhost:3001/api/visits/walk-in', {
      data: {
        patientId: patient.id,
        doctorId: doc.id,
        reasonForVisit: 'Pre-cancellation audit'
      }
    });
    const visit = await vRes.json();

    // 2. Doctor consultation & complete to reach READY_FOR_RECEPTION
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
        reasonForVisit: 'Pre-cancellation audit',
        clinicalNotes: 'Examined before cancellation test',
        consultationFee: 300
      }
    });
    await request.post(`http://localhost:3001/api/consultations/visit/${visit.id}/complete`, {
      data: {}
    });

    // 3. Receptionist records a partial payment of ₹100
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });
    const payRes = await request.post('http://localhost:3001/api/payments', {
      data: {
        visitId: visit.id,
        amount: 100,
        method: 'Cash',
        notes: 'Deposit before cancellation'
      }
    });
    expect(payRes.status()).toBe(201);

    // 4. CANCEL the visit
    const cancelRes = await request.patch(`http://localhost:3001/api/visits/${visit.id}/cancel`, {
      data: {}
    });
    expect(cancelRes.status()).toBe(200);
    const cancelledVisit = await cancelRes.json();
    expect(cancelledVisit.status).toBe('CANCELLED');

    // 5. Attempt second cancellation -> MUST BE REJECTED with 400 (Cannot cancel already CANCELLED visit)
    const secondCancel = await request.patch(`http://localhost:3001/api/visits/${visit.id}/cancel`, {
      data: {}
    });
    expect(secondCancel.status()).toBe(400);

    // 6. INVARIANT AUDIT: Verify non-destructive integrity
    // Patient still exists
    const patAudit = await request.get(`http://localhost:3001/api/patients/${patient.id}`);
    expect(patAudit.status()).toBe(200);

    // Historical visit still exists and is accessible
    const visitAudit = await request.get(`http://localhost:3001/api/visits/${visit.id}`);
    expect(visitAudit.status()).toBe(200);
    expect((await visitAudit.json()).status).toBe('CANCELLED');

    // Payments associated with cancelled visit are preserved
    const payAudit = await request.get('http://localhost:3001/api/payments');
    const payments = (await payAudit.json()).data;
    const existingPayment = payments.find((p: any) => p.visitId === visit.id);
    expect(existingPayment).toBeTruthy();
    expect(existingPayment.amount).toBe(100);
  });

  test('PERSIST-3: UI Session Retention & Navigation Refresh Across Views', async ({ page }) => {
    // 1. Browser login as Receptionist
    await page.goto('http://localhost:5173/login');
    await page.locator('#username').fill('receptionist');
    await page.locator('#password').fill('demo123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('http://localhost:5173/reception-desk');

    // 2. Refresh on Reception Desk
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Reception Desk|Today's Queue|Waiting/i).first()).toBeVisible();

    // 3. Navigate to Patients and refresh
    await page.goto('http://localhost:5173/patients');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Patient Records|All Patients|Search/i).first()).toBeVisible();

    // 4. Navigate to Partial Payments and refresh
    await page.goto('http://localhost:5173/partial-payments');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Partial Payments|Outstanding/i).first()).toBeVisible();
  });

});
