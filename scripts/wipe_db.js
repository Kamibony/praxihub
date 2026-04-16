const admin = require("firebase-admin");

// Set emulator hosts to avoid authentication issues during local testing
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

admin.initializeApp({
  projectId: "praxihub-app"
});

const db = admin.firestore();
// test
async function test() {
   const qs = await db.collection("placements").limit(1).get();
   console.log(qs.size);
}
test();
