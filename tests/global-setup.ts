import { execSync } from 'child_process';
import { clearFirestore, clearAuth, seedAdminUser, seedStudentUser, seedMentorAndLog, seedClosedPlacementForCommission, seedPublicPortfolio } from './e2e/seed';

async function globalSetup() {
  console.log('Cleaning up orphaned ports...');
  try {
    // Need to avoid killing our own processes (like the currently starting webServer from Playwright)
    // lsof might match Playwright itself depending on how it's executed. Wait-on might be enough, but let's clear out specific node/java processes if they are definitely orphans.
    // For now, let's keep it simple and just rely on Playwright's webServer configuration and wait-on. The previous aggressive kill command might have terminated the very server Playwright just spun up for the tests.
    // execSync('kill $(lsof -t -i:3000 -i:4000 -i:5000 -i:5001 -i:8080 -i:9099 -i:9150) 2>/dev/null || true');
  } catch (error) {
    // Ignore error if no processes found
  }

  console.log('Waiting for emulators and web app to be fully ready...');
  try {
    // Wait for all essential ports to be reachable. Playwright starts the webServer for us,
    // but the inner services like Auth (9099) might take an extra second to boot after 8080.
    execSync('npx wait-on tcp:127.0.0.1:3000 tcp:127.0.0.1:8080 tcp:127.0.0.1:9099 -t 60000');
  } catch (error) {
    console.error('Timeout waiting for required ports to open:', error);
    throw error;
  }

  // Seeding requires emulators to be fully up.
  console.log('Seeding database...');
  try {
      await clearFirestore();
      await clearAuth();
      await seedAdminUser();
      await seedStudentUser();
      await seedMentorAndLog();
      await seedClosedPlacementForCommission();
      await seedPublicPortfolio();
      console.log('Database seeded successfully.');
  } catch (error) {
      console.error('Failed to seed database:', error);
  }
}

export default globalSetup;
