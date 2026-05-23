const admin = require('firebase-admin');

// Initialize Firebase Admin (assumes GOOGLE_APPLICATION_CREDENTIALS is set)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function auditIntegrity() {
    let violations = [];
    console.log("Starting System Integrity Audit...\n");

    const usersSnap = await db.collection('users').get();
    const placementsSnap = await db.collection('placements').get();

    const validRoles = ['STUDENT', 'INSTITUTION', 'COORDINATOR', 'ADMIN'];
    const validMajors = ['UPV', 'KPV', null];

    // Track valid UIDs for referential integrity checks
    const validUids = new Set();

    console.log(`Auditing ${usersSnap.size} users...`);
    usersSnap.forEach(doc => {
        const data = doc.data();
        const uid = doc.id;
        validUids.add(uid);

        // Rule: uid must match document ID
        if (data.uid !== uid) {
            violations.push(`User ${uid}: uid field (${data.uid}) does not match document ID.`);
        }

        // Rule: Role must be valid
        if (!validRoles.includes(data.role?.toUpperCase())) {
             violations.push(`User ${uid}: Invalid or missing role (${data.role}).`);
        }

        // Rule: Students must have a valid major. Non-students should not.
        if (data.role?.toUpperCase() === 'STUDENT') {
            if (!['UPV', 'KPV'].includes(data.major)) {
                violations.push(`User ${uid}: STUDENT must have major 'UPV' or 'KPV' (found: ${data.major}).`);
            }
        }

        // Rule: Legacy fields shouldn't exist
        if (data.studentMajor !== undefined) violations.push(`User ${uid}: Contains deprecated 'studentMajor' field. Use 'major' instead.`);
        if (data.firstName !== undefined || data.lastName !== undefined || data.name !== undefined) {
             violations.push(`User ${uid}: Contains deprecated name fields (firstName/lastName/name). Use 'displayName' instead.`);
        }
    });

    console.log(`Auditing ${placementsSnap.size} placements...`);
    placementsSnap.forEach(doc => {
        const data = doc.data();
        const pid = doc.id;

        // Rule: Referential Integrity - studentId
        if (!data.studentId || !validUids.has(data.studentId)) {
             violations.push(`Placement ${pid}: Invalid or missing studentId (${data.studentId}).`);
        }

        // Rule: SSOT Violation - Placements must NOT contain user identity data
        const forbiddenFields = ['studentName', 'studentEmail', 'major', 'studentMajor'];
        forbiddenFields.forEach(field => {
            if (data[field] !== undefined) {
                 violations.push(`Placement ${pid}: SSOT Violation - contains denormalized field '${field}'.`);
            }
        });
    });

    console.log("\n--- Audit Results ---");
    if (violations.length === 0) {
        console.log("✅ PERFECT HEALTH: 0 Violations found.");
    } else {
        console.log(`❌ FAILED: Found ${violations.length} violations.`);
        violations.forEach(v => console.log(` - ${v}`));
    }
}

auditIntegrity().catch(console.error);
