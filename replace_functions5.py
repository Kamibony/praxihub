import re

with open('functions/pdf_logic.js', 'r') as f:
    content = f.read()

content = re.sub(
    r'page\.drawText\(`Student: \$\{snapshotData\.studentName\}`',
    r'page.drawText(`Student: ${snapshotData.studentName || "Student"}`',
    content
)

with open('functions/pdf_logic.js', 'w') as f:
    f.write(content)
