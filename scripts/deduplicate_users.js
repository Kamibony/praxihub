const admin = require('firebase-admin');

// Initialize Firebase Admin (assumes GOOGLE_APPLICATION_CREDENTIALS is set or running in emulator)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const auth = admin.auth();

const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');

async function getAuthLastSignIn(uid) {
    try {
        const userRecord = await auth.getUser(uid);
        return new Date(userRecord.metadata.lastSignInTime).getTime() || 0;
    } catch (error) {
        // User might not exist in Auth
        return 0;
    }
}

async function getPlacementCount(uid) {
    const studentPlacements = await db.collection('placements').where('studentId', '==', uid).get();
    const mentorPlacements = await db.collection('placements').where('institutionId', '==', uid).get();
    return studentPlacements.size + mentorPlacements.size;
}

function getCompletenessScore(userData) {
    let score = 0;
    if (userData.major) score++;
    if (userData.displayName || userData.name) score++;
    if (userData.role) score++;
    if (userData.studentId) score++;
    if (userData.email) score++;
    return score;
}

function getCreatedAt(userData) {
    if (userData.createdAt) {
        if (userData.createdAt.toDate) return userData.createdAt.toDate().getTime();
        if (userData.createdAt.seconds) return userData.createdAt.seconds * 1000;
        return new Date(userData.createdAt).getTime();
    }
    return 0;
}

async function determineWinner(uids) {
    const profiles = [];

    for (const uid of uids) {
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) continue;
        const data = doc.data();

        profiles.push({
            uid,
            data,
            placementsCount: await getPlacementCount(uid),
            lastSignIn: await getAuthLastSignIn(uid),
            completeness: getCompletenessScore(data),
            createdAt: getCreatedAt(data)
        });
    }

    if (profiles.length === 0) return null;

    // Sort by priority cascade
    profiles.sort((a, b) => {
        // 1. Highest Relational Activity
        if (b.placementsCount !== a.placementsCount) return b.placementsCount - a.placementsCount;

        // 2. Most recent Firebase Auth activity
        if (b.lastSignIn !== a.lastSignIn) return b.lastSignIn - a.lastSignIn;

        // 3. Profile completeness
        if (b.completeness !== a.completeness) return b.completeness - a.completeness;

        // 4. Chronological recency (newest wins, so largest createdAt)
        return b.createdAt - a.createdAt;
    });

    return {
        winner: profiles[0],
        losers: profiles.slice(1)
    };
}

async function migrateRelations(winnerUid, loserUid, batch) {
    let migrations = { placements: 0, auditLogs: 0 };

    // Migrate Placements (studentId)
    const studentPlacements = await db.collection('placements').where('studentId', '==', loserUid).get();
    studentPlacements.forEach(doc => {
        if (!isDryRun) batch.update(doc.ref, { studentId: winnerUid });
        migrations.placements++;
    });

    // Migrate Placements (institutionId)
    const mentorPlacements = await db.collection('placements').where('institutionId', '==', loserUid).get();
    mentorPlacements.forEach(doc => {
        if (!isDryRun) batch.update(doc.ref, { institutionId: winnerUid });
        migrations.placements++;
    });

    // Migrate Audit Logs
    const auditLogs = await db.collection('audit_logs').where('userId', '==', loserUid).get();
    auditLogs.forEach(doc => {
        if (!isDryRun) batch.update(doc.ref, { userId: winnerUid });
        migrations.auditLogs++;
    });

    return migrations;
}

async function processDuplicates() {
    console.log(`Starting Deduplication Script... Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

    const usersSnap = await db.collection('users').get();
    const emailMap = new Map();
    const studentIdMap = new Map();

    usersSnap.forEach(doc => {
        const data = doc.data();
        const uid = doc.id;

        if (data.email) {
            const emailLower = data.email.toLowerCase();
            if (!emailMap.has(emailLower)) emailMap.set(emailLower, []);
            emailMap.get(emailLower).push(uid);
        }

        if (data.studentId) {
            if (!studentIdMap.has(data.studentId)) studentIdMap.set(data.studentId, []);
            studentIdMap.get(data.studentId).push(uid);
        }
    });

    // Find all groups of UIDs that are duplicates
    const duplicateGroups = [];

    for (const [email, uids] of emailMap.entries()) {
        if (uids.length > 1) duplicateGroups.push({ reason: `Email: ${email}`, uids });
    }
    for (const [studentId, uids] of studentIdMap.entries()) {
        if (uids.length > 1) duplicateGroups.push({ reason: `StudentId: ${studentId}`, uids });
    }

    if (duplicateGroups.length === 0) {
        console.log("No duplicates found.");
        return;
    }

    for (const group of duplicateGroups) {
        console.log(`\nAnalyzing group: ${group.reason}`);
        console.log(`Involved UIDs: ${group.uids.join(', ')}`);

        const result = await determineWinner(group.uids);
        if (!result) {
            console.log("No valid profiles found for this group.");
            continue;
        }

        const { winner, losers } = result;
        console.log(`  -> Winner: ${winner.uid} (Placements: ${winner.placementsCount}, LastSignIn: ${new Date(winner.lastSignIn).toISOString()}, Completeness: ${winner.completeness}, Created: ${new Date(winner.createdAt).toISOString()})`);

        const batch = db.batch();

        for (const loser of losers) {
            console.log(`  -> Loser: ${loser.uid} (Placements: ${loser.placementsCount}, LastSignIn: ${new Date(loser.lastSignIn).toISOString()}, Completeness: ${loser.completeness}, Created: ${new Date(loser.createdAt).toISOString()})`);

            const migrations = await migrateRelations(winner.uid, loser.uid, batch);
            console.log(`     - Migrating ${migrations.placements} placements and ${migrations.auditLogs} audit logs from ${loser.uid} to ${winner.uid}`);

            // Hard Delete the Loser profile
            const loserRef = db.collection('users').doc(loser.uid);
            if (!isDryRun) batch.delete(loserRef);
            console.log(`     - Deleting profile ${loser.uid}`);

            // Delete Auth user (optional, implementing carefully)
            if (!isDryRun) {
                try {
                    await auth.deleteUser(loser.uid);
                    console.log(`     - Deleted Auth User ${loser.uid}`);
                } catch (err) {
                    console.log(`     - Failed to delete Auth User ${loser.uid} (might not exist)`);
                }
            }
        }

        if (!isDryRun) {
            await batch.commit();
            console.log(`  => Successfully merged and purged group: ${group.reason}`);
        } else {
            console.log(`  => [DRY RUN] Would merge and purge group: ${group.reason}`);
        }
    }

    console.log("\nFinished deduplication process.");
}

processDuplicates().catch(console.error);
