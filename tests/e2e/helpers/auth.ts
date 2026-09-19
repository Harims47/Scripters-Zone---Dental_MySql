import { Page, expect } from '@playwright/test';
import { dismissLowStockAlertIfPresent } from './lowStockHelper';

export interface UserCredentials {
  username: string;
  role: 'Receptionist' | 'Duty Doctor' | 'Head Doctor';
}

/**
 * Standard test credentials
 */
export const TEST_USERS = {
  receptionist: { username: 'receptionist', password: 'demo123', role: 'Receptionist', expectedPath: '/reception-desk' },
  dutyDoctor: { username: 'dutydoctor', password: 'demo123', role: 'Duty Doctor', expectedPath: '/dashboard' },
  headDoctor: { username: 'headdoctor', password: 'demo123', role: 'Head Doctor', expectedPath: '/dashboard' },
};

/**
 * Robust login helper supporting role-aware landing paths
 */
export async function loginAs(page: Page, roleKey: keyof typeof TEST_USERS) {
  const user = TEST_USERS[roleKey];
  
  // Clean cookies and session to prevent cross-test cookie collision
  await page.context().clearCookies();
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const userInput = page.locator('input#username, input[placeholder*="receptionist"]').first();
  await userInput.waitFor({ state: 'visible', timeout: 10000 });
  await userInput.fill(user.username);

  const passInput = page.locator('input#password, input[type="password"]').first();
  await passInput.fill(user.password);

  const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in")').first();
  await submitBtn.click();

  // Wait for the role-specific landing path
  await page.waitForURL(`**${user.expectedPath}`, { timeout: 20000 });
  
  // If Low Stock modal is currently overlaying the page, dismiss it
  await dismissLowStockAlertIfPresent(page, 3000);
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  // Dismiss any low stock alert or open dialog/sheet backdrops
  await dismissLowStockAlertIfPresent(page, 2000);
  const openBackdrop = page.locator('div[data-state="open"].fixed.inset-0, [role="dialog"]');
  if (await openBackdrop.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  try {
    // Sidebar logout button is inside aside
    const sidebarLogout = page.locator('aside button').filter({ hasText: 'Logout' }).first();
    if (await sidebarLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sidebarLogout.click({ timeout: 3000 });
    } else {
      // Topbar fallback
      const userMenuTrigger = page.locator('header .cursor-pointer').last();
      if (await userMenuTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userMenuTrigger.click();
        const menuLogout = page.getByRole('menuitem', { name: /Logout/i });
        if (await menuLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
          await menuLogout.click({ timeout: 3000 });
        }
      } else {
        // Unauthorized page fallback
        const unauthorizedLogout = page.getByRole('button', { name: /Logout/i }).first();
        if (await unauthorizedLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
          await unauthorizedLogout.click({ timeout: 3000 });
        }
      }
    }
    await page.waitForURL('**/login', { timeout: 5000 });
  } catch {
    // Fallback: clear cookies and session then navigate to login
    await page.request.post('/api/auth/logout').catch(() => {});
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (_) {}
    });
    await page.goto('/login');
    await page.waitForURL('**/login', { timeout: 10000 });
  }
}





