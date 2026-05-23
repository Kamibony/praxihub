import re

with open('apps/web/app/institution/dashboard/page.tsx', 'r') as f:
    content = f.read()

# Fix Unterminated string constant
content = content.replace(r"\'Student neuveden\'", "'Student neuveden'")

with open('apps/web/app/institution/dashboard/page.tsx', 'w') as f:
    f.write(content)
