import { execSync } from 'child_process';
import { clearFirestore, clearAuth, seedAdminUser, seedStudentUser, seedMentorAndLog, seedClosedPlacementForCommission, seedPublicPortfolio } from './e2e/seed';

async function globalSetup() {
  console.log('Killing potential orphaned processes...');
  try {
    execSync('kill $(lsof -t -i :3000) 2>/dev/null || true');
    execSync('kill $(lsof -t -i :4000) 2>/dev/null || true');
    execSync('kill $(lsof -t -i :5001) 2>/dev/null || true');
    execSync('kill $(lsof -t -i :8080) 2>/dev/null || true');
    execSync('kill $(lsof -t -i :9099) 2>/dev/null || true');
    execSync('kill $(lsof -t -i :9199) 2>/dev/null || true');
  } catch (error) {
    // Ignore errors from kill commands
  }

  // Seeding requires emulators to be fully up.
  // Playwright's webServer ensures this if we use wait-on, or we can just run seed here
  // Note: Playwright's webServer ensures the port is reachable before running globalSetup!
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
