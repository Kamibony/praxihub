import re

with open('functions/index.js', 'r') as f:
    content = f.read()

content = re.sub(
    r'const title = `KRAU Kompetenční matice: \$\{placementData\.studentName \|\| \'Student\'\}`;',
    r'const studentRef = await db.collection("users").doc(placementData.studentId).get();\n    const studentName = studentRef.exists ? studentRef.data().displayName : "Student";\n    const title = `KRAU Kompetenční matice: ${studentName}`;',
    content
)

with open('functions/index.js', 'w') as f:
    f.write(content)
