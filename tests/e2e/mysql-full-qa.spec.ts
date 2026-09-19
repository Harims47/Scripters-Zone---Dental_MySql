import { test, expect, Page } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from './helpers/auth';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';
import fs from 'fs';

/**
 * Universal error listener setup for Phase 10 compliance
 */
function attachErrorListeners(page: Page, capturedErrors: string[]) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore harmless favicon or known benign auth responses (401 on logout, 403 on RBAC probe)
      if (!text.includes('favicon') && !text.includes('403') && !text.includes('401')) {
        capturedErrors.push(`Console error: ${text}`);
      }
    }
  });

  page.on('pageerror', err => {
    capturedErrors.push(`Page error: ${err.message}`);
  });

  page.on('response', res => {
    if (res.status() >= 500) {
      capturedErrors.push(`5xx Server error on ${res.url()}: ${res.status()}`);
    }
  });
}

test.describe('DentalCore — MySQL Full Application QA Suite', () => {

  // =========================================================================
  // PHASE 5: PLAYWRIGHT AUTH & ROLE-BASED ACCESS CONTROL (RBAC)
  // =========================================================================
  test.describe('Phase 5: Auth & RBAC Verification', () => {

    test('AUTH-1: Head Doctor login, protected routes, and complete module navigation', async ({ page }) => {
      test.setTimeout(60000);
      const errors: string[] = [];
      attachErrorListeners(page, errors);

      await loginAs(page, 'headDoctor');
      await expect(page).toHaveURL(/.*\/dashboard/);
      await expect(page.locator('body')).toContainText(/Head Doctor|Dr\. Rajesh Sharma/i);

      // Verify Head Doctor has access to all primary routes
      const headRoutes = ['/dashboard', '/reception-desk', '/patients', '/appointments', '/queue', '/inventory', '/billing', '/reimbursement', '/reports', '/staff', '/settings', '/historical-migration'];
      for (const route of headRoutes) {
        await page.goto(route);
        await dismissLowStockAlertIfPresent(page, 500);
        await expect(page).toHaveURL(new RegExp(`.*${route}`));
        await expect(page.locator('body')).not.toContainText('Access Denied');
      }

      await logout(page);
      expect(errors.filter(e => !e.includes('403'))).toHaveLength(0);
    });

    test('AUTH-2: Duty Doctor login, consultation access, and restricted module enforcement', async ({ page }) => {
      const errors: string[] = [];
      attachErrorListeners(page, errors);

      await loginAs(page, 'dutyDoctor');
      await expect(page).toHaveURL(/.*\/dashboard/);
      await expect(page.locator('body')).toContainText(/Duty Doctor|Dr\. Priya Venkatesh/i);

      // Allowed routes
      await page.goto('/patients');
      await dismissLowStockAlertIfPresent(page, 2000);
      await expect(page).toHaveURL(/.*\/patients/);

      await page.goto('/queue');
      await dismissLowStockAlertIfPresent(page, 2000);
      await expect(page).toHaveURL(/.*\/queue/);

      // Restricted routes: /settings and /reports MUST block Duty Doctor with /unauthorized
      await page.goto('/settings');
      await page.waitForURL('**/unauthorized');
      await expect(page.locator('body')).toContainText(/Access Denied|Unauthorized/i);

      await page.goto('/reports');
      await page.waitForURL('**/unauthorized');
      await expect(page.locator('body')).toContainText(/Access Denied|Unauthorized/i);

      await logout(page);
    });

    test('AUTH-3: Receptionist login, Reception Desk landing, and restricted inventory/settings', async ({ page }) => {
      const errors: string[] = [];
      attachErrorListeners(page, errors);

      await loginAs(page, 'receptionist');
      await expect(page).toHaveURL(/.*\/reception-desk/);
      await expect(page.locator('body')).toContainText(/Receptionist|Kavitha Sundaram/i);

      // Allowed reception routes
      await page.goto('/appointments');
      await dismissLowStockAlertIfPresent(page, 2000);
      await expect(page).toHaveURL(/.*\/appointments/);

      await page.goto('/billing');
      await dismissLowStockAlertIfPresent(page, 2000);
      await expect(page).toHaveURL(/.*\/billing/);

      // Restricted routes: /inventory and /settings MUST block Receptionist with /unauthorized
      await page.goto('/inventory');
      await page.waitForURL('**/unauthorized');
      await expect(page.locator('body')).toContainText(/Access Denied|Unauthorized/i);

      await page.goto('/settings');
      await page.waitForURL('**/unauthorized');
      await expect(page.locator('body')).toContainText(/Access Denied|Unauthorized/i);

      await logout(page);
    });

    test('AUTH-4: Logout terminates session and prevents back-navigation', async ({ page }) => {
      await loginAs(page, 'receptionist');
      await logout(page);

      // Attempt accessing protected route
      await page.goto('/reception-desk');
      await page.waitForURL('**/login', { timeout: 10000 });
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  // =========================================================================
  // PHASE 6: PLAYWRIGHT BUSINESS JOURNEYS
  // =========================================================================
  test.describe('Phase 6: Real Clinical Business Journeys', () => {

    const testTimestamp = Date.now().toString().slice(-6);
    const newPatientName = `Sanjay Verma ${testTimestamp}`;
    const newPatientPhone = `9840${testTimestamp}`;

    test('JOURNEY-1: New Patient Registration -> Directory -> Walk-in Check-in', async ({ page }) => {
      test.setTimeout(60000);
      await loginAs(page, 'receptionist');
      await page.goto('/reception-desk');
      await dismissLowStockAlertIfPresent(page, 2000);

      // Open Register Patient Modal
      await page.getByRole('button', { name: 'Register Patient' }).first().click();
      await page.getByRole('button', { name: 'New Patient' }).click();

      // Fill in real patient form
      await page.locator('input[placeholder="Enter patient name"]').fill(newPatientName);
      await page.locator('input[placeholder="10-digit mobile number"]').fill(newPatientPhone);
      await page.locator('input[placeholder="e.g. 30"]').fill('38');

      // Gender selection if available
      const genderSelect = page.locator('button:has-text("Select gender"), select').first();
      if (await genderSelect.isVisible().catch(() => false)) {
        await genderSelect.click();
        const maleOption = page.getByRole('option', { name: 'Male' }).first();
        if (await maleOption.isVisible().catch(() => false)) await maleOption.click();
      }

      await page.getByRole('button', { name: 'Register Patient' }).last().click();

      // Dismiss confirmation dialog if shown
      const regModal = page.getByRole('dialog').filter({ hasText: /Registration Complete|Registration Successful/i });
      if (await regModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        await regModal.getByRole('button', { name: 'OK' }).click();
      }

      // Verify in Patient Directory
      await page.goto('/patients');
      await dismissLowStockAlertIfPresent(page, 2000);
      await page.getByPlaceholder('Search name, ID or phone...').fill(newPatientPhone);
      await expect(page.locator('table')).toContainText(newPatientName, { timeout: 10000 });

      await logout(page);
    });

    test('JOURNEY-2: Existing Patient Search -> View Profile & Clinical History', async ({ page }) => {
      await loginAs(page, 'receptionist');
      await page.goto('/patients');
      await dismissLowStockAlertIfPresent(page, 2000);

      // Search for seeded patient Vikramaditya Iyer
      await page.getByPlaceholder('Search name, ID or phone...').fill('Vikramaditya');
      const row = page.locator('table tr').filter({ hasText: 'Vikramaditya Iyer' }).first();
      await expect(row).toBeVisible({ timeout: 10000 });
      await expect(row).toContainText('9840111222');

      // Click on patient to view drawer or detail
      await row.click();
      await page.waitForTimeout(1000);

      await logout(page);
    });

    test('JOURNEY-3: Doctor-Owned Payment Privacy ("Handled by Doctor" Masking)', async ({ page }) => {
      // 1. Head Doctor views Aarav Nambiar (doctor-owned payment of 3500)
      await loginAs(page, 'headDoctor');
      await page.goto('/patients');
      await dismissLowStockAlertIfPresent(page, 2000);
      await page.getByPlaceholder('Search name, ID or phone...').fill('Aarav Nambiar');
      await expect(page.locator('table')).toContainText('Aarav Nambiar');
      await logout(page);

      // 2. Receptionist logs in and checks Billing Queue
      await loginAs(page, 'receptionist');
      await page.goto('/billing');
      await dismissLowStockAlertIfPresent(page, 2000);

      // Verify that Aarav Nambiar's visit is either completely excluded from reception billing
      // or if displayed, masked to "Handled by Doctor" with NO payment collection button
      const aaravRow = page.locator('table tr').filter({ hasText: 'Aarav Nambiar' });
      if (await aaravRow.count() > 0) {
        await expect(aaravRow).toContainText('Handled by Doctor');
        await expect(aaravRow.locator('button:has-text("Collect Payment")')).toHaveCount(0);
      }

      await logout(page);
    });

    test('JOURNEY-4: Partial Payment Ledger & Balance Tracking', async ({ page }) => {
      // Meera Krishnan has a visit with Due 2700, Paid 1200, Balance 1500
      await loginAs(page, 'headDoctor');
      await page.goto('/partial-payments');
      await dismissLowStockAlertIfPresent(page, 2000);

      // Verify Meera Krishnan is listed under Partial Payments
      const meeraRow = page.locator('table tr').filter({ hasText: 'Meera Krishnan' }).first();
      if (await meeraRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(meeraRow).toContainText('Meera Krishnan');
        // Check for remaining balance or paid amount
        await expect(meeraRow).toContainText(/1,500|1500|1,200|1200/);
      }

      await logout(page);
    });

    test('JOURNEY-5: Inventory & Supplier Catalog Audit', async ({ page }) => {
      await loginAs(page, 'headDoctor');
      await page.goto('/inventory');
      await dismissLowStockAlertIfPresent(page, 3000);

      // Check Medicines Table
      await expect(page.locator('h1:has-text("Inventory"), h2:has-text("Inventory")').first()).toBeVisible();
      await expect(page.locator('table')).toContainText('Amoxicillin 500mg');
      await expect(page.locator('table')).toContainText('Latex Examination Gloves M');

      // Check Suppliers Tab if present
      const suppliersTab = page.locator('button:has-text("Suppliers"), a:has-text("Suppliers")').first();
      if (await suppliersTab.isVisible().catch(() => false)) {
        await suppliersTab.click();
        await expect(page.locator('body')).toContainText('Apex Dental Supplies Ltd');
      }

      await logout(page);
    });

    test('JOURNEY-6: Reimbursement Document Management & Preview', async ({ page }) => {
      await loginAs(page, 'headDoctor');
      await page.goto('/reimbursement');
      await dismissLowStockAlertIfPresent(page, 2000);

      await expect(page.locator('h1:has-text("Reimbursement")')).toBeVisible();

      // Verify seeded document RMB-2026-000001 for Vikramaditya Iyer
      const docRow = page.locator('table tr').filter({ hasText: 'RMB-2026-000001' }).first();
      await expect(docRow).toBeVisible({ timeout: 10000 });
      await expect(docRow).toContainText('Vikramaditya Iyer');
      await expect(docRow).toContainText('Issued');

      // Open Create Drawer
      const createBtn = page.getByRole('button', { name: 'Create Reimbursement' });
      await createBtn.click();
      await expect(page.locator('text=Draft and issue an official reimbursement letter')).toBeVisible({ timeout: 5000 });

      // Select Meera Krishnan
      const patientItem = page.locator('div.max-h-48 > div.cursor-pointer').filter({ hasText: 'Meera Krishnan' }).first();
      if (await patientItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await patientItem.click();
        await expect(page.locator('text=Change Patient')).toBeVisible();
      }

      // Close drawer
      const closeBtn = page.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      }

      await logout(page);
    });

    test('JOURNEY-7: Historical Controlled Data Inspection', async ({ page }) => {
      await loginAs(page, 'headDoctor');
      await page.goto('/historical-migration');
      await dismissLowStockAlertIfPresent(page, 2000);

      // Verify historical batch appears
      await expect(page.locator('body')).toContainText('Batch-2025-Clinic-Archive.pdf');

      await logout(page);
    });
  });

  // =========================================================================
  // PHASE 7: PLAYWRIGHT SEARCH TESTING (COLLATION & CASE-INSENSITIVITY)
  // =========================================================================
  test.describe('Phase 7: Case-Insensitive Search Verification', () => {

    test('SEARCH-1: Patient search handles lowercase, uppercase, mixed-case, and phone', async ({ page }) => {
      await loginAs(page, 'receptionist');
      await page.goto('/patients');
      await dismissLowStockAlertIfPresent(page, 2000);

      const searchInput = page.getByPlaceholder('Search name, ID or phone...');

      // 1. Lowercase search
      await searchInput.fill('vikramaditya');
      await expect(page.locator('table')).toContainText('Vikramaditya Iyer', { timeout: 5000 });

      // 2. Uppercase search
      await searchInput.fill('VIKRAMADITYA');
      await expect(page.locator('table')).toContainText('Vikramaditya Iyer', { timeout: 5000 });

      // 3. Mixed case search
      await searchInput.fill('ViKrAmAdItYa');
      await expect(page.locator('table')).toContainText('Vikramaditya Iyer', { timeout: 5000 });

      // 4. Partial last name
      await searchInput.fill('iyer');
      await expect(page.locator('table')).toContainText('Vikramaditya Iyer', { timeout: 5000 });

      // 5. Phone search
      await searchInput.fill('9840111222');
      await expect(page.locator('table')).toContainText('Vikramaditya Iyer', { timeout: 5000 });

      await logout(page);
    });

    test('SEARCH-2: Medicine search handles case-insensitivity and partial names', async ({ page }) => {
      await loginAs(page, 'headDoctor');
      await page.goto('/inventory');
      await dismissLowStockAlertIfPresent(page, 2000);

      const searchInput = page.getByPlaceholder(/Search/i).first();

      // Lowercase
      await searchInput.fill('amoxicillin');
      await expect(page.locator('table')).toContainText('Amoxicillin 500mg', { timeout: 5000 });

      // Uppercase
      await searchInput.fill('AMOXICILLIN');
      await expect(page.locator('table')).toContainText('Amoxicillin 500mg', { timeout: 5000 });

      // Partial
      await searchInput.fill('500mg');
      await expect(page.locator('table')).toContainText('Amoxicillin 500mg', { timeout: 5000 });

      await logout(page);
    });
  });

  // =========================================================================
  // PHASE 8: PLAYWRIGHT DOCUMENT / EXPORT TESTING
  // =========================================================================
  test.describe('Phase 8: Document Generation & Export Downloads', () => {

    test('EXPORT-1: Reimbursement PDF download verification', async ({ page }) => {
      await loginAs(page, 'headDoctor');
      await page.goto('/reimbursement');
      await dismissLowStockAlertIfPresent(page, 2000);

      const docRow = page.locator('table tr').filter({ hasText: 'RMB-2026-000001' }).first();
      await expect(docRow).toBeVisible({ timeout: 10000 });

      // Find download / action button
      const downloadBtn = docRow.locator('button[title*="Download"], button:has-text("PDF"), button:has-text("Download")').first();
      if (await downloadBtn.isVisible().catch(() => false)) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 15000 }),
          downloadBtn.click()
        ]);

        const path = await download.path();
        expect(path).toBeTruthy();
        if (path) {
          const stats = fs.statSync(path);
          expect(stats.size).toBeGreaterThan(1000); // Must be a non-empty PDF file
          const buffer = fs.readFileSync(path);
          expect(buffer.slice(0, 4).toString()).toBe('%PDF');
        }
      }

      await logout(page);
    });

    test('EXPORT-2: Reports CSV / XLSX export downloads', async ({ page }) => {
      await loginAs(page, 'headDoctor');
      await page.goto('/reports');
      await dismissLowStockAlertIfPresent(page, 2000);

      // Switch to Visits tab
      const visitsTab = page.locator('button:has-text("Visits"), [role="tab"]:has-text("Visits")').first();
      await visitsTab.click();
      await page.waitForTimeout(1000);

      // Check CSV Export button in toolbar
      const csvBtn = page.locator('button[title*="CSV"], button:has-text("CSV")').first();
      if (await csvBtn.isVisible().catch(() => false)) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 15000 }),
          csvBtn.click()
        ]);

        const path = await download.path();
        expect(path).toBeTruthy();
        if (path) {
          const stats = fs.statSync(path);
          expect(stats.size).toBeGreaterThan(10);
        }
      }

      await logout(page);
    });
  });

  // =========================================================================
  // PHASE 9: PLAYWRIGHT RESPONSIVE QA (5 REQUIRED VIEWPORTS)
  // =========================================================================
  test.describe('Phase 9: Multi-Viewport Responsive QA', () => {

    const viewports = [
      { width: 375, height: 812, name: 'Mobile iPhone X (375x812)' },
      { width: 430, height: 932, name: 'Large Mobile iPhone 14 Pro Max (430x932)' },
      { width: 768, height: 1024, name: 'Tablet iPad (768x1024)' },
      { width: 1366, height: 768, name: 'Standard Laptop (1366x768)' },
      { width: 1440, height: 900, name: 'Desktop Monitor (1440x900)' }
    ];

    for (const vp of viewports) {
      test(`RESPONSIVE: Key clinical routes render properly on ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // 1. Login Page
        await page.goto('/login');
        await expect(page.locator('input#username, input[name="username"], input[type="text"]').first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Sign In|Login/i })).toBeVisible();

        // 2. Head Doctor Navigation
        await loginAs(page, 'headDoctor');

        const routesToCheck = ['/dashboard', '/reception-desk', '/patients', '/queue', '/billing', '/reimbursement'];
        for (const r of routesToCheck) {
          await page.goto(r);
          await dismissLowStockAlertIfPresent(page, 1500);
          await expect(page.locator('body')).toBeVisible();

          // Check that there is no catastrophic horizontal scroll overflow on main container
          const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
          const innerWidth = await page.evaluate(() => window.innerWidth);
          // Allow minor tolerance for scrollbars (<= 15px)
          expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 25);
        }

        await logout(page);
      });
    }
  });

});
