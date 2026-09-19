import { test, expect } from '@playwright/test';

test.describe('Round 2: Reports Financial & Operational Integrity', () => {

  test('REPORT-1: Strict RBAC Protection of Reports Subsystem', async ({ request }) => {
    // 1. Receptionist attempted access -> 403 Forbidden
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    const recSummary = await request.get('http://localhost:3001/api/reports/summary');
    expect(recSummary.status()).toBe(403);

    const recRev = await request.get('http://localhost:3001/api/reports/revenue');
    expect(recRev.status()).toBe(403);

    const recProc = await request.get('http://localhost:3001/api/reports/procurement');
    expect(recProc.status()).toBe(403);

    // 2. Duty Doctor attempted access -> 403 Forbidden
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'dutydoctor', password: 'demo123' }
    });

    const docSummary = await request.get('http://localhost:3001/api/reports/summary');
    expect(docSummary.status()).toBe(403);

    const docRev = await request.get('http://localhost:3001/api/reports/revenue');
    expect(docRev.status()).toBe(403);

    // 3. Head Doctor authorized access -> 200 OK
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'headdoctor', password: 'demo123' }
    });

    const headSummary = await request.get('http://localhost:3001/api/reports/summary');
    expect(headSummary.status()).toBe(200);

    const headRev = await request.get('http://localhost:3001/api/reports/revenue?timeframe=all');
    expect(headRev.status()).toBe(200);

    const headProc = await request.get('http://localhost:3001/api/reports/procurement?timeframe=all');
    expect(headProc.status()).toBe(200);
  });

  test('REPORT-2: Cross-Contamination Isolation Between Patient Revenue and Supplier Procurement', async ({ request }) => {
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'headdoctor', password: 'demo123' }
    });

    // 1. Fetch Revenue Report
    const revRes = await request.get('http://localhost:3001/api/reports/revenue?timeframe=all');
    expect(revRes.status()).toBe(200);
    const revData = await revRes.json();

    // Verify all transaction rows belong to patient payments
    if (revData.data && revData.data.length > 0) {
      for (const row of revData.data) {
        expect(row.patientId).toBeTruthy();
        expect(row.patientName).toBeTruthy();
        // Crucial: No supplier or PO fields leak into patient payments
        expect(row.supplierId).toBeUndefined();
        expect(row.orderNumber).toBeUndefined();
      }
    }

    // 2. Fetch Procurement Report
    const procRes = await request.get('http://localhost:3001/api/reports/procurement?timeframe=all');
    expect(procRes.status()).toBe(200);
    const procData = await procRes.json();

    // Verify procurement rows belong to purchase orders/suppliers
    if (procData.data && procData.data.length > 0) {
      for (const row of procData.data) {
        expect(row.orderNumber).toBeTruthy();
        expect(row.supplierName).toBeTruthy();
        // Crucial: No patient fields leak into procurement
        expect(row.patientId).toBeUndefined();
      }
    }
  });

  test('REPORT-3: Export Format Integrity (CSV, PDF, XLSX)', async ({ request }) => {
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'headdoctor', password: 'demo123' }
    });

    // 1. CSV export for Revenue
    const csvRes = await request.get('http://localhost:3001/api/reports/revenue/export?format=csv&timeframe=all');
    expect(csvRes.status()).toBe(200);
    expect(csvRes.headers()['content-type']).toContain('text/csv');

    // 2. PDF export for Visits
    const pdfRes = await request.get('http://localhost:3001/api/reports/visits/export?format=pdf&timeframe=all');
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()['content-type']).toContain('application/pdf');

    // 3. XLSX export for Procurement
    const xlsxRes = await request.get('http://localhost:3001/api/reports/procurement/export?format=xlsx&timeframe=all');
    expect(xlsxRes.status()).toBe(200);
    expect(xlsxRes.headers()['content-type']).toContain('spreadsheetml');
  });

});
