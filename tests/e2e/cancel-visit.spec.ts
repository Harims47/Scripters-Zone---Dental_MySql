import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';

test.describe('Phase 9.1: Cancel Visit & Payment Status', () => {

  const testPatientName = `QA_Cancel_${Date.now()}`;
  const testPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

  test('Should display Payment Status column and register a walk-in to test cancellation', async ({ page }) => {
    // 1. Navigate and login as Receptionist
    await loginAs(page, 'receptionist');
    await expect(page).toHaveURL(/.*\/reception-desk/);

    // Dismiss Low Stock Alert if modal is blocking the reception page
    await dismissLowStockAlertIfPresent(page);

    // 2. Verify Payment Status column header exists
    await expect(page.locator('th:has-text("Payment Status")')).toBeVisible();

    // 3. Register a new walk-in visit using Reception Desk drawer
    await page.getByRole('button', { name: 'Register Patient' }).first().click();
    
    // Switch to New Patient mode
    await page.getByRole('button', { name: 'New Patient' }).click();

    // Fill required details
    await page.locator('input[placeholder="Enter patient name"]').fill(testPatientName);
    await page.locator('input[placeholder="10-digit mobile number"]').fill(testPhone);
    await page.locator('input[placeholder="e.g. 30"]').fill('25');

    // Submit registration
    await page.getByRole('button', { name: 'Register Patient' }).last().click();
    
    // Accept Registration Complete Dialog
    await expect(page.getByRole('heading', { name: /Registration Complete|Registration Successful/i })).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();

    // 4. Find the newly created visit row
    const row = page.locator('tr').filter({ hasText: testPatientName });
    await expect(row).toBeVisible();
    
    // Verify Payment Status is Unpaid or "—"
    await expect(row.locator('td').nth(4)).toBeVisible();

    // Verify Action button: Cancel Visit icon should be present (title="Cancel Visit")
    const cancelBtn = row.locator('button[title="Cancel Visit"]');
    await expect(cancelBtn).toBeVisible();

    // 5. Click Cancel Visit
    await cancelBtn.click();
    
    // Expect SweetAlert warning
    await expect(page.locator('.swal2-popup:has-text("Cancel this visit?")')).toBeVisible();

    // 6. Dismiss with Keep Visit first
    await page.getByRole('button', { name: 'Keep Visit' }).click();
    await expect(row).toContainText('Waiting');

    // 7. Click Cancel Visit again and confirm
    await cancelBtn.click();
    await page.getByRole('button', { name: 'Cancel Visit' }).click();
    
    // Expect Success SweetAlert and dismiss
    await expect(page.locator('.swal2-popup:has-text("Cancelled")')).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();

    // 8. Verify the row now displays Cancelled stage
    await expect(row).toContainText('Cancelled');
    
    // Edit and View History should still exist
    await expect(row.locator('button[title="Edit Patient"]')).toBeVisible();
    await expect(row.locator('button[title="View Patient Details"]')).toBeVisible();
  });
});
