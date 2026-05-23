import re

with open('apps/web/app/student/dashboard/page.tsx', 'r') as f:
    content = f.read()

# Fix Unterminated string constant around line 339
# The error says: const isKpv = user.major === \'KPV\';
content = re.sub(r"const isKpv = user\.major === \\'KPV\\';", "const isKpv = user.major === 'KPV';", content)

with open('apps/web/app/student/dashboard/page.tsx', 'w') as f:
    f.write(content)
