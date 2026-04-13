const fs = require('fs');

const file = 'functions/index.js';
let data = fs.readFileSync(file, 'utf8');

const originalBlock = `  // Optional: check admin role here
  // const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  // if (!userDoc.exists || (userDoc.data().role !== 'admin' && userDoc.data().role !== 'coordinator')) {
  //   throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění.");
  // }`;

const newBlock = `  // Check admin role here
  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists || (userDoc.data().role !== 'admin' && userDoc.data().role !== 'coordinator')) {
    throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění.");
  }`;

if (data.includes(originalBlock)) {
   data = data.replace(originalBlock, newBlock);
   fs.writeFileSync(file, data);
   console.log("Replaced successfully!");
} else {
   console.log("Could not find the original block");
}
