const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/web/app/admin/dashboard/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const docContentPattern = /          \{activeTab === "documents" && \([\s\S]*?          \)\}\n/;

content = content.replace(docContentPattern, '');

const navButtonPattern = /            <button\n              onClick=\{\(\) => setActiveTab\("documents"\)\}\n              className=\{\`px-4 py-2 font-medium border-b-2 transition-colors \$\{\n                activeTab === "documents"\n                  \? "border-blue-600 text-blue-600"\n                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"\n              \}\`\}\n            >\n              Globální dokumenty\n            <\/button>\n/;
content = content.replace(navButtonPattern, '');

fs.writeFileSync(filePath, content);
