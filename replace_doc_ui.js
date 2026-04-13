const fs = require('fs');

const file = 'apps/web/app/admin/documents/page.tsx';
let data = fs.readFileSync(file, 'utf8');

const topBlock = `        <p className="text-slate-600 mb-8">Centrální správa dokumentů, šablon a AI metodiky.</p>

        {/* AI Knowledge Base Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 p-4 flex items-start gap-3">`;

const newTopBlock = `        <p className="text-slate-600 mb-8">Centrální správa dokumentů, šablon a AI metodiky.</p>

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button className="py-3 px-6 text-sm font-medium border-b-2 border-blue-600 text-blue-600">AI Knowledge Base</button>
          <button className="py-3 px-6 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700">Data Import Engine</button>
          <button className="py-3 px-6 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700">Template Manager</button>
          <button className="py-3 px-6 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700">Compliance Archive</button>
        </div>

        {/* AI Knowledge Base Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 p-4 flex items-start gap-3">`;

if (data.includes(topBlock)) {
   data = data.replace(topBlock, newTopBlock);
   fs.writeFileSync(file, data);
   console.log("Replaced top block successfully!");
} else {
   console.log("Could not find the top block");
}
