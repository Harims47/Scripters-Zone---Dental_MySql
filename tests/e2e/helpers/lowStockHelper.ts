import { Page, expect } from '@playwright/test';

/**
 * Reusable helper to safely dismiss the Low Stock Alert modal if it is currently visible.
 * 
 * Rules:
 * - Detects whether the Low Stock Alert modal is currently open.
 * - Dismisses via "Remind in 1 hr" or "Dismiss All" or "Close".
 * - Never fails if the modal is NOT visible.
 * - Does NOT alter application behavior.
 * - Uses visible UI interaction.
 */
export async function dismissLowStockAlertIfPresent(page: Page, timeoutMs = 4000): Promise<boolean> {
  try {
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Low Stock Alert/i });
    
    // Wait for the dialog to appear if it's currently mounting/fetching
    await dialog.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => {});
    
    if (!(await dialog.isVisible().catch(() => false))) {
      return false;
    }

    // Try "Dismiss All", "Remind in 1 hr", or "Close" button
    const dismissAllBtn = dialog.getByRole('button', { name: /Dismiss All/i });
    if (await dismissAllBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dismissAllBtn.click();
      await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      return true;
    }

    const remindBtn = dialog.getByRole('button', { name: /Remind in 1 hr/i });
    if (await remindBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await remindBtn.click();
      await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      return true;
    }

    const closeBtn = dialog.getByRole('button', { name: /Close/i });
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
      await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
}


