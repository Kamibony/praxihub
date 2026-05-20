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
const auth = admin.auth();

async function seedUsers() {
    console.log("Seeding test users for table search verification...");

    const dummyUsers = [
        { email: 'adam.dd@example.com', name: 'Adam Dobeš', role: 'student', major: 'UPV' },
        { email: 'eva.dd@example.com', name: 'Eva Dvořáková', role: 'student', major: 'KPV' },
        { email: 'jan.novak@example.com', name: 'Jan Novák', role: 'coordinator', major: '' },
        { email: 'reditel@skola-dd.cz', name: 'ZŠ a MŠ DD, p.o.', role: 'institution', major: '' },
        { email: 'info@dd-company.cz', name: 'DD Company s.r.o.', role: 'institution', major: '' },
    ];

    for (let u of dummyUsers) {
        let user;
        try {
            user = await auth.getUserByEmail(u.email);
            console.log(`User ${u.email} already exists in auth.`);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                user = await auth.createUser({
                    email: u.email,
                    emailVerified: true,
                    displayName: u.name,
                });
                console.log(`Created user ${u.email} in auth.`);
            } else {
                console.error(`Error with user ${u.email}:`, e);
                continue;
            }
        }

        await db.collection("users").doc(user.uid).set({
            email: u.email,
            name: u.name,
            role: u.role,
            major: u.major,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`Seeded user ${u.email} in Firestore.`);
    }

    console.log("Finished seeding users.");
    process.exit(0);
}

seedUsers();
