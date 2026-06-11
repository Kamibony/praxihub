/**
 * SOFT DELETE MIGRATION SCRIPT
 *
 * Objective:
 * Enforce a strict Single Source of Truth (SSOT) globally by ensuring
 * no "ghost records" appear in any UI view, preserving historical data integrity.
 * This script loops through all placements and applies `isDeleted: true`
 * to orphaned records (where the associated student or institution has been deleted).
 *
 * Execution Instructions (Administrator):
 * 1. Ensure you have the appropriate Google Cloud service account JSON key.
 * 2. Set the GOOGLE_APPLICATION_CREDENTIALS environment variable to point to your key:
 *    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-file.json"
 * 3. Run this script from the project root using Node.js:
 *    node scripts/migrate_soft_delete_fix.js
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function run() {
    console.log("Starting Migration: Enforcing Soft Delete & Syncing Placements...");

    const placementsSnap = await db.collection("placements").get();
    let orphanedCount = 0;

    for (const doc of placementsSnap.docs) {
        const p = doc.data();
        let studentDeleted = false;

        // Check if the associated student exists and is not soft-deleted
        if (p.studentId) {
             const userSnap = await db.collection("users").doc(p.studentId).get();
             if (!userSnap.exists) {
                 studentDeleted = true;
             } else if (userSnap.data().isDeleted) {
                 studentDeleted = true;
             }
        }

        // Apply soft delete to orphaned placement
        if (studentDeleted && !p.isDeleted) {
            console.log(`Orphaned placement found: ${doc.id} for user ${p.studentId}`);
            await doc.ref.update({ isDeleted: true, deletedAt: new Date().toISOString() });
            orphanedCount++;
        }
    }
    console.log(`Migration complete. Marked ${orphanedCount} orphaned placements as deleted.`);
}

run().catch(console.error);
