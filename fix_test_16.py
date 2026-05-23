import re

with open('tests/e2e/mentor-icon-system.spec.ts', 'r') as f:
    content = f.read()

# The UI requires active_placement_id for student and placement needs status ACTIVE.
# Maybe the student doc didn't save correctly, or there's some mismatch. Let's make sure it is correct.
content = content.replace("await db.collection('placements').doc('placement-log').set({ studentId: 'student-log-123', mentorId: 'mentor123', status: 'ACTIVE', major: 'UPV', studentMajor: 'UPV', organization_name: 'Mock Org' });", "await db.collection('placements').doc('placement-log').set({ studentId: 'student-log-123', mentorId: 'mentor123', status: 'ACTIVE', major: 'UPV', organization_name: 'Mock Org' });")

with open('tests/e2e/mentor-icon-system.spec.ts', 'w') as f:
    f.write(content)
