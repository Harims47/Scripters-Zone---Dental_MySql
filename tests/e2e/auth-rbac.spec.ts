import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';

test.describe('Authentication and RBAC', () => {

  test('Valid Login - Receptionist lands on /reception-desk', async ({ page }) => {
    await loginAs(page, 'receptionist');
    await expect(page).toHaveURL(/.*\/reception-desk/);
    await expect(page.locator('body')).toContainText('Receptionist');
  });

  test('Valid Login - Duty Doctor lands on /dashboard', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('body')).toContainText('Duty Doctor');
  });

  test('Valid Login - Head Doctor lands on /dashboard', async ({ page }) => {
    await loginAs(page, 'headDoctor');
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('body')).toContainText(/Head Doctor|MOHAMED RAFI/i);
  });

  test('Invalid Login shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('invaliduser');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Session Persistence across page reload', async ({ page }) => {
    await loginAs(page, 'receptionist');
    await page.reload();
    await page.waitForURL('**/reception-desk');
    await expect(page.locator('body')).toContainText('Receptionist', { timeout: 10000 });
  });

  test('Logout redirects to /login and restricts protected access', async ({ page }) => {
    await loginAs(page, 'receptionist');
    await logout(page);

    // Try going back to a protected route
    await page.goto('/reception-desk');
    await expect(page).toHaveURL(/.*\/login/);
  });


  test('Receptionist Boundaries - Inventory blocked', async ({ page }) => {
    await loginAs(page, 'receptionist');
    await page.goto('/inventory');
    await page.waitForURL('**/unauthorized');
    await expect(page.getByText('Access Denied')).toBeVisible();
  });

  test('Duty Doctor Boundaries - Settings blocked', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    await page.goto('/settings');
    await page.waitForURL('**/unauthorized');
    await expect(page.getByText('Access Denied')).toBeVisible();
  });

  test('Head Doctor Access - Full Administrative Access', async ({ page }) => {
    await loginAs(page, 'headDoctor');

    // Can access inventory
    await page.goto('/inventory');
    await expect(page.locator('body')).toContainText('Inventory', { timeout: 10000 });

    // Can access reports
    await page.goto('/reports');
    await expect(page.locator('body')).toContainText('Reports', { timeout: 10000 });
  });
});
