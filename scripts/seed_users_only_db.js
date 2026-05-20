const admin = require("firebase-admin");

if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`Connecting to Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
}

if (!admin.apps.length) {
    const config = {};
    if (process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        config.projectId = 'demo-project';
    } else {
        config.projectId = 'praxihub-app';
    }
    admin.initializeApp(config);
}

const db = admin.firestore();

async function seedUsers() {
    console.log("Seeding test users for table search verification...");

    const dummyUsers = [
        { email: 'adam.dd@example.com', name: 'Adam Dobeš', role: 'student', major: 'UPV' },
        { email: 'eva.dd@example.com', name: 'Eva Dvořáková', role: 'student', major: 'KPV' },
        { email: 'jan.novak@example.com', name: 'Jan Novák', role: 'coordinator', major: '' },
        { email: 'reditel@skola-dd.cz', name: 'ZŠ a MŠ DD, p.o.', role: 'institution', major: '' },
        { email: 'info@dd-company.cz', name: 'DD Company s.r.o.', role: 'institution', major: '' },
    ];

    for (let i = 0; i < dummyUsers.length; i++) {
        let u = dummyUsers[i];
        try {
            await db.collection("users").doc(`dummy-user-${i}`).set({
                email: u.email,
                name: u.name,
                role: u.role,
                major: u.major,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`Seeded user ${u.email} in Firestore.`);
        } catch(e) {
             console.error(`Error with user ${u.email}:`, e);
        }
    }

    console.log("Finished seeding users.");
    process.exit(0);
}

seedUsers();
