# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase3-features.spec.ts >> Phase 3 Features >> Public Portfolio route loads data
- Location: tests/e2e/phase3-features.spec.ts:7:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="portfolio-content"]') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - link "PraxiHub" [ref=e5] [cursor=pointer]:
        - /url: /
        - img [ref=e7]
        - generic [ref=e9]: PraxiHub
      - generic [ref=e10]:
        - link "Manuál" [ref=e11] [cursor=pointer]:
          - /url: /manual
          - img [ref=e12]
          - text: Manuál
        - link "Přihlásit se" [ref=e14] [cursor=pointer]:
          - /url: /login
          - img [ref=e15]
          - text: Přihlásit se
  - button "Potřebujete poradit?" [ref=e22] [cursor=pointer]:
    - generic: Potřebujete poradit?
    - img [ref=e23]
```

# Test source

```ts
  1  |
  2  | import { test, expect } from './test-utils';
  3  | import { loginAs } from './login-helper';
  4  |
  5  | test.describe('Phase 3 Features', () => {
  6  |
  7  |   test('Public Portfolio route loads data', async ({ page }) => {
  8  |      page.on('console', msg => console.log('PORTFOLIO CONSOLE:', msg.text()));
  9  |
  10 |      // First let's seed a public portfolio
  11 |      await page.route('**/updatePublicPortfolio', async route => {
  12 |          await route.fulfill({status: 200, body: JSON.stringify({data: {success:true}})})
  13 |      });
  14 |
  15 |      const { db } = require('./setup-firebase-admin');
  16 |      await db.collection('public_portfolios').doc('student123').set({
  17 |         displayName: 'Student Portfolio Test',
  18 |         major: 'KPV',
  19 |         totalHours: 120,
  20 |         completedPlacements: 1,
  21 |         skills: [{ skill: 'React', level: 80 }, { skill: 'TypeScript', level: 90 }]
  22 |      });
  23 |
  24 |      // UAT Unlock bypass specifically for this page since we are not going through login where it is set
  25 |      await page.addInitScript(() => {
  26 |         window.sessionStorage.setItem('uat_unlocked', 'true');
  27 |      });
  28 |
  29 |      await page.goto('/portfolio?id=student123');
  30 |
  31 |      // Explicitly wait for the container
> 32 |      await page.waitForSelector('[data-testid="portfolio-content"]', { timeout: 15000 });
     |                 ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  33 |
  34 |      await expect(page.getByText('Student Portfolio Test')).toBeVisible({timeout: 15000});
  35 |      await expect(page.getByText('120')).toBeVisible(); // hours
  36 |   });
  37 |
  38 |   test('QR Scanner button on Mentor dashboard', async ({ page }) => {
  39 |      await loginAs(page, 'mentor123');
  40 |      await page.goto('/institution/dashboard');
  41 |
  42 |      await expect(page.getByText('Načítám data...')).not.toBeVisible({ timeout: 20000 });
  43 |
  44 |      // Look for QR scanning button/text
  45 |      const scanButton = page.locator('button').filter({ hasText: /QR/i });
  46 |      await expect(scanButton).toBeVisible();
  47 |   });
  48 | });
  49 |
```