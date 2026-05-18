import { test, expect } from '@playwright/test';

test.describe('QR Hub Verification', () => {
  test('should display verification loading state or error for invalid ID', async ({ page }) => {
    // Unlock UAT first
    await page.addInitScript(() => {
      window.sessionStorage.setItem('uat_unlocked', 'true');
    });

    // Go to verification page directly with a random ID
    await page.goto('/verify?id=test-invalid-id-123');

    // Wait for the loading spinner to disappear
    const spinner = page.locator('.animate-spin').first();
    await expect(spinner).not.toBeVisible({ timeout: 15000 });

    // Expect to eventually see an invalid record error
    await expect(page.getByText(/Neplatný|nenalezen/i).first()).toBeVisible({ timeout: 15000 });
  });
});
