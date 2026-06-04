const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/web/app/admin/dashboard/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The block to remove is from "// Global Documents state" down to "setGlobalDocs(() => {});"
const startGlobalDocsState = content.indexOf('// Global Documents state');
if (startGlobalDocsState !== -1) {
    const endGlobalDocsState = content.indexOf('];', startGlobalDocsState) + 2;
    content = content.slice(0, startGlobalDocsState) + content.slice(endGlobalDocsState);
}

content = content.replace(/const \[loadingDocs, setLoadingDocs\] = useState\(false\);/, '');

// Inside useEffect
content = content.replace(/fetchGlobalDocs\(\);/, '');

// fetchGlobalDocs
content = content.replace(/  const fetchGlobalDocs = async \(\) => \{[\s\S]*?setLoadingDocs\(false\);\n    \}\n  \};\n/g, '');

// handleGlobalDocUpload
content = content.replace(/  const handleGlobalDocUpload = async \([\s\S]*?alert\("Chyba při nahrávání dokumentu."\);\n    \}\n  \};\n/g, '');

// handleGlobalDocDelete
content = content.replace(/  const handleGlobalDocDelete = async \(path: string\) => \{[\s\S]*?alert\("Chyba při mazání dokumentu."\);\n    \}\n  \};\n/g, '');

// Nav button
const navButtonPattern = /<button\n              onClick=\{\(\) => setActiveTab\("documents"\)\}\n              className=\{\`px-4 py-2 font-medium border-b-2 transition-colors \$\{\n                activeTab === "documents"\n                  \? "border-blue-600 text-blue-600"\n                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"\n              \}\`\}\n            >\n              Globální dokumenty\n            <\/button>\n/;
content = content.replace(navButtonPattern, '');

// Content block (using exact string replacement since regex can be finicky with nested brackets)
const docContentStart = content.indexOf('{activeTab === "documents" && (');
if (docContentStart !== -1) {
    // Find matching bracket
    let depth = 0;
    let endIndex = -1;
    for (let i = docContentStart; i < content.length; i++) {
        if (content[i] === '{' || content[i] === '(') depth++;
        if (content[i] === '}' || content[i] === ')') depth--;
        if (depth === 0) {
            endIndex = i + 1;
            break;
        }
    }
    if (endIndex !== -1) {
        content = content.slice(0, docContentStart) + content.slice(endIndex);
    }
}


fs.writeFileSync(filePath, content);
