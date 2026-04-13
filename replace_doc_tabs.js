const fs = require('fs');

const file = 'apps/web/app/admin/documents/page.tsx';
let data = fs.readFileSync(file, 'utf8');

const importBlock = `import { Save, Play, AlertTriangle } from 'lucide-react';
import Navbar from "@/components/Navbar";`;

const newImportBlock = `import { Save, Play, AlertTriangle, FileText, Database, Archive } from 'lucide-react';
import Navbar from "@/components/Navbar";`;

if (data.includes(importBlock)) {
   data = data.replace(importBlock, newImportBlock);
}

const stateBlock = `  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testReflection, setTestReflection] = useState('');`;

const newStateBlock = `  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testReflection, setTestReflection] = useState('');
  const [activeTab, setActiveTab] = useState<'AI' | 'IMPORT' | 'TEMPLATES' | 'COMPLIANCE'>('AI');`;

if (data.includes(stateBlock)) {
   data = data.replace(stateBlock, newStateBlock);
}

const tabsBlock = `        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button className="py-3 px-6 text-sm font-medium border-b-2 border-blue-600 text-blue-600">AI Knowledge Base</button>
          <button className="py-3 px-6 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700">Data Import Engine</button>
          <button className="py-3 px-6 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700">Template Manager</button>
          <button className="py-3 px-6 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700">Compliance Archive</button>
        </div>

        {/* AI Knowledge Base Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">`;

const newTabsBlock = `        <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('AI')}
            className={\`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 \${activeTab === 'AI' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}>
            <AlertTriangle size={16} /> AI Knowledge Base
          </button>
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={\`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 \${activeTab === 'IMPORT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}>
            <Database size={16} /> Data Import Engine
          </button>
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={\`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 \${activeTab === 'TEMPLATES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}>
            <FileText size={16} /> Template Manager
          </button>
          <button
            onClick={() => setActiveTab('COMPLIANCE')}
            className={\`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 \${activeTab === 'COMPLIANCE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}>
            <Archive size={16} /> Compliance Archive
          </button>
        </div>

        {activeTab === 'AI' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">`;

if (data.includes(tabsBlock)) {
   data = data.replace(tabsBlock, newTabsBlock);
}


const endBlock = `        </div>

      </div>
    </div>
  );
}`;

const newEndBlock = `        </div>
        )}

        {activeTab === 'IMPORT' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center h-64">
             <Database size={48} className="text-slate-300 mb-4" />
             <h2 className="text-xl font-bold text-slate-700">Data Import Engine</h2>
             <p className="text-slate-500 mt-2">Nástroj pro bezpečný import dat z Excelu (UPV2) bude brzy zprovozněn.</p>
          </div>
        )}

        {activeTab === 'TEMPLATES' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center h-64">
             <FileText size={48} className="text-slate-300 mb-4" />
             <h2 className="text-xl font-bold text-slate-700">Template Manager</h2>
             <p className="text-slate-500 mt-2">Správa statických šablon (PDF, manuály) ve Firebase Storage bude integrována sem.</p>
          </div>
        )}

        {activeTab === 'COMPLIANCE' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center h-64">
             <Archive size={48} className="text-slate-300 mb-4" />
             <h2 className="text-xl font-bold text-slate-700">Compliance Archive</h2>
             <p className="text-slate-500 mt-2">Archiv rámcových smluv s institucemi se připravuje.</p>
          </div>
        )}

      </div>
    </div>
  );
}`;

if (data.includes(endBlock)) {
   data = data.replace(endBlock, newEndBlock);
}

fs.writeFileSync(file, data);
console.log("Updated tabs successfully!");
