const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

exports.getImpersonationToken = functions.https.onCall(async (data, context) => {
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

  const { targetUserId } = data;
  if (!targetUserId) {
    throw new functions.https.HttpsError("invalid-argument", "Chybí ID cílového uživatele.");
  }

  const targetDoc = await db.collection("users").doc(targetUserId).get();
  if (!targetDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Cílový uživatel nenalezen.");
  }

  const targetRole = targetDoc.data().role;
  if (targetRole === "admin" || targetRole === "coordinator") {
      throw new functions.https.HttpsError("permission-denied", "Nelze se přihlásit jako administrátor nebo koordinátor.");
  }

  if (!targetUserId) {
    throw new functions.https.HttpsError("invalid-argument", "Cílové ID (targetUserId) je prázdné nebo nedefinované.");
  }

  try {
    console.log(`Vytváření impersonation tokenu pro targetUserId: ${targetUserId}, volající callerUid: ${callerUid}`);
    const targetToken = await admin.auth().createCustomToken(targetUserId, { impersonatorUid: callerUid });
    return { targetToken };
  } catch (error) {
    console.error("Kritická chyba při vytváření custom tokenu pro impersonaci:", {
      error: error.message,
      targetUserId,
      callerUid,
      stack: error.stack
    });
    // Původní error message
    throw new functions.https.HttpsError("internal", `Nepodařilo se vygenerovat token pro UID ${targetUserId}. Zkontrolujte Service Account IAM role.`);
  }
});


exports.stopImpersonating = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Musíte být přihlášeni.");
    }

    // Verify that the current token actually has the impersonator claim
    const impersonatorUid = context.auth.token.impersonatorUid;
    if (!impersonatorUid) {
        throw new functions.https.HttpsError("permission-denied", "Nejste v režimu impersonace.");
    }

    try {
      // Issue a fresh token for the original admin to prevent 1h lockout
      const adminToken = await admin.auth().createCustomToken(impersonatorUid);
      return { returnToken: adminToken };
    } catch (error) {
      console.error("Chyba při návratu z impersonace:", error);
      throw new functions.https.HttpsError("internal", "Nepodařilo se vygenerovat návratový token.");
    }
});
