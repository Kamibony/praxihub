const admin = require("firebase-admin");

// Use emulator by default for safety
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

admin.initializeApp({
  projectId: "demo-project"
});

const auth = admin.auth();
const db = admin.firestore();

async function deleteCollection(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(100);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function deleteUsers(nextPageToken) {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);

    const uids = [];
    listUsersResult.users.forEach((userRecord) => {
        uids.push(userRecord.uid);
    });

    if (uids.length > 0) {
        await auth.deleteUsers(uids);
        console.log(`Successfully deleted ${uids.length} auth users`);
    }

    if (listUsersResult.pageToken) {
        await deleteUsers(listUsersResult.pageToken);
    }
}

async function wipe() {
  console.log("Starting Hard Reset Wipe...");
  try {
     console.log("1. Wiping time_logs subcollections...");
     const placements = await db.collection("placements").get();
     for (const doc of placements.docs) {
         await deleteCollection(`placements/${doc.id}/time_logs`);
     }

     console.log("2. Wiping placements collection...");
     await deleteCollection("placements");

     console.log("3. Wiping users collection...");
     await deleteCollection("users");

     console.log("4. Wiping organizations collection...");
     await deleteCollection("organizations");

     console.log("5. Wiping audit_logs collection...");
     await deleteCollection("audit_logs");

     console.log("6. Wiping system_configs collection...");
     await deleteCollection("system_configs");

     console.log("7. Wiping Auth Users...");
     await deleteUsers();

     console.log("Hard Reset completed successfully.");
  } catch (e) {
     console.error(e);
  }
}

wipe();
