const admin = require("firebase-admin");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
// Initialize default app
admin.initializeApp({
  projectId: "praxihub-app"
});

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
    // When there are no documents left, we are done
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}


async function wipe() {
  console.log("Starting wipe...");
  try {
     // wipe time_logs first
     console.log("Wiping time_logs (this requires collection group query)...");
     // wait, time_logs is subcollection, we need to iterate internships
     const internships = await db.collection("internships").get();
     for (const doc of internships.docs) {
         await deleteCollection(`internships/${doc.id}/time_logs`);
     }
     console.log("Wiping internships...");
     await deleteCollection("internships");
     console.log("Wipe completed.");
  } catch (e) {
     console.error(e);
  }
}

wipe();
