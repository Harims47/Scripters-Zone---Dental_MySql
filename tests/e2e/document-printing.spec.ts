import { test, expect } from '@playwright/test';

test.describe('Phase 7.2 - Professional Document Printing Workflow', () => {
  let testPatientPhone = `999${Date.now().toString().slice(-7)}`;
  let testPatientId = '';

  test.beforeAll(async ({ request }) => {
    // Basic setup if needed, otherwise rely on UI tests below
  });

  test('Billing Workflow to Document Generation', async ({ page, context }) => {
    // Navigate and login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="text"]', 'receptionist');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.goto('http://localhost:5173/billing');
    await page.waitForTimeout(2000);

    // Find first 'Collect Payment' or 'View' action
    const actionButtons = page.locator('button:has-text("Collect Payment"), button:has-text("View")');
    if (await actionButtons.count() > 0) {
      await actionButtons.first().click();
      
      // If we are in Collect Payment state, handle dispensing then pay
      const dispenseBtn = page.locator('button:has-text("Complete Dispensing")');
      if (await dispenseBtn.isVisible()) {
        await dispenseBtn.click();
      }

      // Handle payment
      const collectBtn = page.locator('button:has-text("Collect Payment")');
      if (await collectBtn.isVisible()) {
        await page.click('div:has-text("Cash") >> nth=0'); // select cash method roughly
        await collectBtn.click();
      }

      // Now we should see the Billing Completed dialog with Print options
      await expect(page.locator('text=Billing Completed')).toBeVisible();

      // Test Print Prescription (Expect a new page with PDF)
      const [prescriptionPage] = await Promise.all([
        context.waitForEvent('page'),
        page.click('button:has-text("Print Prescription")')
      ]);
      await prescriptionPage.waitForLoadState('networkidle');
      expect(prescriptionPage.url()).toMatch(/^blob:/); // Blob URL for PDF
      await prescriptionPage.close();

      // Test Print Receipt
      const [receiptPage] = await Promise.all([
        context.waitForEvent('page'),
        page.click('button:has-text("Print Receipt")')
      ]);
      await receiptPage.waitForLoadState('networkidle');
      expect(receiptPage.url()).toMatch(/^blob:/);
      await receiptPage.close();
    }
  });
});
