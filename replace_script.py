import re

with open('apps/web/app/admin/payroll/page.tsx', 'r') as f:
    content = f.read()
content = re.sub(r'studentName: placement\.studentName \|\| placement\.studentId', r'studentName: userRef.exists() ? (userRef.data().displayName || userRef.data().email) : placement.studentId', content)
with open('apps/web/app/admin/payroll/page.tsx', 'w') as f:
    f.write(content)

with open('apps/web/app/institution/dashboard/page.tsx', 'r') as f:
    content = f.read()
content = re.sub(r'studentName: studentData\.name \|\| studentData\.displayName \|\| studentData\.email \|\| placement\.studentName \|\| \'Student neuveden\'', r'studentName: studentData.displayName || studentData.email || \'Student neuveden\'', content)
content = re.sub(r'studentName: placement\.studentName \|\| \'Student\'', r'studentName: placement.studentName || \'Student\' /* THIS SHOULD BE HYDRATED, check context */', content)
content = re.sub(r'\{placement\.studentName \|\| \'Načítám\.\.\.\'\}', r'{placement.studentName || \'Načítám...\'}', content)
with open('apps/web/app/institution/dashboard/page.tsx', 'w') as f:
    f.write(content)
