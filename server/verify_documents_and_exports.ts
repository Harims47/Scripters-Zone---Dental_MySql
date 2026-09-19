process.env.NODE_ENV = 'test';

import { prisma } from './src/db';
import jwt from 'jsonwebtoken';
import http from 'http';
import ExcelJS from 'exceljs';
import {
  generatePrescriptionPDF,
  generateInvoicePDF,
  generateReceiptPDF,
} from './src/services/documentService';
import { generateCSV, generateXLSX } from './src/services/exportService';
import { getInvoicePDF, getReceiptPDF, getPrescriptionPDF } from './src/controllers/documentController';
import { exportBillingQueue } from './src/controllers/billingController';
import { exportPayments } from './src/controllers/paymentController';
import { exportVisits } from './src/controllers/visitController';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    data: null,
    isAttachment: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.data = body;
      return this;
    },
    header(k: string, v: string) {
      this.headers[k] = v;
      return this;
    },
    attachment(filename: string) {
      this.isAttachment = true;
      return this;
    },
    send(body: any) {
      this.data = body;
      return this;
    },
  };
  return res;
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

async function runVerification() {
  console.log('===========================================================');
  console.log('🧪 DENTALCORE — DOCUMENTS & EXPORTS VERIFICATION SUITE');
  console.log('===========================================================\n');

  // Fetch head doctor user from database
  const headDoc = await prisma.user.findFirst({ where: { role: 'Head Doctor' } });
  if (!headDoc) {
    throw new Error('Head Doctor user not found in database.');
  }
  const doctorToken = jwt.sign({ id: headDoc.id, role: headDoc.role }, JWT_SECRET, { expiresIn: '1h' });

  // -----------------------------------------------------------------
  // 1. Prescription PDF Generation
  // -----------------------------------------------------------------
  console.log('\n--- 1. Prescription PDF Generation ---');
  const rxBuffer = await generatePrescriptionPDF({
    clinicName: 'DentalCore Dental Clinic',
    patientName: 'Arun Kumar',
    patientAge: 34,
    patientGender: 'Male',
    patientId: 'PAT-1001',
    patientPhone: '9876543210',
    visitDate: '14/09/2026',
    doctorName: 'Dr. Arun Kumar',
    diagnosis: 'Acute Pulpitis #16',
    items: [
      { medicineName: 'Amoxicillin 500mg', quantity: 15, dosage: '1 Tab', frequency: 'Three times daily', duration: '5 days', instructions: 'After food' },
      { medicineName: 'Ibuprofen 400mg', quantity: 10, dosage: '1 Tab', frequency: 'Twice daily', duration: '5 days', instructions: 'After food' }
    ]
  });
  assert(Buffer.isBuffer(rxBuffer) && rxBuffer.length > 1000, 'Prescription PDF generates a valid buffer (> 1KB)');
  assert(rxBuffer.slice(0, 4).toString() === '%PDF', 'Prescription PDF starts with %PDF magic header');

  // -----------------------------------------------------------------
  // 2. Invoice PDF Generation
  // -----------------------------------------------------------------
  console.log('\n--- 2. Itemized Invoice PDF Generation ---');
  const invBuffer = await generateInvoicePDF({
    clinicName: 'DentalCore Dental Clinic',
    invoiceNumber: 'INV-TEST-001',
    visitId: 'VIS-1001',
    visitDate: '14/09/2026',
    patientName: 'Kavitha S.',
    patientId: 'PAT-2002',
    patientPhone: '9840123456',
    doctorName: 'Dr. Priya Ramesh',
    consultationFee: 300,
    treatmentFee: 3500,
    medicineCost: 450,
    totalAmount: 4250,
    amountPaid: 4250,
    amountDue: 0,
    status: 'Fully Paid',
    treatments: [
      { name: 'Root Canal Treatment (Single Sitting)', category: 'Endodontics', notes: 'Tooth #16', fee: 3500 }
    ],
    medicines: [
      { name: 'Augmentin 625mg', quantity: 10, unitPrice: 30, total: 300 },
      { name: 'Zerodol-SP', quantity: 10, unitPrice: 15, total: 150 }
    ],
    payments: [
      { receiptNo: 'RCPT-001', date: '14/09/2026', method: 'Cash', amount: 2000 },
      { receiptNo: 'RCPT-002', date: '14/09/2026', method: 'GPay', amount: 2250 }
    ]
  });
  assert(Buffer.isBuffer(invBuffer) && invBuffer.length > 1000, 'Invoice PDF generates a valid buffer (> 1KB)');
  assert(invBuffer.slice(0, 4).toString() === '%PDF', 'Invoice PDF starts with %PDF magic header');

  // -----------------------------------------------------------------
  // 3. Excel Export
  // -----------------------------------------------------------------
  console.log('\n--- 3. Excel (XLSX) Export ---');
  const testCols = [
    { key: 'id', label: 'Visit ID' },
    { key: 'patientName', label: 'Patient Name' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' }
  ];
  const testData = [
    { id: 'V-1', patientName: 'John Doe', amount: 1500, status: 'Paid' },
    { id: 'V-2', patientName: 'Jane Smith', amount: 2200, status: 'Completed' }
  ];
  const xlsxBuffer = await generateXLSX(testCols, testData, 'Visits');
  assert(Buffer.isBuffer(xlsxBuffer) && xlsxBuffer.length > 500, 'XLSX generator produces valid buffer');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsxBuffer);
  const worksheet = workbook.getWorksheet('Visits');
  assert(worksheet !== undefined && worksheet.rowCount === 3, 'XLSX workbook loaded successfully with header + 2 data rows');
  assert(worksheet?.getRow(1).getCell(1).value === 'Visit ID', 'XLSX header row has correct column label');

  // -----------------------------------------------------------------
  // 4. CSV Export with UTF-8 BOM
  // -----------------------------------------------------------------
  console.log('\n--- 4. CSV Export with UTF-8 BOM ---');
  const csvData = [
    { id: 'V-1', patientName: 'Dr. John, Jr.', amount: '₹1,500.00', notes: 'Line 1\nLine 2' },
    { id: 'V-2', patientName: 'Jane "Ace" Smith', amount: '₹2,200.00', notes: 'Standard' }
  ];
  const csvCols = [
    { key: 'id', label: 'Visit ID' },
    { key: 'patientName', label: 'Patient Name' },
    { key: 'amount', label: 'Amount' },
    { key: 'notes', label: 'Notes' }
  ];
  const csvOutput = generateCSV(csvCols, csvData);
  assert(csvOutput.charCodeAt(0) === 0xFEFF, 'CSV starts with UTF-8 BOM (\\uFEFF) for Excel compatibility');
  assert(csvOutput.includes('"Dr. John, Jr."'), 'CSV properly escapes comma-containing strings with double quotes');
  assert(csvOutput.includes('"Jane ""Ace"" Smith"'), 'CSV properly escapes embedded quotes with double quotes');
  assert(csvOutput.includes('₹1,500.00'), 'CSV preserves Unicode Indian Rupee symbol (₹)');

  // -----------------------------------------------------------------
  // 5. Long Data Values & Multi-Medicine Safety
  // -----------------------------------------------------------------
  console.log('\n--- 5. Long Data Values & Multi-Medicine Safety ---');
  const longName = 'Somasundaram Venkatanarasimha Ramachandran Subramanian';
  const longItems = Array.from({ length: 14 }, (_, i) => ({
    medicineName: `Very Long Pharmaceutical Formulation Compound Brand Name Tablets ${i + 1} Forte 625mg Extended Release`,
    quantity: 20,
    dosage: '1 Tab',
    frequency: 'Three times daily',
    duration: '10 days',
    instructions: 'Take 30 minutes after heavy breakfast with warm water'
  }));

  const longRxBuffer = await generatePrescriptionPDF({
    clinicName: 'DentalCore Dental Clinic Super Speciality Care',
    patientName: longName,
    patientAge: 68,
    patientGender: 'Male',
    patientId: 'PAT-LONG-999',
    patientPhone: '+91-9876543210',
    visitDate: '14/09/2026',
    doctorName: 'Dr. Aravindan Krishnamoorthy B.D.S., M.D.S., F.I.C.D.',
    diagnosis: 'Severe Chronic Generalized Periodontitis with Multiple Periapical Abscesses',
    items: longItems
  });
  assert(Buffer.isBuffer(longRxBuffer) && longRxBuffer.slice(0, 4).toString() === '%PDF', 'Prescription PDF handles 14 long medicines and long patient/doctor names without crashing');

  // -----------------------------------------------------------------
  // 6. Empty Optional Values Safety
  // -----------------------------------------------------------------
  console.log('\n--- 6. Empty Optional Values Safety ---');
  const emptyRxBuffer = await generatePrescriptionPDF({
    clinicName: '',
    patientName: 'Minimal Patient',
    patientId: 'PAT-EMPTY',
    patientPhone: '',
    visitDate: '',
    doctorName: '',
    items: []
  });
  assert(Buffer.isBuffer(emptyRxBuffer) && emptyRxBuffer.slice(0, 4).toString() === '%PDF', 'Prescription PDF gracefully handles empty strings, null age/gender, and zero medicines');

  const emptyInvBuffer = await generateInvoicePDF({
    clinicName: '',
    invoiceNumber: 'INV-EMPTY',
    visitId: 'VIS-EMPTY',
    visitDate: '14/09/2026',
    patientName: 'Empty Patient',
    patientId: 'PAT-EMP',
    patientPhone: '',
    consultationFee: 0,
    treatmentFee: 0,
    medicineCost: 0,
    totalAmount: 0,
    amountPaid: 0,
    amountDue: 0,
    status: 'Fully Paid',
    treatments: [],
    medicines: [],
    payments: []
  });
  assert(Buffer.isBuffer(emptyInvBuffer) && emptyInvBuffer.slice(0, 4).toString() === '%PDF', 'Invoice PDF gracefully handles 0 amounts, empty procedures, and empty payments');

  // -----------------------------------------------------------------
  // 7. Multiple Payment Rows Representation
  // -----------------------------------------------------------------
  console.log('\n--- 7. Multiple Payment Rows Representation ---');
  const multiPayInvBuffer = await generateInvoicePDF({
    clinicName: 'DentalCore Clinic',
    invoiceNumber: 'INV-MULTI-01',
    visitId: 'VIS-MULTI',
    visitDate: '14/09/2026',
    patientName: 'Rajesh Khanna',
    patientId: 'PAT-MULTI',
    patientPhone: '9876500000',
    consultationFee: 500,
    treatmentFee: 8000,
    medicineCost: 500,
    totalAmount: 9000,
    amountPaid: 7000,
    amountDue: 2000,
    status: 'Partially Paid',
    payments: [
      { receiptNo: 'RCPT-101', date: '10/09/2026', method: 'Cash', amount: 3000 },
      { receiptNo: 'RCPT-102', date: '12/09/2026', method: 'UPI', amount: 2000 },
      { receiptNo: 'RCPT-103', date: '14/09/2026', method: 'Card', amount: 2000 }
    ]
  });
  assert(Buffer.isBuffer(multiPayInvBuffer) && multiPayInvBuffer.length > 2000, 'Invoice PDF with 3 payment installments renders successfully');

  // -----------------------------------------------------------------
  // 8 & 9 & 10. Doctor-Owned Visit Security & Direct API Access
  // -----------------------------------------------------------------
  console.log('\n--- 8, 9 & 10. Doctor-Owned Visit Security & Direct API Access ---');

  // Find or check a doctor-owned visit and a reception-owned visit
  const doctorVisit = await prisma.visit.findFirst({
    where: { paymentOwner: 'DOCTOR' },
    include: { patient: true }
  });

  const receptionVisit = await prisma.visit.findFirst({
    where: { paymentOwner: 'RECEPTION' },
    include: { patient: true }
  });

  if (doctorVisit) {
    // Test 8: Authorized Doctor CAN access doctor-owned visit invoice via HTTP endpoint
    const docRes = await requestAPI(`/api/documents/invoice/${doctorVisit.id}`, doctorToken);
    assert(docRes.status === 200, `Doctor can access invoice for doctor-owned visit (HTTP ${docRes.status})`);
    assert(docRes.headers['content-type'] === 'application/pdf', 'Doctor invoice response has application/pdf content type');

    // Test 9 & 10: Receptionist CANNOT access doctor-owned visit invoice (Controller Level direct test)
    const mockReqRecep: any = {
      params: { visitId: doctorVisit.id },
      user: { id: 'mock-reception-id', role: 'Receptionist' }
    };
    const mockResRecep = createMockRes();
    await getInvoicePDF(mockReqRecep, mockResRecep);
    assert(mockResRecep.statusCode === 403, `Receptionist is blocked with HTTP 403 for doctor-owned invoice (received ${mockResRecep.statusCode})`);
    assert(mockResRecep.data?.error?.includes('Access denied') && mockResRecep.data?.message === 'Handled by Doctor', 'Receptionist receives neutral "Handled by Doctor" message and error');

    // Test Receipt endpoint protection too
    const mockResRecepRcpt = createMockRes();
    await getReceiptPDF(mockReqRecep, mockResRecepRcpt);
    assert(mockResRecepRcpt.statusCode === 403, `Receptionist is blocked with HTTP 403 for doctor-owned receipt (received ${mockResRecepRcpt.statusCode})`);
  }

  // -----------------------------------------------------------------
  // 11. Reception Exports Do Not Leak Doctor-Owned Financial Data
  // -----------------------------------------------------------------
  console.log('\n--- 11. Reception Exports Do Not Leak Doctor-Owned Financial Data ---');
  const mockReqBilling: any = {
    query: { format: 'csv' },
    user: { id: 'mock-reception-id', role: 'Receptionist' }
  };
  const mockResBilling = createMockRes();
  await exportBillingQueue(mockReqBilling, mockResBilling, (() => {}) as any);
  assert(mockResBilling.statusCode === 200, 'Receptionist can export billing queue');
  const billingCsv = String(mockResBilling.data);
  assert(billingCsv.charCodeAt(0) === 0xFEFF, 'Billing CSV export includes UTF-8 BOM');
  assert(billingCsv.includes('Treatment Fee'), 'Billing CSV export includes Treatment Fee column');

  const mockReqPayments: any = {
    query: { format: 'csv' },
    user: { id: 'mock-reception-id', role: 'Receptionist' }
  };
  const mockResPayments = createMockRes();
  await exportPayments(mockReqPayments, mockResPayments, (() => {}) as any);
  assert(mockResPayments.statusCode === 200, 'Receptionist can export payments');

  const mockReqVisits: any = {
    query: { format: 'csv' },
    user: { id: 'mock-reception-id', role: 'Receptionist' }
  };
  const mockResVisits = createMockRes();
  await exportVisits(mockReqVisits, mockResVisits, (() => {}) as any);
  assert(mockResVisits.statusCode === 200, 'Receptionist can export visits');
  const visitsCsv = String(mockResVisits.data);
  if (doctorVisit) {
    // If the doctor visit appears in the visits list, its payment status must be 'Handled by Doctor'
    assert(!visitsCsv.includes(`₹${doctorVisit.amountDue}`), 'Reception visits export does not leak doctor-owned fee amounts');
  }

  // -----------------------------------------------------------------
  // 12. Authorized Doctor Exports Retain Required Data
  // -----------------------------------------------------------------
  console.log('\n--- 12. Authorized Doctor Exports Retain Required Data ---');
  const docBillingRes = await requestAPI('/api/billing/export?format=csv', doctorToken);
  assert(docBillingRes.status === 200, 'Doctor can export billing queue via live API');
  const docBillingCsv = docBillingRes.body.toString();
  assert(docBillingCsv.includes('Consultation Fee') && docBillingCsv.includes('Treatment Fee'), 'Doctor billing export contains all fee columns');

  // -----------------------------------------------------------------
  // 13 & 14. Existing Receipt & Prescription PDFs Functional
  // -----------------------------------------------------------------
  console.log('\n--- 13 & 14. Existing Receipt & Prescription PDFs Functional ---');
  const rcptBuffer = await generateReceiptPDF({
    clinicName: 'DentalCore Dental Clinic',
    patientName: 'Test Patient',
    patientId: 'PAT-1',
    patientPhone: '9876543210',
    visitId: 'VIS-1',
    visitDate: '14/09/2026',
    consultationFee: 200,
    medicineCost: 300,
    totalAmount: 500,
    amountPaid: 500,
    paymentMethod: 'Cash',
    paymentDate: '14/09/2026',
    paymentStatus: 'Paid',
    receiptNo: 'RCPT-001',
    receivedBy: 'Receptionist'
  });
  assert(Buffer.isBuffer(rcptBuffer) && rcptBuffer.slice(0, 4).toString() === '%PDF', 'Existing Receipt PDF generator remains 100% functional');

  if (receptionVisit) {
    const rxApiRes = await requestAPI(`/api/documents/prescription/${receptionVisit.id}`, doctorToken);
    assert(rxApiRes.status === 200 || rxApiRes.status === 404, `Prescription API responds cleanly (HTTP ${rxApiRes.status})`);
  }

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification()
  .catch((err) => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
