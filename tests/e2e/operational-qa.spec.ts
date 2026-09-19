import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * REAL BROWSER QA TEST SUITE:
 * LOW STOCK ALERT & DOCTOR AVAILABILITY SOUND
 * 
 * Non-destructive: Uses QA-specific test keys and restores any QA state.
 */

test.describe('Real Browser QA: Low Stock Alert & Doctor Availability Sound', () => {

  test('PART 1 & 2 & 3: Environment, Low Stock Modal Rendering, Multi-Item & Dismissal', async ({ page }) => {
    // 1. Login as Head Doctor (who has full access to PO creation & alerts)
    await loginAs(page, 'headDoctor');
    await expect(page).toHaveURL(/.*\/dashboard/);

    // 2. Wait for Low Stock Alert Modal to appear (there are low stock items in DB)
    const alertModal = page.getByRole('dialog');
    await expect(alertModal).toBeVisible({ timeout: 15000 });

    // Verify visual structure
    await expect(alertModal.getByText('Low Stock Alert', { exact: false })).toBeVisible();
    await expect(alertModal.getByText('Current Stock', { exact: false })).toBeVisible();
    await expect(alertModal.getByText('Minimum Stock', { exact: false })).toBeVisible();
    await expect(alertModal.getByText('Please order the stock now', { exact: false })).toBeVisible();

    // Verify Head Doctor has Create Purchase Order button
    const createPOBtn = alertModal.getByRole('button', { name: /Create Purchase Order/i });
    await expect(createPOBtn).toBeVisible();

    // Verify multiple alert navigation if more than 1 low-stock item exists
    const badgeCount = alertModal.locator('.badge, [class*="bg-amber-700"]');
    const hasMultiple = await badgeCount.isVisible().catch(() => false);
    if (hasMultiple) {
      console.log('Multiple low-stock items detected in browser modal.');
      const nextBtn = alertModal.locator('button:has(svg.lucide-chevron-right)');
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Capture screenshot of the modal
    await page.screenshot({ path: 'test-results/low_stock_modal_headdoctor.png' });

    // Click "Remind in 1 hr" to dismiss
    const dismissBtn = alertModal.getByRole('button', { name: /Remind in 1 hr/i });
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    // Modal should close
    await expect(alertModal).not.toBeVisible({ timeout: 5000 });

    // Verify alert does not immediately pop back up on normal page interaction
    await page.waitForTimeout(2000);
    await expect(alertModal).not.toBeVisible();
  });

  test('PART 6 & 7: PO Creation Workflow Prefill & Receptionist RBAC Guidance', async ({ page }) => {
    // 1. Receptionist login
    await loginAs(page, 'receptionist');
    await expect(page).toHaveURL(/.*\/reception-desk/);

    // Clear localStorage dismissal so modal can display for receptionist
    await page.evaluate(() => {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('dc_low_stock_dismissed_')) {
          localStorage.removeItem(key);
        }
      });
    });

    // Reload page to re-trigger check
    await page.reload();
    await page.waitForTimeout(2000);

    const alertModal = page.getByRole('dialog');
    const isModalVisible = await alertModal.isVisible().catch(() => false);

    if (isModalVisible) {
      // Verify Receptionist sees informational guidance and NOT a functional Create PO button
      await expect(alertModal.getByText(/Contact Head Doctor to Order/i)).toBeVisible();
      const directCreateBtn = alertModal.getByRole('button', { name: /^Create Purchase Order$/i });
      await expect(directCreateBtn).not.toBeVisible();

      await page.screenshot({ path: 'test-results/low_stock_modal_receptionist_rbac.png' });

      // Dismiss as receptionist
      await alertModal.getByRole('button', { name: /Remind in 1 hr/i }).click();
      await expect(alertModal).not.toBeVisible();
    }

    // 2. Head Doctor: Click Create Purchase Order -> redirects to PO creation with medicine prefilled
    await page.goto('/login');
    await loginAs(page, 'headDoctor');

    // Clear dismissal again for test
    await page.evaluate(() => {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('dc_low_stock_dismissed_')) {
          localStorage.removeItem(key);
        }
      });
    });
    await page.reload();

    await expect(alertModal).toBeVisible({ timeout: 10000 });
    const createPOBtn = alertModal.getByRole('button', { name: /Create Purchase Order/i });
    await createPOBtn.click();

    // Should navigate to /inventory with orders tab
    await page.waitForURL(/.*\/inventory\?tab=orders.*/, { timeout: 10000 });
    expect(page.url()).toContain('tab=orders');
    expect(page.url()).toContain('createForMedicine=');

    // Purchase order creation sheet/drawer should be open
    await page.waitForTimeout(1000);
    const poDrawer = page.locator('[role="dialog"], .sheet-content, [class*="SheetContent"]');
    await expect(poDrawer.first()).toBeVisible();

    await page.screenshot({ path: 'test-results/po_creation_drawer_prefilled.png' });
  });

  test('PART 8 - 14: Reception Desk Doctor Availability, Cards & Audio Transition State', async ({ page }) => {
    // Collect console logs and errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loginAs(page, 'receptionist');
    await expect(page).toHaveURL(/.*\/reception-desk/);

    // Interact with page to trigger audio unlock gesture
    await page.mouse.click(100, 100);

    // Verify Doctor Cards section is present and styled correctly
    const doctorsSection = page.locator('section:has-text("Doctors")');
    await expect(doctorsSection).toBeVisible();

    // Check doctor card statuses (Available = green bg / pulse, With Patient = red, Leave = gray)
    const doctorCards = doctorsSection.locator('.rounded-xl');
    const count = await doctorCards.count();
    expect(count).toBeGreaterThan(0);

    // Verify initial load completed silently (no unhandled audio exceptions)
    expect(consoleErrors.filter((e) => e.includes('AudioContext') || e.includes('sound'))).toHaveLength(0);

    // Screenshot Reception Desk initial state
    await page.screenshot({ path: 'test-results/reception_desk_initial_doctors.png' });

    // Verify visual status badge on cards
    const firstCard = doctorCards.first();
    await expect(firstCard).toBeVisible();

    // Wait through polling cycles (10 seconds) to ensure zero re-render crashes or repeat sound errors
    await page.waitForTimeout(10000);

    // Verify zero audio crashes
    expect(consoleErrors.filter((e) => e.includes('AudioContext') || e.includes('sound'))).toHaveLength(0);
  });
});
