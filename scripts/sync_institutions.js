const admin = require("firebase-admin");

if (process.env.USE_EMULATOR) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
}

admin.initializeApp({
  projectId: "praxihub-app"
});

const db = admin.firestore();

async function syncInstitutions() {
    console.log("Starting institution synchronization...");

    try {
        // We'll run in batches if there are many placements
        const placementsSnapshot = await db.collection("placements").get();
        console.log(`Found ${placementsSnapshot.size} placements.`);

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        // In-memory cache to avoid redundant reads/writes
        // Key: original organization name/ICO, Value: new institution user UID
        const instMap = new Map();

        // 1. Process all existing institution users into our map first
        const instUsersSnapshot = await db.collection("users")
            .where("role", "==", "institution")
            .get();

        instUsersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.ico) instMap.set(data.ico, doc.id);
            if (data.displayName) instMap.set(data.displayName, doc.id);
            if (data.name) instMap.set(data.name, doc.id); // Check both just in case
        });
        console.log(`Loaded ${instMap.size} existing institutions into cache.`);

        // 2. We'll collect all distinct org strings from placements
        const orgStrings = new Set();
        const placements = [];
        placementsSnapshot.forEach(doc => {
            placements.push({ id: doc.id, data: doc.data() });
            const org = doc.data().organizationId; // Currently this stores the name or ID
            if (org) orgStrings.add(String(org).trim());
        });

        // 3. For each distinct org string, ensure an institution user exists
        for (const orgStr of orgStrings) {
            if (!orgStr) continue;

            if (instMap.has(orgStr)) {
                // Already exists
                continue;
            }

            // Determine if it's an ICO (mostly digits) or a name
            // Let's say if it contains mostly digits and length is around 8
            const isIco = /^\d{6,10}$/.test(orgStr.replace(/\s/g, ''));

            const newUserRef = db.collection("users").doc();
            const newInstData = {
                role: "institution",
                displayName: isIco ? `Organizace (IČO: ${orgStr})` : orgStr,
                status: "uninvited",
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (isIco) {
                newInstData.ico = orgStr.replace(/\s/g, '');
            } else {
                newInstData.name = orgStr; // Legacy field mapping
            }

            await newUserRef.set(newInstData);
            instMap.set(orgStr, newUserRef.id);
            createdCount++;
            console.log(`Created new institution: ${newInstData.displayName} -> ${newUserRef.id}`);
        }

        // 4. Update all placements to link to the proper user document via institutionId
        const batch = db.batch();
        let batchCount = 0;

        for (const placement of placements) {
            const { id, data } = placement;
            const orgStr = data.organizationId ? String(data.organizationId).trim() : null;

            if (!orgStr) {
                skippedCount++;
                continue;
            }

            const institutionId = instMap.get(orgStr);
            if (!institutionId) {
                console.warn(`Could not resolve institutionId for placement ${id} with orgStr: ${orgStr}`);
                skippedCount++;
                continue;
            }

            // Only update if it's actually changing / missing
            if (data.institutionId !== institutionId) {
                const placementRef = db.collection("placements").doc(id);
                batch.update(placementRef, { institutionId: institutionId });
                batchCount++;
                updatedCount++;
            } else {
                skippedCount++;
            }

            // Firestore batches max 500 operations
            if (batchCount >= 450) {
                await batch.commit();
                console.log(`Committed batch of ${batchCount} updates.`);
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
            console.log(`Committed final batch of ${batchCount} updates.`);
        }

        console.log("Migration complete!");
        console.log(`Created ${createdCount} new institution users.`);
        console.log(`Updated ${updatedCount} placements.`);
        console.log(`Skipped ${skippedCount} placements.`);

    } catch (err) {
        console.error("Migration failed:", err);
    }
}

syncInstitutions();
