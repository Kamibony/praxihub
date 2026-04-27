'use client';

import React, { useState, useEffect } from 'react';
import { db, functions } from "../../../lib/firebase";
import { doc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../../../lib/firebase";
import { httpsCallable } from "firebase/functions";

import Navbar from "@/components/Navbar";
import Link from 'next/link';
import VisualMappingImport from '../../../components/VisualMappingImport';

export default function DocumentCenter() {
  type Snippets = { metodika: string; uznatelnost: string; kompetencni_ramec: string };
  const initialSnippets: Snippets = { metodika: '', uznatelnost: '', kompetencni_ramec: '' };
  const [rulesUpv, setRulesUpv] = useState<Snippets>(initialSnippets);
  const [rulesKpv, setRulesKpv] = useState<Snippets>(initialSnippets);
  const [activeDept, setActiveDept] = useState<'UPV' | 'KPV'>('UPV');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testReflection, setTestReflection] = useState('');
  const [activeTab, setActiveTab] = useState<'AI' | 'IMPORT' | 'TEMPLATES' | 'COMPLIANCE'>('AI');
  const [runningMigration, setRunningMigration] = useState(false);
  const [importFormat, setImportFormat] = useState('UPV');
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<any>(null);

  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [uploadingCompliance, setUploadingCompliance] = useState(false);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const parseSnippets = (content: string): Snippets => {
          try {
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object') {
              return {
                metodika: parsed.metodika || '',
                uznatelnost: parsed.uznatelnost || '',
                kompetencni_ramec: parsed.kompetencni_ramec || ''
              };
            }
          } catch (e) {
            // If it's not JSON, it's legacy text, assign to metodika
            return { ...initialSnippets, metodika: content };
          }
          return initialSnippets;
        };

        const docRefUpv = doc(db, 'system_configs', 'ai_rules_upv');
        const docSnapUpv = await getDoc(docRefUpv);
        if (docSnapUpv.exists()) {
          setRulesUpv(parseSnippets(docSnapUpv.data().content));
        } else {
            // Fallback for legacy data
            const docRefLegacy = doc(db, 'system_configs', 'ai_krau_rules');
            const docSnapLegacy = await getDoc(docRefLegacy);
            if (docSnapLegacy.exists()) {
                setRulesUpv(parseSnippets(docSnapLegacy.data().content));
            }
        }

        const docRefKpv = doc(db, 'system_configs', 'ai_rules_kpv');
        const docSnapKpv = await getDoc(docRefKpv);
        if (docSnapKpv.exists()) {
          setRulesKpv(parseSnippets(docSnapKpv.data().content));
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
    if (!confirm("Upozornění: Změna těchto pravidel okamžitě ovlivní, jak umělá inteligence hodnotí všechny budoucí reflexe studentů pro zvolený obor. Opravdu chcete změny uložit?")) return;

    setSaving(true);
    try {
      const updateFn = httpsCallable(functions, 'updateSystemConfig');
      const docId = activeDept === 'UPV' ? 'ai_rules_upv' : 'ai_rules_kpv';
      const contentObj = activeDept === 'UPV' ? rulesUpv : rulesKpv;

      // Store as JSON string, backend functions will receive it,
      // but evaluateReflection needs to handle JSON string properly
      const content = JSON.stringify(contentObj);
      const title = activeDept === 'UPV' ? 'Metodika UPV (Učitelství)' : 'Metodika KPV (Poradenství)';

      await updateFn({
        docId: docId,
        title: title,
        content: content,
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
      const currentRulesObj = activeDept === 'UPV' ? rulesUpv : rulesKpv;
      // Convert current rules to a formatted markdown string for testing,
      // identical to what `evaluateReflection` will do
      const currentRules = `
## Metodika
${currentRulesObj.metodika}

## Uznatelnost
${currentRulesObj.uznatelnost}

## Kompetenční rámec
${currentRulesObj.kompetencni_ramec}
`;
      const res = await evaluateFn({ reflectionText: testReflection, rulesText: currentRules });
      setTestResult(res.data);
    } catch (e) {
      console.error(e);
      alert('Chyba při testování AI.');
    }
    setTesting(false);
  };



  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, pathPrefix: string, setUploading: (v: boolean) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `global_documents/${pathPrefix}/${activeDept}/${file.name}`);
      await uploadBytes(storageRef, file);
      alert('Soubor úspěšně nahrán.');
      // Refresh documents list
      fetchDocs(pathPrefix);
    } catch (err) {
      console.error(err);
      alert('Chyba při nahrávání souboru.');
    }
    setUploading(false);
  };

  const [docsList, setDocsList] = useState<{name: string, url: string}[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const handleMigration = async () => {
    if (!confirm("Are you sure you want to run the institutions migration? This will create users and update placements.")) return;
    setRunningMigration(true);
    try {
      const migrateFn = httpsCallable(functions, 'migrateInstitutions');
      const res = await migrateFn();
      const data = res.data as { success: boolean; createdCount: number; updatedCount: number };
      alert(`Migrace úspěšná! Vytvořeno institucí: ${data.createdCount}, Aktualizováno smluv: ${data.updatedCount}`);
    } catch (e: any) {
      console.error(e);
      alert(`Chyba při migraci: ${e.message}`);
    }
    setRunningMigration(false);
  };

  const fetchDocs = async (pathPrefix: string) => {
    setLoadingDocs(true);
    try {
      // Must dynamically import listAll, getDownloadURL since they are used
      const { listAll, getDownloadURL } = await import("firebase/storage");
      const listRef = ref(storage, `global_documents/${pathPrefix}/${activeDept}`);
      const res = await listAll(listRef);
      const docs = await Promise.all(
        res.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          return {
            name: itemRef.name,
            url,
          };
        }),
      );
      setDocsList(docs);
    } catch (error) {
      console.error("Error fetching docs:", error);
      setDocsList([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'TEMPLATES') {
      fetchDocs('templates');
    } else if (activeTab === 'COMPLIANCE') {
      fetchDocs('compliance');
    }
  }, [activeTab, activeDept]);


  if (loading) return <div className="p-8">Načítám...</div>;

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar />
      <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-bold font-sans text-slate-100">Admin Document Center</h1>
          <Link
            href="/admin/dashboard"
            className="text-sm font-medium text-slate-300 hover:text-blue-400 transition"
          >
            &larr; Zpět na Dashboard
          </Link>
        </div>
        <div className="flex justify-between items-center mb-8">
          <p className="text-slate-300">Centrální správa dokumentů, šablon a AI metodiky.</p>
          <button
            onClick={handleMigration}
            disabled={runningMigration}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
          >
            {runningMigration ? "Probíhá migrace..." : "🚨 RUN MIGRATION"}
          </button>
        </div>

        {/* Global Department Scope Toggle */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex bg-slate-900/50 rounded-xl p-1 border border-white/10 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setActiveDept('UPV')}
              className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 flex items-center gap-2 ${activeDept === 'UPV' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
              <span className="text-lg">👩‍🏫</span>
              UPV (Učitelství)
            </button>
            <button
              onClick={() => setActiveDept('KPV')}
              className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 flex items-center gap-2 ${activeDept === 'KPV' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
              <span className="text-lg">🤝</span>
              KPV (Poradenství)
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('AI')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'AI' ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20 rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            ✨ AI Knowledge Base
          </button>
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'IMPORT' ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20 rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            📂 Roster Import
          </button>
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'TEMPLATES' ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20 rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            📄 Template Manager
          </button>
          <button
            onClick={() => setActiveTab('COMPLIANCE')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'COMPLIANCE' ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20 rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            🏛️ Compliance Archive
          </button>
        </div>

        {activeTab === 'AI' && (
          <div className="card-glass overflow-hidden">
          <div className="bg-red-900/20 border-b border-red-800/50 p-4 flex items-start gap-3">
            <span className="text-xl">🚨</span>
            <div>
              <h2 className="font-bold font-sans text-red-300">AI Knowledge Base (KRAU MŠMT)</h2>
              <p className="text-red-400 text-sm">🔴 KRITICKÉ NASTAVENÍ SYSTÉMU. Změny zde přímo ovlivňují rozhodování AI.</p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Editor */}
            <div className="flex flex-col h-[600px]">
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Metodika pro {activeDept}</label>
                  <textarea
                    className="w-full h-32 p-4 bg-slate-900/50 border border-white/10 text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
                    value={activeDept === 'UPV' ? rulesUpv.metodika : rulesKpv.metodika}
                    onChange={(e) => activeDept === 'UPV' ? setRulesUpv({...rulesUpv, metodika: e.target.value}) : setRulesKpv({...rulesKpv, metodika: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Uznatelnost</label>
                  <textarea
                    className="w-full h-32 p-4 bg-slate-900/50 border border-white/10 text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
                    value={activeDept === 'UPV' ? rulesUpv.uznatelnost : rulesKpv.uznatelnost}
                    onChange={(e) => activeDept === 'UPV' ? setRulesUpv({...rulesUpv, uznatelnost: e.target.value}) : setRulesKpv({...rulesKpv, uznatelnost: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">Kompetenční rámec</label>
                  <textarea
                    className="w-full h-32 p-4 bg-slate-900/50 border border-white/10 text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
                    value={activeDept === 'UPV' ? rulesUpv.kompetencni_ramec : rulesKpv.kompetencni_ramec}
                    onChange={(e) => activeDept === 'UPV' ? setRulesUpv({...rulesUpv, kompetencni_ramec: e.target.value}) : setRulesKpv({...rulesKpv, kompetencni_ramec: e.target.value})}
                  />
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                💾
                {saving ? 'Ukládám...' : 'Uložit metodiku'}
              </button>
            </div>

            {/* Test Playground */}
            <div className="flex flex-col h-[600px] bg-slate-800/50 p-4 rounded-xl border border-white/10">
              <h3 className="font-bold font-sans text-slate-100 mb-2 flex items-center gap-2">
                ▶️
                Otestovat nanečisto
              </h3>
              <p className="text-sm text-slate-400 mb-4">Vyzkoušejte, jak AI ohodnotí text podle aktuálních (neuložených) pravidel výše.</p>

              <textarea
                className="w-full h-32 p-3 bg-slate-900/50 border border-white/10 text-slate-100 rounded-lg mb-4 resize-none text-sm"
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

              <div className="flex-1 overflow-auto bg-slate-800/50 border border-white/10 rounded-lg p-4">
                {testResult ? (
                  <div>
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold mb-4 ${testResult.evaluation?.isPass ? 'bg-green-900/40 text-green-300 border border-green-800' : 'bg-red-900/40 text-red-300 border border-red-800'}`}>
                      Výsledek: {testResult.evaluation?.isPass ? 'SPLNĚNO' : 'NESPLNĚNO'}
                    </div>
                    <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
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
          <div className="card-glass p-8">
            <div className="flex items-center gap-3 mb-2 border-b border-white/10 pb-4">
              <span className="text-2xl">📂</span>
              <h2 className="text-xl font-bold font-sans text-slate-100">Roster Import (Excel/CSV student lists)</h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">Nahrávejte a mapujte seznamy studentů z Excelu (.xlsx) nebo CSV pro automatické vytvoření uživatelů.</p>

            {!importStats ? (
                <VisualMappingImport onSuccess={setImportStats} department={activeDept} />
            ) : (
              <div className="mt-8 bg-green-900/20 border border-green-800/50 rounded-lg p-4 text-green-300">
                <h3 className="font-bold font-sans mb-2">Import úspěšně dokončen</h3>
                <ul className="list-disc pl-5 text-sm space-y-1 mb-4">
                  <li>Přidáno studentů: {importStats.added}</li>
                  <li>Aktualizováno studentů: {importStats.updated}</li>
                  <li>Ignorováno řádků: {importStats.ignored}</li>
                </ul>
                <div className="flex gap-4">
                  <Link
                    href="/admin/users"
                    className="inline-flex items-center gap-2 text-sm font-semibold bg-green-900/40 px-4 py-2 border border-green-700/50 rounded-lg text-green-300 hover:bg-green-800/50 transition"
                  >
                    Přejít na Správu uživatelů
                  </Link>
                  <button
                    onClick={() => setImportStats(null)}
                    className="inline-flex items-center gap-2 text-sm font-semibold bg-slate-800/50 px-4 py-2 border border-slate-700 rounded-lg text-slate-200 hover:bg-slate-700 transition"
                  >
                    Nahrát další soubor
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

                {activeTab === 'TEMPLATES' && (
          <div className="card-glass p-8">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <span className="text-2xl">📄</span>
              <h2 className="text-xl font-bold font-sans text-slate-100">Template Manager ({activeDept})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col items-center justify-center text-center h-64 bg-slate-800/50 rounded-xl border border-dashed border-slate-600 relative hover:bg-slate-800/70 hover:border-slate-500 transition">
                 <input
                    type="file"
                    accept=".pdf,.docx,.pptx"
                    onChange={(e) => handleFileUpload(e, 'templates', setUploadingTemplate)}
                    disabled={uploadingTemplate}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                 <div className="text-5xl mb-4 pointer-events-none opacity-50">📤</div>
                 <h2 className="text-xl font-bold font-sans text-slate-200 pointer-events-none">Nahrát šablonu</h2>
                 <p className="text-slate-400 mt-2 pointer-events-none">
                   {uploadingTemplate ? 'Nahrávám...' : 'Klikněte pro nahrání šablony (.pdf, .docx, .pptx) do Firebase Storage.'}
                 </p>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-xl border border-white/10 overflow-y-auto h-64">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Nahrané šablony</h3>
                {loadingDocs ? (
                  <p className="text-sm text-slate-400">Načítám soubory...</p>
                ) : docsList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Zatím nebyly nahrány žádné šablony pro {activeDept}.</p>
                ) : (
                  <ul className="space-y-3">
                    {docsList.map((doc) => (
                      <li key={doc.name} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                        <span className="text-sm text-slate-200 truncate pr-4" title={doc.name}>{doc.name}</span>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium whitespace-nowrap">Stáhnout &rarr;</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

                {activeTab === 'COMPLIANCE' && (
          <div className="card-glass p-8">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <span className="text-2xl">🏛️</span>
              <h2 className="text-xl font-bold font-sans text-slate-100">Compliance Archive ({activeDept})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col items-center justify-center text-center h-64 bg-slate-800/50 rounded-xl border border-dashed border-slate-600 relative hover:bg-slate-800/70 hover:border-slate-500 transition">
                 <input
                    type="file"
                    accept=".pdf,.docx,.pptx"
                    onChange={(e) => handleFileUpload(e, 'compliance', setUploadingCompliance)}
                    disabled={uploadingCompliance}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                 <div className="text-5xl mb-4 pointer-events-none opacity-50">📤</div>
                 <h2 className="text-xl font-bold font-sans text-slate-200 pointer-events-none">Nahrát rámcovou smlouvu</h2>
                 <p className="text-slate-400 mt-2 pointer-events-none">
                   {uploadingCompliance ? 'Nahrávám...' : 'Klikněte pro nahrání rámcové smlouvy (.pdf, .docx, .pptx) do Firebase Storage.'}
                 </p>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-xl border border-white/10 overflow-y-auto h-64">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Nahrané smlouvy</h3>
                {loadingDocs ? (
                  <p className="text-sm text-slate-400">Načítám soubory...</p>
                ) : docsList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Zatím nebyly nahrány žádné smlouvy pro {activeDept}.</p>
                ) : (
                  <ul className="space-y-3">
                    {docsList.map((doc) => (
                      <li key={doc.name} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                        <span className="text-sm text-slate-200 truncate pr-4" title={doc.name}>{doc.name}</span>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium whitespace-nowrap">Stáhnout &rarr;</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
