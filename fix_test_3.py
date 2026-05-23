import re
import os

with open('tests/e2e/student-categorical-hours.spec.ts', 'r') as f:
    content = f.read()

# Fix student-categorical-hours.spec.ts line 58 should be KPV not UPV
content = content.replace("uid: 'student-kpv', email: 'student-kpv@praxihub.cz' });\n    await db.collection('users').doc('student-kpv').set({\n      role: 'student',\n      major: 'UPV',", "uid: 'student-kpv', email: 'student-kpv@praxihub.cz' });\n    await db.collection('users').doc('student-kpv').set({\n      role: 'student',\n      major: 'KPV',")

with open('tests/e2e/student-categorical-hours.spec.ts', 'w') as f:
    f.write(content)

with open('tests/e2e/mentor-icon-system.spec.ts', 'r') as f:
    content = f.read()
if "major: '" not in content:
    content = content.replace("role: 'student',", "role: 'student',\n      major: 'UPV',")
with open('tests/e2e/mentor-icon-system.spec.ts', 'w') as f:
    f.write(content)
