import re

with open('functions/index.js', 'r') as f:
    content = f.read()

content = re.sub(
    r'const snapshotData = {\s*\.\.\.placementData,',
    r'const studentRef = await db.collection("users").doc(placementData.studentId).get();\n      const studentName = studentRef.exists ? studentRef.data().displayName : "Student";\n      const snapshotData = {\n        ...placementData,\n        studentName,',
    content
)

with open('functions/index.js', 'w') as f:
    f.write(content)
