const fs = require('fs');

const rules = fs.readFileSync('firestore.rules', 'utf8');
if (!rules.includes("hasNoDenormalizedFields")) {
    console.error("Rules failed to update");
    process.exit(1);
}
console.log("Rules validated.");
