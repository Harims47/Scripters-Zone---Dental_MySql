import { chromium, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:5173';
const outDir = path.resolve(process.cwd(), 'responsive-qa', 'remediation_verification');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function dismissModals(page: Page) {
  try {
    const alertBtn = page.locator('button:has-text("Acknowledge & View Details"), button:has-text("Dismiss"), button:has-text("Close")').first();
    if (await alertBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await alertBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch (_) {}
}

async function testDashboardRegisterPatient() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login as receptionist
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Username').fill('receptionist');
  await page.getByLabel('Password').fill('demo123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/reception-desk', { timeout: 10000 });
  await dismissModals(page);

  // Navigate to /dashboard as receptionist
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await dismissModals(page);

  // Click Register Patient on Dashboard
  const regBtn = page.locator('button:has-text("Register Patient")');
  await regBtn.click();
  
  // Verify redirect to /reception-desk
  await page.waitForURL('**/reception-desk', { timeout: 5000 });
  // Verify actual register patient drawer opened
  await page.waitForSelector('text=Registration Type', { timeout: 5000 });
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(outDir, 'dashboard_register_patient_drawer.png') });
  console.log('Successfully redirected to reception-desk and opened Register Patient drawer!');

  await browser.close();
}

testDashboardRegisterPatient().catch(err => {
  console.error(err);
  process.exit(1);
});
