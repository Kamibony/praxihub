with open('apps/web/app/admin/documents/page.tsx', 'r') as f:
    content = f.read()

# Make sure all blue is refactored to match dark mode better, such as indigo
content = content.replace('hover:text-blue-600', 'hover:text-blue-400')
content = content.replace('bg-blue-600 hover:bg-blue-700', 'bg-indigo-600 hover:bg-indigo-700')
content = content.replace('focus:ring-blue-500 focus:border-blue-500', 'focus:ring-indigo-500 focus:border-indigo-500')

with open('apps/web/app/admin/documents/page.tsx', 'w') as f:
    f.write(content)
