const admin = require("firebase-admin");

if (process.env.USE_EMULATOR) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
}

admin.initializeApp({
  projectId: "praxihub-app"
});

const db = admin.firestore();

async function run() {
    const qs = await db.collection("placements").limit(3).get();
    qs.forEach(doc => console.log(doc.id, doc.data()));

    console.log("----");
    const os = await db.collection("organizations").limit(3).get();
    os.forEach(doc => console.log(doc.id, doc.data()));
}
run();
