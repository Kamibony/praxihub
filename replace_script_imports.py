with open('apps/web/app/admin/documents/page.tsx', 'r') as f:
    content = f.read()

# Remove unused Lucide icons to fix linter errors if any
content = content.replace("import { Save, Play, AlertTriangle, FileText, Database, Archive } from 'lucide-react';", "")

with open('apps/web/app/admin/documents/page.tsx', 'w') as f:
    f.write(content)
