import re

with open('functions/index.js', 'r') as f:
    content = f.read()

content = re.sub(r'currentData\.studentMajor \|\| currentData\.major', r'currentData.major', content)
content = re.sub(r'existingPlacementDoc\.data\(\)\.studentMajor \|\| existingPlacementDoc\.data\(\)\.major', r'existingPlacementDoc.data().major', content)
content = re.sub(r'studentMajor: userObj\.major \|\| null,', r'', content)
content = re.sub(r'const major = placementData\.studentMajor \|\| placementData\.major;', r'const major = placementData.major;', content)

with open('functions/index.js', 'w') as f:
    f.write(content)

with open('functions/pdf_logic.js', 'r') as f:
    content = f.read()

content = re.sub(r'snapshotData\.studentMajor === "UPV" \|\|', r'', content)
content = re.sub(r'\(!snapshotData\.studentMajor && !snapshotData\.major\)', r'(!snapshotData.major)', content)

with open('functions/pdf_logic.js', 'w') as f:
    f.write(content)
