import { test, expect } from './test-utils';
import { loginAs } from './login-helper';

test.describe('Phase 2: Commission State Transitions & PDF/Bonus', () => {
  test('Admin promotes CLOSED placement to FINAL_EXAM and views commission', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Log in as Admin
    await loginAs(page, 'admin123');
    await page.goto('/admin/dashboard');

    // Wait for the page to load
    await expect(page.getByText('Načítám data...')).not.toBeVisible({ timeout: 20000 });

    // 2. Go to Commissions tab
    const commisionsTab = page.getByRole('button', { name: 'Komise / Commissions' });
    await expect(commisionsTab).toBeVisible();
    await commisionsTab.click();

    // 3. Find the CLOSED placement and promote it
    const promoteButton = page.getByRole('button', { name: 'Posunout do FINAL_EXAM' }).first();
    await expect(promoteButton).toBeVisible({ timeout: 15000 });

    // Mock the alert and function call
    page.on('dialog', dialog => dialog.accept());

    // Mock transitionPlacementState cloud function
    await page.route('**/transitionPlacementState', async route => {
      const { db } = require('./setup-firebase-admin');
      await db.collection('placements').doc('placement-closed').update({
         status: 'FINAL_EXAM'
      });
      await db.collection('commissions').doc('comm123').set({
        placementId: 'placement-closed',
        status: 'PENDING_DECREE',
        studentName: 'Test Student',
        major: 'KPV',
        createdAt: new Date().toISOString()
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { success: true } })
      });
    });

    await promoteButton.click();

    // 4. Verify it moved to the active commissions section
    // Wait for the UI to update with the new commission (mocked above)
    await expect(page.getByText('ID Praxe: placement-closed').first()).toBeVisible({ timeout: 10000 });
    const generateDecreeButton = page.getByRole('button', { name: 'Generovat dekret' }).first();
    await expect(generateDecreeButton).toBeVisible();
  });
});
