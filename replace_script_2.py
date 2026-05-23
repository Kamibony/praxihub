import re

with open('apps/web/app/institution/dashboard/page.tsx', 'r') as f:
    content = f.read()

# Note that `placement` in that context is already an element of `hydratedPlacements`, so `placement.studentName` is actually hydrated.
content = re.sub(r'placement\.studentName \|\| \\\'Student\\\' /\* THIS SHOULD BE HYDRATED, check context \*/', r'placement.studentName || \'Student\'', content)
content = re.sub(r"placement\.studentName \|\| 'Student' /\* THIS SHOULD BE HYDRATED, check context \*/", r"placement.studentName || 'Student'", content)

with open('apps/web/app/institution/dashboard/page.tsx', 'w') as f:
    f.write(content)
