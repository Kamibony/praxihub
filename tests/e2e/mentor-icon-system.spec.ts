import { test, expect } from './test-utils';
import { loginAs } from './login-helper';

test.describe('Scenario 3: Mentor Icon System', () => {
  test('Student adds time log, Mentor approves in real-time', async ({ browser }) => {
    test.setTimeout(60000);

    // Create separate browser contexts to simulate two different users
    const studentContext = await browser.newContext();
    const mentorContext = await browser.newContext();

    const studentPage = await studentContext.newPage();
    const mentorPage = await mentorContext.newPage();

    // 1. Log in Student
    // Ensure we handle console/page errors in contexts too for debugging
    studentPage.on('console', msg => console.log('STUDENT LOG:', msg.text()));
    studentPage.on('pageerror', err => console.log('STUDENT ERROR:', err.message));

    await loginAs(studentPage, 'student-log-123');
    await studentPage.goto('/student/dashboard');

    await expect(studentPage.getByText('Načítám data...')).not.toBeVisible({ timeout: 20000 });

    // We expect the student to see the "Nový záznam" section (add time log)
    // The seeded internship is in APPROVED state, which reveals time logs UI.
    const dateInput = studentPage.locator('input[type="date"]');
    await expect(dateInput).toBeVisible({ timeout: 15000 });

    // 2. Log in Mentor
    mentorPage.on('console', msg => console.log('MENTOR LOG:', msg.text()));
    mentorPage.on('pageerror', err => console.log('MENTOR ERROR:', err.message));

    await loginAs(mentorPage, 'mentor123');
    await mentorPage.goto('/mentor/dashboard');

    await expect(mentorPage.getByText('Načítám data...')).not.toBeVisible({ timeout: 20000 });
    await expect(mentorPage.getByRole('heading', { name: 'Mentor Hub' })).toBeVisible({ timeout: 15000 });

    // 3. Student Creates Time Log
    await dateInput.fill('2024-05-15');

    const hoursInput = studentPage.locator('input[type="number"]');
    await hoursInput.fill('4');

    const descriptionInput = studentPage.locator('textarea[placeholder="Co jste dělali?"]');
    await descriptionInput.fill('Test time log description for e2e test.');

    const addButton = studentPage.getByRole('button', { name: /Přidat záznam/i });
    await addButton.click();

    // Student UI should show it as pending
    await expect(studentPage.getByText('Test time log description for e2e test.').first()).toBeVisible();
    await expect(studentPage.getByText('Čeká na schválení').first()).toBeVisible();

    // 4. Mentor views and approves the time log
    // According to memory, pending time logs show directly on the Mentor Dashboard. Let's look for it.
    try {
        await expect(mentorPage.getByText('Test time log description for e2e test.').first()).toBeVisible({ timeout: 10000 });
    } catch (e) {
        console.log("Could not find the time log on Mentor Dashboard. Current text:");
        console.log(await mentorPage.evaluate(() => document.body.innerText));
        throw e;
    }

    // Click approve button
    // Wait for the specific approve button. The Mentor Dashboard has a specific UI for this. Let's look for the button containing text "Schválit"
    const approveButton = mentorPage.locator('button').filter({ hasText: 'Schválit' }).first();
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    // 5. Verify real-time updates
    // Mentor sees it as approved
    await expect(mentorPage.getByText('Schváleno').first()).toBeVisible();

    // Student sees it as approved (no refresh needed due to onSnapshot)
    await expect(studentPage.getByText('Schváleno').first()).toBeVisible();

    // Close contexts
    await studentContext.close();
    await mentorContext.close();
  });
});
