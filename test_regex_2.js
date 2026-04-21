const fs = require('fs');
const content = fs.readFileSync('apps/web/app/admin/dashboard/page.tsx', 'utf8');

const regex = /<td className="px-6 py-4 whitespace-nowrap">\s*<span\s*className=\{`px-2\.5 py-0\.5 inline-flex text-xs leading-5 font-semibold rounded-full border [\s\S]*?<\/span>\s*<\/td>\s*<td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">[\s\S]*?<\/td>/;

console.log("Regex matches?", regex.test(content));
