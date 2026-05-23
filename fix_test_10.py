import re

with open('tests/e2e/mentor-icon-system.spec.ts', 'r') as f:
    content = f.read()

content = content.replace("await studentPage.goto('/student/dashboard');", "await studentPage.goto('/student/dashboard');\n    await studentPage.click('button:has-text(\"Náslechy\")').catch(() => {});")

with open('tests/e2e/mentor-icon-system.spec.ts', 'w') as f:
    f.write(content)
