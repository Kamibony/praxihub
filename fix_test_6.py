import re
import os

with open('tests/e2e/student-evaluation.spec.ts', 'r') as f:
    content = f.read()

content = content.replace("await db.collection('users').doc('student123').set({ role: 'STUDENT', major: 'UPV', email: 'test@praxihub.cz',", "await db.collection('users').doc('student123').set({ role: 'student', major: 'UPV', email: 'test@praxihub.cz',")

with open('tests/e2e/student-evaluation.spec.ts', 'w') as f:
    f.write(content)
