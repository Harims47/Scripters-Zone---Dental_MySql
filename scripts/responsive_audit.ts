import { chromium, Browser, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface Viewport {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: Viewport[] = [
  { name: 'Mobile Small', width: 375, height: 812 },
  { name: 'Mobile Large', width: 430, height: 932 },
  { name: 'Tablet Portrait', width: 768, height: 1024 },
  { name: 'Tablet Landscape', width: 1024, height: 768 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Large Desktop', width: 1920, height: 1080 },
];

interface AuditFinding {
  role: string;
  route: string;
  viewport: string;
  width: number;
  height: number;
  scrollWidth: number;
  clientWidth: number;
  overflowAmount: number;
  overflowingElements?: string[];
  clippedElements?: string[];
  smallTouchTargets?: string[];
  screenshotPath: string;
  status: 'PASS' | 'FAIL' | 'INACCESSIBLE';
  error?: string;
}

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve(process.cwd(), 'responsive-qa');

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function dismissModals(page: Page) {
  try {
    const alertBtn = page.locator('button:has-text("Acknowledge & View Details"), button:has-text("Dismiss"), button:has-text("Close")').first();
    if (await alertBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await alertBtn.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  } catch (_) {}
}

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
  await dismissModals(page);
}

async function runPageAudit(
  page: Page,
  roleDir: string,
  route: string,
  vp: Viewport
): Promise<AuditFinding> {
  const sanitizedRoute = route.replace(/\//g, '_').replace(/^_/, '') || 'home';
  const saveDir = path.join(OUTPUT_DIR, roleDir, sanitizedRoute);
  ensureDir(saveDir);
  const screenshotFileName = `${vp.width}x${vp.height}.png`;
  const screenshotPath = path.join(saveDir, screenshotFileName);
  const relativeScreenshotPath = path.join('responsive-qa', roleDir, sanitizedRoute, screenshotFileName).replace(/\\/g, '/');

  try {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(async () => {
      // Fallback if network idle doesn't trigger
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    });

    await page.waitForTimeout(1000);
    await dismissModals(page);

    // Diagnostics in browser context
    const diagnostics = await page.evaluate((vpWidth) => {
      const doc = document.documentElement;
      const scrollWidth = doc.scrollWidth;
      const clientWidth = doc.clientWidth;
      const winWidth = window.innerWidth;
      const overflow = scrollWidth - clientWidth;

      // Find overflowing elements
      const overflowing: string[] = [];
      if (overflow > 1) {
        const all = document.querySelectorAll('*');
        all.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.right > winWidth + 2 && rect.width > 0 && rect.height > 0) {
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const cls = (el.className && typeof el.className === 'string') 
              ? `.${el.className.split(' ').slice(0, 2).join('.')}` 
              : '';
            const textSnippet = (el.textContent || '').trim().slice(0, 25);
            const desc = `${tag}${id}${cls} [right=${Math.round(rect.right)}px, w=${Math.round(rect.width)}px] "${textSnippet}"`;
            if (overflowing.length < 5 && !overflowing.some(e => e.includes(tag + id + cls))) {
              overflowing.push(desc);
            }
          }
        });
      }

      // Find small touch targets on mobile/tablet (buttons, links, inputs with width or height < 24px)
      const smallTargets: string[] = [];
      if (vpWidth <= 768) {
        const interactives = document.querySelectorAll('button, a, input, select');
        interactives.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24)) {
            const tag = el.tagName.toLowerCase();
            const text = (el.textContent || (el as HTMLInputElement).value || '').trim().slice(0, 20);
            if (smallTargets.length < 5) {
              smallTargets.push(`${tag} (${Math.round(rect.width)}x${Math.round(rect.height)}) "${text}"`);
            }
          }
        });
      }

      return {
        scrollWidth,
        clientWidth,
        winWidth,
        overflowAmount: Math.max(0, overflow),
        overflowingElements: overflowing,
        smallTouchTargets: smallTargets
      };
    }, vp.width);

    // Capture screenshot
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const isFail = diagnostics.overflowAmount > 2;

    return {
      role: roleDir,
      route,
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      scrollWidth: diagnostics.scrollWidth,
      clientWidth: diagnostics.clientWidth,
      overflowAmount: diagnostics.overflowAmount,
      overflowingElements: diagnostics.overflowingElements,
      smallTouchTargets: diagnostics.smallTouchTargets,
      screenshotPath: relativeScreenshotPath,
      status: isFail ? 'FAIL' : 'PASS',
    };
  } catch (err: any) {
    // Error during navigation
    return {
      role: roleDir,
      route,
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      scrollWidth: 0,
      clientWidth: 0,
      overflowAmount: 0,
      screenshotPath: relativeScreenshotPath,
      status: 'FAIL',
      error: err.message || 'Page load failure',
    };
  }
}

