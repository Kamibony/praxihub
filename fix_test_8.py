import re

with open('tests/e2e/student-evaluation.spec.ts', 'r') as f:
    content = f.read()

# Make sure we don't accidentally update but rather 'set' with merge if it doesn't exist
content = content.replace("await db.collection('users').doc('student123').update({", "await db.collection('users').doc('student123').set({")

with open('tests/e2e/student-evaluation.spec.ts', 'w') as f:
    f.write(content)
