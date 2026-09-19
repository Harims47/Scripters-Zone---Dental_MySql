import { test, expect } from '@playwright/test';

test.describe('DentalCore — Profile Update End-to-End', () => {
  test('User can edit profile details and changes persist to backend and database', async ({ page }) => {
    // 1. Log in as Head Doctor
    await page.goto('http://localhost:5173/login');
    await page.locator('#username').fill('headdoctor');
    await page.locator('#password').fill('demo123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify successful login
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });

    // 2. Navigate to Profile Page
    await page.goto('http://localhost:5173/profile');
    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible({ timeout: 10000 });

    // Dismiss any low stock alert if it appears
    const alertCloseBtn = page.locator('button:has-text("Remind in 1 hr"), div[role="dialog"] button:has-text("Close")').first();
    if (await alertCloseBtn.isVisible().catch(() => false)) {
      await alertCloseBtn.click();
      await page.waitForTimeout(400);
    }

    await expect(page.locator('text=Personal Information')).toBeVisible();

    // 3. Click Edit Profile
    const editBtn = page.getByRole('button', { name: 'Edit Profile' });
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // 4. Verify Drawer opened
    await expect(page.locator('text=Edit My Profile')).toBeVisible();

    // 5. Fill new profile details
    const nameInput = page.locator('input[placeholder="Enter full name"]');
    const phoneInput = page.locator('input[placeholder="Enter phone number"]');

    await nameInput.fill('Dr. Arun Kumar');
    await phoneInput.fill('9443023648');

    // 6. Click Save Changes
    const saveBtn = page.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    // 7. Verify Success Toast & Updated values on page
    await expect(page.locator('text=Profile updated successfully')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Dr. Arun Kumar').first()).toBeVisible();
    await expect(page.locator('text=9443023648')).toBeVisible();

    // 8. Reload page to verify backend database persistence
    await page.reload();
    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible({ timeout: 10000 });

    if (await alertCloseBtn.isVisible().catch(() => false)) {
      await alertCloseBtn.click();
      await page.waitForTimeout(400);
    }

    await expect(page.locator('text=Dr. Arun Kumar').first()).toBeVisible();
    await expect(page.locator('text=9443023648')).toBeVisible();

    // 9. Restore original details
    await editBtn.click();
    await expect(page.locator('text=Edit My Profile')).toBeVisible();
    await nameInput.fill('Dr. Arun');
    await phoneInput.fill('+91 98765 43210');
    await saveBtn.click();
    await expect(page.locator('text=Profile updated successfully')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Dr. Arun').first()).toBeVisible();
  });
});
