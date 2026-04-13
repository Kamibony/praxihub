import { test as baseTest, expect } from '@playwright/test';
import { clearFirestore, clearAuth, seedAdminUser, seedStudentUser, seedMentorAndLog } from './seed';

export const test = baseTest.extend({});

test.beforeEach(async ({ page }) => {
    // Log browser console output for default context if used
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    await clearFirestore();
    await clearAuth();

    await seedAdminUser();
    await seedStudentUser();
    await seedMentorAndLog();

    // Explicit pause to let emulators catch up with index writes
    await new Promise(r => setTimeout(r, 2000));
});

export { expect };
