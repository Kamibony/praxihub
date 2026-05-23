import re
import os

for root, _, files in os.walk('tests/e2e'):
    for file in files:
        if file.endswith('.spec.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

            content = content.replace("major: 'UP',", "major: 'UPV',")

            with open(path, 'w') as f:
                f.write(content)
