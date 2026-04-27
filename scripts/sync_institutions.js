const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "praxihub-production",
    });
}
const db = admin.firestore();

const isDryRun = process.argv.includes("--dry-run");

async function syncInstitutions() {
    console.log(`Starting institutions sync...${isDryRun ? " (DRY RUN)" : ""}`);
    const placementsSnapshot = await db.collection("placements").get();

    const uniqueOrgs = {}; // orgId -> { orgData, placementRefs }

    console.log(`Found ${placementsSnapshot.docs.length} placements.`);

    for (const doc of placementsSnapshot.docs) {
        const data = doc.data();
        if (data.organizationId) {
            if (!uniqueOrgs[data.organizationId]) {
                uniqueOrgs[data.organizationId] = [];
            }
            uniqueOrgs[data.organizationId].push(doc.ref);
        }
    }

    const orgIds = Object.keys(uniqueOrgs);
    console.log(`Found ${orgIds.length} unique organizations linked in placements.`);

    for (const orgId of orgIds) {
        const orgDoc = await db.collection("organizations").doc(orgId).get();
        if (!orgDoc.exists) continue;

        const orgData = orgDoc.data();

        // Find if user already exists
        let instQ = db.collection("users").where("role", "==", "institution").where("displayName", "==", orgData.name).limit(1);
        let instSnapshot = await instQ.get();

        let instId;
        if (!instSnapshot.empty) {
            instId = instSnapshot.docs[0].id;
        } else {
            const newUserRef = db.collection("users").doc();
            instId = newUserRef.id;
            if (isDryRun) {
                console.log(`[DRY RUN] Would create institution user ${instId} for organization ${orgId}: ${orgData.name}`);
            } else {
                await newUserRef.set({
                    role: "institution",
                    displayName: orgData.name || "Neznámá instituce",
                    ico: orgData.ico || null,
                    status: "uninvited",
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Created institution user ${instId} for organization ${orgId}`);
            }
        }

        // Update placements
        for (const placementRef of uniqueOrgs[orgId]) {
            if (isDryRun) {
                console.log(`[DRY RUN] Would update placement ${placementRef.id} with institutionId ${instId}`);
            } else {
                await placementRef.update({
                    institutionId: instId
                });
                console.log(`Updated placement ${placementRef.id} with institutionId ${instId}`);
            }
        }
    }

    console.log("Sync complete.");
}

syncInstitutions().catch(console.error);
