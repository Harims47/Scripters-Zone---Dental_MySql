import { prisma } from './src/db';
import ExcelJS from 'exceljs';
import jwt from 'jsonwebtoken';
import http from 'http';
import {
  parseFileRows,
  inspectFile,
  suggestColumnMappings,
  normalizePhone,
  normalizeGender,
  calculateAgeFromDOB,
  validateRows,
  executeImport
} from './src/services/patientImportService';

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

async function runTestSuite() {
  console.log('===========================================================');
  console.log('🧪 DENTALCORE — EXISTING PATIENT IMPORT v1 VERIFICATION');
  console.log('===========================================================\n');

  // Find Head Doctor & ensure temporary Receptionist for RBAC test
  const headDoctor = await prisma.user.findFirst({ where: { role: 'Head Doctor' } });
  if (!headDoctor) {
    throw new Error('Head Doctor user not found in DB.');
  }

  let receptionist = await prisma.user.findUnique({ where: { username: 'test_receptionist' } });
  if (!receptionist) {
    receptionist = await prisma.user.create({
      data: {
        username: 'test_receptionist',
        passwordHash: 'test_hash',
        role: 'Receptionist'
      }
    });
  }

  const headDoctorCookie = generateAuthCookie(headDoctor);
  const receptionistCookie = generateAuthCookie(receptionist);

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Normalization & Field Parsing Units
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Normalization & Field Parsing ---');

  // Phone Normalization
  assert(normalizePhone('9876543210') === '9876543210', 'Normalizes clean 10-digit mobile');
  assert(normalizePhone('+91 98765 43210') === '9876543210', 'Normalizes +91 with spaces');
  assert(normalizePhone('09876543210') === '9876543210', 'Normalizes 11-digit leading zero');
  assert(normalizePhone('12345') === null, 'Rejects short phone number');
  assert(normalizePhone('abcdefghij') === null, 'Rejects non-numeric phone');
  assert(normalizePhone(null) === null, 'Rejects null/empty phone');

  // Gender Normalization
  assert(normalizeGender('Male') === 'Male', 'Normalizes "Male"');
  assert(normalizeGender('M') === 'Male', 'Normalizes "M"');
  assert(normalizeGender('female') === 'Female', 'Normalizes "female"');
  assert(normalizeGender('F') === 'Female', 'Normalizes "F"');
  assert(normalizeGender('other') === 'Other', 'Normalizes "other"');
  assert(normalizeGender('alien') === null, 'Rejects invalid gender');

  // Age calculation from DOB
  const dobAge = calculateAgeFromDOB('15/08/1990');
  assert(typeof dobAge === 'number' && dobAge >= 33 && dobAge <= 36, `Calculates age from DD/MM/YYYY (${dobAge})`);
  assert(calculateAgeFromDOB('invalid-date') === null, 'Rejects invalid date string');

  // Auto-Mapping Suggestions
  const headers = ['Patient Name', 'Mobile No', 'Age', 'Sex', 'City', 'Email Address', 'Diagnosis', 'Treatment Fee'];
  const mappingResult = suggestColumnMappings(headers);
  assert(mappingResult.mappings.name === 'Patient Name', 'Auto-maps "Patient Name" -> name');
  assert(mappingResult.mappings.phone === 'Mobile No', 'Auto-maps "Mobile No" -> phone');
  assert(mappingResult.mappings.age === 'Age', 'Auto-maps "Age" -> age');
  assert(mappingResult.mappings.gender === 'Sex', 'Auto-maps "Sex" -> gender');
  assert(mappingResult.mappings.address === 'City', 'Auto-maps "City" -> address');
  assert(mappingResult.mappings.email === 'Email Address', 'Auto-maps "Email Address" -> email');
  assert(
    mappingResult.unmappedClinical.includes('Diagnosis') && mappingResult.unmappedClinical.includes('Treatment Fee'),
    'Clinical columns (Diagnosis, Treatment Fee) are flagged as unmapped'
  );

  // -------------------------------------------------------------------------
  // TEST GROUP 2: File Format Parsers (.csv & .xlsx)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: File Parsers (.csv & .xlsx) ---');

  // CSV Parsing
  const csvData = Buffer.from(
    'Name,Phone,Age,Gender,City,Notes\n' +
    'Aarav Patel,9820011111,28,Male,Mumbai,Scaling\n' +
    'Priya Sharma,9820022222,34,Female,Pune,Checkup\n'
  );
  const csvParsed = await parseFileRows(csvData, 'csv');
  assert(csvParsed.headers.length === 6, `CSV parsed headers count: ${csvParsed.headers.length}`);
  assert(csvParsed.rows.length === 2, `CSV parsed rows count: ${csvParsed.rows.length}`);
  assert(csvParsed.rows[0]['Name'] === 'Aarav Patel', 'CSV first row data matches');

  // XLSX Parsing
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Patients');
  ws.addRow(['Full Name', 'Contact Number', 'DOB', 'Gender', 'Address']);
  ws.addRow(['Kavita Reddy', '9820033333', '1995-05-20', 'Female', 'Bangalore']);
  ws.addRow(['Rajesh Kumar', '9820044444', '1988-10-12', 'Male', 'Chennai']);
  const xlsxBuffer = Buffer.from(await wb.xlsx.writeBuffer());

  const xlsxParsed = await parseFileRows(xlsxBuffer, 'xlsx');
  assert(xlsxParsed.headers.length === 5, `XLSX parsed headers count: ${xlsxParsed.headers.length}`);
  assert(xlsxParsed.rows.length === 2, `XLSX parsed rows count: ${xlsxParsed.rows.length}`);
  assert(xlsxParsed.rows[0]['Full Name'] === 'Kavita Reddy', 'XLSX first row data matches');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Validation, Deduplication & Conflict Detection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Validation, Deduplication & Conflict Detection ---');

  // Pick an existing patient from database with non-null phone and age
  const existingPatient = await prisma.patient.findFirst({
    where: { phone: { not: null }, age: { not: null } }
  });
  if (!existingPatient) throw new Error('No existing patient found in DB for duplicate tests.');

  const testRows = [
    // 1. Valid new patient
    { Name: 'Siddharth Rao', Phone: '9820055555', Age: '30', Gender: 'Male', City: 'Hyderabad' },
    // 2. Exact duplicate of existing DB patient (same phone, same name)
    { Name: existingPatient.name, Phone: existingPatient.phone, Age: String(existingPatient.age), Gender: existingPatient.gender, City: 'Test' },
    // 3. Phone conflict with existing DB patient (same phone, different name)
    { Name: 'Completely Different Name', Phone: existingPatient.phone, Age: '45', Gender: 'Female', City: 'Test' },
    // 4. Missing phone (Schema limitation: must be INVALID)
    { Name: 'No Phone Patient', Phone: '', Age: '25', Gender: 'Male', City: 'Test' },
    // 5. Invalid phone format
    { Name: 'Bad Phone Patient', Phone: '12345', Age: '22', Gender: 'Male', City: 'Test' },
    // 6. Missing name
    { Name: '', Phone: '9820066666', Age: '29', Gender: 'Male', City: 'Test' },
    // 7. Invalid age
    { Name: 'Bad Age Patient', Phone: '9820077777', Age: 'not-a-number', Gender: 'Male', City: 'Test' },
    // 8. In-file duplicate (same phone as row 1, same name)
    { Name: 'Siddharth Rao', Phone: '9820055555', Age: '30', Gender: 'Male', City: 'Hyderabad' },
    // 9. In-file phone conflict (same phone as row 1, different name)
    { Name: 'Ananya Rao', Phone: '9820055555', Age: '28', Gender: 'Female', City: 'Hyderabad' }
  ];

  const mappings = {
    name: 'Name',
    phone: 'Phone',
    age: 'Age',
    gender: 'Gender',
    address: 'City'
  };

  const validationSummary = await validateRows(testRows, mappings);
  assert(validationSummary.newCount === 1, `Correct NEW count: ${validationSummary.newCount} (Expected: 1)`);
  assert(validationSummary.exactDuplicateCount === 2, `Correct EXACT_DUPLICATE count: ${validationSummary.exactDuplicateCount} (Expected: 2)`);
  assert(validationSummary.phoneConflictCount === 2, `Correct PHONE_CONFLICT count: ${validationSummary.phoneConflictCount} (Expected: 2)`);
  assert(validationSummary.invalidCount === 4, `Correct INVALID count: ${validationSummary.invalidCount} (Expected: 4)`);

  const missingPhoneErr = validationSummary.invalidRowsList.find(r => r.name === 'No Phone Patient');
  assert(
    !!missingPhoneErr && missingPhoneErr.errors.some(e => e.includes('mandatory 10-digit unique identifier')),
    'Missing phone error clearly explains unique identifier constraint'
  );

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Database Safety & Count Invariance
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Database Safety & Table Count Invariance ---');

  // Baseline counts across all 8 tables
  const beforeCounts = {
    patients: await prisma.patient.count(),
    visits: await prisma.visit.count(),
    consultations: await prisma.consultation.count(),
    prescriptions: await prisma.prescription.count(),
    prescriptionItems: await prisma.prescriptionItem.count(),
    treatmentPlans: await prisma.treatmentPlan.count(),
    treatmentPlanItems: await prisma.treatmentPlanItem.count(),
    payments: await prisma.payment.count()
  };

  // Create a synthetic CSV with 3 brand-new unique patients
  const uniqueTimestamp = Date.now().toString().slice(-6);
  const p1Phone = `9811${uniqueTimestamp}`;
  const p2Phone = `9822${uniqueTimestamp}`;
  const p3Phone = `9833${uniqueTimestamp}`;

  const importCSV = Buffer.from(
    'Name,Phone,Age,Gender,Address,Email,Diagnosis,ClinicalNotes\n' +
    `Unique Test Patient Alpha,${p1Phone},29,Male,Chennai,alpha@test.com,Caries,Scaling required\n` +
    `Unique Test Patient Beta,${p2Phone},42,Female,Bangalore,beta@test.com,Root Canal,RCT Sitting 1\n` +
    `Unique Test Patient Gamma,${p3Phone},35,Male,Madurai,gamma@test.com,Extraction,Tooth 36\n`
  );

  const importResult = await executeImport(importCSV, 'csv', {
    name: 'Name',
    phone: 'Phone',
    age: 'Age',
    gender: 'Gender',
    address: 'Address',
    email: 'Email'
  });

  assert(importResult.importedCount === 3, `Successfully imported 3 patients (Count: ${importResult.importedCount})`);

  // After counts across all 8 tables
  const afterCounts = {
    patients: await prisma.patient.count(),
    visits: await prisma.visit.count(),
    consultations: await prisma.consultation.count(),
    prescriptions: await prisma.prescription.count(),
    prescriptionItems: await prisma.prescriptionItem.count(),
    treatmentPlans: await prisma.treatmentPlan.count(),
    treatmentPlanItems: await prisma.treatmentPlanItem.count(),
    payments: await prisma.payment.count()
  };

  assert(afterCounts.patients === beforeCounts.patients + 3, `Patient table count increased by exactly 3 (${beforeCounts.patients} -> ${afterCounts.patients})`);
  assert(afterCounts.visits === beforeCounts.visits, `Visit count invariant (${beforeCounts.visits} === ${afterCounts.visits})`);
  assert(afterCounts.consultations === beforeCounts.consultations, `Consultation count invariant (${beforeCounts.consultations} === ${afterCounts.consultations})`);
  assert(afterCounts.prescriptions === beforeCounts.prescriptions, `Prescription count invariant (${beforeCounts.prescriptions} === ${afterCounts.prescriptions})`);
  assert(afterCounts.prescriptionItems === beforeCounts.prescriptionItems, `PrescriptionItem count invariant (${beforeCounts.prescriptionItems} === ${afterCounts.prescriptionItems})`);
  assert(afterCounts.treatmentPlans === beforeCounts.treatmentPlans, `TreatmentPlan count invariant (${beforeCounts.treatmentPlans} === ${afterCounts.treatmentPlans})`);
  assert(afterCounts.treatmentPlanItems === beforeCounts.treatmentPlanItems, `TreatmentPlanItem count invariant (${beforeCounts.treatmentPlanItems} === ${afterCounts.treatmentPlanItems})`);
  assert(afterCounts.payments === beforeCounts.payments, `Payment count invariant (${beforeCounts.payments} === ${afterCounts.payments})`);

  // Verify created patients have zero clinical child records
  const createdP1 = await prisma.patient.findUnique({
    where: { phone: p1Phone },
    include: { visits: true, payments: true, treatmentPlan: true }
  });
  assert(!!createdP1, 'Imported patient Alpha exists in database');
  assert(createdP1?.visits.length === 0, 'Imported patient Alpha has 0 visits');
  assert(createdP1?.payments.length === 0, 'Imported patient Alpha has 0 payments');
  assert(createdP1?.treatmentPlan === null, 'Imported patient Alpha has no treatment plan');

  // Idempotency: Re-running import with exact same file must insert 0 new patients
  const reImportResult = await executeImport(importCSV, 'csv', {
    name: 'Name',
    phone: 'Phone',
    age: 'Age',
    gender: 'Gender',
    address: 'Address',
    email: 'Email'
  });
  assert(reImportResult.importedCount === 0, `Idempotent re-run: 0 new patients imported (Count: ${reImportResult.importedCount})`);
  assert(reImportResult.skippedCount === 3, `Idempotent re-run: all 3 existing rows skipped (Count: ${reImportResult.skippedCount})`);

  // Clean up the 3 test patients
  await prisma.patient.deleteMany({
    where: { phone: { in: [p1Phone, p2Phone, p3Phone] } }
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 5: HTTP Endpoints & RBAC Security
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: HTTP Endpoints & RBAC Security ---');

  const dummyBase64 = Buffer.from('Name,Phone,Age,Gender\nTest User,9829999999,30,Male\n').toString('base64');

  // 1. Receptionist blocked with 403 on inspect
  const r1 = await makeHttpRequest('/api/patients/import/inspect', 'POST', {
    fileBase64: dummyBase64,
    fileName: 'test.csv',
    fileType: 'csv'
  }, receptionistCookie);
  assert(r1.status === 403, `Receptionist is blocked on /import/inspect (Status: ${r1.status})`);

  // 2. Receptionist blocked with 403 on validate
  const r2 = await makeHttpRequest('/api/patients/import/validate', 'POST', {
    fileBase64: dummyBase64,
    fileName: 'test.csv',
    fileType: 'csv',
    mappings: { name: 'Name', phone: 'Phone', age: 'Age', gender: 'Gender' }
  }, receptionistCookie);
  assert(r2.status === 403, `Receptionist is blocked on /import/validate (Status: ${r2.status})`);

  // 3. Receptionist blocked with 403 on execute
  const r3 = await makeHttpRequest('/api/patients/import/execute', 'POST', {
    fileBase64: dummyBase64,
    fileName: 'test.csv',
    fileType: 'csv',
    mappings: { name: 'Name', phone: 'Phone', age: 'Age', gender: 'Gender' }
  }, receptionistCookie);
  assert(r3.status === 403, `Receptionist is blocked on /import/execute (Status: ${r3.status})`);

  // 4. Head Doctor authorized on inspect
  const h1 = await makeHttpRequest('/api/patients/import/inspect', 'POST', {
    fileBase64: dummyBase64,
    fileName: 'test.csv',
    fileType: 'csv'
  }, headDoctorCookie);
  assert(h1.status === 200, `Head Doctor authorized on /import/inspect (Status: ${h1.status})`);
  assert(h1.data.totalRows === 1, `Head Doctor inspect detects 1 row (TotalRows: ${h1.data.totalRows})`);

  // 5. Unsupported file format rejection
  const badExt = await makeHttpRequest('/api/patients/import/inspect', 'POST', {
    fileBase64: dummyBase64,
    fileName: 'legacy_records.xls',
    fileType: 'xls'
  }, headDoctorCookie);
  assert(badExt.status === 400, `Rejects unsupported .xls binary file with HTTP 400 (Status: ${badExt.status})`);

  // -------------------------------------------------------------------------
  // TEST GROUP 6: Performance & Large Dataset Benchmark
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Performance & Large Dataset Benchmark ---');

  // 1. Generate 100-row synthetic dataset
  const wb100 = new ExcelJS.Workbook();
  const ws100 = wb100.addWorksheet('Patients');
  ws100.addRow(['Patient Name', 'Mobile Number', 'Age', 'Gender', 'City', 'Clinical History']);
  for (let i = 1; i <= 100; i++) {
    const numStr = String(i).padStart(4, '0');
    ws100.addRow([`Benchmark Patient ${numStr}`, `990000${numStr}`, 20 + (i % 50), i % 2 === 0 ? 'Male' : 'Female', 'Chennai', 'Legacy Root Canal']);
  }
  const buf100 = Buffer.from(await wb100.xlsx.writeBuffer());

  const t0 = Date.now();
  const inspect100 = await inspectFile(buf100, 'bench100.xlsx', 'xlsx');
  const tInspect100 = Date.now() - t0;
  assert(inspect100.totalRows === 100, `100 rows inspected in ${tInspect100}ms (Rows: ${inspect100.totalRows})`);

  const t1 = Date.now();
  const { rows: rows100 } = await parseFileRows(buf100, 'xlsx');
  const val100 = await validateRows(rows100, inspect100.suggestedMappings);
  const tVal100 = Date.now() - t1;
  assert(val100.newCount === 100, `100 rows validated in ${tVal100}ms (New: ${val100.newCount})`);

  // 2. Generate 1,000-row synthetic CSV
  const csv1000Rows: string[] = ['Name,Phone,Age,Gender,Address,Notes'];
  for (let i = 1; i <= 1000; i++) {
    const numStr = String(i).padStart(5, '0');
    csv1000Rows.push(`Stress Patient ${numStr},97000${numStr},${25 + (i % 40)},${i % 2 === 0 ? 'Male' : 'Female'},Bangalore,Scaling`);
  }
  const buf1000 = Buffer.from(csv1000Rows.join('\n'));

  const t2 = Date.now();
  const { rows: rows1000 } = await parseFileRows(buf1000, 'csv');
  const val1000 = await validateRows(rows1000, {
    name: 'Name',
    phone: 'Phone',
    age: 'Age',
    gender: 'Gender',
    address: 'Address'
  });
  const tVal1000 = Date.now() - t2;
  assert(rows1000.length === 1000, `1,000 CSV rows parsed and validated in ${tVal1000}ms (Valid: ${val1000.newCount})`);

  // Clean up temporary test user
  await prisma.user.deleteMany({ where: { username: 'test_receptionist' } });

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test execution failed with unhandled error:', err);
  process.exit(1);
});
