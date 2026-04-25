with open('apps/web/components/VisualMappingImport.tsx', 'r') as f:
    content = f.read()

# Fix table borders and empty rows border
content = content.replace('className="border-b last:border-0"', 'className="border-b border-white/5 last:border-0"')
content = content.replace('border-b text-slate-300 font-medium whitespace-nowrap', 'border-b border-white/10 text-slate-300 font-medium whitespace-nowrap')
content = content.replace('className="flex justify-end gap-3 pt-4 border-t"', 'className="flex justify-end gap-3 pt-4 border-t border-white/10"')

# Make sure icons are matched
content = content.replace('<Upload size={48} className="text-indigo-500 mb-4" />', '<div className="text-5xl mb-4 opacity-50">📤</div>')
content = content.replace('<Database className="text-indigo-400 mt-1" size={20} />', '<span className="text-xl">📂</span>')
content = content.replace('<AlertTriangle className="text-yellow-500 mt-1" size={24} />', '<span className="text-2xl">⚠️</span>')

with open('apps/web/components/VisualMappingImport.tsx', 'w') as f:
    f.write(content)
