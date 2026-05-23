import re

with open('tests/e2e/student-evaluation.spec.ts', 'r') as f:
    content = f.read()

# auth user creation needs to happen before setting doc
content = content.replace("await db.collection('users').doc('student123').set({ role: 'student', major: 'UPV', email: 'test@praxihub.cz',\n      active_placement_id: 'placement123'\n    });", "await require('./setup-firebase-admin').auth.createUser({ uid: 'student123', email: 'test@praxihub.cz' }).catch(() => {});\n    await db.collection('users').doc('student123').set({ role: 'STUDENT', major: 'UPV', email: 'test@praxihub.cz',\n      active_placement_id: 'placement123'\n    });")

with open('tests/e2e/student-evaluation.spec.ts', 'w') as f:
    f.write(content)
