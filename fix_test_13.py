import re

with open('tests/e2e/mentor-icon-system.spec.ts', 'r') as f:
    content = f.read()

content = content.replace("test.setTimeout(60000);", "test.setTimeout(60000);\n\n    const { clearFirestore, clearAuth } = require('./seed');\n    await clearFirestore();\n    await clearAuth();\n\n    const { db, auth } = require('./setup-firebase-admin');\n    await auth.createUser({ uid: 'student-log-123', email: 'student-log-123@praxihub.cz' }).catch(() => {});\n    await db.collection('users').doc('student-log-123').set({ role: 'student', major: 'UPV', displayName: 'Jan Novák', email: 'student-log-123@praxihub.cz', active_placement_id: 'placement-log' });\n    await db.collection('placements').doc('placement-log').set({ studentId: 'student-log-123', mentorId: 'mentor123', status: 'ACTIVE', major: 'UPV', studentMajor: 'UPV' });\n    await auth.createUser({ uid: 'mentor123', email: 'mentor123@praxihub.cz' }).catch(() => {});\n    await db.collection('users').doc('mentor123').set({ role: 'institution', email: 'mentor123@praxihub.cz' });")

with open('tests/e2e/mentor-icon-system.spec.ts', 'w') as f:
    f.write(content)
