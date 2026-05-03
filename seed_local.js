const admin = require('firebase-admin');

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-project',
  });
}

const db = admin.firestore();

async function seed() {
  await db.collection('public_portfolios').doc('student123').set({
    displayName: 'Student 123',
    major: 'KPV',
    bio: 'Jsem motivovaný student KPV se zájmem o výuku.',
    skills: [
      { skill: 'Komunikace', level: 85 },
      { skill: 'Plánování výuky', level: 70 },
      { skill: 'Reflexe', level: 90 }
    ],
    completedPlacements: 2,
    totalHours: 120
  });
  console.log("Seeded");
}

seed();
