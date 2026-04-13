import * as admin from 'firebase-admin';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-project',
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
