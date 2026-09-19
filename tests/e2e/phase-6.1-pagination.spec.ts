import { test, expect } from '@playwright/test';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';

test.describe('Phase 6.1 Server-Side Pagination & Search', () => {

  test.beforeEach(async ({ page }) => {
    // Login as Admin so we can access Inventory too
    await page.goto('/login');
    await page.getByLabel('Username').fill('headdoctor');
    await page.getByLabel('Password').fill('demo123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');
    await dismissLowStockAlertIfPresent(page);
  });

  test('TEST 1 - Patients Pagination & Search', async ({ page }) => {
    await page.goto('/patients');
    await dismissLowStockAlertIfPresent(page);

    // Wait for table to load
    await expect(page.locator('table')).toBeVisible();

    // Verify pagination controls
    const nextBtn = page.getByRole('button', { name: 'Go to next page' });
    await expect(nextBtn).toBeVisible();
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
    }
    
    // Search nonexistent to verify filter response
    const searchInput = page.getByPlaceholder('Search name, ID or phone...');
    await searchInput.fill('NonexistentXYZ999');
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText(/No patient found|No records|No results/i);
  });

  test('TEST 2 - Appointments Pagination & Search', async ({ page }) => {
    await page.goto('/appointments');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.locator('table')).toBeVisible();
    
    const searchInput = page.getByPlaceholder('Search patient or phone...');
    await searchInput.fill('NonexistentXYZ999');
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText(/No appointments found|No records|No results/i);
  });

  test('TEST 3 - Inventory Pagination & Search', async ({ page }) => {
    await page.goto('/inventory');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.locator('table')).toBeVisible();
    
    const nextBtn = page.getByRole('button', { name: 'Go to next page' });
    await expect(nextBtn).toBeVisible();
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
    }
    
    const searchInput = page.getByPlaceholder('Search inventory...');
    await searchInput.fill('Tablet 1');
    await page.waitForTimeout(500);
    await expect(page.getByText('Tablet 1').first()).toBeVisible();
  });

  test('TEST 4 - Billing Pagination & Search', async ({ page }) => {
    await page.goto('/billing');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.locator('table')).toBeVisible();
    
    const nextBtn = page.getByRole('button', { name: 'Go to next page' });
    await expect(nextBtn).toBeVisible();
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
    }
    
    const searchInput = page.getByPlaceholder('Search patient or ID...');
    await searchInput.fill('NonexistentXYZ999');
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText(/No records|No billing|No results/i);
  });

  test('TEST 5 - Payments Pagination & Workflow (Partial Payments)', async ({ page }) => {
    await page.goto('/partial-payments');
    await dismissLowStockAlertIfPresent(page);
    await expect(page.locator('table')).toBeVisible();
    
    // Check if table contains records
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify collect payment dialog workflow
    const collectBtn = page.getByRole('button', { name: /Collect Payment/i }).first();
    if (await collectBtn.isVisible().catch(() => false)) {
      await collectBtn.click();
      
      const modal = page.locator('[role="dialog"]').filter({ hasText: /Collect Outstanding Balance|Collect Payment/i });
      await expect(modal).toBeVisible();
      
      // Choose cash payment method
      await modal.getByRole('button', { name: /Cash/i }).click();
      
      // Confirm payment button
      const confirmBtn = modal.getByRole('button', { name: /Confirm Payment/i });
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();

      // Modal closes after confirmation
      await expect(modal).toBeHidden({ timeout: 10000 });
    }
  });
});
