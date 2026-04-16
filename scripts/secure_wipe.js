const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "praxihub-app"
});

const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage().bucket();

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
        // KEEP THE ADMIN ACCOUNT
        if (userRecord.email !== "admin@praxihub.cz" && userRecord.email !== "anet@praxihub.cz" && userRecord.email !== "praxihub@gmail.com") {
             uids.push(userRecord.uid);
        }
    });

    if (uids.length > 0) {
        await auth.deleteUsers(uids);
        console.log(`Successfully deleted ${uids.length} auth users`);
    }

    if (listUsersResult.pageToken) {
        await deleteUsers(listUsersResult.pageToken);
    }
}

async function emptyStorageFolder(folderName) {
    try {
        await storage.deleteFiles({ prefix: folderName });
        console.log(`Cleared storage folder: ${folderName}`);
    } catch (e) {
        console.log(`Could not clear ${folderName} (might be empty)`);
    }
}

async function wipe() {
  console.log("Starting Secure Cascading Wipe...");
  try {
     console.log("1. Wiping time_logs subcollections...");
     const placements = await db.collection("placements").get();
     for (const doc of placements.docs) {
         await deleteCollection(`placements/${doc.id}/time_logs`);
     }

     console.log("2. Wiping placements collection...");
     await deleteCollection("placements");

     console.log("3. Wiping Storage Artifacts...");
     await emptyStorageFolder("contracts/");
     await emptyStorageFolder("certificates/");

     console.log("4. Wiping Auth Users (except admins)...");
     await deleteUsers();

     console.log("Cascading Wipe completed successfully.");
  } catch (e) {
     console.error(e);
  }
}

wipe();
