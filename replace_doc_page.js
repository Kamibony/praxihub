const fs = require('fs');

const file = 'apps/web/app/admin/documents/page.tsx';
let data = fs.readFileSync(file, 'utf8');

const originalBlock = `import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";`;
const newBlock = `import { doc, getDoc, serverTimestamp } from "firebase/firestore";`;

if (data.includes(originalBlock)) {
   data = data.replace(originalBlock, newBlock);
}

const originalSaveBlock = `    try {
      await setDoc(doc(db, 'system_configs', 'ai_krau_rules'), {
        id: "ai_krau_rules",
        title: "KRAU MŠMT Hodnotící Metodika",
        content: rules,
        lastUpdated: serverTimestamp(),
        updatedBy: "admin",
        isCritical: true
      });`;

const newSaveBlock = `    try {
      const updateFn = httpsCallable(functions, 'updateSystemConfig');
      await updateFn({
        docId: "ai_krau_rules",
        title: "KRAU MŠMT Hodnotící Metodika",
        content: rules,
        isCritical: true
      });`;

if (data.includes(originalSaveBlock)) {
   data = data.replace(originalSaveBlock, newSaveBlock);
   fs.writeFileSync(file, data);
   console.log("Replaced successfully!");
} else {
   console.log("Could not find the save block");
}
