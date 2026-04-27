const admin = require("firebase-admin");

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

admin.initializeApp({
  projectId: "praxihub-app"
});

const db = admin.firestore();

async function run() {
   const qs = await db.collection("placements").limit(5).get();
   qs.forEach(doc => console.log(doc.id, doc.data()));
}
run();
