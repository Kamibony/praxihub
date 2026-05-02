import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'html',
  globalSetup: require.resolve('./tests/global-setup.ts'),
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npx firebase emulators:start --project demo-project --only firestore,auth,functions,storage',
      port: 8080,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd apps/web && NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-project NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=localhost:8080 ../../node_modules/.bin/next dev -p 3000',
      port: 3000,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    }
  ]
});
