import { test, expect } from '@playwright/test';
import { loginAs } from './login-helper';

test.describe('Smart AI Matchmaking', () => {
  test.skip('should display matchmaking UI for students', async ({ page }) => {
    // Navigate to student dashboard (mocked login)
    await loginAs(page, 'student123');
    await page.goto('/student/dashboard');

    // Check if the ✨ AI Matchmaking button exists in the dashboard teaser
    await expect(page.locator('text=✨')).toBeVisible();

    // Navigate to matchmaking page
    await page.goto('/student/matchmaking');

    // Verify the page loaded
    await expect(page.locator('text=AI Matchmaking')).toBeVisible();
    await expect(page.locator('text=Hledáme pro tebe ideální firmu')).toBeVisible();
  });
});
