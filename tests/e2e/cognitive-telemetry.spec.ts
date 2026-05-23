import { loginAs } from "./login-helper";
import { test, expect } from '@playwright/test';
import { db, auth } from './setup-firebase-admin';
import { clearFirestore, clearAuth } from './seed';

test.describe('Epic 3: Cognitive Telemetry', () => {
  test.beforeEach(async () => {
    await clearFirestore();
    await clearAuth();

    // Seed student user
    await auth.createUser({ uid: 'student-telemetry', email: 'student-telemetry@praxihub.cz' });
    await db.collection('users').doc('student-telemetry').set({
      role: 'student',
      major: 'UPV',
      researchConsent: true,
      email: 'student-telemetry@praxihub.cz',
      active_placement_id: 'placement-telemetry',
      createdAt: new Date().toISOString()
    });

    await db.collection('placements').doc('placement-telemetry').set({
      studentId: 'student-telemetry',
      status: 'EVALUATION',
      organization_name: 'Mock School',
      studentMajor: 'UPV',
      createdAt: new Date().toISOString()
    });
  });

  test('background telemetry logs anonymized draft', async ({ page }) => {
    await loginAs(page, 'student-telemetry');
    await page.goto('/student/dashboard');
    await page.waitForURL('**/student/dashboard', { timeout: 15000 });

    // Open Reflexe tab
    await page.click('button:has-text("Reflexe")');

    // Type a reflection draft
    const testDraft = 'This is a test reflection draft for telemetry.';
    await page.fill('textarea[placeholder="Zde napište nebo nadiktujte svou závěrečnou reflexi..."]', testDraft);

    // Wait for the debounce timer to trigger background logging
    await page.waitForTimeout(4000);

    // Assert that the draft was saved to research_telemetry
    const telemetrySnapshot = await db.collection('research_telemetry').get();
    expect(telemetrySnapshot.empty).toBeFalsy();

    let foundDraft = false;
    let isAnonymized = true;

    telemetrySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.textDraft === testDraft) {
        foundDraft = true;
        if (data.anonymousId === 'student-telemetry') {
          isAnonymized = false;
        }
      }
    });

    expect(foundDraft).toBeTruthy();
    expect(isAnonymized).toBeTruthy();
  });
});