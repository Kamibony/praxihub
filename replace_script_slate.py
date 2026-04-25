with open('apps/web/app/admin/documents/page.tsx', 'r') as f:
    content = f.read()

# Fix some backgrounds and borders
content = content.replace('bg-slate-100 rounded-lg p-1', 'bg-slate-900/50 rounded-lg p-1 border border-white/5')
content = content.replace("activeRuleTab === 'UPV' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-200'", "activeRuleTab === 'UPV' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'")
content = content.replace("activeRuleTab === 'KPV' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-200'", "activeRuleTab === 'KPV' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'")

# Pre block in testing
content = content.replace('text-slate-100 whitespace-pre-wrap', 'text-slate-300 whitespace-pre-wrap')

# Import Success block
content = content.replace('bg-green-50 border border-green-200', 'bg-green-900/20 border border-green-800/50')
content = content.replace('text-green-800', 'text-green-300')
content = content.replace('text-green-700', 'text-green-300')
content = content.replace('border-green-300', 'border-green-700/50')
content = content.replace('bg-white px-4 py-2 border border-green-700/50', 'bg-green-900/40 px-4 py-2 border border-green-700/50')
content = content.replace('hover:bg-green-100', 'hover:bg-green-800/50')

# Import another file button
content = content.replace('bg-white px-4 py-2 border border-slate-300', 'bg-slate-800/50 px-4 py-2 border border-slate-700')
content = content.replace('hover:bg-slate-100', 'hover:bg-slate-700')

# Templates and Compliance hovers
content = content.replace('hover:bg-slate-50', 'hover:bg-slate-800/70 hover:border-slate-600')

with open('apps/web/app/admin/documents/page.tsx', 'w') as f:
    f.write(content)
