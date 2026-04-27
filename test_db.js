const admin = require("firebase-admin");

// Set FIREBASE_AUTH_EMULATOR_HOST to bypass auth
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

admin.initializeApp({
  projectId: "praxihub-app"
});

const db = admin.firestore();

async function run() {
    console.log("running...")
    try {
        const placementsRef = db.collection('placements');
        const placementsSnapshot = await placementsRef.limit(1).get();
        console.log(`Found ${placementsSnapshot.size} placements.`);
        if (placementsSnapshot.size > 0) {
            console.log(placementsSnapshot.docs[0].data());
        }
    } catch(err) {
        console.error(err);
    }
}
run();
