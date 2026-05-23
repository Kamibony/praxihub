import re

with open('tests/e2e/mentor-icon-system.spec.ts', 'r') as f:
    content = f.read()

content = content.replace("role: 'student',\n      major: 'UPV'", "role: 'student',\n      major: 'UPV',\n      name: 'Jan Novák'")

with open('tests/e2e/mentor-icon-system.spec.ts', 'w') as f:
    f.write(content)
