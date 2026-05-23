import re

with open('functions/index.js', 'r') as f:
    content = f.read()

content = re.sub(
    r'studentName: studentDoc\.exists\s*\?\s*studentDoc\.data\(\)\.displayName\s*:\s*"Neznámý student",',
    r'studentName: studentDoc.exists ? (studentDoc.data().displayName || studentDoc.data().email || "Neznámý student") : "Neznámý student",',
    content
)

with open('functions/index.js', 'w') as f:
    f.write(content)

with open('functions/pdf_logic.js', 'r') as f:
    content = f.read()

content = re.sub(
    r'page\.drawText\(`Student: \$\{decreeData\.studentName\}`',
    r'page.drawText(`Student: ${decreeData.studentName || "Student"}`',
    content
)

with open('functions/pdf_logic.js', 'w') as f:
    f.write(content)
