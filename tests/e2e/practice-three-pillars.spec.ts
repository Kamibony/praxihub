import { loginAs } from "./login-helper";
import { test, expect } from '@playwright/test';
import { db, auth } from './setup-firebase-admin';
import { clearFirestore, clearAuth } from './seed';

test.describe('Epic 2: The 3-Pillar Practice UI', () => {
  test.beforeEach(async () => {
    await clearFirestore();
    await clearAuth();

    // Seed KRAU rules
    await db.collection("system_configs").doc("ai_krau_rules").set({
      id: "ai_krau_rules",
      title: "KRAU MŠMT Hodnotící Metodika",
      content: "Testovací obsah metodiky...",
      domains: ['Oblast 1: Obor a předmět', 'Oblast 2: Plánování výuky'],
      isCritical: true
    });

    // Seed student user
    await auth.createUser({ uid: 'student-3pillar', email: 'student-3pillar@praxihub.cz' });
    await db.collection('users').doc('student-3pillar').set({
      role: 'student',
      major: 'UPV',
      researchConsent: true,
      email: 'student-3pillar@praxihub.cz',
      active_placement_id: 'placement-3pillar',
      createdAt: new Date().toISOString()
    });

    await db.collection('placements').doc('placement-3pillar').set({
      studentId: 'student-3pillar',
      status: 'ACTIVE',
      organization_name: 'Mock School',
      studentMajor: 'UPV',
      createdAt: new Date().toISOString()
    });
  });

  test('student can interact with Náslechy, Výstupy and Reflexe tabs', async ({ page }) => {
    await loginAs(page, 'student-3pillar');
    await page.goto('/student/dashboard');
    await page.waitForURL('**/student/dashboard', { timeout: 15000 });

    // Pillar 1: Náslechy (Live Tracker)
    await expect(page.locator('button', { hasText: 'Náslechy' })).toBeVisible();
    await page.click('button:has-text("Náslechy")');
    await expect(page.locator('h3', { hasText: 'Evidence hodin a náslechy' })).toBeVisible();
    await page.fill('input[type="date"]', '2023-11-11');
    await page.fill('input[type="number"]', '1');
    await page.fill('textarea', 'Test log in Náslechy');
    await page.click('button:has-text("Přidat záznam")');
    await expect(page.locator('p', { hasText: 'Test log in Náslechy' })).toBeVisible();

    // Pillar 2: Výstupy
    await page.click('button:has-text("Výstupy")');
    await expect(page.locator('h3', { hasText: 'Kompetenční rámec (MŠMT KRAU)' })).toBeVisible();
    await expect(page.locator('text=KRAU MŠMT Hodnotící Metodika')).toBeVisible();

    const rubricTextarea = page.locator('textarea[placeholder="Důkazy a hodnocení studenta v této oblasti..."]').first();
    await rubricTextarea.fill('Skvělé plánování výuky.');
    // Debounce wait
    await page.waitForTimeout(2500);

    // Pillar 3: Reflexe
    await page.click('button:has-text("Reflexe")');
    await expect(page.locator('h3', { hasText: 'Závěrečná reflexe' })).toBeVisible();
    await page.fill('textarea[placeholder="Zde napište nebo nadiktujte svou závěrečnou reflexi..."]', 'Tato praxe byla velmi přínosná.');
    await expect(page.locator('button', { hasText: 'Odeslat k hodnocení AI' })).toBeEnabled();
  });
});
