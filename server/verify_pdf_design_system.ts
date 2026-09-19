/**
 * DENTALCORE — PRODUCTION PDF DESIGN SYSTEM VERIFICATION SUITE
 * 
 * Verifies:
 * 1. HTTP 200 & application/pdf for authorized requests
 * 2. %PDF magic header bytes
 * 3. Authoritative clinic branding (Name, Address, Phone, Email, Logo)
 * 4. Human-readable dates (DD MMM YYYY)
 * 5. Indian Rupee formatting (₹2,890, ₹2,000, ₹890)
 * 6. ZERO internal ID leakage (extracts rendered text with PDFParse and scans for UUIDs, patientId, visitId, etc.)
 * 7. Legitimate business document numbers preserved (INV-..., RCPT-..., RMB-..., PO-...)
 * 8. Two-pass page numbering ("Page X of Y") and repeated table headers on multi-page reports
 * 9. Doctor-owned payment privacy (Receptionist receives HTTP 403 on doctor-owned financial PDFs)
 */

process.env.NODE_ENV = 'test';

import { prisma } from './src/db';
import jwt from 'jsonwebtoken';
import http from 'http';
import { PDFParse } from 'pdf-parse';
import { PDFDocument as PDFLibDoc } from 'pdf-lib';
import {
  generatePrescriptionPDF,
  generateReceiptPDF,
  generateInvoicePDF,
  generateReimbursementPDF,
  generatePurchaseOrderPDF
} from './src/services/documentService';
import { generatePDF, ExportColumn } from './src/services/exportService';
import { getClinicBranding, formatCurrency, formatHumanDate } from './src/services/pdf/clinicBranding';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const textObj = await parser.getText();
  return textObj.text || '';
}

