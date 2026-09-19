import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Settings Page - Clean Basic Clinic Profile', () => {

  test('Settings page displays clean basic Clinic Profile without Appointment Types or extra cards', async ({ page }) => {
    // 1. Log in as Head Doctor
    await loginAs(page, 'headDoctor');

    // 2. Navigate to /settings
    await page.goto('/settings');
    await page.waitForURL('**/settings', { timeout: 10000 });

    // 3. Confirm header and clinic profile card
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Clinic Profile' })).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();

    // 4. Verify Appointment Types and extra clutter are completely gone
    await expect(page.getByText('Appointment Types')).toHaveCount(0);
    await expect(page.getByText('Clinic Operations')).toHaveCount(0);
    await expect(page.getByText('Consultation Hours')).toHaveCount(0);
    await expect(page.getByText('Facility Amenities')).toHaveCount(0);

    // 5. Verify the core basic fields are cleanly rendered
    await expect(page.getByText('Clinic Name').first()).toBeVisible();
    await expect(page.getByText('Default Language').first()).toBeVisible();
    await expect(page.getByText('Phone Number').first()).toBeVisible();
    await expect(page.getByText('Email Address').first()).toBeVisible();
    await expect(page.getByText('Clinic Address').first()).toBeVisible();

    // 6. Test Edit Profile drawer
    const editBtn = page.getByRole('button', { name: /Edit Profile/i });
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Drawer should open with clean sections
    await expect(page.getByText('Edit Clinic Profile')).toBeVisible();
    await expect(page.getByText('Basic Information')).toBeVisible();
    await expect(page.getByText('Contact Details')).toBeVisible();
    await expect(page.getByText('Location')).toBeVisible();

    // Modify a basic field
    const phoneInput = page.locator('input[placeholder*="+91 98765 43210"]');
    await phoneInput.fill('+91 98765 99999');

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Expect success toast and updated phone in UI
    await expect(page.getByText(/Clinic profile updated successfully/i)).toBeVisible();
    await expect(page.getByText('+91 98765 99999')).toBeVisible();

    // Wait for drawer to close
    await expect(page.getByText('Edit Clinic Profile')).toHaveCount(0);

    // Take screenshot
    await page.screenshot({ path: 'test-results/settings-clean.png', fullPage: true });

  });

});
