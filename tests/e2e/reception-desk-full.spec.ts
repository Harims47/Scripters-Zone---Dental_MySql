import { test, expect, Page } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';

/**
 * Capture unexpected application errors
 */
function attachErrorListeners(page: Page, capturedErrors: string[]) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
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

test.describe('DentalCore — Dedicated Reception Desk Comprehensive E2E Suite', () => {

  test('RECEPTION-DESK-01 to 03: Page load, doctors, patient names, and search', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListeners(page, errors);

    await loginAs(page, 'receptionist');
    await page.goto('/reception-desk');
    await dismissLowStockAlertIfPresent(page, 2000);

    // 01: Doctors and rows appear
    await expect(page.locator('table')).toBeVisible();
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();

    // 02: Every visible row displays a valid patient name, ZERO 'Unknown'
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const nameCell = row.locator('td').nth(2);
      const nameText = (await nameCell.innerText()).trim();
      expect(nameText).not.toBe('Unknown');
      expect(nameText.length).toBeGreaterThan(2);
    }

    const unknownCount = await page.locator('table').getByText('Unknown', { exact: true }).count();
    expect(unknownCount).toBe(0);

    // 03: Patient search returns correct patient
    const searchInput = page.getByPlaceholder(/search patients/i);
    await searchInput.fill('Sunita');
    await page.waitForTimeout(500);

    const filteredRows = page.locator('table tbody tr');
    await expect(filteredRows.first()).toContainText('Sunita Deshmukh');
    expect(await filteredRows.count()).toBe(1);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
    await logout(page);
  });

  test('RECEPTION-DESK-04: View action opens correct patient identity and details', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListeners(page, errors);

    await loginAs(page, 'receptionist');
    await page.goto('/reception-desk');
    await dismissLowStockAlertIfPresent(page, 2000);

    // Locate Rohan Kulkarni row
    const rohanRow = page.locator('table tbody tr').filter({ hasText: 'Rohan Kulkarni' }).first();
    await expect(rohanRow).toBeVisible();

    // Click View button (Eye icon)
    const viewBtn = rohanRow.locator('button[title="View Patient Details"]');
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();

    // Verify View sheet opens
    const sheet = page.locator('[role="dialog"]').filter({ hasText: /View Patient Details/i });
    await expect(sheet).toBeVisible({ timeout: 5000 });

    // Verify patient identity is correctly populated in disabled fields
    await expect(sheet.locator('input[placeholder="e.g. John Doe"]')).toHaveValue('Rohan Kulkarni');
    await expect(sheet.locator('input[placeholder="e.g. 9876543210"]')).toHaveValue('9840555666');
    await expect(sheet.locator('input[placeholder="e.g. 30"]')).toHaveValue('31');
    await expect(sheet.locator('[role="combobox"]').last()).toContainText(/Wisdom tooth/i);

    // Close sheet
    await sheet.getByRole('button', { name: 'Close' }).last().click();
    await expect(sheet).not.toBeVisible();

    expect(errors).toHaveLength(0);
    await logout(page);
  });

  test('RECEPTION-DESK-05 & 06: Edit action opens, populates, edits, saves, and updates MySQL', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListeners(page, errors);

    await loginAs(page, 'receptionist');
    await page.goto('/reception-desk');
    await dismissLowStockAlertIfPresent(page, 2000);

    // Locate Sunita Deshmukh row
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Sunita');
    const sunitaRow = page.locator('table tbody tr').filter({ hasText: 'Sunita Deshmukh' }).first();
    await expect(sunitaRow).toBeVisible();

    // Click Edit button (Pencil icon)
    const editBtn = sunitaRow.locator('button[title="Edit Patient"]');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify Edit sheet opens
    const sheet = page.locator('[role="dialog"]').filter({ hasText: /Edit Patient Details/i });
    await expect(sheet).toBeVisible({ timeout: 5000 });

    // 05: Verify all expected fields are populated
    const nameInput = sheet.locator('input[placeholder="e.g. John Doe"]');
    const phoneInput = sheet.locator('input[placeholder="e.g. 9876543210"]');
    const ageInput = sheet.locator('input[placeholder="e.g. 30"]');
    const addressInput = sheet.locator('textarea[placeholder="Patient address"]');
    const reasonCombobox = sheet.locator('[role="combobox"]').last();

    await expect(nameInput).toHaveValue('Sunita Deshmukh');
    await expect(phoneInput).toHaveValue('9840444555');
    await expect(ageInput).toHaveValue('52');
    await expect(addressInput).toContainText('Shivajinagar, Pune');
    await expect(reasonCombobox).toContainText(/Routine dental check-up/i);

    // 06: Perform harmless edit (e.g. update address with updated timestamp)
    const newAddress = 'Flat 402 Deccan Heights, Shivajinagar, Pune 411005 (Updated)';
    await addressInput.fill(newAddress);

    // Click Save Details
    await sheet.getByRole('button', { name: 'Save Details' }).click();

    // Verify toast / drawer closes
    await expect(sheet).not.toBeVisible({ timeout: 5000 });

    // Verify through the API that patient address updated in MySQL
    const res = await page.request.get('/api/patients?limit=100');
    const data = await res.json();
    const updated = data.data?.find((p: any) => p.phone === '9840444555');
    expect(updated?.address).toBe(newAddress);

    expect(errors).toHaveLength(0);
    await logout(page);
  });

  test('RECEPTION-DESK-07 & 08: Doctor selection and walk-in check-in workflow', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListeners(page, errors);

    await loginAs(page, 'receptionist');
    await page.goto('/reception-desk');
    await dismissLowStockAlertIfPresent(page, 2000);

    // Check doctor presence in doctor cards/summary
    await expect(page.locator('body')).toContainText(/Dr\. Rajesh Sharma/i);
    await expect(page.locator('body')).toContainText(/Dr\. Priya Venkatesh/i);

    // Register a new walk-in patient
    const uniquePhone = `984099${Date.now().toString().slice(-4)}`;
    const uniqueName = `Anand Natarajan ${uniquePhone.slice(-4)}`;

    await page.getByRole('button', { name: 'Register Patient' }).first().click();
    await page.getByRole('button', { name: 'New Patient' }).click();

    await page.locator('input[placeholder="Enter patient name"]').fill(uniqueName);
    await page.locator('input[placeholder="10-digit mobile number"]').fill(uniquePhone);
    await page.locator('input[placeholder="e.g. 30"]').fill('42');

    await page.getByRole('button', { name: 'Register Patient' }).last().click();

    // Dismiss confirmation dialog if present
    const okBtn = page.locator('.swal2-confirm, button:has-text("OK")');
    await okBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await okBtn.isVisible()) {
      await okBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify the newly registered patient appears in the live queue table with their REAL NAME
    await page.goto('/reception-desk');
    await dismissLowStockAlertIfPresent(page, 2000);

    const newRow = page.locator('table tbody tr').filter({ hasText: uniqueName }).first();
    await expect(newRow).toBeVisible({ timeout: 10000 });
    await expect(newRow).toContainText(uniqueName);
    await expect(newRow).not.toContainText('Unknown');

    expect(errors).toHaveLength(0);
    await logout(page);
  });

  test('RECEPTION-DESK-09 & 10: Payment action behavior and Doctor-Owned payment privacy', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListeners(page, errors);

    await loginAs(page, 'receptionist');
    await page.goto('/reception-desk');
    await dismissLowStockAlertIfPresent(page, 2000);

    // 10: Doctor-owned payment privacy on Reception Desk
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Aarav');
    const aaravRow = page.locator('table tbody tr').filter({ hasText: 'Aarav Nambiar' }).first();
    await expect(aaravRow).toBeVisible();

    // MUST show Payment Not Required / Handled by Doctor
    await expect(aaravRow).toContainText('Payment Not Required');

    // MUST NOT display a Collect Payment button
    await expect(aaravRow.locator('button:has-text("Collect Payment")')).toHaveCount(0);
    await searchInput.fill('');

    // 09: For completed reception-billed visit (Vikramaditya Iyer), verify Paid badge
    await searchInput.fill('Vikramaditya');
    const vikramRow = page.locator('table tbody tr').filter({ hasText: 'Vikramaditya Iyer' }).first();
    await expect(vikramRow).toBeVisible();
    await expect(vikramRow).toContainText('Paid');
    await searchInput.fill('');

    expect(errors).toHaveLength(0);
    await logout(page);
  });

  test('RECEPTION-DESK-11 & 12: Action buttons state validation', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListeners(page, errors);

    await loginAs(page, 'receptionist');
    await page.goto('/reception-desk');
    await dismissLowStockAlertIfPresent(page, 2000);

    // On waiting rows, Send to Doctor (Share) should be enabled
    const rohanRow = page.locator('table tbody tr').filter({ hasText: 'Rohan Kulkarni' }).first();
    const sendBtn = rohanRow.locator('button:has(svg.lucide-send), button[title*="send to doctor" i]');
    await expect(sendBtn).toBeVisible();

    // Cancel visit button exists (can be Cancel Visit or Cannot cancel once doctor is assigned)
    const cancelBtn = rohanRow.locator('button[title*="cancel" i], button:has(svg.lucide-x-circle)');
    await expect(cancelBtn).toBeVisible();

    expect(errors).toHaveLength(0);
    await logout(page);
  });
});
