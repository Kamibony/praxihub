import os
import re

for root, _, files in os.walk('tests/e2e'):
    for file in files:
        if file.endswith('.spec.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

            content = content.replace("await db.collection('users').doc('student123').set({ role: 'student', major: 'UPV', email: 'test@praxihub.cz',\n      active_placement_id: 'placement123'", "await db.collection('users').doc('student123').set({ role: 'student', major: 'UPV', email: 'test@praxihub.cz', displayName: 'Jan Novak',\n      active_placement_id: 'placement123'")

            with open(path, 'w') as f:
                f.write(content)
