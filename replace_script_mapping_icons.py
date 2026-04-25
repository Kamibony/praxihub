with open('apps/web/components/VisualMappingImport.tsx', 'r') as f:
    content = f.read()

# Make sure imports are clean
content = content.replace("import { ArrowRight, CheckCircle, Upload, AlertTriangle, Database } from 'lucide-react';", "")
content = content.replace("<ArrowRight size={16} />", "➡️")
content = content.replace("<CheckCircle size={16} />", "✅")

with open('apps/web/components/VisualMappingImport.tsx', 'w') as f:
    f.write(content)
