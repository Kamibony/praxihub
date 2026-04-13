const fs = require('fs');

const file = 'apps/web/app/admin/documents/page.tsx';
let data = fs.readFileSync(file, 'utf8');

const originalBlock = `import { db, functions } from "../../../../lib/firebase";`;
const newBlock = `import { db, functions } from "../../../lib/firebase";`;

if (data.includes(originalBlock)) {
   data = data.replace(originalBlock, newBlock);
   fs.writeFileSync(file, data);
   console.log("Replaced successfully!");
} else {
   console.log("Could not find the block");
}
