with open('apps/web/components/VisualMappingImport.tsx', 'r') as f:
    content = f.read()

# Containers and backgrounds
content = content.replace('bg-slate-50', 'bg-transparent')
content = content.replace('bg-white p-4 rounded-xl border border-slate-200', 'bg-slate-800/50 p-4 rounded-xl border border-white/10')
content = content.replace('bg-white p-6 rounded-xl border border-slate-200 shadow-sm', 'card-glass p-6')
content = content.replace('bg-blue-50 border border-blue-100', 'bg-indigo-900/20 border border-indigo-800/50')
content = content.replace('bg-slate-100', 'bg-slate-800/50')
content = content.replace('bg-yellow-50 border border-yellow-200', 'bg-yellow-900/20 border border-yellow-800/50')

# Text Colors
content = content.replace('text-slate-800', 'text-slate-100')
content = content.replace('text-slate-700', 'text-slate-200')
content = content.replace('text-slate-600', 'text-slate-300')
content = content.replace('text-slate-500', 'text-slate-400')
content = content.replace('text-blue-900', 'text-indigo-300')
content = content.replace('text-blue-700', 'text-indigo-400')
content = content.replace('text-blue-600', 'text-indigo-400')
content = content.replace('text-blue-500', 'text-indigo-500')
content = content.replace('text-yellow-900', 'text-yellow-300')
content = content.replace('text-yellow-800', 'text-yellow-400')
content = content.replace('text-yellow-600', 'text-yellow-500')
content = content.replace('text-red-600', 'text-red-400')
content = content.replace('text-red-500', 'text-red-400')

# Form Elements
content = content.replace('className="border p-1.5 rounded text-sm w-48 bg-transparent"', 'className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100"')
content = content.replace('className="border-b"', 'className="border-b border-white/10"')
content = content.replace('border-slate-300', 'border-slate-600')

# Buttons
content = content.replace('hover:bg-slate-800/50', 'hover:bg-slate-800')
content = content.replace('bg-blue-600 hover:bg-blue-700', 'bg-indigo-600 hover:bg-indigo-700')
content = content.replace('hover:bg-yellow-100', 'hover:bg-yellow-800/50')
content = content.replace('border-t border-yellow-200', 'border-t border-yellow-800/50')

with open('apps/web/components/VisualMappingImport.tsx', 'w') as f:
    f.write(content)
