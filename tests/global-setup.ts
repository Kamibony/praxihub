import { execSync } from 'child_process';
import { clearFirestore, clearAuth, seedAdminUser, seedStudentUser, seedMentorAndLog, seedClosedPlacementForCommission, seedPublicPortfolio } from './e2e/seed';

async function globalSetup() {
  console.log('Pre-flight: Checking for orphaned processes on critical ports...');
  const ports = [3000, 4000, 5000, 5001, 8080, 9099, 9150];
  for (const port of ports) {
    try {
      execSync(`kill $(lsof -t -i :${port}) 2>/dev/null || true`);
    } catch (e) {
      // Ignored
    }
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
