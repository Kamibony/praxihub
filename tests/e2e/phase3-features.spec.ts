
import { test, expect } from './test-utils';
import { loginAs } from './login-helper';

test.describe('Phase 3 Features', () => {

  test('Public Portfolio route loads data', async ({ page }) => {
     page.on('console', msg => console.log('PORTFOLIO CONSOLE:', msg.text()));

     // First let's seed a public portfolio
     await page.route('**/updatePublicPortfolio', async route => {
         await route.fulfill({status: 200, body: JSON.stringify({data: {success:true}})})
     });

     const { db } = require('./setup-firebase-admin');
     await db.collection('public_portfolios').doc('student123').set({
        displayName: 'Student Portfolio Test',
        major: 'KPV',
        totalHours: 120,
        completedPlacements: 1,
        skills: [{ skill: 'React', level: 80 }, { skill: 'TypeScript', level: 90 }]
     });

     // UAT Unlock bypass specifically for this page since we are not going through login where it is set
     await page.addInitScript(() => {
        window.sessionStorage.setItem('uat_unlocked', 'true');
     });

     await page.goto('/portfolio?id=student123');

     // Explicitly wait for the container
     await page.waitForSelector('[data-testid="portfolio-content"]', { timeout: 15000 });

     await expect(page.getByText('Student Portfolio Test')).toBeVisible({timeout: 15000});
     await expect(page.getByText('120')).toBeVisible(); // hours
  });

  test('QR Scanner button on Mentor dashboard', async ({ page }) => {
     await loginAs(page, 'mentor123');
     await page.goto('/institution/dashboard');

     await expect(page.getByText('Načítám data...')).not.toBeVisible({ timeout: 20000 });

     // Look for QR scanning button/text
     const scanButton = page.locator('button').filter({ hasText: /QR/i });
     await expect(scanButton).toBeVisible();
  });
});
