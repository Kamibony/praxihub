'use client';

import React, { useState, useEffect } from 'react';
import { db, functions } from "../../../lib/firebase";
import { doc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../../../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { Save, Play, AlertTriangle, FileText, Database, Archive } from 'lucide-react';
import Navbar from "@/components/Navbar";
import Link from 'next/link';

export default function DocumentCenter() {
  const [rules, setRules] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testReflection, setTestReflection] = useState('');
  const [activeTab, setActiveTab] = useState<'AI' | 'IMPORT' | 'TEMPLATES' | 'COMPLIANCE'>('AI');
  const [importFormat, setImportFormat] = useState('UPV');
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<any>(null);

  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [uploadingCompliance, setUploadingCompliance] = useState(false);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const docRef = doc(db, 'system_configs', 'ai_krau_rules');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRules(docSnap.data().content);
        }
      } catch (e) {
        console.error('Error fetching rules', e);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  const handleSave = async () => {
    if (!confirm("Upozornění: Změna těchto pravidel okamžitě ovlivní, jak umělá inteligence hodnotí všechny budoucí reflexe studentů. Opravdu chcete změny uložit?")) return;

    setSaving(true);
    try {
      const updateFn = httpsCallable(functions, 'updateSystemConfig');
      await updateFn({
        docId: "ai_krau_rules",
        title: "KRAU MŠMT Hodnotící Metodika",
        content: rules,
        isCritical: true
      });
      alert('Pravidla byla úspěšně uložena.');
    } catch (e) {
      console.error(e);
      alert('Chyba při ukládání.');
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testReflection) return alert('Zadejte text reflexe pro testování.');
    setTesting(true);
    setTestResult(null);
    try {
      const evaluateFn = httpsCallable(functions, 'testEvaluateReflection');
      const res = await evaluateFn({ reflectionText: testReflection, rulesText: rules });
      setTestResult(res.data);
    } catch (e) {
      console.error(e);
      alert('Chyba při testování AI.');
    }
    setTesting(false);
  };


  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStats(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        const importFn = httpsCallable(functions, 'importRoster');
        const res = await importFn({ fileData: base64Data, format: importFormat });
        setImportStats(res.data);
        setImporting(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Import failed", error);
      alert('Chyba při importu.');
      setImporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, pathPrefix: string, setUploading: (v: boolean) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `global_documents/${pathPrefix}/${file.name}`);
      await uploadBytes(storageRef, file);
      alert('Soubor úspěšně nahrán.');
    } catch (err) {
      console.error(err);
      alert('Chyba při nahrávání souboru.');
    }
    setUploading(false);
  };


  if (loading) return <div className="p-8">Načítám...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-bold text-slate-900">Admin Document Center</h1>
          <Link
            href="/admin/dashboard"
            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition"
          >
            &larr; Zpět na Dashboard
          </Link>
        </div>
        <p className="text-slate-600 mb-8">Centrální správa dokumentů, šablon a AI metodiky.</p>

        <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('AI')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'AI' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <AlertTriangle size={16} /> AI Knowledge Base
          </button>
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'IMPORT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Database size={16} /> Data Import Engine
          </button>
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'TEMPLATES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileText size={16} /> Template Manager
          </button>
          <button
            onClick={() => setActiveTab('COMPLIANCE')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'COMPLIANCE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Archive size={16} /> Compliance Archive
          </button>
        </div>

        {activeTab === 'AI' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 p-4 flex items-start gap-3">
            <AlertTriangle className="text-red-600 mt-0.5" size={20} />
            <div>
              <h2 className="font-bold text-red-800">AI Knowledge Base (KRAU MŠMT)</h2>
              <p className="text-red-600 text-sm">🔴 KRITICKÉ NASTAVENÍ SYSTÉMU. Změny zde přímo ovlivňují rozhodování AI.</p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Editor */}
            <div className="flex flex-col h-[600px]">
              <label className="block text-sm font-medium text-slate-700 mb-2">Pravidla a metodika (Markdown)</label>
              <textarea
                className="flex-1 w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <Save size={18} />
                {saving ? 'Ukládám...' : 'Uložit metodiku'}
              </button>
            </div>

            {/* Test Playground */}
            <div className="flex flex-col h-[600px] bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Play size={18} className="text-blue-600" />
                Otestovat nanečisto
              </h3>
              <p className="text-sm text-slate-500 mb-4">Vyzkoušejte, jak AI ohodnotí text podle aktuálních (neuložených) pravidel výše.</p>

              <textarea
                className="w-full h-32 p-3 border border-slate-300 rounded-lg mb-4 resize-none text-sm"
                placeholder="Zadejte testovací text studentské reflexe..."
                value={testReflection}
                onChange={(e) => setTestReflection(e.target.value)}
              />
              <button
                onClick={handleTest}
                disabled={testing}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium transition-colors mb-6 self-start"
              >
                {testing ? 'Analyzuji...' : 'Spustit test'}
              </button>

              <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-lg p-4">
                {testResult ? (
                  <div>
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold mb-4 ${testResult.evaluation?.isPass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      Výsledek: {testResult.evaluation?.isPass ? 'SPLNĚNO' : 'NESPLNĚNO'}
                    </div>
                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    Výsledek testu se zobrazí zde
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

                {activeTab === 'IMPORT' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <Database size={24} className="text-blue-600" />
              <h2 className="text-xl font-bold text-slate-800">Data Import Engine</h2>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Formát importu</label>
              <select
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="UPV">Odbor Učitelství (UPV) - Komplexní formát</option>
                <option value="KP">Odbor Kariérové poradenství (KP) - Standardní formát</option>
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 relative hover:bg-slate-100 transition">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                disabled={importing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center pointer-events-none">
                <Database size={48} className="text-slate-400 mb-4" />
                <p className="font-medium text-slate-700 text-lg">
                  {importing ? 'Zpracovávám data...' : 'Klikněte nebo přetáhněte Excel soubor'}
                </p>
                <p className="text-sm text-slate-500 mt-2">Podporované formáty: .xlsx, .xls</p>
              </div>
            </div>

            {importStats && (
              <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
                <h3 className="font-bold mb-2">Import úspěšně dokončen</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Přidáno studentů: {importStats.added}</li>
                  <li>Aktualizováno studentů: {importStats.updated}</li>
                  <li>Ignorováno řádků: {importStats.ignored}</li>
                </ul>
              </div>
            )}
          </div>
        )}

                {activeTab === 'TEMPLATES' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center h-64 relative hover:bg-slate-50 transition">
             <input
                type="file"
                onChange={(e) => handleFileUpload(e, 'templates', setUploadingTemplate)}
                disabled={uploadingTemplate}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
             <FileText size={48} className="text-slate-300 mb-4 pointer-events-none" />
             <h2 className="text-xl font-bold text-slate-700 pointer-events-none">Template Manager</h2>
             <p className="text-slate-500 mt-2 pointer-events-none">
               {uploadingTemplate ? 'Nahrávám...' : 'Klikněte pro nahrání šablony (PDF, DOCX) do Firebase Storage.'}
             </p>
          </div>
        )}

                {activeTab === 'COMPLIANCE' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center h-64 relative hover:bg-slate-50 transition">
             <input
                type="file"
                onChange={(e) => handleFileUpload(e, 'compliance', setUploadingCompliance)}
                disabled={uploadingCompliance}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
             <Archive size={48} className="text-slate-300 mb-4 pointer-events-none" />
             <h2 className="text-xl font-bold text-slate-700 pointer-events-none">Compliance Archive</h2>
             <p className="text-slate-500 mt-2 pointer-events-none">
               {uploadingCompliance ? 'Nahrávám...' : 'Klikněte pro nahrání rámcové smlouvy do Firebase Storage.'}
             </p>
          </div>
        )}

      </div>
    </div>
  );
}
