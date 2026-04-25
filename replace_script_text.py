with open('apps/web/app/admin/documents/page.tsx', 'r') as f:
    content = f.read()

# Make sure the font-mono pre contains slate-300
content = content.replace('text-xs font-mono text-slate-100 whitespace-pre-wrap', 'text-xs font-mono text-slate-300 whitespace-pre-wrap')
content = content.replace('text-xs font-mono text-slate-800 whitespace-pre-wrap', 'text-xs font-mono text-slate-300 whitespace-pre-wrap')

with open('apps/web/app/admin/documents/page.tsx', 'w') as f:
    f.write(content)
