import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';

test('REPRODUCE: Inspect Reception Desk table rows and verify if "Unknown" is rendered', async ({ page }) => {
  await loginAs(page, 'receptionist');
  await page.goto('/reception-desk');
  await dismissLowStockAlertIfPresent(page, 2000);

  // Wait for table to load
  await page.waitForSelector('table tbody tr');

  // Capture screenshot of the table
  await page.screenshot({ path: 'test-results/reception-desk-reproduce.png', fullPage: true });

  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  console.log(`\n=== VISIBLE RECEPTION DESK ROWS: ${count} ===`);

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const rowText = await row.innerText();
    const cells = await row.locator('td').allInnerTexts();
    console.log(`Row #${i + 1}:`, cells);
  }

  // Check if "Unknown" is present in the table
  const hasUnknown = await page.locator('table').getByText('Unknown').count();
  console.log(`Occurrences of "Unknown" in Reception Desk table: ${hasUnknown}`);

  // Also check View and Edit buttons on the first row
  const firstRow = rows.first();
  const editBtn = firstRow.locator('button[title="Edit Patient"]');
  const viewBtn = firstRow.locator('button[title="View Patient Details"]');
  console.log('Edit button visible:', await editBtn.isVisible());
  console.log('View button visible:', await viewBtn.isVisible());

  // Click View button and check if drawer opens
  if (await viewBtn.isVisible()) {
    console.log('Clicking View button...');
    await viewBtn.click();
    await page.waitForTimeout(1500);
    const drawerOrSheet = page.locator('[role="dialog"], [data-state="open"]');
    const drawerCount = await drawerOrSheet.count();
    console.log(`Drawer/Dialog open count after clicking View: ${drawerCount}`);
    await page.screenshot({ path: 'test-results/reception-desk-after-view-click.png' });
  }

  // Expect failure if "Unknown" is present so we confirm reproduction
  expect(hasUnknown).toBe(0);
});
