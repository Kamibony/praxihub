import re

with open('functions/index.js', 'r') as f:
    content = f.read()

content = re.sub(r'studentMajor:\s*existingPlacementDoc\.data\(\)\.studentMajor \|\|\s*existingPlacementDoc\.data\(\)\.major,', r'', content)

with open('functions/index.js', 'w') as f:
    f.write(content)
