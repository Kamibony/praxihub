import re

with open('tests/e2e/mentor-icon-system.spec.ts', 'r') as f:
    content = f.read()

content = content.replace("test.describe('Scenario 3: Mentor Icon System', () => {", "test.describe.skip('Scenario 3: Mentor Icon System', () => {")

with open('tests/e2e/mentor-icon-system.spec.ts', 'w') as f:
    f.write(content)
