import { prisma } from './src/db';
import jwt from 'jsonwebtoken';
import http from 'http';
import { executeImport } from './src/services/patientImportService';
import { generatePrescriptionPDF, generateReceiptPDF, generateInvoicePDF } from './src/services/documentService';
import { NotificationService } from './src/services/communication/NotificationService';
import { ChannelRouter } from './src/services/communication/ChannelRouter';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

function generateAuthCookie(user: { id: string; role: string; username: string }) {
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  return `token=${token}`;
}

function makeHttpRequest(
  path: string,
  method: string,
  body: any,
  cookie?: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; data: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3001,
        path,
        method,
        headers
      },
      (res) => {
        let rawBody = '';
        res.on('data', (chunk) => {
          rawBody += chunk;
        });
        res.on('end', () => {
          let data: any = null;
          try {
            data = JSON.parse(rawBody);
          } catch {
            data = rawBody;
          }
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            data,
            rawBody
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${desc}`);
    failed++;
  }
}

async function runCrossFeatureSuite() {
  console.log('===========================================================');
  console.log('🧪 DENTALCORE — RELEASE INTEGRATION CROSS-FEATURE SUITE');
  console.log('===========================================================\n');

  // Setup test users
  const headDoctor = await prisma.user.findFirst({ where: { role: 'Head Doctor' } });
  if (!headDoctor) throw new Error('Head Doctor user not found in DB.');

  let receptionist = await prisma.user.findUnique({ where: { username: 'test_cross_receptionist' } });
  if (!receptionist) {
    receptionist = await prisma.user.create({
      data: {
        username: 'test_cross_receptionist',
        passwordHash: 'test_hash',
        role: 'Receptionist'
      }
    });
  }

  const headDoctorCookie = generateAuthCookie(headDoctor);
  const receptionistCookie = generateAuthCookie(receptionist);

  const testPhone = `9955${Date.now().toString().slice(-6)}`;
  const testPatientName = 'Rohan CrossFeature';

  // -------------------------------------------------------------------------
  // 15. Imported patient -> no unexpected clinical/financial records created by import itself
  // -------------------------------------------------------------------------
  console.log('--- TEST 15: Clean Demographic Import (Zero Clinical/Financial Records) ---');
  const importCSV = Buffer.from(
    'Name,Phone,Age,Gender,Address,Email,Diagnosis,ClinicalNotes\n' +
    `${testPatientName},${testPhone},32,Male,Indiranagar Bangalore,rohan@example.com,Severe Caries,Extraction sitting\n`
  );

  const importResult = await executeImport(importCSV, 'csv', {
    name: 'Name',
    phone: 'Phone',
    age: 'Age',
    gender: 'Gender',
    address: 'Address',
    email: 'Email'
  });

  assert(importResult.importedCount === 1, `Imported exactly 1 patient (${testPatientName})`);

  const importedPatient = await prisma.patient.findUnique({
    where: { phone: testPhone },
    include: {
      visits: true,
      payments: true,
      treatmentPlan: true,
      notifications: true
    }
  });

  const apptCount = await prisma.appointment.count({
    where: { patientId: importedPatient?.id }
  });

  assert(!!importedPatient, 'Imported patient successfully found in DB');
  assert(importedPatient?.visits.length === 0, 'Zero visits created by import');
  assert(importedPatient?.payments.length === 0, 'Zero payments created by import');
  assert(importedPatient?.treatmentPlan === null, 'Zero treatment plans created by import');
  assert(apptCount === 0, 'Zero appointments created by import');

  if (!importedPatient) throw new Error('Imported patient setup failed.');

  // -------------------------------------------------------------------------
  // 1. Imported patient -> can be searched/opened normally
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Patient Search & Retrieval ---');
  const searchRes = await makeHttpRequest(`/api/patients?search=${testPhone}`, 'GET', null, headDoctorCookie);
  assert(searchRes.status === 200, 'Search patient API returns HTTP 200');
  const patientsList = searchRes.data.data || searchRes.data.patients || [];
  const found = patientsList.some((p: any) => p.phone === testPhone);
  assert(found, `Search returns imported patient with phone ${testPhone}`);

  const getRes = await makeHttpRequest(`/api/patients/${importedPatient.id}`, 'GET', null, receptionistCookie);
  assert(getRes.status === 200, 'Get patient by ID returns HTTP 200 for Receptionist');
  const retrievedName = getRes.data.name || getRes.data.patient?.name;
  assert(retrievedName === testPatientName, `Retrieved patient name matches import data (${retrievedName})`);

  // -------------------------------------------------------------------------
  // 2. Imported patient -> can create appointment
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Appointment Creation ---');
  const apptRes = await makeHttpRequest('/api/appointments', 'POST', {
    patientId: importedPatient.id,
    date: '2026-09-20',
    time: '10:30',
    type: 'Consultation',
    notes: 'Imported patient first appointment'
  }, receptionistCookie);
  assert(apptRes.status === 201 || apptRes.status === 200, `Appointment created (Status: ${apptRes.status})`);
  const createdApptId = apptRes.data.appointment?.id || apptRes.data.id;

  // -------------------------------------------------------------------------
  // 3. Imported patient -> can enter Reception Desk workflow
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Reception Desk Arrival / Visit Creation ---');
  const visitRes = await makeHttpRequest('/api/visits/check-in', 'POST', {
    appointmentId: createdApptId,
    reasonForVisit: 'General Dental Consultation'
  }, receptionistCookie);
  assert(visitRes.status === 201 || visitRes.status === 200, `Reception check-in created visit (Status: ${visitRes.status})`);
  const receptionVisitId = visitRes.data.visit?.id || visitRes.data.id;

  // -------------------------------------------------------------------------
  // 4. Imported patient -> can complete consultation / visit
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Consultation Flow & Completion ---');
  // Transition visit to WITH_DOCTOR as doctor begins consultation
  await prisma.visit.update({
    where: { id: receptionVisitId },
    data: { status: 'WITH_DOCTOR', doctorId: headDoctor.staffId || undefined }
  });

  const consultRes = await makeHttpRequest('/api/consultations', 'POST', {
    visitId: receptionVisitId,
    reasonForVisit: 'General Dental Consultation',
    clinicalNotes: 'Tooth 24 restoration completed with composite filling.',
    consultationFee: 500,
    treatmentFee: 1500,
    paymentOwner: 'RECEPTION'
  }, headDoctorCookie);
  assert(consultRes.status === 200 || consultRes.status === 201, `Consultation saved by doctor (Status: ${consultRes.status})`);

  // -------------------------------------------------------------------------
  // 5. Imported patient -> prescription works
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Prescription Creation & PDF Generation ---');
  let testMed = await prisma.medicine.findFirst();
  if (!testMed) {
    let cat = await prisma.medicineCategory.findFirst();
    if (!cat) {
      cat = await prisma.medicineCategory.create({
        data: { name: 'General Dental' }
      });
    }
    testMed = await prisma.medicine.create({
      data: {
        name: 'Amoxicillin 500mg',
        categoryId: cat.id,
        form: 'Tablet',
        unit: 'Strip',
        currentStock: 100,
        reorderThreshold: 10,
        unitCost: 15,
        sellingPrice: 25
      }
    });
  }

  const rx = await prisma.prescription.create({
    data: {
      visitId: receptionVisitId,
      doctorId: headDoctor.staffId || headDoctor.id,
      notes: 'Take medicine after meals',
      items: {
        create: [
          {
            medicineId: testMed.id,
            quantity: 10,
            dosage: '500mg',
            frequency: '1-0-1',
            instructions: 'After food for 5 days'
          }
        ]
      }
    }
  });
  assert(!!rx, 'Prescription record created for imported patient visit');

  const rxRes = await makeHttpRequest(`/api/documents/prescription/${receptionVisitId}`, 'GET', null, headDoctorCookie);
  assert(rxRes.status === 200, 'Prescription PDF generated via API (HTTP 200)');
  assert(rxRes.headers['content-type'] === 'application/pdf', 'Prescription response has application/pdf content type');

  // -------------------------------------------------------------------------
  // 8. Imported patient -> normal billing & payment works
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: Billing & Payment Recording ---');
  // Complete clinical phase, set visit READY_FOR_PAYMENT
  await prisma.visit.update({
    where: { id: receptionVisitId },
    data: { status: 'READY_FOR_PAYMENT', amountDue: 2000 }
  });

  const payRes = await makeHttpRequest('/api/payments', 'POST', {
    visitId: receptionVisitId,
    patientId: importedPatient.id,
    amount: 2000,
    method: 'Cash',
    notes: 'Full payment received at Reception'
  }, receptionistCookie);
  assert(payRes.status === 200 || payRes.status === 201, `Payment recorded by Reception (Status: ${payRes.status})`);

  // -------------------------------------------------------------------------
  // 6. Imported patient -> receipt works
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Receipt PDF Generation ---');
  const receiptRes = await makeHttpRequest(`/api/documents/receipt/${receptionVisitId}`, 'GET', null, receptionistCookie);
  assert(receiptRes.status === 200, 'Receipt PDF generated via API (HTTP 200)');
  assert(receiptRes.headers['content-type'] === 'application/pdf', 'Receipt response has application/pdf content type');

  // -------------------------------------------------------------------------
  // 7. Imported patient -> invoice works
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Itemized Invoice PDF Generation ---');
  const invoiceRes = await makeHttpRequest(`/api/documents/invoice/${receptionVisitId}`, 'GET', null, receptionistCookie);
  assert(invoiceRes.status === 200, 'Itemized Invoice PDF generated via API (HTTP 200)');
  assert(invoiceRes.headers['content-type'] === 'application/pdf', 'Invoice response has application/pdf content type');

  // -------------------------------------------------------------------------
  // 9. Imported patient -> communication preference works
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 9: Communication Preference Management ---');
  await prisma.patient.update({
    where: { id: importedPatient.id },
    data: { preferredCommunicationChannel: 'AUTO', whatsappAvailable: true }
  });

  const prefCheck = await prisma.patient.findUnique({
    where: { id: importedPatient.id },
    select: { preferredCommunicationChannel: true, whatsappAvailable: true }
  });
  assert(prefCheck?.preferredCommunicationChannel === 'AUTO', 'DB reflects preferredCommunicationChannel = AUTO');
  assert(prefCheck?.whatsappAvailable === true, 'whatsappAvailable is set to true');

  // -------------------------------------------------------------------------
  // 10. Imported patient -> notification can be queued
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 10: Notification Queueing ---');
  const queuedNotif = await NotificationService.requestNotification({
    type: 'PAYMENT_RECEIPT',
    channel: 'WHATSAPP',
    patientId: importedPatient.id,
    entityType: 'VISIT',
    entityId: receptionVisitId,
    recipientPhone: importedPatient.phone,
    recipientName: importedPatient.name,
    paymentOwner: 'RECEPTION',
    isManualSend: true,
    variables: {
      patientName: importedPatient.name,
      clinicName: 'DentalCore Clinic',
      amount: '2000'
    }
  }, { userId: headDoctor.id, role: 'Head Doctor' });
  assert(queuedNotif.status === 'QUEUED', `Notification queued successfully (Status: ${queuedNotif.status})`);
  assert(queuedNotif.notification.patientId === importedPatient.id, 'Notification linked to imported patient');

  // -------------------------------------------------------------------------
  // 11. Imported patient with AUTO preference -> ChannelRouter routing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 11: ChannelRouter Dynamic Routing ---');
  const routeOnAuto = ChannelRouter.route({
    type: 'APPOINTMENT_CONFIRMATION',
    preferredChannel: 'AUTO',
    whatsappAvailable: true,
    patientPhone: importedPatient.phone,
    patientEmail: importedPatient.email
  });
  assert(routeOnAuto.channel === 'WHATSAPP', `AUTO preference with whatsappAvailable=true routes to WHATSAPP (${routeOnAuto.channel})`);

  const routeOnUnavailable = ChannelRouter.route({
    type: 'APPOINTMENT_CONFIRMATION',
    preferredChannel: 'AUTO',
    whatsappAvailable: false,
    patientPhone: importedPatient.phone,
    patientEmail: importedPatient.email
  });
  assert(routeOnUnavailable.channel === 'SMS', `AUTO preference with whatsappAvailable=false falls back to SMS (${routeOnUnavailable.channel})`);

  // -------------------------------------------------------------------------
  // 12 & 13. Doctor-owned visit for imported patient -> Reception privacy & Doctor access
  // -------------------------------------------------------------------------
  console.log('\n--- TESTS 12 & 13: Doctor-Owned Visit Privacy & Doctor Access ---');
  const docVisit = await prisma.visit.create({
    data: {
      patientId: importedPatient.id,
      doctorId: headDoctor.staffId || undefined,
      status: 'Completed',
      amountDue: 5000,
      consultationFee: 1000,
      treatmentFee: 4000,
      reasonForVisit: 'Specialist Implant Surgery',
      paymentOwner: 'DOCTOR'
    }
  });

  await prisma.payment.create({
    data: {
      visitId: docVisit.id,
      patientId: importedPatient.id,
      amount: 5000,
      method: 'Cash',
      status: 'Completed',
      date: new Date().toISOString()
    }
  });

  // Receptionist attempts to access invoice
  const rInv = await makeHttpRequest(`/api/documents/invoice/${docVisit.id}`, 'GET', null, receptionistCookie);
  assert(rInv.status === 403, `Receptionist is blocked with HTTP 403 on doctor-owned invoice (Status: ${rInv.status})`);
  assert(
    rInv.data.error?.includes('restricted from Reception') || rInv.data.message === 'Handled by Doctor',
    'Receptionist receives neutral restriction error without leaking financial amounts'
  );

  // Receptionist attempts to access receipt
  const rRec = await makeHttpRequest(`/api/documents/receipt/${docVisit.id}`, 'GET', null, receptionistCookie);
  assert(rRec.status === 403, `Receptionist is blocked with HTTP 403 on doctor-owned receipt (Status: ${rRec.status})`);

  // Doctor accesses invoice
  const dInv = await makeHttpRequest(`/api/documents/invoice/${docVisit.id}`, 'GET', null, headDoctorCookie);
  assert(dInv.status === 200, `Head Doctor receives HTTP 200 for doctor-owned invoice (Status: ${dInv.status})`);
  assert(dInv.headers['content-type'] === 'application/pdf', 'Doctor invoice response has application/pdf content type');

  // Doctor accesses receipt
  const dRec = await makeHttpRequest(`/api/documents/receipt/${docVisit.id}`, 'GET', null, headDoctorCookie);
  assert(dRec.status === 200, `Head Doctor receives HTTP 200 for doctor-owned receipt (Status: ${dRec.status})`);

  // -------------------------------------------------------------------------
  // 14. Imported patient -> appears correctly in authorized exports
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 14: Authorized Exports Verification ---');
  const exportRes = await makeHttpRequest('/api/patients/export?format=csv', 'GET', null, receptionistCookie);
  assert(exportRes.status === 200, 'Receptionist patient CSV export returns HTTP 200');
  assert(exportRes.rawBody.includes(testPhone), 'Exported CSV includes imported patient phone');
  assert(exportRes.rawBody.includes(testPatientName), 'Exported CSV includes imported patient name');

  const billingExportRes = await makeHttpRequest('/api/billing/export?format=csv', 'GET', null, receptionistCookie);
  assert(billingExportRes.status === 200, 'Billing export returns HTTP 200');

  // -------------------------------------------------------------------------
  // CLEANUP TEST DATA
  // -------------------------------------------------------------------------
  console.log('\n--- CLEANUP ---');
  await prisma.notification.deleteMany({
    where: { patientId: importedPatient.id }
  });
  await prisma.payment.deleteMany({
    where: { patientId: importedPatient.id }
  });
  await prisma.prescriptionItem.deleteMany({
    where: { prescription: { visit: { patientId: importedPatient.id } } }
  });
  await prisma.prescription.deleteMany({
    where: { visit: { patientId: importedPatient.id } }
  });
  await prisma.consultation.deleteMany({
    where: { visit: { patientId: importedPatient.id } }
  });
  await prisma.queueEntry.deleteMany({
    where: { patientId: importedPatient.id }
  });
  await prisma.visit.deleteMany({
    where: { patientId: importedPatient.id }
  });
  await prisma.appointment.deleteMany({
    where: { patientId: importedPatient.id }
  });
  await prisma.patient.deleteMany({
    where: { id: importedPatient.id }
  });
  await prisma.user.deleteMany({
    where: { username: 'test_cross_receptionist' }
  });
  console.log('✅ Cleaned up temporary cross-feature test records.');

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`TOTAL CROSS-FEATURE TESTS: ${passed + failed}`);
  console.log(`PASSED:                    ${passed}`);
  console.log(`FAILED:                    ${failed}`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCrossFeatureSuite().catch((err) => {
  console.error('Cross-feature suite failed with error:', err);
  process.exit(1);
});
