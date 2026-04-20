const fs = require('fs');
let code = fs.readFileSync('functions/impersonation.js', 'utf8');

code = code.replace(
`  const targetRole = targetDoc.data().role;
  if (targetRole !== "student" && targetRole !== "mentor") {
      throw new functions.https.HttpsError("permission-denied", "Lze se přihlásit pouze jako student nebo mentor.");
  }`,
`  const targetRole = targetDoc.data().role;
  if (targetRole === "admin" || targetRole === "coordinator") {
      throw new functions.https.HttpsError("permission-denied", "Nelze se přihlásit jako administrátor nebo koordinátor.");
  }`
);

fs.writeFileSync('functions/impersonation.js', code);
