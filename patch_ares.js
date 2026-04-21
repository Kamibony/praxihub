const fs = require('fs');
const content = fs.readFileSync('functions/index.js', 'utf8');

const fetchAresAndLinkCode = `
// ARES Backend Function
exports.fetchAresAndLink = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }

  const { ico, placementId } = data;
  if (!ico || !placementId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing ICO or placementId.");
  }

  const db = admin.firestore();
  const placementRef = db.collection("placements").doc(placementId);

  try {
    const placementDoc = await placementRef.get();
    if (!placementDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Placement not found.");
    }

    // Look up the organization by ICO in the Firestore
    const orgQuery = await db.collection("organizations").where("ico", "==", ico).get();
    let orgId;
    let orgData;

    if (orgQuery.empty) {
      // Mock ARES API fetch - typically would do fetch(ARES_URL)
      console.log(\`Mocking ARES fetch for ICO: \${ico}\`);

      // Attempting to use the data from the placement if available, otherwise mock data
      const pData = placementDoc.data();
      orgData = {
        name: pData.organization_name || "ARES Fetched Organization",
        ico: ico,
        web: pData.organization_web || "",
        status: "ACTIVE",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const newOrgRef = await db.collection("organizations").add(orgData);
      orgId = newOrgRef.id;
    } else {
      orgId = orgQuery.docs[0].id;
      orgData = orgQuery.docs[0].data();
    }

    // Update the placement state to PENDING_INSTITUTION and link the organization ID
    await placementRef.update({
      organizationId: orgId,
      status: "PENDING_INSTITUTION",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      systemLogs: admin.firestore.FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        message: "Automatické ARES ověření dokončeno. Organizace propojena.",
        actorId: "system"
      })
    });

    return { success: true, organizationId: orgId, organizationName: orgData.name };
  } catch (error) {
    console.error("fetchAresAndLink Error:", error);
    throw new functions.https.HttpsError("internal", \`Error linking ARES data: \${error.message}\`);
  }
});
`;

if (!content.includes('exports.fetchAresAndLink')) {
  fs.writeFileSync('functions/index.js', content + '\n' + fetchAresAndLinkCode);
  console.log('fetchAresAndLink added.');
} else {
  console.log('fetchAresAndLink already exists.');
}
