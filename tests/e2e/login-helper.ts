import { Page } from '@playwright/test';
import { auth } from './setup-firebase-admin';

export async function loginAs(page: Page, uid: string) {
  const customToken = await auth.createCustomToken(uid);

  // Use a route that is more robust than root if root is redirecting or empty
  await page.goto('/login');

  await page.waitForFunction(() => (window as any).firebaseAuth !== undefined, { timeout: 15000 });

  await page.evaluate(async (token) => {
    const signInWithCustomToken = (window as any).firebaseSignInWithCustomToken;
    await signInWithCustomToken((window as any).firebaseAuth, token);
  }, customToken);

  // Add a slight pause to allow auth state observers in the app to realize the user is logged in before navigating
  await page.waitForTimeout(1000);
}
