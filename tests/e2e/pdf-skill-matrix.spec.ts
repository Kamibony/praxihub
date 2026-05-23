import { loginAs } from "./login-helper";
import { test, expect } from '@playwright/test';
import { db, auth } from './setup-firebase-admin';
import { clearFirestore, clearAuth } from './seed';

test.describe('Epic 4: PDF Skill Matrix', () => {
  test.beforeEach(async () => {
    await clearFirestore();
    await clearAuth();

    // Seed student user
    await auth.createUser({ uid: 'student-pdf', email: 'student-pdf@praxihub.cz' });
    await db.collection('users').doc('student-pdf').set({
      role: 'student',
      major: 'UPV',
      researchConsent: true,
      email: 'student-pdf@praxihub.cz',
      active_placement_id: 'placement-pdf',
      createdAt: new Date().toISOString()
    });

    await db.collection('placements').doc('placement-pdf').set({
      studentId: 'student-pdf',
      status: 'CLOSED', // Ensure it's CLOSED to show the Matrix button
      organization_name: 'Mock School',
      studentMajor: 'UPV',
      createdAt: new Date().toISOString(),
      evaluationResult: {
        isPass: true,
        didacticCompetence: { score: 90, reasoning: 'Excellent' },
        pedagogicalCompetence: { score: 85, reasoning: 'Great' },
        socialCompetence: { score: 80, reasoning: 'Good' },
        reflectiveCompetence: { score: 95, reasoning: 'Perfect' }
      }
    });
  });

  test('student can generate and download KRAU Matrix', async ({ page }) => {
    await loginAs(page, 'student-pdf');
    await page.goto('/student/dashboard');
    await page.waitForURL('**/student/dashboard', { timeout: 15000 });

    // Open Reflexe tab (which contains the CLOSED state evaluation results and matrix button)
    await page.click('button:has-text("Reflexe")');

    // Wait for the button
    const generateBtn = page.locator('button:has-text("Generovat KRAU Matrix")');
    await expect(generateBtn).toBeVisible();

    // Setup a mock for the cloud function response using Playwright's route interception
    await page.route('**/generateSkillMatrixPDF', async (route) => {
      const json = {
        result: {
          success: true,
          url: 'https://mock.storage.googleapis.com/test.pdf'
        }
      };
      await route.fulfill({ json });
    });

    // Handle the javascript alert explicitly
    page.once('dialog', dialog => dialog.accept());

    // Click it
    await generateBtn.click();

    // Verify UI swaps to download link after successful return
    const downloadLink = page.locator('a:has-text("Stáhnout KRAU Matrix")');
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute('href', 'https://mock.storage.googleapis.com/test.pdf');
  });
});