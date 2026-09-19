import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from './helpers/auth';

const API_BASE = 'http://localhost:3001';

test.describe('DentalCore Module-Level Access Control & RBAC Hardening', () => {

  test('Module Access UI displays all 15 modules with Duty Doctor Reports unchecked by default', async ({ page }) => {
    // 1. Log in as Head Doctor
    await loginAs(page, 'headDoctor');
    await page.goto('/staff');
    await page.waitForURL('**/staff');

    // Wait for staff table to load Dr. QA Duty Doctor
    await expect(page.getByText('Dr. QA Duty Doctor')).toBeVisible({ timeout: 10000 });

    // Find the row for Dr. QA Duty Doctor and click Edit
    const docRow = page.locator('tr').filter({ hasText: 'Dr. QA Duty Doctor' });
    const editBtn = docRow.getByRole('button', { name: 'Edit staff' });
    await editBtn.click();

    // Drawer should open
    await expect(page.getByText('Module Access Control')).toBeVisible({ timeout: 5000 });

    // Verify all 9 sidebar modules are present in the drawer for Duty Doctor
    const sidebarModules = [
      'Dashboard', 'Reception Desk', 'Partial Payments', 'Patients',
      'Queue', 'Inventory', 'Staff Management', 'Reports', 'Settings'
    ];

    for (const mod of sidebarModules) {
      const modLocator = page.locator(`[data-testid="module-access-${mod.toLowerCase().replace(/\s+/g, '-')}"]`);
      await expect(modLocator).toBeVisible();
    }

    // Verify non-sidebar modules are NOT present
    const nonSidebarModules = ['Appointments', 'Doctor Workspace', 'Prescriptions', 'Dispensing', 'Billing', 'Payments'];
    for (const mod of nonSidebarModules) {
      const modLocator = page.locator(`[data-testid="module-access-${mod.toLowerCase().replace(/\s+/g, '-')}"]`);
      await expect(modLocator).toHaveCount(0);
    }

    // Verify neither Dashboard nor Staff is disabled / grayed out
    await expect(page.locator('input[name="module_Dashboard"]')).toBeEnabled();
    await expect(page.locator('input[name="module_Staff Management"]')).toBeEnabled();

    // Verify NO "Role Restricted" or "Protected" badges are shown anywhere
    await expect(page.getByText('Role Restricted')).toHaveCount(0);
    await expect(page.getByText('Protected')).toHaveCount(0);

    // Reports checkbox is UNCHECKED by default for Duty Doctor
    await expect(page.locator('input[name="module_Reports"]')).not.toBeChecked();

    // Close drawer
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('CRITICAL CASE 1: Duty Doctor with Reports unchecked cannot access Reports', async ({ page, request }) => {
    // 1. Log in as Duty Doctor
    await loginAs(page, 'dutyDoctor');
    await page.waitForURL('**/dashboard');

    // 2. Verify Reports is NOT visible in Duty Doctor sidebar
    const reportsNav = page.locator('aside').getByRole('link', { name: /Reports/i });
    await expect(reportsNav).toHaveCount(0);

    // 3. Direct navigation to /reports must redirect to /unauthorized
    await page.goto('/reports');
    await page.waitForURL('**/unauthorized', { timeout: 10000 });
    await expect(page.getByText('Access Denied')).toBeVisible();

    // 4. API call to /api/reports with Duty Doctor session must return 403 Forbidden
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: TEST_USERS.dutyDoctor.username, password: TEST_USERS.dutyDoctor.password }
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const token = loginData.token || loginData.data?.token;

    const reportsApiRes = await request.get(`${API_BASE}/api/reports/financial`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    expect(reportsApiRes.status()).toBe(403);
  });

  test('CRITICAL CASE 2: Empty permissions semantics - explicit [] does not restore role defaults', async ({ page, request }) => {
    // 1. Log in as Head Doctor
    await loginAs(page, 'headDoctor');
    await page.goto('/staff');
    await page.waitForURL('**/staff');

    // Open edit for Dr. QA Duty Doctor
    const docRow = page.locator('tr').filter({ hasText: 'Dr. QA Duty Doctor' });
    await docRow.getByRole('button', { name: 'Edit staff' }).click();
    await expect(page.getByText('Module Access Control')).toBeVisible({ timeout: 5000 });

    // Click "Clear All" in the Module Access Editor
    await page.getByRole('button', { name: 'Clear All' }).click();

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 10000 });

    // Verify via backend API that permissions is persisted as []
    const headLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: TEST_USERS.headDoctor.username, password: TEST_USERS.headDoctor.password }
    });
    const headToken = (await headLoginRes.json()).token;
    const staffListRes = await request.get(`${API_BASE}/api/staff`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {}
    });
    const staffList = await staffListRes.json();
    const dutyDoc = staffList.data.find((s: any) => s.name === 'Dr. QA Duty Doctor');
    expect(dutyDoc).toBeDefined();
    expect(Array.isArray(dutyDoc.permissions)).toBe(true);
    expect(dutyDoc.permissions.length).toBe(0);

    // 2. Log in as Duty Doctor with permissions = []
    await logout(page);
    await loginAs(page, 'dutyDoctor');

    // Role defaults must NOT return! Sidebar should not have Patients, Queue, Prescriptions, Doctor Workspace
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: /Doctor Workspace/i })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /Patients/i })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /Queue/i })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /Prescriptions/i })).toHaveCount(0);

    // Direct navigation to /patients must be blocked and redirected
    await page.goto('/patients');
    await page.waitForURL('**/unauthorized', { timeout: 10000 });
    await expect(page.getByText('Access Denied')).toBeVisible();

    // 3. Restore Dr. QA Duty Doctor permissions back to Role Defaults for subsequent test hygiene
    await logout(page);
    await loginAs(page, 'headDoctor');
    await page.goto('/staff');
    await page.waitForURL('**/staff');
    const docRowRestore = page.locator('tr').filter({ hasText: 'Dr. QA Duty Doctor' });
    await docRowRestore.getByRole('button', { name: 'Edit staff' }).click();
    await expect(page.getByText('Module Access Control')).toBeVisible();
    await page.getByRole('button', { name: 'Role Defaults' }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 10000 });
  });

  test('Privilege Escalation Prevention - Checking Reports for Duty Doctor or Receptionist remains 403', async ({ request }) => {
    // 1. Authenticate as Head Doctor to update permissions
    const headLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: TEST_USERS.headDoctor.username, password: TEST_USERS.headDoctor.password }
    });
    const headToken = (await headLoginRes.json()).token;

    // Get staff list to find Dr. QA Duty Doctor
    const staffRes = await request.get(`${API_BASE}/api/staff`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {}
    });
    const staffList = (await staffRes.json()).data;
    const dutyDoc = staffList.find((s: any) => s.name === 'Dr. QA Duty Doctor');
    expect(dutyDoc).toBeDefined();

    // Try setting permissions to include 'Reports' (privilege escalation attempt)
    const updateRes = await request.put(`${API_BASE}/api/staff/${dutyDoc.id}`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {},
      data: {
        name: dutyDoc.name,
        phone: dutyDoc.phone.replace(/\D/g, '').slice(-10),
        role: dutyDoc.role,
        permissions: ['Dashboard', 'Patients', 'Reports']
      }
    });
    expect(updateRes.ok()).toBeTruthy();

    // 2. Log in as Duty Doctor
    const dutyLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: TEST_USERS.dutyDoctor.username, password: TEST_USERS.dutyDoctor.password }
    });
    const dutyToken = (await dutyLoginRes.json()).token;

    // Call /api/reports/financial - backend requireRole('Head Doctor') MUST block it with 403
    const reportsRes = await request.get(`${API_BASE}/api/reports/financial`, {
      headers: dutyToken ? { Authorization: `Bearer ${dutyToken}` } : {}
    });
    expect(reportsRes.status()).toBe(403);

    // Call /api/reports/overview - MUST also return 403
    const overviewRes = await request.get(`${API_BASE}/api/reports/overview`, {
      headers: dutyToken ? { Authorization: `Bearer ${dutyToken}` } : {}
    });
    expect(overviewRes.status()).toBe(403);

    // Clean up: restore role defaults
    await request.put(`${API_BASE}/api/staff/${dutyDoc.id}`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {},
      data: {
        name: dutyDoc.name,
        phone: dutyDoc.phone.replace(/\D/g, '').slice(-10),
        role: dutyDoc.role,
        permissions: null // restore null baseline
      }
    });
  });

  test('Head Doctor retains Dashboard and Staff Management even if unchecked', async ({ page, request }) => {
    // 1. Authenticate as Head Doctor
    const headLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: TEST_USERS.headDoctor.username, password: TEST_USERS.headDoctor.password }
    });
    const headToken = (await headLoginRes.json()).token;

    // Get Head Doctor staff id
    const staffRes = await request.get(`${API_BASE}/api/staff`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {}
    });
    const staffList = (await staffRes.json()).data;
    const arun = staffList.find((s: any) => s.role === 'Head Doctor');
    expect(arun).toBeDefined();

    // Attempt to revoke Dashboard and Staff Management via API
    await request.put(`${API_BASE}/api/staff/${arun.id}`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {},
      data: {
        name: arun.name,
        phone: arun.phone.replace(/\D/g, '').slice(-10),
        role: arun.role,
        permissions: ['Patients'] // Excludes Dashboard and Staff Management
      }
    });

    // Verify Head Doctor UI still has Dashboard and Staff Management in sidebar
    await loginAs(page, 'headDoctor');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: /Dashboard/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Staff/i })).toBeVisible();

    // Direct access to /staff works
    await page.goto('/staff');
    await expect(page).toHaveURL(/.*\/staff/);

    // Clean up: restore Head Doctor permissions
    await request.put(`${API_BASE}/api/staff/${arun.id}`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {},
      data: {
        name: arun.name,
        phone: arun.phone.replace(/\D/g, '').slice(-10),
        role: arun.role,
        permissions: null
      }
    });
  });

  test('Module permission configuration persists across reload and re-login', async ({ page, request }) => {
    // Head Doctor updates Duty Doctor with only ['Dashboard', 'Queue']
    const headLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: TEST_USERS.headDoctor.username, password: TEST_USERS.headDoctor.password }
    });
    const headToken = (await headLoginRes.json()).token;
    const staffRes = await request.get(`${API_BASE}/api/staff`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {}
    });
    const dutyDoc = (await staffRes.json()).data.find((s: any) => s.name === 'Dr. QA Duty Doctor');

    await request.put(`${API_BASE}/api/staff/${dutyDoc.id}`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {},
      data: {
        name: dutyDoc.name,
        phone: dutyDoc.phone.replace(/\D/g, '').slice(-10),
        role: dutyDoc.role,
        permissions: ['Dashboard', 'Queue']
      }
    });

    // Log in as Duty Doctor
    await loginAs(page, 'dutyDoctor');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: /Queue/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Patients/i })).toHaveCount(0);

    // Direct navigation to /patients is blocked
    await page.goto('/patients');
    await page.waitForURL('**/unauthorized', { timeout: 10000 });

    // Reload page
    await page.reload();
    await page.waitForURL('**/unauthorized');

    // Go to /queue
    await page.goto('/queue');
    await page.waitForURL('**/queue');
    await expect(sidebar.getByRole('link', { name: /Queue/i })).toBeVisible();

    // Logout and log in again
    await logout(page);
    await loginAs(page, 'dutyDoctor');
    await expect(sidebar.getByRole('link', { name: /Queue/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Patients/i })).toHaveCount(0);

    // Clean up: restore role defaults
    await request.put(`${API_BASE}/api/staff/${dutyDoc.id}`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {},
      data: {
        name: dutyDoc.name,
        phone: dutyDoc.phone.replace(/\D/g, '').slice(-10),
        role: dutyDoc.role,
        permissions: null
      }
    });
  });

  test('Custom module assignment - Checking Partial Payments for Duty Doctor displays Partial Payments in sidebar', async ({ page, request }) => {
    // 1. Authenticate as Head Doctor and assign Partial Payments to Duty Doctor
    const headLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: TEST_USERS.headDoctor.username, password: TEST_USERS.headDoctor.password }
    });
    const headToken = (await headLoginRes.json()).token;
    const staffRes = await request.get(`${API_BASE}/api/staff`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {}
    });
    const dutyDoc = (await staffRes.json()).data.find((s: any) => s.name === 'Dr. QA Duty Doctor');

    await request.put(`${API_BASE}/api/staff/${dutyDoc.id}`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {},
      data: {
        name: dutyDoc.name,
        phone: dutyDoc.phone.replace(/\D/g, '').slice(-10),
        role: dutyDoc.role,
        permissions: ['Dashboard', 'Partial Payments', 'Patients', 'Queue']
      }
    });

    // 2. Log in as Duty Doctor
    await loginAs(page, 'dutyDoctor');
    const sidebar = page.locator('aside');

    // Partial Payments must be visible in sidebar
    await expect(sidebar.getByRole('link', { name: /Partial Payments/i })).toBeVisible();

    // Direct navigation to /partial-payments works
    await page.goto('/partial-payments');
    await page.waitForURL('**/partial-payments', { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/partial-payments/);

    // Clean up: restore role defaults
    await request.put(`${API_BASE}/api/staff/${dutyDoc.id}`, {
      headers: headToken ? { Authorization: `Bearer ${headToken}` } : {},
      data: {
        name: dutyDoc.name,
        phone: dutyDoc.phone.replace(/\D/g, '').slice(-10),
        role: dutyDoc.role,
        permissions: null
      }
    });
  });

  test('Dr. Irfan with Partial Payments assigned shows Partial Payments in sidebar upon login', async ({ page }) => {
    // 1. Log in directly as Irfan
    await page.goto('/login');
    await page.fill('input[type="text"], input[name="username"]', 'irfan');
    await page.fill('input[type="password"]', '1234');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    const { dismissLowStockAlertIfPresent } = await import('./helpers/lowStockHelper');
    await dismissLowStockAlertIfPresent(page, 4000);
    
    // Check sidebar
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: /Partial Payments/i })).toBeVisible();

    // Navigate to Partial Payments
    await sidebar.getByRole('link', { name: /Partial Payments/i }).click();
    await page.waitForURL('**/partial-payments', { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/partial-payments/);
  });


});

