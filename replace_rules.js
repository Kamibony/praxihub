const fs = require('fs');

const file = 'functions/index.js';
let data = fs.readFileSync(file, 'utf8');

const newFunction = `
// --- 9. UPDATE SYSTEM CONFIG ---
exports.updateSystemConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Musíte být přihlášeni.");
  }

  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists || (userDoc.data().role !== 'admin' && userDoc.data().role !== 'coordinator')) {
    throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění.");
  }

  const { docId, content, title, isCritical } = data;

  if (!docId || !content) {
    throw new functions.https.HttpsError("invalid-argument", "Chybí povinné parametry.");
  }

  try {
    await admin.firestore().collection('system_configs').doc(docId).set({
      id: docId,
      title: title || docId,
      content: content,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid,
      isCritical: isCritical || false
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error("Error updating config:", error);
    throw new functions.https.HttpsError("internal", "Nepodařilo se uložit konfiguraci.", error.message);
  }
});
`;

data += newFunction;
fs.writeFileSync(file, data);
console.log("Added updateSystemConfig");
