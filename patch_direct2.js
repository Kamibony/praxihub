const fs = require('fs');
let content = fs.readFileSync('apps/web/app/admin/dashboard/page.tsx', 'utf8');

content = content.replace(
  /className=\{getCardClasses\("PENDING_ORG_APPROVAL"\)\}\s*onClick=\{\(\) => setFilterStatus\("PENDING_ORG_APPROVAL"\)\}/g,
  `className={getCardClasses("PENDING_MATCH")} onClick={() => setFilterStatus("PENDING_MATCH")}`
);

content = content.replace(
  /className=\{getCardClasses\("NEEDS_REVIEW"\)\}\s*onClick=\{\(\) => setFilterStatus\("NEEDS_REVIEW"\)\}/g,
  `className={getCardClasses("PENDING_INSTITUTION")} onClick={() => setFilterStatus("PENDING_INSTITUTION")}`
);

content = content.replace(
  /className=\{getCardClasses\("ANALYZING"\)\}\s*onClick=\{\(\) => setFilterStatus\("ANALYZING"\)\}/g,
  `className={getCardClasses("PENDING_COORDINATOR")} onClick={() => setFilterStatus("PENDING_COORDINATOR")}`
);

// Also need to fix the contents of these old cards to not cause TS errors or runtime logic errors
content = content.replace(
  /placements.filter\(\s*\(\s*i\s*\)\s*=>\s*i.status === "PENDING_ORG_APPROVAL",\s*\).length/g,
  `placements.filter((i) => i.status === "PENDING_MATCH").length`
);
content = content.replace(
  /placements.filter\(\s*\(\s*i\s*\)\s*=>\s*i.status === "NEEDS_REVIEW"\s*\).length/g,
  `placements.filter((i) => i.status === "PENDING_INSTITUTION").length`
);
content = content.replace(
  /placements.filter\(\s*\(\s*i\s*\)\s*=>\s*i.status === "ANALYZING"\s*\).length/g,
  `placements.filter((i) => i.status === "PENDING_COORDINATOR").length`
);

content = content.replace(
  /<p className="text-xs text-gray-500 uppercase font-bold">\s*Žádosti o schválení\s*<\/p>/g,
  `<p className="text-xs text-gray-500 uppercase font-bold">Matchmaking</p>`
);

content = content.replace(
  /<p className="text-xs text-gray-500 uppercase font-bold">\s*Čeká na kontrolu\s*<\/p>/g,
  `<p className="text-xs text-gray-500 uppercase font-bold">Čeká Firma</p>`
);

content = content.replace(
  /<p className="text-xs text-gray-500 uppercase font-bold">\s*AI zpracovává\s*<\/p>/g,
  `<p className="text-xs text-gray-500 uppercase font-bold">Čeká Koord</p>`
);

fs.writeFileSync('apps/web/app/admin/dashboard/page.tsx', content);
