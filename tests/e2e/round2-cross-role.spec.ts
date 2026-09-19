import { test, expect } from '@playwright/test';

test.describe('Round 2: Cross-Role Coordination & Operational Integrity', () => {

  test('ROLE-1: Staff Attendance Modification RBAC & Doctor Queue Handover', async ({ request }) => {
    // 1. Receptionist cannot modify doctor attendance (Must get 403)
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    const staffRes = await request.get('http://localhost:3001/api/staff');
    const staffList = (await staffRes.json()).data;
    const dutyDoc = staffList.find((s: any) => s.name === 'Dr. QA Duty Doctor') || staffList[0];

    const unauthAttend = await request.put(`http://localhost:3001/api/staff/${dutyDoc.id}/attendance`, {
      data: { attendance: 'On Leave' }
    });
    expect(unauthAttend.status()).toBe(403);

    // 2. Head Doctor CAN modify doctor attendance
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'headdoctor', password: 'demo123' }
    });

    const authAttend = await request.put(`http://localhost:3001/api/staff/${dutyDoc.id}/attendance`, {
      data: { attendance: 'Present' }
    });
    expect(authAttend.status()).toBe(200);

    // 3. Receptionist registers patient & creates visit
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    const phone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const patRes = await request.post('http://localhost:3001/api/patients', {
      data: {
        name: `QA-CrossRole-${Date.now()}`,
        phone,
        age: 28,
        gender: 'Female'
      }
    });
    const patient = await patRes.json();

    const walkInRes = await request.post('http://localhost:3001/api/visits/walk-in', {
      data: {
        patientId: patient.id,
        doctorId: dutyDoc.id,
        reasonForVisit: 'Consultation and Plan'
      }
    });
    expect(walkInRes.status()).toBe(201);
    const visit = await walkInRes.json();

    // 4. Duty Doctor logs in & views queue
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'dutydoctor', password: 'demo123' }
    });

    const queueRes = await request.get('http://localhost:3001/api/queue');
    expect(queueRes.status()).toBe(200);
    const queue = await queueRes.json();
    const entry = (queue.data || queue).find((q: any) => q.visitId === visit.id || q.patientId === patient.id);
    expect(entry).toBeTruthy();

    // 5. Duty Doctor starts consultation
    const startRes = await request.patch(`http://localhost:3001/api/queue/${entry.id}/transition`, {
      data: { action: 'START_CONSULTATION' }
    });
    expect(startRes.status()).toBe(200);

    // 6. Add Treatment Plan items (Roadmap items)
    const catRes = await request.get('http://localhost:3001/api/treatments/catalog');
    const catalog = await catRes.json();
    if (catalog.length > 0) {
      const planItemRes = await request.post(`http://localhost:3001/api/treatments/${patient.id}/treatment-plan/items`, {
        data: {
          treatmentCatalogId: catalog[0].id,
          notes: 'Planned root canal therapy session 1',
          completedVisitId: null
        }
      });
      expect(planItemRes.status()).toBe(201);
    }

    // Save consultation with explicit consultationFee = 400
    await request.post('http://localhost:3001/api/consultations', {
      data: {
        visitId: visit.id,
        doctorId: dutyDoc.id,
        reasonForVisit: 'Consultation and Plan',
        clinicalNotes: 'Examined, treatment planned',
        consultationFee: 400
      }
    });

    // Complete consultation
    const compRes = await request.post(`http://localhost:3001/api/consultations/visit/${visit.id}/complete`, {
      data: {}
    });
    expect(compRes.status()).toBe(200);

    // 7. Verify visit transitioned to READY_FOR_RECEPTION
    const visitCheck = await request.get(`http://localhost:3001/api/visits/${visit.id}`);
    const vData = await visitCheck.json();
    expect(vData.status).toBe('READY_FOR_RECEPTION');

    // CRITICAL INVARIANT: Verify treatment plan did NOT silently add to amountDue!
    // amountDue must equal consultationFee = 400 (not inflated by treatment plan roadmap)
    expect(vData.amountDue).toBe(400);

    // 8. Verify Receptionist sees visit in Billing queue
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });
    const billingRes = await request.get('http://localhost:3001/api/billing');
    const billingData = (await billingRes.json()).data;
    const bEntry = billingData.find((b: any) => b.id === visit.id);
    expect(bEntry).toBeTruthy();
    expect(bEntry.amountDue).toBe(400);
  });

  test('ROLE-2: Duplicate Active Visit Prevention', async ({ request }) => {
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    const phone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const patRes = await request.post('http://localhost:3001/api/patients', {
      data: {
        name: `QA-ActiveVisitGuard-${Date.now()}`,
        phone,
        age: 32,
        gender: 'Male'
      }
    });
    const patient = await patRes.json();

    // First walk-in visit creation -> Success
    const v1 = await request.post('http://localhost:3001/api/visits/walk-in', {
      data: { patientId: patient.id, reasonForVisit: 'First Visit' }
    });
    expect(v1.status()).toBe(201);

    // Second walk-in visit creation for same active patient -> MUST BE REJECTED with 409
    const v2 = await request.post('http://localhost:3001/api/visits/walk-in', {
      data: { patientId: patient.id, reasonForVisit: 'Second Visit Attempt' }
    });
    expect(v2.status()).toBe(409);
    const err = await v2.json();
    expect(err.error).toContain('already has an active visit');
  });

});
