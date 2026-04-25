import re

with open('apps/web/app/admin/documents/page.tsx', 'r') as f:
    content = f.read()

# Emojis for icons
content = content.replace('<AlertTriangle size={16} /> AI Knowledge Base', '✨ AI Knowledge Base')
content = content.replace('<Database size={16} /> Data Import Engine', '📂 Data Import Engine')
content = content.replace('<FileText size={16} /> Template Manager', '📄 Template Manager')
content = content.replace('<Archive size={16} /> Compliance Archive', '🏛️ Compliance Archive')

content = content.replace('<AlertTriangle className="text-red-600 mt-0.5" size={20} />', '<span className="text-xl">🚨</span>')
content = content.replace('<Play size={18} className="text-blue-600" />', '▶️')

content = content.replace('<Database size={24} className="text-blue-600" />', '<span className="text-2xl">📂</span>')
content = content.replace('<FileText size={48} className="text-slate-300 mb-4 pointer-events-none" />', '<div className="text-5xl mb-4 pointer-events-none opacity-50">📄</div>')
content = content.replace('<Archive size={48} className="text-slate-300 mb-4 pointer-events-none" />', '<div className="text-5xl mb-4 pointer-events-none opacity-50">🏛️</div>')
content = content.replace('<Save size={18} />', '💾')

content = content.replace("bg-red-50 border-b border-red-100", "bg-red-900/20 border-b border-red-800/50")

with open('apps/web/app/admin/documents/page.tsx', 'w') as f:
    f.write(content)
