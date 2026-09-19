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
  await page.goto('/login');
  
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for the role-specific landing path
  await page.waitForURL(`**${user.expectedPath}`);
  
  // If Low Stock modal is currently overlaying the page, dismiss it
  await dismissLowStockAlertIfPresent(page, 3000);
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  // If Low Stock modal is currently overlaying the page, dismiss it so background is clickable
  await dismissLowStockAlertIfPresent(page, 4000);

  // Sidebar logout button is inside aside
  const sidebarLogout = page.locator('aside button').filter({ hasText: 'Logout' }).first();
  if (await sidebarLogout.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sidebarLogout.click();
  } else {
    // Topbar fallback
    const userMenuTrigger = page.locator('header .cursor-pointer').last();
    if (await userMenuTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userMenuTrigger.click();
      const menuLogout = page.getByRole('menuitem', { name: /Logout/i });
      if (await menuLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menuLogout.click();
      }
    } else {
      // Unauthorized page fallback
      const unauthorizedLogout = page.getByRole('button', { name: /Logout/i }).first();
      if (await unauthorizedLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
        await unauthorizedLogout.click();
      }
    }
  }

  // Wait for redirect to login
  await page.waitForURL('**/login', { timeout: 10000 });
}





