import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';

test.describe('Error States', () => {

  const testPatientName = `PW_ErrorTest_${Date.now()}`;
  const testPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

  test('Duplicate Active Visit', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Receptionist Login
    await loginAs(page, 'receptionist');
    await dismissLowStockAlertIfPresent(page);

    // 2. Create Patient via Reception Desk
    await page.goto('/reception-desk');
    await dismissLowStockAlertIfPresent(page);

    await page.getByRole('button', { name: 'Register Patient' }).first().click();
    await page.getByRole('button', { name: 'New Patient' }).click();

    await page.locator('input[placeholder="Enter patient name"]').fill(testPatientName);
    await page.locator('input[placeholder="10-digit mobile number"]').fill(testPhone);
    await page.locator('input[placeholder="e.g. 30"]').fill('30');
    
    // Click Register Patient inside drawer footer
    await page.getByRole('button', { name: 'Register Patient' }).last().click();

    // Accept Registration modal
    const regModal = page.getByText('Registration Complete');
    await expect(regModal).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'OK' }).click();

    // 3. Navigate to Patients Directory
    await page.goto('/patients');
    await dismissLowStockAlertIfPresent(page);

    // Filter/search or locate patient row
    const searchInput = page.locator('input[placeholder*="Search by patient name"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(testPatientName);
      await page.waitForTimeout(500);
    }

    const patientRow = page.locator('tr', { hasText: testPatientName }).first();
    await expect(patientRow).toBeVisible({ timeout: 10000 });
    await patientRow.click();

    // 4. In view drawer, click 'Start Visit'
    const startVisitBtn = page.getByRole('button', { name: /Start Visit/i });
    await expect(startVisitBtn).toBeVisible({ timeout: 10000 });
    await startVisitBtn.click();

    // Verify Active Visit Warning is visible in the drawer
    await expect(page.getByText('Active Visit Warning')).toBeVisible({ timeout: 5000 });

    // Select doctor in drawer
    const drawer = page.locator('div[role="dialog"][data-state="open"]');
    const doctorSelect = drawer.locator('select');
    await doctorSelect.selectOption({ index: 1 });

    // Attempt to submit duplicate visit
    await drawer.getByRole('button', { name: /Create & Add to Queue/i }).click();

    // Verify error notification / toast for active visit is shown
    await expect(page.getByText(/This patient already has an active visit/i)).toBeVisible({ timeout: 5000 });
  });

});

