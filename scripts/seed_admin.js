const admin = require("firebase-admin");


admin.initializeApp({
  projectId: "praxihub-app"
});

const auth = admin.auth();
const db = admin.firestore();

async function seedAdmin() {
  const email = "praxihub@gmail.com";
  let user;

  try {
    user = await auth.getUserByEmail(email);
    console.log("Admin user already exists in Auth");
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      user = await auth.createUser({
        email: email,
        emailVerified: true,
      });
      console.log("Admin user created in Auth");
    } else {
      throw e;
    }
  }

  await db.collection("users").doc(user.uid).set({
    email: email,
    role: "coordinator",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log("Admin user seeded in Firestore successfully.");
}

seedAdmin().catch(console.error);
