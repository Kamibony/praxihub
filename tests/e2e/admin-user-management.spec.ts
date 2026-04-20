import { test, expect } from '@playwright/test';
import { loginAs } from './login-helper';
import { db } from '../../apps/web/lib/firebase';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

test.describe('Manual User Management & Impersonation', () => {

  test('Admin creates a user manually and impersonates them', async ({ page }) => {
    // 1. Admin login
    await loginAs(page, 'testadmin123', 'admin');
    await page.goto('/admin/users');

    // 2. Click "Nový uživatel"
    await page.getByRole('button', { name: 'Nový uživatel' }).click();

    // 3. Fill the form
    const randomEmail = `newuser-${Date.now()}@example.com`;
    await page.getByLabel('Jméno a příjmení').fill('Test New User');
    await page.getByLabel('E-mail').fill(randomEmail);
    await page.getByLabel('Role').selectOption('institution');

    // Handle alert and click create
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Vytvořit uživatele' }).click();

    // Wait for modal to close (or check if user appears in the list - which might need search)
    await expect(page.getByRole('dialog')).toBeHidden();

    // 4. Find the user in the table and impersonate
    await page.getByPlaceholder('Hledat podle jména nebo e-mailu...').fill(randomEmail);
    await page.getByText('Test New User').click(); // Opens slideover

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Přihlásit se jako tento uživatel' }).click();

    // Should be redirected and see impersonation banner
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText('Prohlížíte aplikaci jako Test New User')).toBeVisible({timeout: 10000});

    // 5. Cleanup - Stop impersonating
    await page.getByRole('button', { name: 'Ukončit' }).click();
    await expect(page.getByText('Správa uživatelů')).toBeVisible({timeout: 10000});
  });

});
