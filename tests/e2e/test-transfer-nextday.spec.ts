import { test, expect } from '@playwright/test';

test('Verify transfer to tomorrow and next day queue behavior', async ({ page }) => {
  test.setTimeout(90000);

  // 1. Login as receptionist
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Username').fill('receptionist');
  await page.getByLabel('Password').fill('demo123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/reception-desk');

  const dismissModal = async () => {
    try {
      const alertBtn = page.locator('button:has-text("Acknowledge & View Details"), button:has-text("Dismiss"), button:has-text("Close")').first();
      if (await alertBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await alertBtn.click().catch(() => {});
        await page.waitForTimeout(400);
      }
    } catch (_) {}
  };
  await dismissModal();

  // Register 5 patients
  const ts = Date.now().toString().slice(-4);
  const patientNames = [];
  for (let i = 1; i <= 5; i++) {
    const pName = `P_Trans_${ts}_${i}`;
    patientNames.push(pName);

    await page.getByRole('button', { name: 'Register Patient' }).first().click();
    await page.waitForSelector('text=Registration Type');
    await page.getByRole('button', { name: 'New Patient' }).click();
    await page.locator('input[placeholder="Enter patient name"]').fill(pName);
    await page.locator('input[placeholder="10-digit mobile number"]').fill(`9876${ts}${i}`);
    await page.locator('input[placeholder="e.g. 30"]').fill('29');
    await page.getByRole('button', { name: 'Register Patient' }).last().click();

    // Dismiss Swal registration success dialog
    await page.waitForSelector('.swal2-confirm', { timeout: 5000 });
    await page.locator('.swal2-confirm').click();
    await page.waitForTimeout(500);
  }

  console.log('Registered 5 patients:', patientNames);

  // Now verify today's queue shows 5 rows
  await page.waitForTimeout(1000);
  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  console.log('Today queue row count:', count);

  // Take screenshot of today's queue
  await page.screenshot({ path: 'responsive-qa/remediation_verification/test_today_5_patients.png' });

  // Now complete 3 patients
  // A receptionist can process/cancel or doctor can complete
  // On reception desk, we can click the checkboxes of the last 2 patients (patients 4 and 5)
  // Let's find checkboxes for patientNames[3] and patientNames[4]
  const p4Row = page.locator(`tr:has-text("${patientNames[3]}")`);
  const p5Row = page.locator(`tr:has-text("${patientNames[4]}")`);

  await p4Row.locator('button[role="checkbox"]').click();
  await p5Row.locator('button[role="checkbox"]').click();
  await page.waitForTimeout(300);

  // Click "Transfer to Next Day" button
  const transferBtn = page.locator('button:has-text("Transfer to Next Day")');
  console.log('Transfer button visible:', await transferBtn.isVisible());
  await transferBtn.click();
  await page.waitForTimeout(500);

  // In the Transfer modal, click "Transfer Patients"
  const confirmTransferBtn = page.locator('button:has-text("Transfer Patients")');
  await confirmTransferBtn.click();
  await page.waitForTimeout(1500);

  // The alert asks: "Would you like to view that day's list now?"
  const viewTomorrowBtn = page.locator('button:has-text("View Tomorrow")');
  if (await viewTomorrowBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await viewTomorrowBtn.click();
  } else {
    // Click "Tomorrow" button manually
    await page.getByRole('button', { name: 'Tomorrow' }).click();
  }
  await page.waitForTimeout(1500);

  // Take screenshot of Tomorrow's queue
  await page.screenshot({ path: 'responsive-qa/remediation_verification/test_tomorrow_transferred.png' });

  // Read the table rows on Tomorrow
  const tomorrowRows = page.locator('table tbody tr');
  const tCount = await tomorrowRows.count();
  console.log('Tomorrow tab row count:', tCount);

  for (let i = 0; i < tCount; i++) {
    const text = await tomorrowRows.nth(i).innerText();
    console.log(`Tomorrow Row ${i + 1}:`, text.replace(/\n+/g, ' | '));
  }

  // Now, what happens if we simulate that "Tomorrow" IS today?
  // We can change the date picker to Tomorrow's date or check what happens
});
