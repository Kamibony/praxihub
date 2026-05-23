import { loginAs } from "./login-helper";
import { test, expect } from '@playwright/test';
import { db, auth } from './setup-firebase-admin';
import { clearFirestore, clearAuth } from './seed';

test.describe('Epic 1: Complex Methodology & Hours Tracking', () => {
  test.beforeEach(async () => {
    await clearFirestore();
    await clearAuth();
  });

  test('UPV student sees correct major-specific categories', async ({ page }) => {
    // Seed UPV student
    await auth.createUser({ uid: 'student-upv', email: 'student-upv@praxihub.cz' });
    await db.collection('users').doc('student-upv').set({
      role: 'student',
      major: 'UPV',
      researchConsent: true,
      email: 'student-upv@praxihub.cz',
      active_placement_id: 'placement-upv',
      createdAt: new Date().toISOString()
    });

    await db.collection('placements').doc('placement-upv').set({
      studentId: 'student-upv',
      status: 'ACTIVE',
      organization_name: 'Mock School',
      studentMajor: 'UPV',
      createdAt: new Date().toISOString()
    });

    // Mock login bypassing magic link
    await loginAs(page, 'student-upv');
    await page.goto('/student/dashboard');
    await page.waitForURL('**/student/dashboard', { timeout: 15000 });

    // Verify categories rendered
    await expect(page.locator('p', { hasText: 'Teoretické náslechy' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'Praktické náslechy' })).toBeVisible();

    // Add a time log
    await page.fill('input[type="date"]', '2023-10-10');
    await page.fill('input[type="number"]', '2');
    await page.selectOption('select', { value: 'theoretical_observations' });
    await page.fill('textarea', 'Test observation');
    await page.click('button:has-text("Přidat záznam")');

    // Wait for the new log to appear
    await expect(page.locator('p', { hasText: 'Test observation' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'Teoretické náslechy' }).nth(1)).toBeVisible();
  });

  test('KPV student sees correct major-specific categories', async ({ page }) => {
    // Seed KPV student
    await auth.createUser({ uid: 'student-kpv', email: 'student-kpv@praxihub.cz' });
    await db.collection('users').doc('student-kpv').set({
      role: 'student',
      major: 'KPV',
      researchConsent: true,
      email: 'student-kpv@praxihub.cz',
      active_placement_id: 'placement-kpv',
      createdAt: new Date().toISOString()
    });

    await db.collection('placements').doc('placement-kpv').set({
      studentId: 'student-kpv',
      status: 'ACTIVE',
      organization_name: 'Mock Clinic',
      studentMajor: 'KPV',
      createdAt: new Date().toISOString()
    });

    // Mock login bypassing magic link
    await loginAs(page, 'student-kpv');
    await page.goto('/student/dashboard');
    await page.waitForURL('**/student/dashboard', { timeout: 15000 });

    // Verify categories rendered
    await expect(page.locator('p', { hasText: 'Stínování' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'Případové studie' })).toBeVisible();

    // Add a time log
    await page.fill('input[type="date"]', '2023-10-11');
    await page.fill('input[type="number"]', '3');
    await page.selectOption('select', { value: 'case_studies' });
    await page.fill('textarea', 'Test case study');
    await page.click('button:has-text("Přidat záznam")');

    // Wait for the new log to appear
    await expect(page.locator('p', { hasText: 'Test case study' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'Případové studie' }).nth(1)).toBeVisible();
  });
});
