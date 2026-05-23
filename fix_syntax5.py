import re

with open('apps/web/contexts/AuthContext.tsx', 'r') as f:
    content = f.read()

# Fix multiple properties
content = re.sub(
    r'\.\.\.data,\s*// merge remaining firestore data\s*displayName: normalizedName,\s*// ensure precedence\s*major: normalizedMajor,\s*// ensure precedence',
    r'...data, // merge remaining firestore data\n                displayName: normalizedName, // ensure precedence\n                major: normalizedMajor, // ensure precedence',
    content
)
# Note: actually we can just manually delete the lines.
