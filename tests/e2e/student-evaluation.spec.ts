
import { test, expect } from './test-utils';
import { loginAs } from './login-helper';

test.describe('Scenario 2: Student AI Evaluation', () => {
  test('Student logs in, types reflection, and submits for AI Evaluation', async ({ page }) => {
    test.setTimeout(60000);

    // Make sure we re-seed placement123 with EVALUATION state because maybe another test changed it
    const { db } = require('./setup-firebase-admin');

    // Ensure the date is in the future or present to be picked up properly if orderBy plays tricks
    const createdAtLog = new Date();
    createdAtLog.setHours(createdAtLog.getHours() + 1);

    await db.collection('users').doc('student123').update({
      active_placement_id: 'placement123'
    });

    await db.collection('placements').doc('placement123').set({
      studentId: 'student123',
      status: 'EVALUATION',
      organization_name: 'Mock Company s.r.o.',
      createdAt: createdAtLog.toISOString(),
      start_date: '2023-01-01',
      end_date: '2023-01-31',
      organization_ico: '12345678'
    });

    await loginAs(page, 'student123');
    await page.goto('/student/dashboard');

    await expect(page.getByText('Načítám data...')).not.toBeVisible({ timeout: 20000 });

    await expect(page.getByText('Závěrečná reflexe')).toBeVisible({ timeout: 15000 });

    const textarea = page.locator('textarea[placeholder="Zde napište svou reflexi..."]');
    await expect(textarea).toBeVisible();
    await textarea.fill('Toto je moje testovací závěrečná reflexe pro AI hodnocení.');

    await page.route('**/evaluateReflection', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            evaluation: {
              isPass: true,
              didacticCompetence: { score: 3, reasoning: 'Mocked feedback' },
              pedagogicalCompetence: { score: 3, reasoning: 'Mocked feedback' },
              socialCompetence: { score: 3, reasoning: 'Mocked feedback' },
              reflectiveCompetence: { score: 3, reasoning: 'Mocked feedback' }
            }
          }
        })
      });

      const { db } = require('./setup-firebase-admin');
      await db.collection('placements').doc('placement123').update({
         status: 'CLOSED',
         evaluationResult: {
            isPass: true,
            didacticCompetence: { score: 3, reasoning: 'Mocked feedback' },
            pedagogicalCompetence: { score: 3, reasoning: 'Mocked feedback' },
            socialCompetence: { score: 3, reasoning: 'Mocked feedback' },
            reflectiveCompetence: { score: 3, reasoning: 'Mocked feedback' }
         },
         certificateUrl: 'https://mock.com/certificate.pdf'
      });
    });

    let alertHandled = false;
    page.on('dialog', dialog => {
      alertHandled = true;
      dialog.accept();
    });

    const submitButton = page.getByRole('button', { name: /Odeslat k hodnocení AI/i });
    await submitButton.click();

    await expect(submitButton).not.toHaveText('Hodnocení...');
    expect(alertHandled).toBeTruthy();
    await expect(page.getByText('Zpětná vazba od AI Sensei')).toBeVisible({ timeout: 15000 });
  });
});
