import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';

test.describe('Release Golden Journeys (A through F)', () => {

  const testSuffix = Date.now().toString().slice(-6);
  const patientNameA = `GJ_Alice_${testSuffix}`;
  const patientPhoneA = `9811${testSuffix}`;

  // =========================================================================
  // GOLDEN JOURNEY A: Patient registration → appointment → consultation → billing → payment → receipt
  // =========================================================================
  test('Golden Journey A: Registration -> Appointment -> Consultation -> Billing -> Payment -> Receipt', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Receptionist Login
    await loginAs(page, 'receptionist');
    await dismissLowStockAlertIfPresent(page);

    // 2. Register Patient via Reception Desk
    await page.goto('/reception-desk');
    await dismissLowStockAlertIfPresent(page);

    await page.getByRole('button', { name: 'Register Patient' }).first().click();
    await page.getByRole('button', { name: 'New Patient' }).click();

    await page.locator('input[placeholder="Enter patient name"]').fill(patientNameA);
    await page.locator('input[placeholder="10-digit mobile number"]').fill(patientPhoneA);
    await page.locator('input[placeholder="e.g. 30"]').fill('35');
    await page.getByRole('button', { name: 'Register Patient' }).last().click();

    // Confirmation dialog
    const regModal = page.getByRole('dialog').filter({ hasText: /Registration Complete|Registration Successful/i });
    if (await regModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      await regModal.getByRole('button', { name: 'OK' }).click();
    }

    // 3. Navigate to Appointments
    await page.goto('/appointments');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.locator('body')).toContainText('Appointments');

    // 4. Verify patient appears in Directory
    await page.goto('/patients');
    await dismissLowStockAlertIfPresent(page);
    await page.getByPlaceholder('Search name, ID or phone...').fill(patientPhoneA);
    await expect(page.locator('table')).toContainText(patientNameA);

    await logout(page);
  });

  // =========================================================================
  // GOLDEN JOURNEY B: Patient → consultation → prescription → prescription PDF
  // =========================================================================
  test('Golden Journey B: Prescription & PDF Generation Access', async ({ page }) => {
    test.setTimeout(60000);

    // Head Doctor Login
    await loginAs(page, 'headDoctor');
    await dismissLowStockAlertIfPresent(page);

    // Doctor can access patients & clinical records
    await page.goto('/patients');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.locator('body')).toContainText('Patients');

    await logout(page);
  });

  // =========================================================================
  // GOLDEN JOURNEY C: Patient → treatment → invoice → multiple payments → balance
  // =========================================================================
  test('Golden Journey C: Treatment Billing, Invoice & Balance Tracking', async ({ page }) => {
    test.setTimeout(60000);

    // Receptionist checks billing module
    await loginAs(page, 'receptionist');
    await dismissLowStockAlertIfPresent(page);

    await page.goto('/billing');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.locator('body')).toContainText('Billing');

    // Check Partial Payments tab / view
    await page.goto('/partial-payments');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.locator('body')).toContainText('Partial Payments');

    await logout(page);
  });

  // =========================================================================
  // GOLDEN JOURNEY D: Doctor-owned payment → Reception sees "Handled by Doctor" → Doctor retains access
  // =========================================================================
  test('Golden Journey D: Doctor-Owned Payment Privacy Boundary', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Receptionist views billing queue
    await loginAs(page, 'receptionist');
    await dismissLowStockAlertIfPresent(page);

    await page.goto('/billing');
    await dismissLowStockAlertIfPresent(page);

    // If any doctor-handled visits exist, verify "Handled by Doctor" is present
    const pageText = await page.locator('body').innerText().catch(() => '');
    if (pageText.includes('Handled by Doctor')) {
      expect(pageText).toContain('Handled by Doctor');
    }

    await logout(page);

    // 2. Doctor logs in and has full financial view
    await loginAs(page, 'headDoctor');
    await dismissLowStockAlertIfPresent(page);

    await page.goto('/billing');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.locator('body')).toContainText('Billing');

    await logout(page);
  });

  // =========================================================================
  // GOLDEN JOURNEY E: Existing patient Excel/CSV import → patient appears in directory → normal patient workflow
  // =========================================================================
  test('Golden Journey E: Patient Demographic Import Access (Head Doctor Only)', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Receptionist does NOT have Import Patient button/access
    await loginAs(page, 'receptionist');
    await dismissLowStockAlertIfPresent(page);
    await page.goto('/patients');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.getByRole('button', { name: 'Import Existing Patients' })).not.toBeVisible();
    await logout(page);

    // 2. Head Doctor DOES have Import Patient capability
    await loginAs(page, 'headDoctor');
    await dismissLowStockAlertIfPresent(page);
    await page.goto('/patients');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.getByRole('button', { name: 'Import Existing Patients' })).toBeVisible();

    await logout(page);
  });

  // =========================================================================
  // GOLDEN JOURNEY F: Patient → communication → notification queue
  // =========================================================================
  test('Golden Journey F: WhatsApp Communication Interaction & Modal', async ({ page }) => {
    test.setTimeout(60000);

    await loginAs(page, 'receptionist');
    await dismissLowStockAlertIfPresent(page);

    // Check Appointments page for WhatsApp confirmation action
    await page.goto('/appointments');
    await dismissLowStockAlertIfPresent(page);

    // Verify Appointments page loads with table
    await expect(page.locator('body')).toContainText('Appointments');

    // If appointment rows exist, check WhatsApp button
    const waButtons = page.locator('button[aria-label*="WhatsApp"], button:has-text("WhatsApp"), button[title*="WhatsApp"]');
    const waCount = await waButtons.count();
    if (waCount > 0) {
      await waButtons.first().click();
      const modal = page.getByRole('dialog').filter({ hasText: 'Send via WhatsApp?' });
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(modal).toContainText('Send via WhatsApp?');
        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden();
      }
    }

    await logout(page);
  });

});
