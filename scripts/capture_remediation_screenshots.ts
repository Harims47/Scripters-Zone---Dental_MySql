import { chromium, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:5173';
const outDir = path.resolve(process.cwd(), 'responsive-qa', 'remediation_verification');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function login(page: Page, roleKey: 'receptionist' | 'dutyDoctor' | 'headDoctor') {
  const users = {
    receptionist: { username: 'receptionist', password: 'demo123', expected: '/reception-desk' },
    dutyDoctor: { username: 'dutydoctor', password: 'demo123', expected: '/dashboard' },
    headDoctor: { username: 'headdoctor', password: 'demo123', expected: '/dashboard' },
  };
  const user = users[roleKey];
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL(`**${user.expected}`, { timeout: 10000 });
  await page.waitForTimeout(600);
}

async function capture() {
  const browser = await chromium.launch();

  // 1. /login at 375x812 (mobile small)
  {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outDir, 'login_375x812_top.png') });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'login_375x812_scrolled.png') });
    await page.close();
  }

  // 2. /reception-desk at 768x1024 with sidebar expanded
  {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await context.newPage();
    await login(page, 'receptionist');
    await page.screenshot({ path: path.join(outDir, 'reception_desk_768x1024.png') });
    await page.close();
    await context.close();
  }

  // 3. /historical-migration at 375x812
  {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await login(page, 'headDoctor');
    await page.goto(`${BASE_URL}/historical-migration`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, 'historical_migration_375x812.png') });
    await page.close();
    await context.close();
  }

  // 4. Dashboard -> Register Patient click (verifies redirect and actual drawer opened)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await login(page, 'headDoctor');
    
    // Click Register Patient on Dashboard
    const regBtn = page.getByRole('button', { name: 'Register Patient' });
    await regBtn.click();
    await page.waitForURL('**/reception-desk', { timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'dashboard_register_patient_drawer.png') });
    await page.close();
    await context.close();
  }

  await browser.close();
  console.log('ALL VERIFICATION SCREENSHOTS CAPTURED');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
