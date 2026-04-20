const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

exports.createUserManually = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Musíte být přihlášeni.");
  }

  const callerUid = context.auth.uid;
  const db = admin.firestore();

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Uživatel nenalezen.");
  }

  const callerRole = callerDoc.data().role;
  if (callerRole !== "admin" && callerRole !== "coordinator") {
    throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění k této akci.");
  }

  const { name, email, role, universityId } = data;

  if (!email || !role || !name) {
    throw new functions.https.HttpsError("invalid-argument", "Chybí povinné parametry (jméno, e-mail, role).");
  }

  try {
    // Check if user with this email already exists in auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create user in Auth
        userRecord = await admin.auth().createUser({
          email: email,
          displayName: name,
        });
      } else {
        throw error;
      }
    }

    // Check if user already exists in Firestore
    const userRef = db.collection("users").doc(userRecord.uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
        throw new functions.https.HttpsError("already-exists", "Uživatel s tímto e-mailem již v databázi existuje.");
    }

    // Provision the user in Firestore with default structural requirements
    const userData = {
      id: userRecord.uid,
      name: name,
      email: email,
      role: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      researchConsent: false // default, they need to accept it
    };

    if (universityId) {
        userData.universityId = universityId;
    }

    if (role === 'student') {
        userData.major = null;
        userData.year = null;
        userData.recommendedMatches = [];
    } else if (role === 'institution') {
        userData.frameworkAgreementExpiration = null;
    }

    await userRef.set(userData);

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error("Chyba při vytváření uživatele:", error);
    if (error instanceof functions.https.HttpsError) {
        throw error;
    }
    throw new functions.https.HttpsError("internal", "Nepodařilo se vytvořit uživatele.", error.message);
  }
});