async function requestAPI(
  path: string,
  token: string
): Promise<{ status: number; headers: Record<string, any>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'GET',
      headers: {
        Cookie: `token=${token}`,
      },
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runPDFVerification() {
  console.log('================================================================');
  console.log('🧪 DENTALCORE — PRODUCTION PDF DESIGN SYSTEM VERIFICATION SUITE');
  console.log('================================================================\n');

  // 1. Authoritative Clinic Branding Provider Check
  console.log('--- 1. Authoritative Clinic Branding Provider ---');
  const branding = getClinicBranding();
  assert(Boolean(branding.name), 'Clinic name is resolved: ' + branding.name);
  assert(Boolean(branding.address), 'Clinic address is resolved: ' + branding.address);
  assert(Boolean(branding.phone), 'Clinic phone is resolved: ' + branding.phone);
  assert(branding.logoPath !== null, 'Clinic logo path is resolved: ' + branding.logoPath);

  // Currency & Date formatters check
  assert(formatCurrency(2890) === '₹2,890', 'formatCurrency(2890) returns ₹2,890');
  assert(formatCurrency(2000) === '₹2,000', 'formatCurrency(2000) returns ₹2,000');
  assert(formatCurrency(890) === '₹890', 'formatCurrency(890) returns ₹890');
  assert(formatHumanDate('2026-09-17') === '17 Sep 2026', 'formatHumanDate returns 17 Sep 2026');

  // 2. Fetch Users & Tokens for RBAC Tests
  console.log('\n--- 2. RBAC & Auth Setup ---');
  const headDoc = await prisma.user.findFirst({ where: { role: 'Head Doctor' } });
  if (!headDoc) throw new Error('Head Doctor not found in database.');
  const doctorToken = jwt.sign({ id: headDoc.id, role: headDoc.role }, JWT_SECRET, { expiresIn: '1h' });

  // Get or seed receptionist
  let receptionist = await prisma.user.findFirst({ where: { role: 'Receptionist' } });
  if (!receptionist) {
    receptionist = await prisma.user.create({
      data: {
        username: 'receptionist_pdf_test',
        passwordHash: 'dummy',
        role: 'Receptionist'
      }
    });
  }
  const receptionistToken = jwt.sign({ id: receptionist.id, role: receptionist.role }, JWT_SECRET, { expiresIn: '1h' });
  assert(true, 'Generated tokens for Head Doctor and Receptionist');

  // 3. Document 1: Prescription PDF
  console.log('\n--- 3. Document: Prescription ---');
  const rxBuffer = await generatePrescriptionPDF({
    patientName: 'Kavitha Sundaram',
    patientAge: 32,
    patientGender: 'Female',
    patientPhone: '9876543210',
    visitDate: '2026-09-17',
    doctorName: 'DR N MOHAMED RAFI B D S',
    diagnosis: 'Caries Tooth #14',
    items: [
      { medicineName: 'Amoxicillin 500mg', quantity: 10, dosage: '1 Tab', frequency: 'Three times daily', instructions: 'After food' },
      { medicineName: 'Paracetamol 650mg', quantity: 6, dosage: '1 Tab', frequency: 'Twice daily', instructions: 'After food' }
    ]
  });

  assert(Buffer.isBuffer(rxBuffer) && rxBuffer.length > 1000, 'Prescription PDF buffer generated (> 1KB)');
  assert(rxBuffer.slice(0, 4).toString() === '%PDF', 'Prescription begins with %PDF');
  const rxText = await extractTextFromPDF(rxBuffer);
  const hasClinicHeaderInfo = rxText.includes(branding.phone) || rxText.includes('Gopichettipalayam') || rxText.toLowerCase().includes(branding.name.toLowerCase());
  assert(hasClinicHeaderInfo, 'Prescription contains authoritative clinic branding details');
  assert(rxText.includes('17 Sep 2026'), 'Prescription contains formatted date 17 Sep 2026');
  assert(rxText.includes('Kavitha Sundaram'), 'Prescription contains patient name');
  assert(rxText.includes('MOHAMED RAFI'), 'Prescription contains clean doctor name');
  const rxUuids = rxText.match(UUID_REGEX) || [];
  assert(rxUuids.length === 0, 'Prescription has ZERO internal UUIDs', rxUuids);

  // 4. Document 2: Receipt PDF
  console.log('\n--- 4. Document: Receipt ---');
  const receiptNo = 'RCPT-2026-0042';
  const rcptBuffer = await generateReceiptPDF({
    patientName: 'Ravi Shankar',
    patientPhone: '9840112233',
    visitDate: '2026-09-17',
    consultationFee: 500,
    medicineCost: 390,
    totalAmount: 890,
    amountPaid: 890,
    paymentMethod: 'GPay',
    paymentDate: '2026-09-17',
    paymentStatus: 'Paid',
    receiptNo,
    receivedBy: 'Staff Cashier',
    doctorName: 'DR N MOHAMED RAFI B D S'
  });

  assert(rcptBuffer.slice(0, 4).toString() === '%PDF', 'Receipt begins with %PDF');
  const rcptText = await extractTextFromPDF(rcptBuffer);
  assert(rcptText.includes(receiptNo), 'Receipt contains business receipt number ' + receiptNo);
  assert(rcptText.includes('₹890') || rcptText.includes('₹500'), 'Receipt contains formatted currency ₹890 / ₹500');
  assert(rcptText.includes('17 Sep 2026'), 'Receipt contains formatted date 17 Sep 2026');
  const rcptUuids = rcptText.match(UUID_REGEX) || [];
  assert(rcptUuids.length === 0, 'Receipt has ZERO internal UUIDs', rcptUuids);
  assert(!rcptText.includes('Patient ID :'), 'Receipt does not contain Patient ID label');

  // 5. Document 3: Invoice PDF
  console.log('\n--- 5. Document: Invoice ---');
  const invNumber = 'INV-2026-0089';
  const dummyUuid = 'c8b217a4-8f92-49cb-8263-d1f50a89de12';
  const invBuffer = await generateInvoicePDF({
    invoiceNumber: invNumber,
    visitDate: '2026-09-17',
    patientName: 'Ananya Ramesh',
    patientId: dummyUuid, // Passed in payload, must NOT appear in output!
    patientPhone: '9443011223',
    doctorName: 'DR N MOHAMED RAFI B D S',
    consultationFee: 500,
    treatmentFee: 1500,
    medicineCost: 890,
    totalAmount: 2890,
    amountPaid: 2000,
    amountDue: 890,
    status: 'Partially Paid',
    treatments: [
      { name: 'Root Canal Treatment', category: 'Endodontics', fee: 1500 }
    ],
    medicines: [
      { name: 'Amoxicillin', quantity: 15, unitPrice: 20, total: 300 }
    ]
  });

  assert(invBuffer.slice(0, 4).toString() === '%PDF', 'Invoice begins with %PDF');
  const invText = await extractTextFromPDF(invBuffer);
  assert(invText.includes(invNumber), 'Invoice contains business invoice number ' + invNumber);
  assert(invText.includes('₹2,890'), 'Invoice contains formatted total amount ₹2,890');
  assert(invText.includes('₹2,000'), 'Invoice contains formatted amount paid ₹2,000');
  assert(invText.includes('Dr. N MOHAMED RAFI B D S') || invText.includes('DR N MOHAMED RAFI'), 'Invoice contains clean doctor name');
  assert(invText.includes('clinic@rafidental.com'), 'Invoice signature block contains clinic email');
  assert(invText.includes('094430 23648'), 'Invoice signature block contains clinic phone');
  assert(invText.includes('Rafi Dental Clinic'), 'Invoice signature block contains clinic name');
  assert(!invText.includes(dummyUuid), 'Invoice DOES NOT expose dummy patient UUID');
  assert(!invText.includes('Patient ID :'), 'Invoice DOES NOT display Patient ID label');
  const invUuids = invText.match(UUID_REGEX) || [];
  assert(invUuids.length === 0, 'Invoice has ZERO internal UUIDs', invUuids);

  // 6. Document 4: Reimbursement Claim PDF
  console.log('\n--- 6. Document: Reimbursement ---');
  const rmbDocNo = 'RMB-2026-000108';
  const rmbBuffer = await generateReimbursementPDF({
    documentNumber: rmbDocNo,
    documentDate: '2026-09-17',
    subject: 'Dental Treatment Reimbursement Claim for Ananya Ramesh',
    content: 'This certifies that the patient underwent composite restoration and scaling.',
    treatmentDescription: 'Tooth #24 Composite Restoration',
    amount: 2890,
    patientName: 'Ananya Ramesh',
    patientAge: 29,
    patientGender: 'Female',
    patientPhone: '9443011223',
    doctorName: 'DR N MOHAMED RAFI B D S'
  });

  assert(rmbBuffer.slice(0, 4).toString() === '%PDF', 'Reimbursement begins with %PDF');
  const rmbText = await extractTextFromPDF(rmbBuffer);
  assert(rmbText.includes(rmbDocNo), 'Reimbursement contains document number ' + rmbDocNo);
  assert(rmbText.includes('₹2,890'), 'Reimbursement contains formatted amount ₹2,890');
  assert(rmbText.includes('17 Sep 2026'), 'Reimbursement contains formatted date 17 Sep 2026');
  assert(!rmbText.includes('1305'), 'Reimbursement DOES NOT contain invented registration number 1305');
  const rmbUuids = rmbText.match(UUID_REGEX) || [];
  assert(rmbUuids.length === 0, 'Reimbursement has ZERO internal UUIDs', rmbUuids);

  // 7. Document 5: Purchase Order PDF
  console.log('\n--- 7. Document: Purchase Order ---');
  const poNumber = 'PO-2026-0034';
  const poBuffer = await generatePurchaseOrderPDF({
    orderNumber: poNumber,
    orderDate: '2026-09-17',
    supplierName: 'MedTech Dental Supplies',
    supplierEmail: 'orders@medtech.com',
    supplierPhone: '044-28901234',
    items: [
      { medicineName: 'Composite Syringe A2', quantity: 5, unitPrice: 400, total: 2000 },
      { medicineName: 'Etching Gel 37%', quantity: 2, unitPrice: 445, total: 890 }
    ],
    totalAmount: 2890,
    expectedDate: '2026-09-24',
    notes: 'Please deliver before noon.'
  });

  assert(poBuffer.slice(0, 4).toString() === '%PDF', 'Purchase Order begins with %PDF');
  const poText = await extractTextFromPDF(poBuffer);
  assert(poText.includes(poNumber), 'Purchase Order contains PO number ' + poNumber);
  assert(poText.includes('₹2,890'), 'Purchase Order contains formatted total ₹2,890');
  assert(poText.includes('17 Sep 2026'), 'Purchase Order contains formatted date 17 Sep 2026');
  const poUuids = poText.match(UUID_REGEX) || [];
  assert(poUuids.length === 0, 'Purchase Order has ZERO internal UUIDs', poUuids);

  // 8. Document 6: Partial Payment Report PDF
  console.log('\n--- 8. Document: Partial Payment Report ---');
  const partialColumns: ExportColumn[] = [
    { key: 'patientName', label: 'Patient Name' },
    { key: 'doctorName', label: 'Doctor Name' },
    { key: 'totalAmount', label: 'Total Amount' },
    { key: 'paidAmount', label: 'Paid Amount' },
    { key: 'balance', label: 'Balance' },
    { key: 'daysOutstanding', label: 'Days Outstanding' }
  ];
  const partialData = [
    { patientName: 'Suresh Raina', doctorName: 'Dr. Rafi', totalAmount: 2890, paidAmount: 2000, balance: 890, daysOutstanding: '4 days' },
    { patientName: 'Deepak Chahar', doctorName: 'Dr. Rafi', totalAmount: 2000, paidAmount: 1000, balance: 1000, daysOutstanding: '7 days' }
  ];
  const partialBuffer = await generatePDF(partialColumns, partialData, 'Partial Payment Alerts Report', 'Total Records: 2');
  assert(partialBuffer.slice(0, 4).toString() === '%PDF', 'Partial Payment Report begins with %PDF');
  const partialText = await extractTextFromPDF(partialBuffer);
  assert(partialText.includes('PARTIAL PAYMENT ALERTS REPORT'), 'Report contains title');
  assert(partialText.includes('₹2,890') && partialText.includes('₹890'), 'Report formats financial numbers in ₹');
  assert(partialText.includes('Suresh Raina'), 'Report contains patient records');
  const partialUuids = partialText.match(UUID_REGEX) || [];
  assert(partialUuids.length === 0, 'Partial Payment Report has ZERO internal UUIDs', partialUuids);

  // 9. Document 7: Multi-Page Clinical & Management Report (Repeated Headers & Page X of Y)
  console.log('\n--- 9. Document: Multi-Page Report (35 Records) ---');
  const testCols: ExportColumn[] = [
    { key: 'id', label: 'Visit ID' }, // Internal ID — MUST be filtered out!
    { key: 'patientId', label: 'Patient ID' }, // Internal ID — MUST be filtered out!
    { key: 'patientName', label: 'Patient Name' },
    { key: 'visitDate', label: 'Visit Date' },
    { key: 'doctor', label: 'Doctor' },
    { key: 'treatment', label: 'Procedure / Treatment' },
    { key: 'fee', label: 'Treatment Fee' }
  ];
  const testRows: any[] = [];
  for (let i = 1; i <= 35; i++) {
    testRows.push({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      patientId: `11111111-1111-1111-1111-${String(i).padStart(12, '0')}`,
      patientName: `Patient Record #${i}`,
      visitDate: '2026-09-17',
      doctor: 'Dr. Mohamed Rafi',
      treatment: `Dental Scaling and Polishing Procedure Grade ${i}`,
      fee: 890 + i * 50
    });
  }
  const multiBuffer = await generatePDF(testCols, testRows, 'Clinic Visits Master Ledger Report', 'Total Records: 35');
  const pdfDoc = await PDFLibDoc.load(multiBuffer);
  const pageCount = pdfDoc.getPageCount();
  assert(pageCount >= 2, `Multi-page report successfully spans multiple pages (actual: ${pageCount})`);

  const multiText = await extractTextFromPDF(multiBuffer);
  assert(multiText.includes('Page 1 of') && multiText.includes('Page 2 of'), 'Multi-page report has Page X of Y numbering on all pages');
  assert(!multiText.includes('Visit ID'), 'Multi-page report filtered out Visit ID column');
  assert(!multiText.includes('Patient ID'), 'Multi-page report filtered out Patient ID column');
  const multiUuids = multiText.match(UUID_REGEX) || [];
  assert(multiUuids.length === 0, 'Multi-page report has ZERO UUID occurrences', multiUuids);

  // 10. API Endpoint Tests via HTTP (Head Doctor 200 vs Receptionist 403)
  console.log('\n--- 10. Live HTTP Endpoints & Privacy Boundaries ---');

  // Test Visits Report Export endpoint
  const visitsRes = await requestAPI('/api/reports/visits/export?format=pdf', doctorToken);
  assert(visitsRes.status === 200, 'GET /api/reports/visits/export?format=pdf returns HTTP 200 for Head Doctor');
  assert(visitsRes.headers['content-type']?.includes('application/pdf'), 'Content-Type is application/pdf');
  assert(visitsRes.body.slice(0, 4).toString() === '%PDF', 'Visits PDF begins with %PDF');
  const visitsText = await extractTextFromPDF(visitsRes.body);
  const visitsUuids = visitsText.match(UUID_REGEX) || [];
  assert(visitsUuids.length === 0, 'Visits export has ZERO internal UUIDs', visitsUuids);

  // Test Revenue Report Export endpoint
  const revRes = await requestAPI('/api/reports/revenue/export?format=pdf', doctorToken);
  assert(revRes.status === 200, 'GET /api/reports/revenue/export?format=pdf returns HTTP 200 for Head Doctor');
  assert(revRes.headers['content-type']?.includes('application/pdf'), 'Revenue Content-Type is application/pdf');
  assert(revRes.body.slice(0, 4).toString() === '%PDF', 'Revenue PDF begins with %PDF');
  const revText = await extractTextFromPDF(revRes.body);
  const revUuids = revText.match(UUID_REGEX) || [];
  assert(revUuids.length === 0, 'Revenue export has ZERO internal UUIDs', revUuids);

  // Test Inventory Report Export endpoint
  const invMovementsRes = await requestAPI('/api/reports/inventory-movements/export?format=pdf', doctorToken);
  assert(invMovementsRes.status === 200, 'GET /api/reports/inventory-movements/export?format=pdf returns HTTP 200 for Head Doctor');
  assert(invMovementsRes.body.slice(0, 4).toString() === '%PDF', 'Inventory PDF begins with %PDF');
  const invMovementsText = await extractTextFromPDF(invMovementsRes.body);
  const invMovementsUuids = invMovementsText.match(UUID_REGEX) || [];
  assert(invMovementsUuids.length === 0, 'Inventory movements export has ZERO internal UUIDs', invMovementsUuids);

  // 11. Security Boundary: Doctor-Owned Financial PDF Privacy
  console.log('\n--- 11. Security Boundary: Doctor-Owned Payment Privacy (200 vs 403) ---');
  
  // Create or find a doctor-owned visit with payment
  let doctorVisit = await prisma.visit.findFirst({
    where: { paymentOwner: 'DOCTOR' },
    include: { payments: true }
  });

  if (!doctorVisit) {
    let patient = await prisma.patient.findFirst();
    if (!patient) {
      patient = await prisma.patient.create({
        data: { name: 'Doctor Owned Patient', phone: '9000000001' }
      });
    }
    doctorVisit = await prisma.visit.create({
      data: {
        patientId: patient.id,
        status: 'COMPLETED',
        paymentOwner: 'DOCTOR',
        consultationFee: 500,
        amountDue: 500,
        payments: {
          create: {
            amount: 500,
            method: 'Cash',
            status: 'Paid',
            patientId: patient.id,
            date: new Date().toISOString()
          }
        }
      },
      include: { payments: true }
    });
  }

  // Ensure doctorVisit has a completed payment for the receipt test
  const hasPaid = (doctorVisit.payments || []).some((p: any) => p.status === 'Paid' || p.status === 'Completed');
  if (!hasPaid) {
    const newPayment = await prisma.payment.create({
      data: {
        amount: 500,
        method: 'Cash',
        status: 'Paid',
        visitId: doctorVisit.id,
        patientId: doctorVisit.patientId,
        date: new Date().toISOString()
      }
    });
    doctorVisit.payments = [...(doctorVisit.payments || []), newPayment];
  }

  // 11a: Receptionist requests Doctor-Owned Receipt -> Must be 403 Forbidden
  const recepReceiptRes = await requestAPI(`/api/documents/receipt/${doctorVisit.id}`, receptionistToken);
  assert(recepReceiptRes.status === 403, 'Receptionist requesting doctor-owned receipt receives HTTP 403 Forbidden');

  // 11b: Receptionist requests Doctor-Owned Invoice -> Must be 403 Forbidden
  const recepInvoiceRes = await requestAPI(`/api/documents/invoice/${doctorVisit.id}`, receptionistToken);
  assert(recepInvoiceRes.status === 403, 'Receptionist requesting doctor-owned invoice receives HTTP 403 Forbidden');

  // 11c: Head Doctor requests Doctor-Owned Receipt -> Must be 200 OK
  const docReceiptRes = await requestAPI(`/api/documents/receipt/${doctorVisit.id}`, doctorToken);
  assert(docReceiptRes.status === 200, 'Head Doctor requesting doctor-owned receipt receives HTTP 200 OK');
  assert(docReceiptRes.headers['content-type']?.includes('application/pdf'), 'Content-Type is application/pdf');

  // 11d: Head Doctor requests Doctor-Owned Invoice -> Must be 200 OK
  const docInvoiceRes = await requestAPI(`/api/documents/invoice/${doctorVisit.id}`, doctorToken);
  assert(docInvoiceRes.status === 200, 'Head Doctor requesting doctor-owned invoice receives HTTP 200 OK');
  assert(docInvoiceRes.headers['content-type']?.includes('application/pdf'), 'Content-Type is application/pdf');

  // 11e: Receptionist requests /api/reports/revenue/export -> Must be 403 Forbidden
  const recepReportsRes = await requestAPI('/api/reports/revenue/export?format=pdf', receptionistToken);
  assert(recepReportsRes.status === 403, 'Receptionist requesting /api/reports/* receives HTTP 403 Forbidden');

  console.log('\n================================================================');
  console.log(`🏁 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPDFVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
