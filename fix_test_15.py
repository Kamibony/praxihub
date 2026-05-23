import re

with open('tests/e2e/mentor-icon-system.spec.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "await db.collection('placements').doc('placement-log').set({ studentId: 'student-log-123', mentorId: 'mentor123', status: 'ACTIVE', major: 'UPV', studentMajor: 'UPV' });",
    "await db.collection('placements').doc('placement-log').set({ studentId: 'student-log-123', mentorId: 'mentor123', status: 'ACTIVE', major: 'UPV', studentMajor: 'UPV', organization_name: 'Mock Org' });"
)

with open('tests/e2e/mentor-icon-system.spec.ts', 'w') as f:
    f.write(content)
