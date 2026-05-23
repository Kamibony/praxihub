
import { test, expect } from './test-utils';
import { loginAs } from './login-helper';

test.describe('Scenario 2: Student AI Evaluation', () => {
  test('Mission 1A: Student logs in, types reflection, and submits for AI Evaluation (UPV)', async ({ page }) => {
    test.setTimeout(60000);

    const { clearFirestore, clearAuth } = require('./seed');
    await clearFirestore();
    await clearAuth();

    // Make sure we re-seed placement123 with EVALUATION state because maybe another test changed it
    const { db } = require('./setup-firebase-admin');

    // Ensure the date is in the future or present to be picked up properly if orderBy plays tricks
    const createdAtLog = new Date();
    createdAtLog.setHours(createdAtLog.getHours() + 1);

    await require('./setup-firebase-admin').auth.createUser({ uid: 'student123', email: 'test@praxihub.cz' }).catch(() => {});
    await db.collection('users').doc('student123').set({ role: 'STUDENT', major: 'UPV', email: 'test@praxihub.cz',
      active_placement_id: 'placement123'
    });

    await db.collection('placements').doc('placement123').set({
      studentId: 'student123',
      status: 'EVALUATION',
      organization_name: 'Mock Company s.r.o.',
      createdAt: createdAtLog.toISOString(),
      start_date: '2023-01-01',
      end_date: '2023-01-31',
      organization_ico: '12345678',
      major: 'UPV',
      studentMajor: 'UPV'
    });

    await loginAs(page, 'student123');
    await page.goto('/student/dashboard');

    await expect(page.getByText('Načítám data...')).not.toBeVisible({ timeout: 20000 });

    await page.click('button:has-text("Reflexe")');
    await expect(page.getByText('Závěrečná reflexe').first()).toBeVisible({ timeout: 15000 });

    const textarea = page.locator('textarea[placeholder*="Zde napište"]').first();
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

    const submitButton = page.getByRole('button', { name: /Odeslat k hodnocení AI/i }).first();
    await submitButton.click();

    // Ensure we await the button reverting its state or component navigating/rendering
    await expect(submitButton).not.toHaveText('Hodnocení...', { timeout: 15000 });
    await expect(page.getByText(/Praxe úspěšně uzavřena/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Mission 1B (OV): Student logs in, types reflection, and submits for AI Evaluation (KPV)', async ({ page }) => {
    test.setTimeout(60000);

    const { clearFirestore, clearAuth } = require('./seed');
    await clearFirestore();
    await clearAuth();

    // Make sure we re-seed placement123 with EVALUATION state because maybe another test changed it
    const { db, auth } = require('./setup-firebase-admin');

    await auth.createUser({ uid: 'student-ov', email: 'student-ov@praxihub.cz' });
    await db.collection('users').doc('student-ov').set({
      role: 'student',
      researchConsent: true,
      email: 'student-ov@praxihub.cz',
      active_placement_id: 'placement-ov',
      createdAt: new Date().toISOString(),
      major: 'KPV'
    });

    // Ensure the date is in the future or present to be picked up properly if orderBy plays tricks
    const createdAtLog = new Date();
    createdAtLog.setHours(createdAtLog.getHours() + 1);

    await db.collection('placements').doc('placement-ov').set({
      studentId: 'student-ov',
      status: 'EVALUATION',
      organization_name: 'Mock Company s.r.o.',
      createdAt: createdAtLog.toISOString(),
      start_date: '2023-01-01',
      end_date: '2023-01-31',
      organization_ico: '12345678',
      major: 'KPV',
      studentMajor: 'KPV'
    });

    await loginAs(page, 'student-ov');
    await page.goto('/student/dashboard');

    await expect(page.getByText('Načítám data...')).not.toBeVisible({ timeout: 20000 });

    await page.click('button:has-text("Reflexe")');
    await expect(page.getByText('Závěrečná reflexe').first()).toBeVisible({ timeout: 15000 });

    const textarea = page.locator('textarea[placeholder*="Zde napište"]').first();
    await expect(textarea).toBeVisible();
    await textarea.fill('Toto je moje testovací závěrečná reflexe pro AI hodnocení pro Odborný Výcvik.');

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
      await db.collection('placements').doc('placement-ov').update({
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

    const submitButton = page.getByRole('button', { name: /Odeslat k hodnocení AI/i }).first();
    await submitButton.click();

    // Ensure we await the button reverting its state or component navigating/rendering
    await expect(submitButton).not.toHaveText('Hodnocení...', { timeout: 15000 });
    await expect(page.getByText(/Praxe úspěšně uzavřena/i).first()).toBeVisible({ timeout: 15000 });
  });
});
