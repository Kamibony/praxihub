import { loginAs } from "./login-helper";
import { test, expect } from '@playwright/test';
import { db, auth } from './setup-firebase-admin';
import { clearFirestore, clearAuth } from './seed';

test.describe('Epic 5: Admin Payroll Module', () => {
  test.beforeEach(async () => {
    await clearFirestore();
    await clearAuth();

    // Seed system_configs for payroll
    await db.collection("system_configs").doc("payroll_settings").set({
      rates: { UPV: 150, KPV: 200 }
    });

    // Seed admin user
    await auth.createUser({ uid: 'admin-payroll', email: 'admin-payroll@praxihub.cz' });
    await db.collection('users').doc('admin-payroll').set({
      role: 'admin',
      email: 'admin-payroll@praxihub.cz',
      createdAt: new Date().toISOString()
    });


    // Seed students for SSOT
    await db.collection('users').doc('student1').set({ role: 'STUDENT', major: 'UPV' });
    await db.collection('users').doc('student2').set({ role: 'STUDENT', major: 'KPV' });

    // Seed Placements and their time logs
    // Placement 1 (UPV)
    await db.collection('placements').doc('p-upv').set({
      studentId: 'student1',
      studentMajor: 'UPV',
      status: 'CLOSED',
      organization_name: 'Mock School',
      organization_ico: '1111',
      institutionId: 'org1'
    });
    await db.collection('placements').doc('p-upv').collection('time_logs').add({ hours: 10, status: 'approved', date: new Date().toISOString() });

    // Placement 2 (KPV)
    await db.collection('placements').doc('p-kpv').set({
      studentId: 'student2',
      studentMajor: 'KPV',
      status: 'EVALUATION',
      organization_name: 'Mock School',
      organization_ico: '1111',
      institutionId: 'org1'
    });
    await db.collection('placements').doc('p-kpv').collection('time_logs').add({ hours: 5, status: 'approved', date: new Date().toISOString() });

    // Unapproved logs shouldn't count
    await db.collection('placements').doc('p-upv').collection('time_logs').add({ hours: 100, status: 'pending', date: new Date().toISOString() });
  });

  test('admin views aggregated payroll calculations', async ({ page }) => {
    await loginAs(page, 'admin-payroll');
    await page.goto('/admin/payroll');
    await page.waitForURL('**/admin/payroll', { timeout: 15000 });

    // Verify header
    await expect(page.locator('h1', { hasText: 'Mzdový modul (Payroll)' })).toBeVisible();

    // Verify row for Mock School
    // Total should be: 10 hrs UPV * 150 = 1500 + 5 hrs KPV * 200 = 1000 => 2500 CZK
    const orgRow = page.locator('tr:has-text("Mock School")');
    await expect(orgRow).toBeVisible();
    await expect(orgRow.locator('td').nth(2)).toContainText('10 h'); // UPV Hours
    await expect(orgRow.locator('td').nth(3)).toContainText('5 h');  // KPV Hours
    await expect(orgRow.locator('td').nth(4)).toContainText('2 500 CZK'); // Payout

    // Check totals box
    await expect(page.locator('p', { hasText: '2 500 CZK' }).first()).toBeVisible();
  });
});