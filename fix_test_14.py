import re

with open('tests/e2e/mentor-icon-system.spec.ts', 'r') as f:
    content = f.read()

content = content.replace("await db.collection('users').doc('student-log-123').set({ role: 'student', major: 'UPV', displayName: 'Jan Novák', email: 'student-log-123@praxihub.cz', active_placement_id: 'placement-log' });", "await db.collection('users').doc('student-log-123').set({ role: 'student', major: 'UPV', displayName: 'Jan Novák', email: 'student-log-123@praxihub.cz', active_placement_id: 'placement-log', researchConsent: true });")

with open('tests/e2e/mentor-icon-system.spec.ts', 'w') as f:
    f.write(content)
