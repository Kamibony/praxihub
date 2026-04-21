const fs = require('fs');
let content = fs.readFileSync('apps/web/app/admin/dashboard/page.tsx', 'utf8');

// Need to fix this typo handling match placement error
content = content.replace(
  /handleMatchPlacement\(item\.id\);/g,
  `if (typeof handleMatchPlacement === "function") { handleMatchPlacement(item.id); }`
);

fs.writeFileSync('apps/web/app/admin/dashboard/page.tsx', content);
