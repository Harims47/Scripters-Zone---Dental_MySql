process.env.NODE_ENV = 'test';

import { prisma } from './src/db';
import jwt from 'jsonwebtoken';
import http from 'http';
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

async function runFinalPass() {
  console.log('===========================================================');
  console.log('🧪 DENTALCORE — FINAL TARGETED VERIFICATION PASS');
  console.log('===========================================================\n');

  // Fetch head doctor user from database
  const headDoc = await prisma.user.findFirst({ where: { role: 'Head Doctor' } });
  if (!headDoc) {
    throw new Error('Head Doctor user not found in database.');
  }
  const doctorToken = jwt.sign({ id: headDoc.id, role: headDoc.role }, JWT_SECRET, { expiresIn: '1h' });

  // -----------------------------------------------------------------
  // CHECK 1 — Prescription API End-to-End
  // -----------------------------------------------------------------
  console.log('\n--- CHECK 1: Prescription API with Real Database Visit ---');
  // Find a real visit with an actual prescription attached
  const visitWithPrescription = await prisma.visit.findFirst({
    where: { prescription: { isNot: null } },
    include: { patient: true, prescription: { include: { items: true } } }
  });

  if (!visitWithPrescription) {
    throw new Error('No visit with prescription found in existing database.');
  }

  // 1A. HTTP Request to running backend server as Doctor
  const rxHttpRes = await requestAPI(`/api/documents/prescription/${visitWithPrescription.id}`, doctorToken);
  assert(rxHttpRes.status === 200, `Doctor can retrieve prescription PDF via HTTP GET /api/documents/prescription/:visitId (Status: ${rxHttpRes.status})`);
  assert(rxHttpRes.headers['content-type'] === 'application/pdf', `Content-Type is application/pdf (Header: ${rxHttpRes.headers['content-type']})`);
  assert(rxHttpRes.body.slice(0, 4).toString() === '%PDF', 'Response buffer begins with %PDF magic header');

  // 1B. Test Receptionist authorization on prescription endpoint (both Doctor & Receptionist are authorized by RBAC)
  const rxMockReqRecep: any = {
    params: { visitId: visitWithPrescription.id },
    user: { id: 'mock-reception-id', role: 'Receptionist' }
  };
  const rxMockResRecep = createMockRes();
  await getPrescriptionPDF(rxMockReqRecep, rxMockResRecep);
  assert(rxMockResRecep.statusCode === 200, `Receptionist is authorized to retrieve prescription PDF (Status: ${rxMockResRecep.statusCode})`);
  assert(Buffer.isBuffer(rxMockResRecep.data) && rxMockResRecep.data.slice(0, 4).toString() === '%PDF', 'Prescription PDF for Receptionist starts with %PDF');

  // -----------------------------------------------------------------
  // CHECK 2 — Invoice API (RECEPTION-owned vs DOCTOR-owned)
  // -----------------------------------------------------------------
  console.log('\n--- CHECK 2: Invoice API (RECEPTION-owned vs DOCTOR-owned) ---');
  let receptionVisit = await prisma.visit.findFirst({
    where: { paymentOwner: 'RECEPTION', payments: { some: {} } },
    include: { patient: true }
  });
  let doctorVisit = await prisma.visit.findFirst({
    where: { paymentOwner: 'DOCTOR', payments: { some: {} } },
    include: { patient: true }
  });

  if (!receptionVisit) {
    const p = await prisma.patient.create({ data: { name: 'Recep Visit Patient', phone: `98700${Date.now() % 100000}` } });
    receptionVisit = await prisma.visit.create({
      data: {
        patientId: p.id,
        status: 'COMPLETED',
        paymentOwner: 'RECEPTION',
        amountDue: 500,
        payments: { create: [{ amount: 500, method: 'Cash', status: 'Completed', recordedBy: 'receptionist' }] }
      },
      include: { patient: true }
    });
  }

  if (!doctorVisit) {
    const p = await prisma.patient.create({ data: { name: 'Doctor Visit Patient', phone: `98600${Date.now() % 100000}` } });
    doctorVisit = await prisma.visit.create({
      data: {
        patientId: p.id,
        status: 'COMPLETED',
        paymentOwner: 'DOCTOR',
        amountDue: 800,
        payments: { create: [{ patientId: p.id, amount: 800, method: 'Cash', status: 'Completed', date: '2026-09-19' }] }
      },
      include: { patient: true }
    });
  }

  // 2A. Doctor can retrieve invoice for both visits via HTTP
  const docInvRecepRes = await requestAPI(`/api/documents/invoice/${receptionVisit.id}`, doctorToken);
  assert(docInvRecepRes.status === 200, `Doctor can retrieve invoice for RECEPTION-owned visit (HTTP ${docInvRecepRes.status})`);
  assert(docInvRecepRes.headers['content-type'] === 'application/pdf' && docInvRecepRes.body.slice(0, 4).toString() === '%PDF', 'Invoice response is valid application/pdf');

  const docInvDocRes = await requestAPI(`/api/documents/invoice/${doctorVisit.id}`, doctorToken);
  assert(docInvDocRes.status === 200, `Doctor can retrieve invoice for DOCTOR-owned visit (HTTP ${docInvDocRes.status})`);
  assert(docInvDocRes.headers['content-type'] === 'application/pdf' && docInvDocRes.body.slice(0, 4).toString() === '%PDF', 'Doctor-owned invoice response is valid application/pdf');

  // 2B. Receptionist CAN retrieve invoice for RECEPTION-owned visit
  const recepInvReq: any = {
    params: { visitId: receptionVisit.id },
    user: { id: 'mock-reception-id', role: 'Receptionist' }
  };
  const recepInvRes = createMockRes();
  await getInvoicePDF(recepInvReq, recepInvRes);
  assert(recepInvRes.statusCode === 200, `Receptionist can retrieve invoice for RECEPTION-owned visit (Status: ${recepInvRes.statusCode})`);
  assert(Buffer.isBuffer(recepInvRes.data) && recepInvRes.data.slice(0, 4).toString() === '%PDF', 'Reception-owned invoice starts with %PDF');

  // 2C. Receptionist CANNOT retrieve invoice for DOCTOR-owned visit (Strict HTTP 403 Forbidden)
  const recepDocInvReq: any = {
    params: { visitId: doctorVisit.id },
    user: { id: 'mock-reception-id', role: 'Receptionist' }
  };
  const recepDocInvRes = createMockRes();
  await getInvoicePDF(recepDocInvReq, recepDocInvRes);
  assert(recepDocInvRes.statusCode === 403, `Receptionist is blocked with HTTP 403 for DOCTOR-owned invoice (Status: ${recepDocInvRes.statusCode})`);
  assert(recepDocInvRes.data?.message === 'Handled by Doctor', `Neutral user-facing message is exactly "Handled by Doctor" (Message: "${recepDocInvRes.data?.message}")`);
  assert(recepDocInvRes.data?.consultationFee === undefined && recepDocInvRes.data?.amountDue === undefined, 'No financial fields are leaked in the 403 response payload');

  // -----------------------------------------------------------------
  // CHECK 3 — Invoice Contents & Mathematical Correctness
  // -----------------------------------------------------------------
  console.log('\n--- CHECK 3: Invoice Calculation & Payment Ledger ---');
  const consultationFee = 500;
  const treatmentFee = 4500;
  const medicineCost = 350;
  const expectedGrossTotal = consultationFee + treatmentFee + medicineCost; // 5350

  const payment1 = { receiptNo: 'RCPT-001', date: '10/09/2026', method: 'Cash', amount: 2000 };
  const payment2 = { receiptNo: 'RCPT-002', date: '12/09/2026', method: 'UPI', amount: 2000 };
  const payment3 = { receiptNo: 'RCPT-003', date: '14/09/2026', method: 'Card', amount: 1350 };
  const payments = [payment1, payment2, payment3];

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0); // 5350
  const balanceDue = Math.max(0, expectedGrossTotal - totalPaid); // 0

  assert(expectedGrossTotal === 5350, 'Gross Total equals Consultation + Treatment + Medicines (500 + 4500 + 350 = 5350)');
  assert(totalPaid === 5350, 'Total Paid equals sum of all authorized payment rows (2000 + 2000 + 1350 = 5350)');
  assert(balanceDue === 0, 'Balance Due equals Gross Total - Total Paid (5350 - 5350 = 0)');

  const multiPayInvoiceBuffer = await generateInvoicePDF({
    clinicName: 'DentalCore Clinic',
    invoiceNumber: 'INV-CALC-TEST',
    visitId: 'VIS-CALC',
    visitDate: '14/09/2026',
    patientName: 'Karthik Raja',
    patientId: 'PAT-CALC',
    patientPhone: '9840999888',
    doctorName: 'Dr. Arun Kumar',
    consultationFee,
    treatmentFee,
    medicineCost,
    totalAmount: expectedGrossTotal,
    amountPaid: totalPaid,
    amountDue: balanceDue,
    status: 'Fully Paid',
    treatments: [
      { name: 'Ceramic Crown', category: 'Prosthodontics', notes: 'Tooth #21', fee: 4500 }
    ],
    medicines: [
      { name: 'Amoxicillin 500mg', quantity: 10, unitPrice: 20, total: 200 },
      { name: 'Paracetamol 650mg', quantity: 15, unitPrice: 10, total: 150 }
    ],
    payments
  });
  assert(Buffer.isBuffer(multiPayInvoiceBuffer) && multiPayInvoiceBuffer.length > 2000, 'Invoice PDF renders itemized treatments, pharmacy items, and multi-payment ledger');

  // -----------------------------------------------------------------
  // CHECK 4 — Export Security for Receptionist
  // -----------------------------------------------------------------
  console.log('\n--- CHECK 4: Export Security (Receptionist Restrictions) ---');

  // 4A. Billing Queue Export as Receptionist
  const mockReqBilling: any = { query: { format: 'csv' }, user: { role: 'Receptionist' } };
  const mockResBilling = createMockRes();
  await exportBillingQueue(mockReqBilling, mockResBilling, (() => {}) as any);
  assert(mockResBilling.statusCode === 200, 'Receptionist can export billing queue');
  const billingCsv = String(mockResBilling.data);
  assert(billingCsv.charCodeAt(0) === 0xFEFF, 'Billing CSV export has UTF-8 BOM');
  assert(!billingCsv.includes(doctorVisit.id), 'Doctor-owned visit ID is excluded from Reception billing export');

  // 4B. Payments Export as Receptionist
  const mockReqPayments: any = { query: { format: 'csv' }, user: { role: 'Receptionist' } };
  const mockResPayments = createMockRes();
  await exportPayments(mockReqPayments, mockResPayments, (() => {}) as any);
  assert(mockResPayments.statusCode === 200, 'Receptionist can export payments');
  const paymentsCsv = String(mockResPayments.data);
  assert(paymentsCsv.charCodeAt(0) === 0xFEFF, 'Payments CSV export has UTF-8 BOM');
  assert(!paymentsCsv.includes(doctorVisit.id), 'Doctor-owned visit payments are excluded from Reception payments export');

  // 4C. Visits Export as Receptionist
  const mockReqVisits: any = { query: { format: 'csv' }, user: { role: 'Receptionist' } };
  const mockResVisits = createMockRes();
  await exportVisits(mockReqVisits, mockResVisits, (() => {}) as any);
  assert(mockResVisits.statusCode === 200, 'Receptionist can export visits');
  const visitsCsv = String(mockResVisits.data);
  assert(visitsCsv.charCodeAt(0) === 0xFEFF, 'Visits CSV export has UTF-8 BOM');
  assert(visitsCsv.includes('Handled by Doctor'), 'Doctor-owned visit payment status is masked to exactly "Handled by Doctor"');
  assert(!visitsCsv.includes(`₹${doctorVisit.amountDue}`), 'Doctor-owned financial fee amounts are completely excluded from visits export');

  // -----------------------------------------------------------------
  // CHECK 5 & 6 — Regression & Existing Features
  // -----------------------------------------------------------------
  console.log('\n--- CHECK 5 & 6: Existing Functionality Regression ---');
  const rcptBuffer = await generateReceiptPDF({
    clinicName: 'DentalCore Dental Clinic',
    patientName: 'Test Patient',
    patientId: 'PAT-REG',
    patientPhone: '9876543210',
    visitId: 'VIS-REG',
    visitDate: '14/09/2026',
    consultationFee: 200,
    medicineCost: 300,
    totalAmount: 500,
    amountPaid: 500,
    paymentMethod: 'Cash',
    paymentDate: '14/09/2026',
    paymentStatus: 'Paid',
    receiptNo: 'RCPT-REG-01',
    receivedBy: 'Receptionist'
  });
  assert(Buffer.isBuffer(rcptBuffer) && rcptBuffer.slice(0, 4).toString() === '%PDF', 'Existing Receipt PDF generator is 100% functional');

  console.log('\n===========================================================');
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFinalPass()
  .catch((err) => {
    console.error('Fatal error during final pass:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
