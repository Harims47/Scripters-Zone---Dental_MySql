import { test, expect } from '@playwright/test';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';

test.describe('DentalCore — Reimbursement Module V1 E2E Flow', () => {
  test.setTimeout(90000);

  test('Golden Journey: Doctor creates, previews, prints and verifies reimbursement document', async ({ page }) => {
    // 1. Doctor Login
    await page.goto('http://localhost:5173/login');
    await page.locator('#username').fill('headdoctor');
    await page.locator('#password').fill('demo123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Dismiss low stock alert if present
    await dismissLowStockAlertIfPresent(page, 3000);

    // 2. Navigate to Reimbursement
    await page.goto('http://localhost:5173/reimbursement');
    await page.waitForURL('**/reimbursement', { timeout: 10000 });

    // Dismiss low stock alert again if it mounted after route transition
    await dismissLowStockAlertIfPresent(page, 2000);

    // Verify sidebar shows Reimbursement nav item
    const reimbursementNav = page.locator('nav a[href="/reimbursement"], a:has-text("Reimbursement")').first();
    await expect(reimbursementNav).toBeVisible({ timeout: 5000 });

    // 3. Verify Reimbursement Page Header and Table
    await expect(page.locator('h1:has-text("Reimbursement")')).toBeVisible();
    const createBtn = page.getByRole('button', { name: 'Create Reimbursement' });
    await expect(createBtn).toBeVisible();

    // 4. Open Create Reimbursement Drawer
    await createBtn.click();
    await expect(page.locator('text=Draft and issue an official reimbursement letter')).toBeVisible({ timeout: 5000 });

    // 5. Select an existing patient from list
    const patientItem = page.locator('div.max-h-48 > div.cursor-pointer').first();
    await expect(patientItem).toBeVisible({ timeout: 5000 });
    await patientItem.click();

    // Verify patient summary badge appears
    await expect(page.locator('text=Change Patient')).toBeVisible({ timeout: 3000 });

    // 6. Enter treatment description & optional amount
    const treatmentField = page.locator('textarea[placeholder*="Dental scaling"]');
    if (await treatmentField.isVisible()) {
      await treatmentField.fill('Comprehensive dental examination and cleaning');
    }

    const amountField = page.locator('input#claimAmount');
    if (await amountField.isVisible()) {
      await amountField.fill('2500');
    }

    // 7. Verify Letter Content is pre-filled and editable
    const contentField = page.locator('textarea#letterContent');
    await expect(contentField).toBeVisible();
    const contentVal = await contentField.inputValue();
    expect(contentVal).toContain('dental treatment at our clinic');

    // Edit content
    await contentField.fill(`${contentVal}\nNote: Treatment completed in good health.`);

    // 8. Click Print Document directly from drawer
    const printDocBtn = page.getByRole('button', { name: 'Print Document' });
    await expect(printDocBtn).toBeVisible();
    await printDocBtn.click();

    // 9. Verify the newly created document appears in the table with Doc No prefix RMB-
    const docNoBadge = page.locator('table tbody tr span.font-mono:has-text("RMB-")').first();
    await expect(docNoBadge).toBeVisible({ timeout: 10000 });
    const docNoText = await docNoBadge.innerText();
    console.log(`Verified new reimbursement document created in list: ${docNoText}`);
    expect(docNoText).toMatch(/^RMB-\d{4}-\d{6}$/);

    // 10. Verify Actions: View, Edit, Print, and Delete are available
    // 10. Verify Action buttons exist on the newly created row
    const row = page.locator(`tr:has-text("${docNoText}")`);
    await expect(row.getByRole('button', { name: 'View Details' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Edit Document' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Print Document' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Delete Document' })).toBeVisible();

    // 11. Test VIEW Provision: Click View and verify details drawer opens
    await row.getByRole('button', { name: 'View Details' }).click();
    await expect(page.locator('h2:has-text("Reimbursement Details")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${docNoText}`).first()).toBeVisible();
    await expect(page.locator('text=Patient Information')).toBeVisible();
    await expect(page.locator('text=Official Statement Content')).toBeVisible();

    // Close View drawer
    await page.getByRole('button', { name: 'Close' }).first().click();
    await expect(page.locator('h2:has-text("Reimbursement Details")')).not.toBeVisible();

    // 12. Test EDIT Provision: Click Edit, update particulars, and save
    await row.getByRole('button', { name: 'Edit Document' }).click();
    await expect(page.locator('h2:has-text("Edit Reimbursement Document")')).toBeVisible({ timeout: 5000 });
    
    const editAmountField = page.locator('input#editClaimAmount');
    await editAmountField.fill('3200');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.locator('text=updated').first()).toBeVisible({ timeout: 5000 });

    // 13. Test DELETE Provision: Click Delete, confirm dialog, and verify removal
    await row.getByRole('button', { name: 'Delete Document' }).click();
    await expect(page.locator('h2:has-text("Delete Reimbursement Document")')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Delete Document' }).last().click();
    await expect(page.locator('text=deleted successfully')).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`tr:has-text("${docNoText}")`)).toHaveCount(0);
  });

  test('RBAC Isolation: Receptionist cannot access Reimbursement page or API', async ({ page }) => {
    // 1. Receptionist Login
    await page.goto('http://localhost:5173/login');
    await page.locator('#username').fill('receptionist');
    await page.locator('#password').fill('demo123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/reception-desk', { timeout: 15000 });

    // 2. Verify Reimbursement is NOT in the sidebar
    const reimbursementNav = page.locator('nav a[href="/reimbursement"], a:has-text("Reimbursement")');
    await expect(reimbursementNav).toHaveCount(0);

    // 3. Direct navigation to /reimbursement is blocked by route permissions
    await page.goto('http://localhost:5173/reimbursement');
    await page.waitForTimeout(1000);
    // Should redirect away from /reimbursement to /reception-desk or /unauthorized
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/reimbursement');

    // 4. Direct backend API call returns 403 Forbidden
    const res = await page.evaluate(async () => {
      const resp = await fetch('http://localhost:3001/api/reimbursements', {
        credentials: 'include'
      });
      return { status: resp.status };
    });
    expect(res.status).toBe(403);
  });

  test('RBAC Isolation: Duty Doctor cannot access Reimbursement page or API', async ({ page }) => {
    // 1. Duty Doctor Login
    await page.goto('http://localhost:5173/login');
    await page.locator('#username').fill('dutydoctor');
    await page.locator('#password').fill('demo123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 2. Verify Reimbursement is NOT in the sidebar
    const reimbursementNav = page.locator('nav a[href="/reimbursement"], a:has-text("Reimbursement")');
    await expect(reimbursementNav).toHaveCount(0);

    // 3. Direct navigation to /reimbursement is blocked by route permissions
    await page.goto('http://localhost:5173/reimbursement');
    await page.waitForTimeout(1000);
    // Should redirect away from /reimbursement to /unauthorized or /dashboard
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/reimbursement');

    // 4. Direct backend API call returns 403 Forbidden
    const res = await page.evaluate(async () => {
      const resp = await fetch('http://localhost:3001/api/reimbursements', {
        credentials: 'include'
      });
      return { status: resp.status };
    });
    expect(res.status).toBe(403);
  });
});
