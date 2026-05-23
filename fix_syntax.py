import re

with open('apps/web/app/student/dashboard/page.tsx', 'r') as f:
    content = f.read()

# Fix duplicate major: user.major
content = re.sub(r'major:\s*user\.major,\s*major:\s*user\.major', r'major: user.major', content)

# Fix user.major || user.major ...
content = re.sub(r'user\?\.major \|\| user\?\.major \|\| "Chybí obor"', r'user?.major || "Chybí obor"', content)
content = re.sub(r'user\?\.major \|\| user\?\.major\)', r'user?.major)', content)
content = re.sub(r'user\.major === \'KPV\' \|\| user\.major === \'KPV\'', r'user.major === \'KPV\'', content)
content = re.sub(r'placement\?\.major \|\| placement\?\.major \|\| "UNKNOWN"', r'user?.major || "UNKNOWN"', content)

with open('apps/web/app/student/dashboard/page.tsx', 'w') as f:
    f.write(content)
