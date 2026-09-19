import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test('API test - Network inspection on Patients page', async ({ page }) => {
  const capturedResponses: { url: string; status: number }[] = [];

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      capturedResponses.push({ url: response.url(), status: response.status() });
    }
  });

  // Login as receptionist (lands on /reception-desk)
  await loginAs(page, 'receptionist');
  await expect(page).toHaveURL(/.*\/reception-desk/);
  
  // Navigate to /patients
  await page.goto('/patients');
  await expect(page.locator('body')).toContainText('Patients', { timeout: 10000 });

  // Verify that API responses were received successfully
  const patientApi = capturedResponses.find(r => r.url.includes('/api/patients'));
  expect(patientApi).toBeDefined();
  expect(patientApi?.status).toBe(200);
});
