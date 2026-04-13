const admin = require("firebase-admin");

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

// Initialize default app
admin.initializeApp({
  projectId: "praxihub-app"
});

const auth = admin.auth();
const db = admin.firestore();

async function deleteUsers(nextPageToken) {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);

    const uids = [];
    listUsersResult.users.forEach((userRecord) => {
        // KEEP THE ADMIN ACCOUNT
        if (userRecord.email !== "admin@praxihub.cz" && userRecord.email !== "anet@praxihub.cz") {
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

async function wipe() {
  console.log("Starting Auth wipe...");
  try {
     await deleteUsers();
     console.log("Auth Wipe completed.");
  } catch (e) {
     console.error(e);
  }
}

wipe();
