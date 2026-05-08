const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

async function backfillClaims() {
  const db = admin.firestore();
  const auth = admin.auth();

  console.log("Starting custom claims backfill...");
  let processed = 0;
  let errors = 0;

  try {
    const usersSnapshot = await db.collection("users").get();
    for (const doc of usersSnapshot.docs) {
      const uid = doc.id;
      const role = doc.data().role;
      if (role) {
        try {
          await auth.setCustomUserClaims(uid, { role: role });
          processed++;
        } catch (authError) {
          if (authError.code !== "auth/user-not-found") errors++;
        }
      }
    }
    console.log(`Backfill complete. Processed: ${processed}, Errors: ${errors}`);
  } catch (err) {
    console.error("Error fetching users from Firestore:", err);
  }
}

backfillClaims().then(() => process.exit(0)).catch(console.error);
