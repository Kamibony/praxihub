import re

with open('apps/web/app/admin/documents/page.tsx', 'r') as f:
    content = f.read()

# Layout
content = content.replace('min-h-screen bg-slate-50', 'min-h-screen bg-transparent')
content = content.replace('text-slate-900', 'text-slate-100')
content = content.replace('text-slate-600', 'text-slate-300')
content = content.replace('text-slate-800', 'text-slate-100')
content = content.replace('text-slate-700', 'text-slate-200')
content = content.replace('text-slate-500', 'text-slate-400')

# Containers
content = content.replace('bg-white rounded-xl shadow-sm border border-slate-200', 'card-glass')
content = content.replace('bg-white p-8 rounded-xl shadow-sm border border-slate-200', 'card-glass p-8')
content = content.replace('bg-slate-50 p-4 rounded-xl border border-slate-200', 'bg-slate-800/50 p-4 rounded-xl border border-white/10')
content = content.replace('bg-white border border-slate-200', 'bg-slate-800/50 border border-white/10')
content = content.replace('border-slate-200', 'border-white/10')
content = content.replace('border-slate-100', 'border-white/10')

# Tabs
content = content.replace("border-blue-600 text-blue-600", "border-indigo-400 text-indigo-300 bg-indigo-500/20 rounded-t-lg")
content = content.replace("border-transparent text-slate-500 hover:text-slate-700", "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg")

with open('apps/web/app/admin/documents/page.tsx', 'w') as f:
    f.write(content)
