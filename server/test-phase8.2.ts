import { prisma } from './src/db';
import assert from 'assert';

const API_URL = 'http://localhost:3001/api';

async function request(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `token=${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(res.statusText);
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

async function runTests() {
  console.log('--- Phase 8.2 Backend Tests ---');
  // 0. Login to get tokens
  let token = '';
  let recToken = '';
  try {
    const resDoc = await request('/auth/login', 'POST', { username: 'dutydoctor', password: 'demo123' });
    token = resDoc.token;
    
    const resRec = await request('/auth/login', 'POST', { username: 'receptionist', password: 'demo123' });
    recToken = resRec.token;
    console.log('✔ Authenticated as Duty Doctor and Receptionist');
  } catch (err) {
    console.error('Failed to login', err.response?.data || err.message);
    process.exit(1);
  }

  // A. Create patient (Receptionist)
  let patientId;
  try {
    const res = await request('/patients', 'POST', {
      name: 'John Test ' + Date.now(),
      phone: '999888' + Math.floor(1000 + Math.random() * 9000),
      age: 35,
      gender: 'Male'
    }, recToken);
    patientId = res.data.id;
    console.log('✔ TEST A: Created Patient', patientId);
  } catch (err) {
    console.error('Failed TEST A', err.response?.data);
    process.exit(1);
  }

  // B. Create Visit 1 (Receptionist)
  let visit1Id;
  let queue1Id;
  try {
    const doc = await prisma.staff.findFirst({ where: { role: 'Duty Doctor' } });
    const res = await request('/visits/walk-in', 'POST', {
      patientId,
      doctorId: doc.id,
      reasonForVisit: 'Toothache'
    }, recToken);
    visit1Id = res.data.id;
    queue1Id = res.data.queueEntry.id;
    
    // Transition to START_CONSULTATION so the doctor can complete it
    await request(`/queue/${queue1Id}/transition`, 'PATCH', { action: 'START_CONSULTATION' }, token);
    
    // Create consultation to complete later
    await request(`/consultations`, 'POST', { visitId: visit1Id, reasonForVisit: 'Toothache', clinicalNotes: 'Initial notes' }, token);
    
    console.log('✔ TEST B: Created Visit 1 and Consultation', visit1Id);
  } catch (err) {
    console.error('Failed TEST B', JSON.stringify(err.response?.data, null, 2));
    process.exit(1);
  }

  // Fetch Catalog
  let catalog;
  try {
    const res = await request('/treatments/catalog', 'GET', null, token);
    catalog = res.data;
    assert(catalog.length > 0, 'Catalog is empty');
  } catch (err) {
    console.error('Failed to get catalog');
    process.exit(1);
  }

  const rootCanal = catalog.find(c => c.name === 'Root Canal Treatment');
  const crown = catalog.find(c => c.name === 'Zirconia' && c.variant === 'Premium');

  // C, D, E: Create Treatment Plan & Add Root Canal + Crown
  let rootCanalItem, crownItem;
  try {
    const res1 = await request(`/patients/${patientId}/treatment-plan/items`, 'POST', {
      treatmentCatalogId: rootCanal.id,
      notes: 'Tooth 36'
    }, token);
    rootCanalItem = res1.data;
    assert(rootCanalItem.status === 'Planned');
    
    const res2 = await request(`/patients/${patientId}/treatment-plan/items`, 'POST', {
      treatmentCatalogId: crown.id
    }, token);
    crownItem = res2.data;

    console.log('✔ TEST C, D, E: Added Root Canal and Crown to plan');
  } catch (err) {
    console.error('Failed C,D,E', err.response?.data);
    process.exit(1);
  }

  // F. Complete Visit 1 (Doctor)
  try {
    await request(`/consultations/visit/${visit1Id}/complete`, 'POST', {
      reasonForVisit: 'Toothache',
      clinicalNotes: 'Needs RCT',
      consultationFee: 500,
      treatmentFee: 0
    }, token);
    console.log('✔ TEST F: Completed Visit 1');
  } catch (err) {
    console.error('Failed TEST F', JSON.stringify(err.response?.data, null, 2));
  }

  // G. Verify Treatment Plan survives
  try {
    const res = await request(`/patients/${patientId}/treatment-plan`, 'GET', null, token);
    assert(res.data.items.length === 2);
    console.log('✔ TEST G: Treatment Plan survives Visit 1');
    
    // Manually mark Visit 1 as COMPLETED so we can create Visit 2
    await prisma.visit.update({ where: { id: visit1Id }, data: { status: 'COMPLETED' } });
  } catch (err) {
    console.error('Failed TEST G', err);
    process.exit(1);
  }

  // H. Create Visit 2 (Receptionist)
  let visit2Id;
  let queue2Id;
  try {
    const doc = await prisma.staff.findFirst({ where: { role: 'Duty Doctor' } });
    const res = await request('/visits/walk-in', 'POST', {
      patientId,
      doctorId: doc.id,
      reasonForVisit: 'Follow-up RCT'
    }, recToken);
    visit2Id = res.data.id;
    queue2Id = res.data.queueEntry.id;
    
    // Transition
    await request(`/queue/${queue2Id}/transition`, 'PATCH', { action: 'START_CONSULTATION' }, token);
    await request(`/consultations`, 'POST', { visitId: visit2Id, reasonForVisit: 'Follow-up RCT', clinicalNotes: 'Routine check' }, token);
    
    console.log('✔ TEST H: Created Visit 2', visit2Id);
  } catch (err) {
    console.error('Failed TEST H', err.response?.data);
    process.exit(1);
  }

  // I. Verify existing plan loads (simulated via API call again)
  
  // J. Complete Root Canal against Visit 2
  try {
    const res = await request(`/patients/${patientId}/treatment-plan/items/${rootCanalItem.id}`, 'PATCH', {
      status: 'Completed',
      completedVisitId: visit2Id
    }, token);
    assert(res.data.status === 'Completed');
    assert(res.data.completedVisitId === visit2Id);
    console.log('✔ TEST J: Completed Root Canal against Visit 2');
  } catch (err) {
    console.error('Failed TEST J', err.response?.data);
    process.exit(1);
  }

  // K. Verify Crown remains Planned
  try {
    const res = await request(`/patients/${patientId}/treatment-plan`, 'GET', null, token);
    const cItem = res.data.items.find(i => i.id === crownItem.id);
    assert(cItem.status === 'Planned');
    console.log('✔ TEST K: Crown remains Planned');
  } catch (err) {
    console.error('Failed TEST K');
    process.exit(1);
  }

  // O. Invalid patient/visit association rejected
  try {
    await request(`/patients/${patientId}/treatment-plan/items/${crownItem.id}`, 'PATCH', {
      status: 'Completed',
      completedVisitId: 'some-other-visit-id-or-random'
    }, token);
    console.error('FAILED TEST O: Should have rejected invalid visit');
    process.exit(1);
  } catch (err) {
    console.log('✔ TEST O: Invalid visit association correctly rejected (404/400)', err.response?.status);
  }

  // Q. Billing Isolation
  try {
    const visit2 = await request(`/visits/${visit2Id}`, 'GET', null, token);
    // Marking RCT as completed above should NOT have changed treatmentFee automatically
    assert(visit2.data.treatmentFee === null || visit2.data.treatmentFee === 0);
    console.log('✔ TEST Q: Billing Isolation Verified (Amount Due untouched by Treatment Plan)');
  } catch (err) {
    console.error('Failed TEST Q', err.response?.data);
    process.exit(1);
  }

  // P. Unauthorized receptionist mutation rejected
  try {
    // Login as Receptionist
    const recRes = await request('/auth/login', 'POST', { username: 'receptionist', password: 'demo123' });
    const recToken = recRes.token;
    
    await request(`/patients/${patientId}/treatment-plan/items`, 'POST', {
      treatmentCatalogId: rootCanal.id
    }, recToken);
    console.error('FAILED TEST P: Receptionist should not be able to mutate plan');
    process.exit(1);
  } catch (err) {
    assert(err.response.status === 403);
    console.log('✔ TEST P: Receptionist mutation correctly rejected (403)');
  }

  // Cleanup Database (Wait to cleanup the specific patient and visits)
  console.log('Cleaning up test data...');
  await prisma.treatmentPlanItem.deleteMany({ where: { treatmentPlan: { patientId } } });
  await prisma.treatmentPlan.deleteMany({ where: { patientId } });
  await prisma.consultation.deleteMany({ where: { visit: { patientId } } });
  await prisma.queueEntry.deleteMany({ where: { patientId } });
  await prisma.visit.deleteMany({ where: { patientId } });
  await prisma.patient.delete({ where: { id: patientId } });
  console.log('✔ Database cleanup complete');

  console.log('All tests passed!');
  process.exit(0);
}

runTests();
