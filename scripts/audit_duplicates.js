const admin = require('firebase-admin');

// Initialize Firebase Admin (assumes GOOGLE_APPLICATION_CREDENTIALS is set or running in emulator)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function auditDuplicates() {
    console.log("Starting Global Duplication Audit...\n");
    const report = {
        users: { total: 0, duplicates: { email: [], studentId: [], displayName: [] } },
        organizations: { total: 0, duplicates: { ico: [] } },
        placements: { total: 0, duplicates: { studentOrgPair: [] } },
    };

    // --- 1. Audit Users ---
    console.log("Scanning 'users' collection...");
    const usersSnap = await db.collection('users').get();
    report.users.total = usersSnap.size;

    const emailMap = new Map();
    const studentIdMap = new Map();
    const displayNameMap = new Map();

    usersSnap.forEach(doc => {
        const data = doc.data();
        const uid = doc.id;

        // Check Email
        if (data.email) {
            const emailLower = data.email.toLowerCase();
            if (emailMap.has(emailLower)) {
                emailMap.get(emailLower).push(uid);
            } else {
                emailMap.set(emailLower, [uid]);
            }
        }

        // Check studentId (dynamic field potentially present)
        if (data.studentId) {
            if (studentIdMap.has(data.studentId)) {
                studentIdMap.get(data.studentId).push(uid);
            } else {
                studentIdMap.set(data.studentId, [uid]);
            }
        }

        // Check displayName
        if (data.displayName) {
            if (displayNameMap.has(data.displayName)) {
                displayNameMap.get(data.displayName).push(uid);
            } else {
                displayNameMap.set(data.displayName, [uid]);
            }
        } else if (data.name) {
            if (displayNameMap.has(data.name)) {
                displayNameMap.get(data.name).push(uid);
            } else {
                displayNameMap.set(data.name, [uid]);
            }
        }
    });

    for (const [email, uids] of emailMap.entries()) {
        if (uids.length > 1) report.users.duplicates.email.push({ email, uids });
    }
    for (const [studentId, uids] of studentIdMap.entries()) {
        if (uids.length > 1) report.users.duplicates.studentId.push({ studentId, uids });
    }
    for (const [name, uids] of displayNameMap.entries()) {
        if (uids.length > 1) report.users.duplicates.displayName.push({ name, uids });
    }

    // --- 2. Audit Organizations ---
    console.log("Scanning 'organizations' collection...");
    const orgsSnap = await db.collection('organizations').get();
    report.organizations.total = orgsSnap.size;

    const icoMap = new Map();

    orgsSnap.forEach(doc => {
        const data = doc.data();
        const docId = doc.id;

        if (data.ico) {
            if (icoMap.has(data.ico)) {
                icoMap.get(data.ico).push(docId);
            } else {
                icoMap.set(data.ico, [docId]);
            }
        }
    });

    for (const [ico, docIds] of icoMap.entries()) {
        if (docIds.length > 1) report.organizations.duplicates.ico.push({ ico, docIds });
    }

    // --- 3. Audit Placements ---
    console.log("Scanning 'placements' collection...");
    const placementsSnap = await db.collection('placements').get();
    report.placements.total = placementsSnap.size;

    const placementPairMap = new Map();

    placementsSnap.forEach(doc => {
        const data = doc.data();
        const docId = doc.id;

        if (data.studentId && data.organizationId) {
            const pairKey = `${data.studentId}::${data.organizationId}`;
            if (placementPairMap.has(pairKey)) {
                placementPairMap.get(pairKey).push(docId);
            } else {
                placementPairMap.set(pairKey, [docId]);
            }
        }
    });

    for (const [pairKey, docIds] of placementPairMap.entries()) {
        if (docIds.length > 1) {
            const [studentId, organizationId] = pairKey.split("::");
            report.placements.duplicates.studentOrgPair.push({ studentId, organizationId, docIds });
        }
    }

    // --- Output Results ---
    console.log("\n=== AUDIT RESULTS ===");
    console.log(JSON.stringify(report, null, 2));

    let issuesFound = false;
    if (report.users.duplicates.email.length > 0) { console.log(`[!] Found ${report.users.duplicates.email.length} duplicated emails.`); issuesFound = true; }
    if (report.users.duplicates.studentId.length > 0) { console.log(`[!] Found ${report.users.duplicates.studentId.length} duplicated studentIds.`); issuesFound = true; }
    if (report.users.duplicates.displayName.length > 0) { console.log(`[!] Found ${report.users.duplicates.displayName.length} duplicated displayNames.`); issuesFound = true; }
    if (report.organizations.duplicates.ico.length > 0) { console.log(`[!] Found ${report.organizations.duplicates.ico.length} duplicated ICOs.`); issuesFound = true; }
    if (report.placements.duplicates.studentOrgPair.length > 0) { console.log(`[!] Found ${report.placements.duplicates.studentOrgPair.length} duplicated placement pairs (student + org).`); issuesFound = true; }

    if (!issuesFound) {
        console.log("✅ No duplicates found based on the scanned unique fields.");
    }
}

auditDuplicates().catch(console.error);