async function main() {
  console.log('=== DentalCore Full Responsive QA Playwright Audit ===');
  console.log('Target URL:', BASE_URL);
  console.log('Output Directory:', OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const allFindings: AuditFinding[] = [];

  try {
    // ----------------------------------------------------
    // 1. PUBLIC ROUTES
    // ----------------------------------------------------
    console.log('\n--- Auditing Public Routes ---');
    const publicRoutes = ['/login', '/unauthorized', '/showcase'];
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();

    for (const route of publicRoutes) {
      console.log(`[Public] Auditing ${route}...`);
      for (const vp of VIEWPORTS) {
        const finding = await runPageAudit(publicPage, 'public', route, vp);
        allFindings.push(finding);
        process.stdout.write(`  ${vp.width}x${vp.height}: ${finding.status} (overflow: ${finding.overflowAmount}px)\n`);
      }
    }
    await publicContext.close();

    // ----------------------------------------------------
    // 2. HEAD DOCTOR ROUTES
    // ----------------------------------------------------
    console.log('\n--- Auditing Head Doctor Routes ---');
    const headDoctorRoutes = [
      '/dashboard',
      '/patients',
      '/reception-desk',
      '/appointments',
      '/queue',
      '/partial-payments',
      '/billing',
      '/inventory',
      '/reports',
      '/historical-migration',
      '/staff',
      '/settings',
      '/profile',
      '/premium-reference',
      '/doctor/patient/PAT-001',
      '/reception/dispensing/VISIT-001',
      '/reception/payment/VISIT-001'
    ];

    const headDoctorContext = await browser.newContext();
    const headDoctorPage = await headDoctorContext.newPage();
    await login(headDoctorPage, 'headDoctor');

    for (const route of headDoctorRoutes) {
      console.log(`[Head Doctor] Auditing ${route}...`);
      for (const vp of VIEWPORTS) {
        const finding = await runPageAudit(headDoctorPage, 'head-doctor', route, vp);
        allFindings.push(finding);
        process.stdout.write(`  ${vp.width}x${vp.height}: ${finding.status} (overflow: ${finding.overflowAmount}px)\n`);
      }
    }
    await headDoctorContext.close();

    // ----------------------------------------------------
    // 3. RECEPTIONIST ROUTES
    // ----------------------------------------------------
    console.log('\n--- Auditing Receptionist Routes ---');
    const receptionistRoutes = [
      '/dashboard',
      '/reception-desk',
      '/patients',
      '/queue',
      '/partial-payments',
      '/billing',
      '/profile',
      '/reception/dispensing/VISIT-001',
      '/reception/payment/VISIT-001'
    ];

    const receptionistContext = await browser.newContext();
    const receptionistPage = await receptionistContext.newPage();
    await login(receptionistPage, 'receptionist');

    for (const route of receptionistRoutes) {
      console.log(`[Receptionist] Auditing ${route}...`);
      for (const vp of VIEWPORTS) {
        const finding = await runPageAudit(receptionistPage, 'receptionist', route, vp);
        allFindings.push(finding);
        process.stdout.write(`  ${vp.width}x${vp.height}: ${finding.status} (overflow: ${finding.overflowAmount}px)\n`);
      }
    }
    await receptionistContext.close();

    // ----------------------------------------------------
    // 4. DUTY DOCTOR ROUTES
    // ----------------------------------------------------
    console.log('\n--- Auditing Duty Doctor Routes ---');
    const dutyDoctorRoutes = [
      '/dashboard',
      '/patients',
      '/queue',
      '/doctor/patient/PAT-001',
      '/profile'
    ];

    const dutyDoctorContext = await browser.newContext();
    const dutyDoctorPage = await dutyDoctorContext.newPage();
    await login(dutyDoctorPage, 'dutyDoctor');

    for (const route of dutyDoctorRoutes) {
      console.log(`[Duty Doctor] Auditing ${route}...`);
      for (const vp of VIEWPORTS) {
        const finding = await runPageAudit(dutyDoctorPage, 'duty-doctor', route, vp);
        allFindings.push(finding);
        process.stdout.write(`  ${vp.width}x${vp.height}: ${finding.status} (overflow: ${finding.overflowAmount}px)\n`);
      }
    }
    await dutyDoctorContext.close();

    // ----------------------------------------------------
    // 5. REPRESENTATIVE USER JOURNEYS
    // ----------------------------------------------------
    console.log('\n--- Executing Representative User Journeys ---');
    const journeyResults: any[] = [];

    // Journey A: Receptionist Mobile (375x812)
    console.log('[Journey] Receptionist Mobile (375x812)...');
    try {
      const rContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const rPage = await rContext.newPage();
      await rPage.goto(`${BASE_URL}/login`);
      await rPage.getByLabel('Username').fill('receptionist');
      await rPage.getByLabel('Password').fill('demo123');
      await rPage.getByRole('button', { name: 'Sign In' }).click();
      await rPage.waitForURL('**/reception-desk');
      await rPage.waitForTimeout(1000);
      await dismissModals(rPage);

      // Open mobile navigation
      const menuBtn = rPage.locator('button:has(svg.lucide-menu)').first();
      let mobileNavOpened = false;
      if (await menuBtn.isVisible().catch(() => false)) {
        await menuBtn.click();
        await rPage.waitForTimeout(500);
        mobileNavOpened = true;
        await rPage.screenshot({ path: path.join(OUTPUT_DIR, 'receptionist', 'journey_mobile_menu.png') });
        // Close menu
        await rPage.keyboard.press('Escape');
        await rPage.waitForTimeout(300);
      }

      // Search patient
      const searchInput = rPage.locator('input[placeholder*="Search"]').first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('John');
        await rPage.waitForTimeout(500);
      }

      await rPage.screenshot({ path: path.join(OUTPUT_DIR, 'receptionist', 'journey_reception_search.png') });
      journeyResults.push({ name: 'Receptionist Mobile (375x812)', status: 'PASS', mobileNavOpened });
      await rContext.close();
    } catch (e: any) {
      journeyResults.push({ name: 'Receptionist Mobile (375x812)', status: 'FAIL', error: e.message });
    }

    // Journey B: Duty Doctor Mobile (375x812)
    console.log('[Journey] Duty Doctor Mobile (375x812)...');
    try {
      const dContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const dPage = await dContext.newPage();
      await dPage.goto(`${BASE_URL}/login`);
      await dPage.getByLabel('Username').fill('dutydoctor');
      await dPage.getByLabel('Password').fill('demo123');
      await dPage.getByRole('button', { name: 'Sign In' }).click();
      await dPage.waitForURL('**/dashboard');
      await dPage.waitForTimeout(800);
      await dismissModals(dPage);

      // Open Doctor Workspace
      await dPage.goto(`${BASE_URL}/doctor/patient/PAT-001`);
      await dPage.waitForTimeout(1000);
      await dPage.screenshot({ path: path.join(OUTPUT_DIR, 'duty-doctor', 'journey_workspace.png') });

      journeyResults.push({ name: 'Duty Doctor Mobile (375x812)', status: 'PASS' });
      await dContext.close();
    } catch (e: any) {
      journeyResults.push({ name: 'Duty Doctor Mobile (375x812)', status: 'FAIL', error: e.message });
    }

    // Journey C: Head Doctor Tablet (768x1024)
    console.log('[Journey] Head Doctor Tablet (768x1024)...');
    try {
      const hContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      const hPage = await hContext.newPage();
      await login(hPage, 'headDoctor');
      await hPage.goto(`${BASE_URL}/historical-migration`);
      await hPage.waitForTimeout(1000);
      await hPage.screenshot({ path: path.join(OUTPUT_DIR, 'head-doctor', 'journey_tablet_migration.png') });
      journeyResults.push({ name: 'Head Doctor Tablet (768x1024)', status: 'PASS' });
      await hContext.close();
    } catch (e: any) {
      journeyResults.push({ name: 'Head Doctor Tablet (768x1024)', status: 'FAIL', error: e.message });
    }

    // Journey D: Head Doctor Desktop (1440x900)
    console.log('[Journey] Head Doctor Desktop (1440x900)...');
    try {
      const hdContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const hdPage = await hdContext.newPage();
      await login(hdPage, 'headDoctor');
      await hdPage.goto(`${BASE_URL}/reports`);
      await hdPage.waitForTimeout(1000);
      await hdPage.screenshot({ path: path.join(OUTPUT_DIR, 'head-doctor', 'journey_desktop_reports.png') });
      journeyResults.push({ name: 'Head Doctor Desktop (1440x900)', status: 'PASS' });
      await hdContext.close();
    } catch (e: any) {
      journeyResults.push({ name: 'Head Doctor Desktop (1440x900)', status: 'FAIL', error: e.message });
    }

    // Write audit summary json
    const summary = {
      timestamp: new Date().toISOString(),
      totalChecks: allFindings.length,
      passedChecks: allFindings.filter(f => f.status === 'PASS').length,
      failedChecks: allFindings.filter(f => f.status === 'FAIL').length,
      viewports: VIEWPORTS,
      journeys: journeyResults,
      findings: allFindings
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'audit_summary.json'), JSON.stringify(summary, null, 2));
    console.log('\nAudit complete! Summary saved to responsive-qa/audit_summary.json');
    console.log(`Total checks: ${summary.totalChecks} | Passed: ${summary.passedChecks} | Failed: ${summary.failedChecks}`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
