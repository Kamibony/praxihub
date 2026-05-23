import re
import os

for root, _, files in os.walk('tests/e2e'):
    for file in files:
        if file.endswith('.spec.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

            if "await db.collection('users').doc" in content and "major: '" not in content and "role: 'student'" in content:
                content = re.sub(
                    r"role:\s*'student',",
                    r"role: 'student',\n      major: 'UPV',",
                    content
                )
            # Some tests have UPV/KPV in the placements mock instead of the user
            content = re.sub(
                r"role:\s*'student'(?![^\}]+major:)",
                r"role: 'student',\n      major: 'UPV'",
                content
            )

            with open(path, 'w') as f:
                f.write(content)
