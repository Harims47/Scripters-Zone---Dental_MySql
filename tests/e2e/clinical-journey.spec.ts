import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { dismissLowStockAlertIfPresent } from './helpers/lowStockHelper';

test.describe('Clinical Journey', () => {

  const testPatientName = `PW_TestPatient_${Date.now()}`;
  const testPhone = `9${Math.floor(Math.random() * 1000000000)}`;

  test('Complete end-to-end clinical workflow', async ({ page }) => {
    test.setTimeout(60000);
    
    // ==========================================
    // PART A - RECEPTIONIST LOGIN & CREATE PATIENT
    // ==========================================
    await loginAs(page, 'receptionist');
    await dismissLowStockAlertIfPresent(page);

    // Register a new walk-in visit using Reception Desk
    await page.getByRole('button', { name: 'Register Patient' }).first().click();
    await page.getByRole('button', { name: 'New Patient' }).click();

    await page.locator('input[placeholder="Enter patient name"]').fill(testPatientName);
    await page.locator('input[placeholder="10-digit mobile number"]').fill(testPhone);
    await page.locator('input[placeholder="e.g. 30"]').fill('45');
    await page.getByRole('button', { name: 'Register Patient' }).last().click();

    // Accept Registration Complete Dialog
    const regModal = page.getByRole('dialog').filter({ hasText: /Registration Complete|Registration Successful/i });
    await expect(regModal).toBeVisible();
    await regModal.getByRole('button', { name: 'OK' }).click();
    await expect(regModal).toBeHidden();

    // Assign to an available doctor from Reception Desk
    const receptionRow = page.locator('tr').filter({ hasText: testPatientName });
    await expect(receptionRow).toBeVisible();
    const sendBtn = receptionRow.getByTitle('Send to Doctor');
    await sendBtn.waitFor({ state: 'visible' });
    await sendBtn.click();
    
    const sendDialog = page.getByRole('dialog').filter({ hasText: 'Send to Doctor' });
    await expect(sendDialog).toBeVisible();
    
    // Find Dr. QA Duty Doctor's doctor card specifically
    const docCard = sendDialog.locator('div.flex').filter({ hasText: 'Dr. QA Duty Doctor' });
    const sendButton = docCard.getByRole('button', { name: 'Send' });
    await expect(sendButton).toBeVisible();
    await sendButton.click();
    
    const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Confirm Assignment' });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Confirm Assignment' }).click();
    
    // ==========================================
    // PART D - QUEUE (RECEPTIONIST CALLS / VIEWS PATIENT)
    // ==========================================
    await page.goto('/queue');
    await dismissLowStockAlertIfPresent(page);
    await page.getByPlaceholder('Search patient, ID or reason...').fill(testPatientName);
    const queueRow = page.locator('tr', { hasText: testPatientName });
    await expect(queueRow).toBeVisible();
    await expect(queueRow).toContainText(/Waiting|In Progress/i);
    
    await logout(page);

    // ==========================================
    // PART E - DOCTOR HANDOFF
    // ==========================================
    // Log in as dutyDoctor (Dr. Priya Sharma) to see and consult assigned patient in queue
    await loginAs(page, 'dutyDoctor');
    await dismissLowStockAlertIfPresent(page);
    await page.goto('/queue');
    await page.getByPlaceholder('Search patient, ID or reason...').fill(testPatientName);
    const doctorQueueRow = page.locator('tr', { hasText: testPatientName });
    await expect(doctorQueueRow).toBeVisible();

    // Start consulting
    await doctorQueueRow.getByRole('button', { name: /Consulting|Start/i }).click();
    await page.waitForURL('**/doctor/patient/*');
    await expect(page.getByText(testPatientName).first()).toBeVisible();

    // ==========================================
    // PART F & G - CONSULTATION & PRESCRIPTION
    // ==========================================
    // 1. Add Consultation
    await page.getByRole('button', { name: 'Consultation', exact: true }).click();
    await page.getByPlaceholder('Enter clinical observations, diagnoses, patient symptoms, or select from the tags above...').fill('Patient reports moderate toothache. Advised hygiene and analgesics.');
    await page.getByRole('button', { name: 'Save Consultation' }).click();

    // 2. Add Prescription
    await page.getByRole('button', { name: 'Prescription', exact: true }).click();
    const rxDialog = page.getByRole('dialog').filter({ hasText: 'Prescription' });
    await expect(rxDialog).toBeVisible();
    const addMedBtn = rxDialog.getByRole('button', { name: 'Add', exact: true }).first();
    await addMedBtn.click();
    const saveRxBtn = rxDialog.getByRole('button', { name: /Save Prescription/i });
    await expect(saveRxBtn).toBeEnabled();
    await saveRxBtn.click();

    // 3. Complete Consultation
    await page.getByRole('button', { name: 'Complete Consultation' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Complete Consultation' }).click();
    await page.waitForURL('**/queue');

    // Log out doctor
    await logout(page);

    // ==========================================
    // PART H, I, J - RECEPTION CHECKOUT, DISPENSING, PAYMENT
    // ==========================================
    await loginAs(page, 'receptionist');
    await dismissLowStockAlertIfPresent(page);
    await page.goto('/reception-desk');

    const checkoutRow = page.locator('tr').filter({ hasText: testPatientName });
    await expect(checkoutRow).toBeVisible();

    // Click checkout & billing button (CreditCard icon)
    await checkoutRow.getByTitle(/Checkout & Billing/i).click();

    // Dispensing Section
    await expect(page.getByRole('heading', { name: '1. Medicines' })).toBeVisible();
    await page.getByRole('button', { name: 'Complete Dispensing' }).click();
    await expect(page.getByText('Medicines Processed')).toBeVisible();

    // Payment Section
    await expect(page.getByRole('heading', { name: '2. Payment' })).toBeVisible();
    const payInput = page.getByPlaceholder(/Max ₹/i);
    const placeholder = await payInput.getAttribute('placeholder');
    const fullAmount = placeholder?.replace(/[^0-9.]/g, '') || '500';
    await payInput.fill(fullAmount);
    await page.getByText('Cash', { exact: true }).click();
    await page.getByRole('button', { name: 'Add Payment' }).click();

    // Confirm Payment modal
    await expect(page.getByRole('heading', { name: 'Confirm Payment' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes, Record Payment' }).click();
    await expect(page.getByText('Payment Completed')).toBeVisible();

    // Close Process Visit drawer
    await page.getByRole('button', { name: 'Done' }).click();

    // ==========================================
    // PART K - PATIENT HISTORY
    // ==========================================
    await page.goto('/patients');
    await dismissLowStockAlertIfPresent(page);

    const patientRow = page.locator('tr', { hasText: testPatientName });
    await expect(patientRow).toBeVisible();
    await patientRow.getByRole('button', { name: 'View patient history' }).click();

    // Verify patient history modal is visible and shows COMPLETED visit
    await expect(page.getByRole('heading', { name: testPatientName })).toBeVisible();
    await expect(page.getByText('COMPLETED').first()).toBeVisible();
  });
});
