const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function runMigration() {
    console.log("Starting 'Big Bang' SSOT Migration...");

    let opsCount = 0;

    // Batch helper variables
    let batch = db.batch();
    let currentBatchCount = 0;

    const commitBatchIfNeeded = async () => {
        if (currentBatchCount === 500) {
            await batch.commit();
            batch = db.batch();
            currentBatchCount = 0;
        }
    };

    // 1. Normalize Users
    console.log("Normalizing Users...");
    const usersSnap = await db.collection('users').get();

    for (const doc of usersSnap.docs) {
        const data = doc.data();
        const updates = {};
        let needsUpdate = false;

        // Consolidate Names to displayName
        const finalName = data.displayName || data.name || [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email || null;
        if (finalName && (data.name !== undefined || data.firstName !== undefined || data.lastName !== undefined || !data.displayName)) {
            updates.displayName = finalName;
            updates.name = admin.firestore.FieldValue.delete();
            updates.firstName = admin.firestore.FieldValue.delete();
            updates.lastName = admin.firestore.FieldValue.delete();
            needsUpdate = true;
        }

        // Consolidate Major
        if (data.role?.toUpperCase() === 'STUDENT') {
            const finalMajor = data.major || data.studentMajor || null;
            if (data.studentMajor !== undefined || (data.major !== finalMajor)) {
                updates.major = finalMajor;
                updates.studentMajor = admin.firestore.FieldValue.delete();
                needsUpdate = true;
            }
        }

        // Standardize Role
        if (data.role && data.role !== data.role.toUpperCase()) {
            updates.role = data.role.toUpperCase();
            needsUpdate = true;
        }

        if (needsUpdate) {
            batch.update(doc.ref, updates);
            currentBatchCount++;
            opsCount++;
            await commitBatchIfNeeded();
        }
    }

    // 2. Normalize Placements
    console.log("Normalizing Placements...");
    const placementsSnap = await db.collection('placements').get();

    for (const doc of placementsSnap.docs) {
        const data = doc.data();
        const updates = {};
        let needsUpdate = false;

        // Strip denormalized user data
        const forbiddenFields = ['studentName', 'studentEmail', 'major', 'studentMajor'];
        forbiddenFields.forEach(field => {
            if (data[field] !== undefined) {
                updates[field] = admin.firestore.FieldValue.delete();
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            batch.update(doc.ref, updates);
            currentBatchCount++;
            opsCount++;
            await commitBatchIfNeeded();
        }
    }

    // Commit any remaining operations in the last batch
    if (currentBatchCount > 0) {
        await batch.commit();
    }

    if (opsCount > 0) {
         console.log(`Successfully committed ${opsCount} normalizations...`);
         console.log("Migration complete.");
    } else {
         console.log("No normalizations needed. Database is clean.");
    }
}

runMigration().catch(console.error);
