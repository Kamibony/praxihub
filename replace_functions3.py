import re

with open('functions/index.js', 'r') as f:
    content = f.read()

content = re.sub(
    r'const previousData = change\.before\.data\(\);\s*// Ak sa zmenil status, pošleme mail\s*if \(newData\.status !== previousData\.status\) \{',
    r'const previousData = change.before.data();\n\n    // Ak sa zmenil status, pošleme mail\n    if (newData.status !== previousData.status) {\n      const studentRef = await admin.firestore().collection("users").doc(newData.studentId).get();\n      const studentEmail = studentRef.exists ? studentRef.data().email : null;\n      if (!studentEmail) return null;',
    content
)
content = re.sub(r'to: newData\.studentEmail,', r'to: studentEmail,', content)
content = re.sub(r'E-mail požiadavka vytvorená pre: \$\{newData\.studentEmail\}', r'E-mail požiadavka vytvorená pre: ${studentEmail}', content)

with open('functions/index.js', 'w') as f:
    f.write(content)
