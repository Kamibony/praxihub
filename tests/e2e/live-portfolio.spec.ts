import { test, expect } from './test-utils';

test.describe('Live E-Portfolio (Public Route)', () => {
  test('renders portfolio correctly for a mock student', async ({ page }) => {
    // We expect the student123 to have a public portfolio
    await page.goto('/p/student123');

    // Check if basic portfolio information is shown
    await expect(page.getByTestId('portfolio-content')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Student 123' })).toBeVisible();
    await expect(page.getByText('Dokončené stáže')).toBeVisible();
    await expect(page.getByText('2', { exact: true })).toBeVisible(); // completed placements
    await expect(page.getByText('120', { exact: true })).toBeVisible(); // total hours
    await expect(page.getByText('🎓 KPV')).toBeVisible();
    await expect(page.getByText('Jsem motivovaný student KPV se zájmem o výuku.')).toBeVisible();
  });

  test('shows access denied or not found for unknown student', async ({ page }) => {
    await page.goto('/p/unknown-student-123');
    await expect(page.getByText('Přístup odepřen')).toBeVisible();
    await expect(page.getByText('Portfolio nebylo nalezeno.')).toBeVisible();
  });
});
