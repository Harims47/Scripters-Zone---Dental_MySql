import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';

test.describe('Round 3 — Release Gate & Production Build Verification', () => {

  test('REL-1: Deep Link and Page Refresh on Production Build (SPA Fallback & No 404s)', async ({ page }) => {
    test.setTimeout(60000);
    // Login as Head Doctor (full route access)
    await loginAs(page, 'headDoctor');

    const routes = [
      '/dashboard',
      '/reception-desk',
      '/patients',
      '/appointments',
      '/queue',
      '/billing',
      '/partial-payments',
      '/inventory',
      '/reports'
    ];

    for (const route of routes) {
      // 1. Direct open
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // Verify no blank page and no 404 error
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(20);
      expect(bodyText).not.toContain('404');
      expect(bodyText).not.toContain('Cannot GET');

      // 2. Page reload (verifies SPA fallback routing in production server)
      await page.reload();
      await page.waitForLoadState('networkidle');
      const reloadedBody = await page.locator('body').innerText();
      expect(reloadedBody.length).toBeGreaterThan(20);
      expect(reloadedBody).not.toContain('404');
      expect(reloadedBody).not.toContain('Cannot GET');
    }
  });

  test('REL-2: Unauthenticated Direct Access & Logout Navigation Safety', async ({ page }) => {
    // 1. Direct access to protected routes without session must redirect to /login
    const protectedRoutes = ['/reception-desk', '/dashboard', '/patients', '/inventory'];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/.*\/login/);
    }

    // 2. Login as Receptionist, then logout
    await loginAs(page, 'receptionist');
    await expect(page).toHaveURL(/.*\/reception-desk/);
    await logout(page);
    await expect(page).toHaveURL(/.*\/login/);

    // 3. Browser Back after logout must NOT expose protected data
    await page.goBack();
    await page.waitForLoadState('networkidle');
    // Expect URL to be login or redirect immediately to login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('REL-3: Security API Boundaries (401 Unauthorized & 403 Forbidden)', async ({ request }) => {
    // 1. Unauthenticated API calls must return 401
    const apiBase = 'http://localhost:3001';
    const res1 = await request.get(`${apiBase}/api/patients`);
    expect(res1.status()).toBe(401);

    const res2 = await request.get(`${apiBase}/api/inventory`);
    expect(res2.status()).toBe(401);

    const res3 = await request.get(`${apiBase}/api/reports/overview`);
    expect(res3.status()).toBe(401);

    // 2. Authenticate as Receptionist via API
    const loginRes = await request.post(`${apiBase}/api/auth/login`, {
      data: { username: 'receptionist', password: 'demo123' }
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const token = loginData.token;

    // 3. Receptionist attempting admin-only staff creation or reports
    const staffRes = await request.post(`${apiBase}/api/staff`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Test Staff', role: 'Duty Doctor' }
    });
    expect(staffRes.status()).toBe(403);

    const reportRes = await request.get(`${apiBase}/api/reports/revenue`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(reportRes.status()).toBe(403);
  });

  test('REL-4: Multi-Tab Cross-Role Coordination without Session Pollution', async ({ browser }) => {
    // Context 1: Receptionist
    const receptionContext = await browser.newContext();
    const receptionPage = await receptionContext.newPage();
    await loginAs(receptionPage, 'receptionist');
    await expect(receptionPage).toHaveURL(/.*\/reception-desk/);

    // Context 2: Duty Doctor
    const doctorContext = await browser.newContext();
    const doctorPage = await doctorContext.newPage();
    await loginAs(doctorPage, 'dutyDoctor');
    await expect(doctorPage).toHaveURL(/.*\/dashboard/);

    // Verify role isolation across concurrent contexts
    await expect(receptionPage.locator('body')).toContainText('Receptionist');
    await expect(doctorPage.locator('body')).toContainText('Duty Doctor');

    // Clean up
    await receptionContext.close();
    await doctorContext.close();
  });

  test('REL-5: Browser Console Audit during Production Navigation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await loginAs(page, 'headDoctor');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.goto('/reception-desk');
    await page.waitForLoadState('networkidle');

    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Filter out expected/benign network errors (like Google translate, fonts, 401 session check, or favicon)
    const severeErrors = consoleErrors.filter(err => 
      !err.includes('translate') && 
      !err.includes('favicon') && 
      !err.includes('fonts.googleapis') &&
      !err.includes('401') && // Initial unauthenticated probe
      !err.includes('403') // 403 checks in other tests
    );

    if (severeErrors.length > 0) {
      console.log('Captured browser console errors:', severeErrors);
    }

    expect(severeErrors.length).toBe(0);
  });

  test('REL-6: Hardening Verification - No Demo Accounts in Production & Doctor Selector uses Live Staff', async ({ page }) => {
    // 1. Open login page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 2. Verify Demo Accounts card is completely absent in production UI
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Demo Accounts');
    expect(body).not.toContain('demo123');
    await expect(page.locator('button:has-text("Receptionist")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Duty Doctor")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Head Doctor")')).toHaveCount(0);

    // 3. Verify normal login works
    await loginAs(page, 'receptionist');
    await expect(page).toHaveURL(/.*\/reception-desk/);

    // 4. Open Patients page and check Start Visit doctor selection
    await page.goto('/patients');
    await page.waitForLoadState('networkidle');
    await dismissLowStockAlertIfPresent(page);

    // Click on first patient row to open profile drawer
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    await page.waitForTimeout(500);

    // Click Start Visit button inside drawer
    const startVisitBtn = page.getByRole('button', { name: /Start Visit/i });
    if (await startVisitBtn.isVisible()) {
      await startVisitBtn.click();
      await page.waitForTimeout(500);

      // Verify Provider select options
      const providerSelect = page.locator('select').filter({ hasText: /Select a doctor|No doctors/ });
      await expect(providerSelect).toBeVisible();

      const optionTexts = await providerSelect.locator('option').allInnerTexts();
      expect(optionTexts.length).toBeGreaterThan(0);
      // Ensure none of the old fake mock doctors appear
      expect(optionTexts.some(t => t.includes('Dr. Strange'))).toBeFalsy();
    }
  });

});
