const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

exports.sanitizeProductionDatabase = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data, context) => {
    // Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Musíte být přihlášeni."
      );
    }

    const db = admin.firestore();
    const auth = admin.auth();

    // Verify caller is coordinator or admin
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists) {
        throw new functions.https.HttpsError("permission-denied", "Uživatel nenalezen.");
    }
    const callerRole = callerDoc.data().role;
    if (callerRole !== "admin" && callerRole !== "coordinator") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Tuto akci může provést pouze administrátor."
      );
    }

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

    console.log("Starting DB Sanitization by admin:", context.auth.uid);

    let deletedAuthCount = 0;
    let deletedUsersCount = 0;

    async function deleteUsersBatch(nextPageToken) {
        const listUsersResult = await auth.listUsers(1000, nextPageToken);

        const uidsToDelete = [];
        listUsersResult.users.forEach((userRecord) => {
            // STRICT RULE: KEEP GMAIL ACCOUNTS
            if (userRecord.email && userRecord.email.toLowerCase().endsWith("@gmail.com")) {
                console.log(`Protecting admin account: ${userRecord.email}`);
            } else {
                uidsToDelete.push(userRecord.uid);
            }
        });

        // For each UID, delete from Firestore
        for (const uid of uidsToDelete) {
             // delete user doc
             try {
                await db.collection("users").doc(uid).delete();
                deletedUsersCount++;
             } catch(e) {
                console.error(`Error deleting user doc ${uid}`, e);
             }
        }

        if (uidsToDelete.length > 0) {
            await auth.deleteUsers(uidsToDelete);
            deletedAuthCount += uidsToDelete.length;
            console.log(`Deleted ${uidsToDelete.length} auth users in this batch`);
        }

        if (listUsersResult.pageToken) {
            await deleteUsersBatch(listUsersResult.pageToken);
        }
    }

    try {
        // 1. Delete all auth users EXCEPT @gmail.com
        await deleteUsersBatch();

        // 2. Clear institutions and organizations completely
        console.log("Wiping institutions and organizations collections...");
        await deleteCollection("institutions");
        await deleteCollection("organizations");

        // 3. Clear time_logs subcollections
        console.log("Wiping time_logs subcollections...");
        const placements = await db.collection("placements").get();
        for (const doc of placements.docs) {
            await deleteCollection(`placements/${doc.id}/time_logs`);
        }

        // 4. Clear placements collection
        console.log("Wiping placements collection...");
        await deleteCollection("placements");

        console.log(`Sanitization finished. Deleted Auth Users: ${deletedAuthCount}, Firestore Users: ${deletedUsersCount}`);
        return { success: true, deletedAuthCount, deletedUsersCount };
    } catch (e) {
        console.error("Sanitization error", e);
        throw new functions.https.HttpsError("internal", "Došlo k chybě při mazání databáze.", e.message);
    }
});
