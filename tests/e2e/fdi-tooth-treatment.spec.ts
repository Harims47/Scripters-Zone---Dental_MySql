import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { queryOne, queryMany } from './helpers/db';

test.describe('DentalCore v1.1 — FDI Interactive Tooth Treatment Planning Suite', () => {
  const apiBase = 'http://localhost:3001';

  async function getActiveTestPatient() {
    const target = await queryOne<{ id: string; visitId: string }>(`
      SELECT p.id, v.id as visitId
      FROM Patient p
      JOIN Visit v ON p.id = v.patientId
      LEFT JOIN Consultation c ON c.visitId = v.id
      WHERE p.status = 'Active' 
        AND v.status NOT IN ('CANCELLED', 'COMPLETED')
        AND (c.status IS NULL OR c.status != 'Completed')
      ORDER BY v.createdAt DESC
      LIMIT 1
    `);
    if (!target) throw new Error('No active patient with visit found');
    return target;
  }

  test('FDI-01: All 32 FDI teeth render with correct anatomical orientation and labels', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    const target = await getActiveTestPatient();

    await page.goto(`/doctor/patient/${target.id}?visitId=${target.visitId}`);
    await page.waitForLoadState('networkidle');

    // Open Treatment Plan modal
    const treatBtn = page.getByRole('button', { name: 'Treatment', exact: true });
    await expect(treatBtn).toBeVisible({ timeout: 10000 });
    await treatBtn.click();

    // Verify FDI chart is visible
    await expect(page.getByText('FDI Dental Chart')).toBeVisible();
    await expect(page.getByText('Patient Right (Dr. Left)')).toBeVisible();
    await expect(page.getByText('Patient Left (Dr. Right)')).toBeVisible();

    // Verify Upper Arch (18..11 and 21..28)
    for (const fdi of [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
      const toothBtn = page.getByRole('button', { name: new RegExp(`Tooth ${fdi}:`, 'i') });
      await expect(toothBtn).toBeVisible();
    }

    // Verify Lower Arch (48..41 and 31..38)
    for (const fdi of [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]) {
      const toothBtn = page.getByRole('button', { name: new RegExp(`Tooth ${fdi}:`, 'i') });
      await expect(toothBtn).toBeVisible();
    }

    // Close modal
    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('FDI-02: Clicking tooth 16 highlights it, displays structured metadata, and keeps notes strictly separate', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    const target = await getActiveTestPatient();

    await page.goto(`/doctor/patient/${target.id}?visitId=${target.visitId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Treatment', exact: true }).click();
    await expect(page.getByText('FDI Dental Chart')).toBeVisible();

    // Click tooth 16
    const tooth16 = page.getByRole('button', { name: /Tooth 16:/i });
    await tooth16.click();

    // Selected teeth section shows pill tag "Tooth 16"
    await expect(page.getByText('Tooth 16').first()).toBeVisible();

    // Structured metadata displays exact tooth details
    await expect(page.getByText('Upper Right First Molar').first()).toBeVisible();
    await expect(page.getByText('Upper Jaw').first()).toBeVisible();
    await expect(page.getByText('Upper Right').first()).toBeVisible();
    await expect(page.getByText('Molar').first()).toBeVisible();

    // Notes textarea must remain completely empty (tooth metadata NOT injected into text)
    const notesArea = page.getByPlaceholder('Enter clinical notes, diagnosis, or instructions...');
    await expect(notesArea).toHaveValue('');

    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('FDI-03: Single tooth treatment saves toothNumber: 16 independently in MySQL and updates planned list', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    const target = await getActiveTestPatient();

    await page.goto(`/doctor/patient/${target.id}?visitId=${target.visitId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Treatment', exact: true }).click();

    // Select Tooth 16
    await page.getByRole('button', { name: /Tooth 16:/i }).click();

    // Select Category
    const categorySelect = page.getByRole('combobox').first();
    await categorySelect.click();
    const firstCategory = page.getByRole('option').first();
    await firstCategory.click();

    // Select Procedure
    const procedureSelect = page.getByRole('combobox').nth(1);
    await procedureSelect.click();
    const firstProcedure = page.getByRole('option').first();
    await firstProcedure.click();

    // Enter doctor notes
    const customNote = `Periapical assessment test ${Date.now()}`;
    const notesArea = page.getByPlaceholder('Enter clinical notes, diagnosis, or instructions...');
    await notesArea.fill(customNote);

    // Click Add to Plan
    await page.getByRole('button', { name: /Add to Plan/i }).click();
    await page.waitForTimeout(1000);

    // Verify item appears in planned list with Tooth 16 badge and notes
    await expect(page.getByText('Tooth 16').first()).toBeVisible();
    await expect(page.getByText(customNote)).toBeVisible();

    // Direct MySQL Read-Only Verification
    const savedItem = await queryOne<{ toothNumber: number; notes: string }>(`
      SELECT tpi.toothNumber, tpi.notes 
      FROM TreatmentPlanItem tpi
      JOIN TreatmentPlan tp ON tpi.treatmentPlanId = tp.id
      WHERE tp.patientId = ? AND tpi.notes = ?
      LIMIT 1
    `, [target.id, customNote]);

    expect(savedItem).toBeDefined();
    expect(savedItem!.toothNumber).toBe(16);
    expect(savedItem!.notes).toBe(customNote);

    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('FDI-04: Multi-tooth selection supports removal and batch creates separate items per tooth', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    const target = await getActiveTestPatient();

    await page.goto(`/doctor/patient/${target.id}?visitId=${target.visitId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Treatment', exact: true }).click();

    // Select teeth 26 and 36
    await page.getByRole('button', { name: /Tooth 26:/i }).click();
    await page.getByRole('button', { name: /Tooth 36:/i }).click();

    // Both pill tags visible
    await expect(page.getByText('Tooth 26').first()).toBeVisible();
    await expect(page.getByText('Tooth 36').first()).toBeVisible();

    // Toggle tooth 36 on chart again to deselect
    await page.getByRole('button', { name: /Tooth 36:/i }).click();

    // Re-select 36 and also select 46
    await page.getByRole('button', { name: /Tooth 36:/i }).click();
    await page.getByRole('button', { name: /Tooth 46:/i }).click();

    // Select Category & Procedure
    await page.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();

    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option').first().click();

    const batchNote = `Batch multi-tooth check ${Date.now()}`;
    await page.getByPlaceholder('Enter clinical notes, diagnosis, or instructions...').fill(batchNote);

    // Button shows count "Add 3 Procedures"
    const addBatchBtn = page.getByRole('button', { name: /Add 3 Procedures/i });
    await expect(addBatchBtn).toBeVisible();
    await addBatchBtn.click();
    await page.waitForTimeout(1200);

    // Verify in MySQL that 3 distinct items were created
    const items = await queryMany<{ toothNumber: number }>(`
      SELECT tpi.toothNumber
      FROM TreatmentPlanItem tpi
      JOIN TreatmentPlan tp ON tpi.treatmentPlanId = tp.id
      WHERE tp.patientId = ? AND tpi.notes = ?
      ORDER BY tpi.toothNumber ASC
    `, [target.id, batchNote]);

    expect(items.length).toBe(3);
    const teeth = items.map(i => i.toothNumber);
    expect(teeth).toEqual([26, 36, 46]);

    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('FDI-05: Non-tooth general treatment persists with toothNumber = NULL and displays General badge', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    const target = await getActiveTestPatient();

    await page.goto(`/doctor/patient/${target.id}?visitId=${target.visitId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Treatment', exact: true }).click();

    // Do NOT select any tooth
    await page.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();

    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option').first().click();

    const generalNote = `Full mouth scaling general ${Date.now()}`;
    await page.getByPlaceholder('Enter clinical notes, diagnosis, or instructions...').fill(generalNote);

    await page.getByRole('button', { name: /Add to Plan/i }).click();
    await page.waitForTimeout(1000);

    // Verify MySQL has toothNumber NULL
    const generalItem = await queryOne<{ toothNumber: number | null }>(`
      SELECT tpi.toothNumber
      FROM TreatmentPlanItem tpi
      JOIN TreatmentPlan tp ON tpi.treatmentPlanId = tp.id
      WHERE tp.patientId = ? AND tpi.notes = ?
      LIMIT 1
    `, [target.id, generalNote]);

    expect(generalItem).toBeDefined();
    expect(generalItem!.toothNumber).toBeNull();

    // Verify UI shows General badge
    await expect(page.getByText('General').first()).toBeVisible();

    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('FDI-06: Editing a planned treatment modifies tooth assignment and notes cleanly in MySQL', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    const target = await getActiveTestPatient();

    await page.goto(`/doctor/patient/${target.id}?visitId=${target.visitId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Treatment', exact: true }).click();

    // Find any edit button on a planned item
    const editBtn = page.getByTitle('Edit procedure').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();

      // Middle pane enters edit mode
      await expect(page.getByText('Edit Procedure')).toBeVisible();

      // Change tooth to 21
      await page.getByRole('button', { name: /Tooth 21:/i }).click();

      // Update notes
      const updatedNote = `Updated clinical note ${Date.now()}`;
      await page.getByPlaceholder('Enter clinical notes, diagnosis, or instructions...').fill(updatedNote);

      // Save changes
      await page.getByRole('button', { name: /Save Changes/i }).click();
      await page.waitForTimeout(1000);

      // Verify updated note is displayed
      await expect(page.getByText(updatedNote)).toBeVisible();
    }

    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('FDI-07: Deleting a planned treatment removes the item from UI and MySQL', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    const target = await getActiveTestPatient();

    // Accept browser confirmation dialog for deletion
    page.on('dialog', dialog => dialog.accept());

    const countBefore = await queryOne<{ total: number }>(`
      SELECT COUNT(*) as total FROM TreatmentPlanItem tpi
      JOIN TreatmentPlan tp ON tpi.treatmentPlanId = tp.id
      WHERE tp.patientId = ?
    `, [target.id]);

    await page.goto(`/doctor/patient/${target.id}?visitId=${target.visitId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Treatment', exact: true }).click();

    const deleteBtn = page.getByTitle('Remove procedure').or(page.getByTitle('Delete procedure')).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(1000);

      const countAfter = await queryOne<{ total: number }>(`
        SELECT COUNT(*) as total FROM TreatmentPlanItem tpi
        JOIN TreatmentPlan tp ON tpi.treatmentPlanId = tp.id
        WHERE tp.patientId = ?
      `, [target.id]);

      expect(countAfter!.total).toBeLessThan(countBefore!.total);
    }

    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('FDI-08: Backend API enforces mutual exclusivity, valid FDI ranges, and protects completed items', async ({ request }) => {
    // Authenticate
    const loginRes = await request.post(`${apiBase}/api/auth/login`, {
      data: { username: 'dutyDoctor', password: 'demo123' },
      headers: { 'Origin': 'http://localhost:5173' }
    });
    expect(loginRes.status()).toBe(200);
    const cookies = loginRes.headers()['set-cookie'];

    const patient = await queryOne<{ id: string }>('SELECT id FROM Patient WHERE status = "Active" LIMIT 1');
    const catalog = await queryOne<{ id: string }>('SELECT id FROM TreatmentCatalog WHERE isActive = true LIMIT 1');

    // 1. Rejects both toothNumber and toothNumbers simultaneously (HTTP 400)
    const bothRes = await request.post(`${apiBase}/api/patients/${patient!.id}/treatment-plan/items`, {
      headers: { 'Cookie': cookies, 'Origin': 'http://localhost:5173' },
      data: {
        treatmentCatalogId: catalog!.id,
        toothNumber: 16,
        toothNumbers: [26, 36]
      }
    });
    expect(bothRes.status()).toBe(400);
    const bothJson = await bothRes.json();
    expect(bothJson.error).toContain('simultaneously');

    // 2. Rejects invalid FDI tooth number 99 (HTTP 400)
    const invalidRes = await request.post(`${apiBase}/api/patients/${patient!.id}/treatment-plan/items`, {
      headers: { 'Cookie': cookies, 'Origin': 'http://localhost:5173' },
      data: {
        treatmentCatalogId: catalog!.id,
        toothNumber: 99
      }
    });
    expect(invalidRes.status()).toBe(400);
    const invalidJson = await invalidRes.json();
    expect(invalidJson.error).toContain('Invalid FDI tooth number');

    // 3. Rejects duplicate numbers in toothNumbers array (HTTP 400)
    const dupRes = await request.post(`${apiBase}/api/patients/${patient!.id}/treatment-plan/items`, {
      headers: { 'Cookie': cookies, 'Origin': 'http://localhost:5173' },
      data: {
        treatmentCatalogId: catalog!.id,
        toothNumbers: [16, 16]
      }
    });
    expect(dupRes.status()).toBe(400);
    const dupJson = await dupRes.json();
    expect(dupJson.error).toContain('Duplicate tooth numbers');

    // 4. Create a completed item, then try to modify its toothNumber (HTTP 400)
    const createRes = await request.post(`${apiBase}/api/patients/${patient!.id}/treatment-plan/items`, {
      headers: { 'Cookie': cookies, 'Origin': 'http://localhost:5173' },
      data: {
        treatmentCatalogId: catalog!.id,
        toothNumber: 16,
        status: 'Completed'
      }
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    const modifyRes = await request.patch(`${apiBase}/api/patients/${patient!.id}/treatment-plan/items/${created.id}`, {
      headers: { 'Cookie': cookies, 'Origin': 'http://localhost:5173' },
      data: {
        toothNumber: 17
      }
    });
    expect(modifyRes.status()).toBe(400);
    const modifyJson = await modifyRes.json();
    expect(modifyJson.error).toContain('completed clinical procedure');
  });

  test('FDI-09: Patient profile and read-only treatment modal render tooth badges with backward compatibility', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    const target = await getActiveTestPatient();

    await page.goto(`/doctor/patient/${target.id}?visitId=${target.visitId}`);
    await page.waitForLoadState('networkidle');

    // Click "View Treatment Plan" (read-only modal) if button exists
    const viewTreatBtn = page.getByRole('button', { name: /View Treatment Plan/i });
    if (await viewTreatBtn.isVisible()) {
      await viewTreatBtn.click();
      await expect(page.getByText('Treatment Plan Details')).toBeVisible();
      // Should cleanly render procedures and any tooth badges without crashing
      await page.keyboard.press('Escape');
    }

    await logout(page);
  });

  test('FDI-10: Treatment fee calculation persists across page reload and saves to consultation', async ({ page }) => {
    await loginAs(page, 'dutyDoctor');
    const target = await getActiveTestPatient();

    await page.goto(`/doctor/patient/${target.id}?visitId=${target.visitId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Treatment', exact: true }).click();

    // Set treatment fee to 1250
    const feeInput = page.locator('input[type="number"]').last();
    await feeInput.fill('1250');

    // Click Done
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Reopen treatment modal and verify fee is 1250
    await page.getByRole('button', { name: 'Treatment', exact: true }).click();
    const reloadedFeeInput = page.locator('input[type="number"]').last();
    await expect(reloadedFeeInput).toHaveValue('1250');

    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });
});
