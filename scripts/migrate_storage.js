const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const bucket = admin.storage().bucket();

async function migrate() {
    console.log("Starting storage migration...");

    try {
        const [files] = await bucket.getFiles();

        console.log(`Found ${files.length} total files in bucket.`);

        let migratedCount = 0;

        for (const file of files) {
            const path = file.name;

            // Check for legacy root folders or files we need to migrate
            let newPath = null;

            if (path.startsWith('templates/')) {
                const fileName = path.replace('templates/', '');
                if (fileName && !fileName.includes('/')) {
                     newPath = `global_documents/templates/UPV/${fileName}`;
                }
            } else if (path.startsWith('compliance/')) {
                const fileName = path.replace('compliance/', '');
                if (fileName && !fileName.includes('/')) {
                     newPath = `global_documents/compliance/UPV/${fileName}`;
                }
            } else if (path.startsWith('methodologies/')) {
                const fileName = path.replace('methodologies/', '');
                if (fileName && !fileName.includes('/')) {
                     newPath = `global_documents/ai_rules/UPV/${fileName}`;
                }
            } else if (path.startsWith('global_documents/') && path.split('/').length === 2) {
                // E.g. global_documents/something.pdf -> this is a legacy root file inside global_documents
                // The dashboard used to let you upload these. Let's put them in templates.
                const fileName = path.replace('global_documents/', '');
                if (fileName && !fileName.includes('/')) {
                     newPath = `global_documents/templates/UPV/${fileName}`;
                }
            }

            if (newPath) {
                console.log(`Moving: ${path} -> ${newPath}`);
                await file.move(newPath);
                migratedCount++;
            }
        }

        console.log(`Migration complete. Moved ${migratedCount} files.`);
    } catch (e) {
        console.error("Migration error:", e);
    }
}

migrate().catch(console.error);
