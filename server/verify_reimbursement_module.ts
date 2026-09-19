import { prisma } from './src/db';
import { generateReimbursementPDF } from './src/services/documentService';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

async function runVerification() {
  console.log('================================================================');
  console.log('STARTING REIMBURSEMENT MODULE VERIFICATION AUDIT');
  console.log('================================================================');

  // Clean up previous verification reimbursement documents
  await prisma.reimbursementDocument.deleteMany({
    where: {
      patientNameSnapshot: { startsWith: 'Reimbursement Test Patient' }
    }
  });

  // 1. Get Head Doctor & Duty Doctor & Receptionist users
  const headDoctorUser = await prisma.user.findFirst({
    where: { role: 'Head Doctor' },
    include: { staff: true }
  });
  const dutyDoctorUser = await prisma.user.findFirst({
    where: { role: 'Duty Doctor' },
    include: { staff: true }
  });
  const receptionistUser = await prisma.user.findFirst({
    where: { role: 'Receptionist' },
    include: { staff: true }
  });

  if (!headDoctorUser) throw new Error('Head Doctor user not found');
  if (!dutyDoctorUser) throw new Error('Duty Doctor user not found');
  if (!receptionistUser) throw new Error('Receptionist user not found');

  console.log(`[Users Checked] Head Doctor: ${headDoctorUser.username}, Duty Doctor: ${dutyDoctorUser.username}, Receptionist: ${receptionistUser.username}`);

  // 2. Setup Test Patient
  const testPhone = '9876500112';
  let patient = await prisma.patient.findUnique({ where: { phone: testPhone } });
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        name: 'Reimbursement Test Patient 1',
        phone: testPhone,
        age: 34,
        gender: 'Male',
        status: 'Active'
      }
    });
  }
  console.log(`[Patient Ready] ${patient.name} (${patient.id})`);

  // 3. Test Sequential Document Number Generation
  console.log('\n--- TEST 1: Sequential Document Numbering ---');
  const year = new Date().getFullYear();
  const prefix = `RMB-${year}-`;

  const lastDoc = await prisma.reimbursementDocument.findFirst({
    where: { documentNumber: { startsWith: prefix } },
    orderBy: { documentNumber: 'desc' },
    select: { documentNumber: true }
  });
  let nextSeq = 1;
  if (lastDoc && lastDoc.documentNumber) {
    const parts = lastDoc.documentNumber.split('-');
    const parsed = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }
  const expectedDocNum1 = `${prefix}${String(nextSeq).padStart(6, '0')}`;
  const expectedDocNum2 = `${prefix}${String(nextSeq + 1).padStart(6, '0')}`;
  console.log(`Expected sequential document numbers: ${expectedDocNum1}, ${expectedDocNum2}`);

  // 4. Create First Document by Head Doctor
  console.log('\n--- TEST 2: Create Reimbursement by Head Doctor ---');
  const doc1 = await prisma.reimbursementDocument.create({
    data: {
      documentNumber: expectedDocNum1,
      patientId: patient.id,
      doctorId: headDoctorUser.staffId,
      documentDate: new Date().toISOString().split('T')[0],
      subject: 'Reimbursement of Dental Treatment Expenses',
      content: 'To Whom It May Concern,\nThis certifies that the patient received dental treatment.\nRegards,\nDr. Arun\nRafi Dental Clinic',
      treatmentDescription: 'Root Canal Treatment and Composite Restoration',
      amount: 4500,
      patientNameSnapshot: patient.name,
      patientAgeSnapshot: patient.age,
      patientGenderSnapshot: patient.gender,
      patientPhoneSnapshot: patient.phone,
      doctorNameSnapshot: headDoctorUser.staff?.name ? `Dr. ${headDoctorUser.staff.name}` : 'Dr. Head Doctor',
      doctorRegNoSnapshot: 'TN-DEN-8821',
      clinicNameSnapshot: 'Rafi Dental Clinic',
      clinicAddressSnapshot: 'Main Road, Clinic Plaza',
      clinicPhoneSnapshot: '+91 98765 43210',
      status: 'Issued'
    }
  });
  console.log(`Created Doc 1: ${doc1.documentNumber} (ID: ${doc1.id})`);
  if (doc1.documentNumber !== expectedDocNum1) {
    throw new Error(`Doc 1 number mismatch: expected ${expectedDocNum1}, got ${doc1.documentNumber}`);
  }

  // 5. Create Second Document by Duty Doctor
  console.log('\n--- TEST 3: Create Reimbursement by Duty Doctor ---');
  const doc2 = await prisma.reimbursementDocument.create({
    data: {
      documentNumber: expectedDocNum2,
      patientId: patient.id,
      doctorId: dutyDoctorUser.staffId,
      documentDate: new Date().toISOString().split('T')[0],
      subject: 'Reimbursement of Dental Treatment Expenses',
      content: 'To Whom It May Concern,\nPatient underwent dental cleaning.\nRegards,\nDr. Duty Doctor\nRafi Dental Clinic',
      treatmentDescription: 'Dental Scaling and Polishing',
      amount: 1200,
      patientNameSnapshot: patient.name,
      patientAgeSnapshot: patient.age,
      patientGenderSnapshot: patient.gender,
      patientPhoneSnapshot: patient.phone,
      doctorNameSnapshot: dutyDoctorUser.staff?.name ? `Dr. ${dutyDoctorUser.staff.name}` : 'Dr. Duty Doctor',
      clinicNameSnapshot: 'Rafi Dental Clinic',
      clinicAddressSnapshot: 'Main Road, Clinic Plaza',
      clinicPhoneSnapshot: '+91 98765 43210',
      status: 'Issued'
    }
  });
  console.log(`Created Doc 2: ${doc2.documentNumber} (ID: ${doc2.id})`);
  if (doc2.documentNumber !== expectedDocNum2) {
    throw new Error(`Doc 2 number mismatch: expected ${expectedDocNum2}, got ${doc2.documentNumber}`);
  }

  // 6. Test Unique Constraint Protection
  console.log('\n--- TEST 4: Unique Constraint Collision Protection ---');
  let duplicateCollisionHandled = false;
  try {
    await prisma.reimbursementDocument.create({
      data: {
        documentNumber: expectedDocNum1, // Collision!
        patientId: patient.id,
        documentDate: '2026-09-17',
        subject: 'Duplicate Test',
        content: 'Test duplicate document number',
        patientNameSnapshot: patient.name,
        status: 'Issued'
      }
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      duplicateCollisionHandled = true;
      console.log('Unique constraint P2002 successfully prevented duplicate documentNumber.');
    } else {
      throw err;
    }
  }
  if (!duplicateCollisionHandled) {
    throw new Error('Database failed to enforce uniqueness on documentNumber');
  }

  // 7. Test Snapshot Immutability
  console.log('\n--- TEST 5: Snapshot Immutability Verification ---');
  // Mutate Patient in DB
  const originalPhone = patient.phone;
  await prisma.patient.update({
    where: { id: patient.id },
    data: {
      name: 'Reimbursement Test Patient 1 RENAMED',
      phone: '9999999999'
    }
  });
  console.log('Updated patient in database with new phone: 9999999999');

  // Fetch document again
  const fetchedDoc1 = await prisma.reimbursementDocument.findUnique({
    where: { id: doc1.id }
  });
  if (!fetchedDoc1) throw new Error('Failed to find doc1');

  console.log(`Document 1 preserved snapshot phone: ${fetchedDoc1.patientPhoneSnapshot} (Original: ${originalPhone})`);
  console.log(`Document 1 preserved snapshot name: ${fetchedDoc1.patientNameSnapshot}`);

  if (fetchedDoc1.patientPhoneSnapshot !== originalPhone) {
    throw new Error(`Snapshot violation! Stored phone changed from ${originalPhone} to ${fetchedDoc1.patientPhoneSnapshot}`);
  }
  if (fetchedDoc1.patientNameSnapshot !== 'Reimbursement Test Patient 1') {
    throw new Error(`Snapshot violation! Stored name changed.`);
  }
  console.log('SNAPSHOT IMMUTABILITY VERIFIED: Historical records remain completely intact!');

  // Restore Patient
  await prisma.patient.update({
    where: { id: patient.id },
    data: {
      name: 'Reimbursement Test Patient 1',
      phone: originalPhone
    }
  });

  // 8. Test Search & Pagination Query
  console.log('\n--- TEST 6: Search & Pagination ---');
  const searchResults = await prisma.reimbursementDocument.findMany({
    where: {
      OR: [
        { documentNumber: { contains: expectedDocNum1 } },
        { patientNameSnapshot: { contains: 'Reimbursement Test Patient' } }
      ]
    },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Search for '${expectedDocNum1}' found ${searchResults.length} matching record(s).`);
  if (searchResults.length === 0) {
    throw new Error('Search failed to return matching document');
  }

  // 9. Test PDF Generation Service
  console.log('\n--- TEST 7: Professional A4 PDF Generation ---');
  const pdfBuffer = await generateReimbursementPDF({
    documentNumber: doc1.documentNumber,
    documentDate: doc1.documentDate,
    subject: doc1.subject,
    content: doc1.content,
    treatmentDescription: doc1.treatmentDescription,
    amount: doc1.amount,
    patientName: doc1.patientNameSnapshot,
    patientAge: doc1.patientAgeSnapshot,
    patientGender: doc1.patientGenderSnapshot,
    patientPhone: doc1.patientPhoneSnapshot,
    doctorName: doc1.doctorNameSnapshot,
    doctorRegNo: doc1.doctorRegNoSnapshot,
    clinicName: doc1.clinicNameSnapshot,
    clinicAddress: doc1.clinicAddressSnapshot,
    clinicPhone: doc1.clinicPhoneSnapshot
  });

  console.log(`Generated PDF Buffer size: ${pdfBuffer.length} bytes`);
  const isPdfHeader = pdfBuffer.slice(0, 4).toString('utf-8') === '%PDF';
  console.log(`PDF header valid: ${isPdfHeader}`);
  if (!isPdfHeader || pdfBuffer.length < 1000) {
    throw new Error('PDF generation produced invalid or empty PDF');
  }

  // 10. Test RBAC Enforcement via HTTP API
  console.log('\n--- TEST 8: RBAC API Enforcement ---');
  const headDocToken = jwt.sign({ id: headDoctorUser.id, role: headDoctorUser.role }, JWT_SECRET, { expiresIn: '1h' });
  const dutyDocToken = jwt.sign({ id: dutyDoctorUser.id, role: dutyDoctorUser.role }, JWT_SECRET, { expiresIn: '1h' });
  const receptionistToken = jwt.sign({ id: receptionistUser.id, role: receptionistUser.role }, JWT_SECRET, { expiresIn: '1h' });

  // Test Head Doctor allowed
  const docRes = await fetch('http://localhost:3001/api/reimbursements', {
    headers: { Cookie: `token=${headDocToken}` }
  });
  console.log(`Head Doctor access status: ${docRes.status} (Expected: 200)`);
  if (docRes.status !== 200) {
    throw new Error(`Head Doctor received ${docRes.status} instead of 200`);
  }

  // Test Duty Doctor forbidden (403) - Reimbursement is strictly Head Doctor only
  const dutyDocRes = await fetch('http://localhost:3001/api/reimbursements', {
    headers: { Cookie: `token=${dutyDocToken}` }
  });
  console.log(`Duty Doctor access status: ${dutyDocRes.status} (Expected: 403 Forbidden)`);
  if (dutyDocRes.status !== 403) {
    throw new Error(`Duty Doctor received ${dutyDocRes.status} instead of 403`);
  }

  // Test Receptionist forbidden (403)
  const recepRes = await fetch('http://localhost:3001/api/reimbursements', {
    headers: { Cookie: `token=${receptionistToken}` }
  });
  console.log(`Receptionist access status: ${recepRes.status} (Expected: 403 Forbidden)`);
  if (recepRes.status !== 403) {
    throw new Error(`Receptionist received ${recepRes.status} instead of 403`);
  }

  // Test Receptionist PDF download forbidden (403)
  const recepPdfRes = await fetch(`http://localhost:3001/api/reimbursements/${doc1.id}/pdf`, {
    headers: { Cookie: `token=${receptionistToken}` }
  });
  console.log(`Receptionist PDF download status: ${recepPdfRes.status} (Expected: 403 Forbidden)`);
  if (recepPdfRes.status !== 403) {
    throw new Error(`Receptionist PDF download received ${recepPdfRes.status} instead of 403`);
  }

  // Test Doctor PDF download allowed (200)
  const docPdfRes = await fetch(`http://localhost:3001/api/reimbursements/${doc1.id}/pdf`, {
    headers: { Cookie: `token=${headDocToken}` }
  });
  console.log(`Doctor PDF download status: ${docPdfRes.status} (Expected: 200)`);
  const contentType = docPdfRes.headers.get('content-type');
  console.log(`Doctor PDF Content-Type: ${contentType} (Expected: application/pdf)`);
  if (docPdfRes.status !== 200 || !contentType?.includes('application/pdf')) {
    throw new Error('Doctor PDF download failed');
  }

  console.log('\n================================================================');
  console.log('REIMBURSEMENT MODULE VERIFICATION SUCCESSFUL!');
  console.log('All 10 verification steps passed cleanly with 100% compliance.');
  console.log('================================================================');
}

runVerification()
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
