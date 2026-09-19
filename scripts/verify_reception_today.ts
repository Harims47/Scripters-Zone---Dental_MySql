import { chromium } from '@playwright/test';
import * as path from 'path';

async function verify() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Username').fill('receptionist');
  await page.getByLabel('Password').fill('demo123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/reception-desk', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Dismiss any modal
  try {
    const alertBtn = page.locator('button:has-text("Acknowledge & View Details"), button:has-text("Dismiss"), button:has-text("Close")').first();
    if (await alertBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await alertBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch (_) {}

  await page.screenshot({ path: path.join(process.cwd(), 'responsive-qa', 'remediation_verification', 'reception_desk_today_empty.png') });
  console.log('Reception desk screenshot captured');
  await browser.close();
}

verify().catch(console.error);
