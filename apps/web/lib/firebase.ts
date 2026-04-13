// apps/web/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions"; // Pridané

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Health Check: Verify if the config is loaded correctly
if (!firebaseConfig.apiKey) {
  console.error("🚨 CRITICAL ERROR: Firebase Config is missing! Check your .env.local file.");
  console.error("Current Config State:", JSON.stringify(firebaseConfig, null, 2));
} else {
  console.log("✅ Firebase Config loaded successfully.");
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

import { connectAuthEmulator, signInWithCustomToken } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { connectStorageEmulator } from "firebase/storage";
import { connectFunctionsEmulator } from "firebase/functions";

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1"); // Export functions

// Connect to Emulators if configured
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  console.log("🔌 Connected to Firebase Local Emulators");
}

if (typeof window !== 'undefined') {
  (window as any).firebaseAuth = auth;
  (window as any).firebaseSignInWithCustomToken = signInWithCustomToken;
}

export default app;
