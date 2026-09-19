import { test, expect } from '@playwright/test';

test.describe('Round 2: Security, Authentication Edge Cases & RBAC Boundaries', () => {

  test('SEC-1: Authentication Boundary & Credential Rejection', async ({ request }) => {
    // 1. Wrong password -> 401
    const badPass = await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'WrongPassword999!' }
    });
    expect(badPass.status()).toBe(401);

    // 2. Wrong username -> 401
    const badUser = await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'nonExistentUser_12345', password: 'demo123' }
    });
    expect(badUser.status()).toBe(401);

    // 3. Empty credentials -> 400 or 401
    const emptyCreds = await request.post('http://localhost:3001/api/auth/login', {
      data: { username: '', password: '' }
    });
    expect([400, 401]).toContain(emptyCreds.status());

    // 4. Direct unauthenticated API access -> 401
    // New isolated request context
    const unauthPat = await request.get('http://localhost:3001/api/patients', {
      headers: { cookie: '' } // explicit empty cookie
    });
    expect(unauthPat.status()).toBe(401);

    const unauthBill = await request.get('http://localhost:3001/api/billing', {
      headers: { cookie: '' }
    });
    expect(unauthBill.status()).toBe(401);
  });

  test('SEC-2: Role-Based Authorization Enforcement Across API Surfaces', async ({ request }) => {
    // 1. Receptionist Role Boundaries
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'receptionist', password: 'demo123' }
    });

    // Receptionist cannot create staff
    const unauthStaff = await request.post('http://localhost:3001/api/staff', {
      data: { name: 'Hacker Staff', role: 'Duty Doctor' }
    });
    expect(unauthStaff.status()).toBe(403);

    // Receptionist cannot delete medicine
    const unauthDelMed = await request.delete('http://localhost:3001/api/inventory/some-random-id');
    expect(unauthDelMed.status()).toBe(403);

    // Receptionist cannot access or create supplier bills
    const unauthBill = await request.post('http://localhost:3001/api/supplier-bills', {
      data: { supplierId: 'test', invoiceNumber: 'INV-1', amount: 500 }
    });
    expect(unauthBill.status()).toBe(403);

    // 2. Duty Doctor Role Boundaries
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'dutydoctor', password: 'demo123' }
    });

    // Duty Doctor cannot access billing queue
    const docBilling = await request.get('http://localhost:3001/api/billing');
    expect(docBilling.status()).toBe(403);

    // Duty Doctor cannot access reports
    const docReports = await request.get('http://localhost:3001/api/reports/summary');
    expect(docReports.status()).toBe(403);

    // Duty Doctor cannot update staff attendance
    const docAttend = await request.put('http://localhost:3001/api/staff/any-id/attendance', {
      data: { attendance: 'Present' }
    });
    expect(docAttend.status()).toBe(403);
  });

  test('SEC-3: Frontend Route Navigation Guarding & Browser Session Isolation', async ({ page }) => {
    // 1. Login as Duty Doctor in browser
    await page.goto('http://localhost:5173/login');
    await page.locator('#username').fill('dutydoctor');
    await page.locator('#password').fill('demo123');
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    // 2. Attempt direct URL navigation to unauthorized /reports
    await page.goto('http://localhost:5173/reports');
    await page.waitForLoadState('networkidle');

    // Must NOT render reports data table (either redirected or showing unauthorized/workspace)
    const hasReportHeading = await page.getByRole('heading', { name: 'Reports & Analytics' }).isVisible();
    expect(hasReportHeading).toBe(false);

    // 3. Attempt direct URL navigation to unauthorized /settings
    await page.goto('http://localhost:5173/settings');
    await page.waitForLoadState('networkidle');
    const hasClinicSettings = await page.getByRole('heading', { name: 'Clinic Settings' }).isVisible();
    expect(hasClinicSettings).toBe(false);
  });

});
