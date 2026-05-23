import re

with open('apps/web/app/institution/dashboard/page.tsx', 'r') as f:
    content = f.read()

# Fix Unterminated string constant from previous regex
content = content.replace("studentName: studentData.displayName || studentData.email || 'Student neuveden',", "studentName: studentData.displayName || studentData.email || 'Student neuveden',")

with open('apps/web/app/institution/dashboard/page.tsx', 'w') as f:
    f.write(content)
