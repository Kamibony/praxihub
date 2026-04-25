with open('apps/web/app/admin/documents/page.tsx', 'r') as f:
    content = f.read()

# Make sure font-bold applies correctly
content = content.replace('className="text-3xl font-bold', 'className="text-3xl font-bold font-sans')
content = content.replace('className="font-bold', 'className="font-bold font-sans')
content = content.replace('className="text-xl font-bold', 'className="text-xl font-bold font-sans')

# Correct red text to something fitting dark mode
content = content.replace('text-red-800', 'text-red-300')
content = content.replace('text-red-600 text-sm', 'text-red-400 text-sm')

# Correct the testing results
content = content.replace('bg-green-100 text-green-800', 'bg-green-900/40 text-green-300 border border-green-800')
content = content.replace('bg-red-100 text-red-300', 'bg-red-900/40 text-red-300 border border-red-800')

with open('apps/web/app/admin/documents/page.tsx', 'w') as f:
    f.write(content)
