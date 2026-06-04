const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/web/app/admin/dashboard/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const docContentPattern = /\{activeTab === "documents" && \([\s\S]*?          \)\}/;

content = content.replace(docContentPattern, '');

// Looking at the end of the file from the error, it looks like there's an extra closing parenthesis or bracket.
// I'll just restore the original and do a simpler replace.
