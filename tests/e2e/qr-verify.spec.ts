import { test, expect } from '@playwright/test';

test.describe('QR Hub Verification', () => {
  test('should display verification loading state or error for invalid ID', async ({ page }) => {
    // Go to verification page directly with a random ID
    await page.goto('/verify?id=test-invalid-id-123');

    // Expect to eventually see an invalid record error
    await expect(page.locator('text=Neplatný záznam')).toBeVisible();
    await expect(page.locator('text=Záznam nenalezen')).toBeVisible();
  });
});
