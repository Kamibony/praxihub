'use client';
import { toast } from "react-hot-toast";

import React, { useState, useEffect } from 'react';
import { db, functions } from "../../../lib/firebase";
import { doc, getDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { ref, uploadBytes, deleteObject } from "firebase/storage";
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
  const [parsingPdf, setParsingPdf] = useState(false);
  const [importFormat, setImportFormat] = useState('UPV');
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<any>(null);

  const [importLogs, setImportLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [uploadingCompliance, setUploadingCompliance] = useState(false);

  // --- Smart Router State ---
  const [routingFile, setRoutingFile] = useState(false);
  const [routingResult, setRoutingResult] = useState<any>(null);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [overrideCategory, setOverrideCategory] = useState<'AI_RULE' | 'ROSTER' | 'TEMPLATE' | 'COMPLIANCE'>('AI_RULE');
  const [overrideDept, setOverrideDept] = useState<'UPV' | 'KPV'>('UPV');
  const [importFileToPass, setImportFileToPass] = useState<File | null>(null);


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
      toast.success('Pravidla byla úspěšně uložena.');
    } catch (e) {
      console.error(e);
      toast.success('Chyba při ukládání.');
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testReflection) return toast.success('Zadejte text reflexe pro testování.');
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
      toast.success('Chyba při testování AI.');
    }
    setTesting(false);
  };




  const handleSmartDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDroppedFile(file);
    setRoutingFile(true);
    setRoutingResult(null);
    setManualOverride(false);
    setImportFileToPass(null);

    try {
      let fileDataBase64 = "";
      let textSample = "";
      let mimeType = file.type;

      if (mimeType === "application/pdf" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        fileDataBase64 = base64String;
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.csv') || file.name.endsWith('.xls')) {
        // Read sample for CSV/Excel
        const xlsx = await import('xlsx');
        const bstr = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsBinaryString(file);
        });
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        // Take first 10 rows
        textSample = data.slice(0, 10).map(row => row.join(', ')).join('\n');
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else {
        // Unknown, pass base64
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        fileDataBase64 = base64String;
      }

      const routeFn = httpsCallable(functions, 'routeDocument');
      const res = await routeFn({ fileDataBase64, mimeType, textSample });
      const data = res.data as any;

      if (data.confidence < 80 || data.category === 'UNKNOWN' || data.department === 'UNKNOWN') {
         setManualOverride(true);
         setOverrideCategory(data.category === 'UNKNOWN' ? 'AI_RULE' : data.category);
         setOverrideDept(data.department === 'UNKNOWN' ? 'UPV' : data.department);
      }

      setRoutingResult(data);

    } catch (err: any) {
      console.error(err);
      toast.error("Chyba při analýze dokumentu: " + err.message);
      setManualOverride(true);
    }
    setRoutingFile(false);
  };

  const executeRouting = async (category: string, dept: string) => {
    if (!droppedFile) return;

    // Set dept globally
    if (dept === 'UPV' || dept === 'KPV') setActiveDept(dept as 'UPV' | 'KPV');

    if (category === 'AI_RULE') {
      setActiveTab('AI');

      // Upload the document to Storage so it's persisted in the AI Knowledge Base
      try {
        const storageRef = ref(storage, `global_documents/ai_rules/${dept}/${droppedFile.name}`);
        await uploadBytes(storageRef, droppedFile);
        fetchDocs('ai_rules');
      } catch (err) {
        console.error("Failed to upload AI Rule document to storage", err);
      }

      if (routingResult?.extractedRules) {
        const parsedData = routingResult.extractedRules;
        const updateRules = (prev: Snippets) => {
           return {
             metodika: prev.metodika ? prev.metodika + "\n\n---\n" + parsedData.metodika : parsedData.metodika,
             uznatelnost: prev.uznatelnost ? prev.uznatelnost + "\n\n---\n" + parsedData.uznatelnost : parsedData.uznatelnost,
             kompetencni_ramec: prev.kompetencni_ramec ? prev.kompetencni_ramec + "\n\n---\n" + parsedData.kompetencni_ramec : parsedData.kompetencni_ramec
           };
        };
        if (dept === 'UPV') {
          setRulesUpv(updateRules(rulesUpv));
        } else {
          setRulesKpv(updateRules(rulesKpv));
        }
        toast.success("Text úspěšně extrahován a přidán. Nezapomeňte změny ULOŽIT.");
      } else {
          toast.success("Vyberte dokument znovu v záložce AI pro manuální extrakci.");
      }
    } else if (category === 'ROSTER') {
      setActiveTab('IMPORT');
      setImportFileToPass(droppedFile);
    } else if (category === 'TEMPLATE') {
      setActiveTab('TEMPLATES');
      setUploadingTemplate(true);
      try {
        const storageRef = ref(storage, `global_documents/templates/${dept}/${droppedFile.name}`);
        await uploadBytes(storageRef, droppedFile);
        toast.success('Šablona úspěšně nahrána.');
        fetchDocs('templates');
      } catch (err) {
        toast.success('Chyba při nahrávání.');
      }
      setUploadingTemplate(false);
    } else if (category === 'COMPLIANCE') {
      setActiveTab('COMPLIANCE');
      setUploadingCompliance(true);
      try {
        const storageRef = ref(storage, `global_documents/compliance/${dept}/${droppedFile.name}`);
        await uploadBytes(storageRef, droppedFile);
        toast.success('Smlouva úspěšně nahrána.');
        fetchDocs('compliance');
      } catch (err) {
        toast.success('Chyba při nahrávání.');
      }
      setUploadingCompliance(false);
    }

    // Reset
    setDroppedFile(null);
    setRoutingResult(null);
    setManualOverride(false);
  };

  const getCategoryName = (cat: string) => {
    switch (cat) {
      case 'AI_RULE': return 'AI Knowledge Base (Metodika)';
      case 'ROSTER': return 'Seznam studentů (Import)';
      case 'TEMPLATE': return 'Šablona dokumentu';
      case 'COMPLIANCE': return 'Smlouva (Compliance)';
      default: return 'Neznámá kategorie';
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, pathPrefix: string, setUploading: (v: boolean) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `global_documents/${pathPrefix}/${activeDept}/${file.name}`);
      await uploadBytes(storageRef, file);
      toast.success('Soubor úspěšně nahrán.');
      // Refresh documents list
      fetchDocs(pathPrefix);
    } catch (err) {
      console.error(err);
      toast.success('Chyba při nahrávání souboru.');
    }
    setUploading(false);
  };

  const [docsList, setDocsList] = useState<{name: string, url: string}[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  const handleDeleteDoc = async (fileName: string, pathPrefix: string) => {
    if (!confirm(`Opravdu chcete smazat soubor "${fileName}"?`)) return;
    setDeletingDoc(fileName);
    try {
      const storageRef = ref(storage, `global_documents/${pathPrefix}/${activeDept}/${fileName}`);
      await deleteObject(storageRef);
      toast.success('Soubor úspěšně smazán.');
      fetchDocs(pathPrefix);
    } catch (err: any) {
      console.error(err);
      toast.error(`Chyba při mazání souboru: ${err.message}`);
    } finally {
      setDeletingDoc(null);
    }
  };

  const handlePdfAIImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!validTypes.includes(file.type)) {
      toast.success("Prosím nahrajte soubor ve formátu PDF nebo DOCX.");
      return;
    }

    setParsingPdf(true);
    try {
      // Upload the document to Storage so it's persisted in the AI Knowledge Base
      try {
        const storageRef = ref(storage, `global_documents/ai_rules/${activeDept}/${file.name}`);
        await uploadBytes(storageRef, file);
        fetchDocs('ai_rules');
      } catch (err) {
        console.error("Failed to upload AI Rule document to storage", err);
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = (event.target?.result as string).split(',')[1];

        const parseFn = httpsCallable(functions, 'parseDocumentForAI');
        const res = await parseFn({
          fileDataBase64: base64String,
          mimeType: file.type
        });

        const parsedData = res.data as Snippets;

        // Append parsed data intelligently to existing text
        const updateRules = (prev: Snippets) => {
           return {
             metodika: prev.metodika ? prev.metodika + "\n\n---\n" + parsedData.metodika : parsedData.metodika,
             uznatelnost: prev.uznatelnost ? prev.uznatelnost + "\n\n---\n" + parsedData.uznatelnost : parsedData.uznatelnost,
             kompetencni_ramec: prev.kompetencni_ramec ? prev.kompetencni_ramec + "\n\n---\n" + parsedData.kompetencni_ramec : parsedData.kompetencni_ramec
           };
        };

        if (activeDept === 'UPV') {
          setRulesUpv(updateRules(rulesUpv));
        } else {
          setRulesKpv(updateRules(rulesKpv));
        }

        toast.success("Text úspěšně extrahován z PDF a přidán k existujícím pravidlům. Nezapomeňte změny ULOŽIT.");
        setParsingPdf(false);
      };
      reader.onerror = (err) => {
        console.error("FileReader error:", err);
        toast.error("Chyba při čtení souboru.");
        setParsingPdf(false);
      };

      reader.readAsDataURL(file);

    } catch (e: any) {
      console.error(e);
      toast.success(`Chyba při analýze PDF: ${e.message}`);
      setParsingPdf(false);
    }
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

  const fetchImportLogs = async () => {
    setLoadingLogs(true);
    try {
      const logsQuery = query(
        collection(db, 'import_logs'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(logsQuery);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setImportLogs(logs);
    } catch (e) {
      console.error("Error fetching import logs", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'TEMPLATES') {
      fetchDocs('templates');
    } else if (activeTab === 'COMPLIANCE') {
      fetchDocs('compliance');
    } else if (activeTab === 'AI') {
      fetchDocs('ai_rules');
    } else if (activeTab === 'IMPORT') {
      fetchImportLogs();
    }
  }, [activeTab, activeDept]);


  if (loading) return <div className="p-8">Načítám...</div>;

  return (
    <div className="min-h-screen dark bg-slate-900">
      <Navbar />
      <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-bold font-sans text-theme-primary">Admin Document Center</h1>
          <Link
            href="/admin/dashboard"
            className="text-sm font-medium text-theme-secondary hover:text-blue-400 transition"
          >
            &larr; Zpět na Dashboard
          </Link>
        </div>
        <div className="flex justify-between items-center mb-8">
          <p className="text-theme-secondary">Centrální správa dokumentů, šablon a AI metodiky.</p>
        </div>


        {/* Smart Router Dropzone */}
        <div className="mb-8">
          <div className="relative border-2 border-dashed border-indigo-500/50 bg-indigo-900/10 hover:bg-indigo-900/20 transition-all rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer shadow-lg shadow-indigo-500/10 backdrop-blur-md">
             <input
                type="file"
                onChange={handleSmartDrop}
                disabled={routingFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                title="Přetáhněte soubor sem"
              />
              {routingFile ? (
                <>
                   <div className="text-4xl mb-4 animate-bounce">🤖</div>
                   <h2 className="text-2xl font-bold font-sans text-indigo-300 pointer-events-none">AI analyzuje dokument...</h2>
                   <p className="text-indigo-400/80 mt-2 pointer-events-none max-w-lg">
                     Prosím čekejte. AI čte obsah souboru a zjišťuje, kam jej nejlépe zařadit.
                   </p>
                </>
              ) : (
                <>
                   <div className="text-4xl mb-4 opacity-80">🧠</div>
                   <h2 className="text-2xl font-bold font-sans text-indigo-300 pointer-events-none">Smart Uploader (AI Router)</h2>
                   <p className="text-indigo-400/80 mt-2 pointer-events-none max-w-lg">
                     Přetáhněte sem <strong>jakýkoliv soubor</strong> (PDF, DOCX, Excel). AI jej automaticky analyzuje, rozpozná jeho účel a navrhne správné zařazení (Metodika, Import studentů, Šablona či Smlouva).
                   </p>
                </>
              )}
          </div>

          {/* AI Confirmation Modal */}
          {routingResult && droppedFile && !routingFile && (
            <div className="mt-4 p-6 bg-slate-800 border border-indigo-500/30 rounded-xl shadow-xl">
               <div className="flex items-start gap-4">
                 <span className="text-3xl mt-1">✨</span>
                 <div className="flex-1">
                   {!manualOverride ? (
                     <>
                       <h3 className="text-xl font-bold text-theme-primary">Zjistili jsme, že jde o <span className="text-indigo-400">{getCategoryName(routingResult.category)}</span> pro obor <span className="text-indigo-400">{routingResult.department}</span>.</h3>
                       <p className="text-theme-muted mt-2">{routingResult.reasoning} (Jistota: {routingResult.confidence}%)</p>
                       <div className="mt-6 flex gap-3">
                         <button onClick={() => executeRouting(routingResult.category, routingResult.department)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition">
                           Ano, pokračovat
                         </button>
                         <button onClick={() => setManualOverride(true)} className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg font-medium transition">
                           Ne, vybrat ručně
                         </button>
                         <button onClick={() => { setRoutingResult(null); setDroppedFile(null); }} className="text-theme-muted hover:text-theme-primary px-4 py-2.5 rounded-lg font-medium transition ml-auto">
                           Zrušit nahrávání
                         </button>
                       </div>
                     </>
                   ) : (
                     <>
                        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 mb-4">
                           <p className="text-amber-400 text-sm">AI si není jisté, nebo jste zvolili ruční zařazení. Kam chcete soubor umístit?</p>
                           {routingResult.confidence < 80 && <p className="text-amber-400/80 text-xs mt-1">Důvod nízké jistoty: {routingResult.reasoning}</p>}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                           <div className="flex-1">
                             <label className="block text-sm font-medium text-theme-secondary mb-2">Kategorie dokumentu</label>
                             <select value={overrideCategory} onChange={e => setOverrideCategory(e.target.value as any)} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none">
                               <option value="AI_RULE">AI Knowledge Base (Metodika/Pravidla)</option>
                               <option value="ROSTER">Seznam studentů (Roster Import)</option>
                               <option value="TEMPLATE">Šablona pro studenty/mentory</option>
                               <option value="COMPLIANCE">Archiv smluv (Compliance)</option>
                             </select>
                           </div>
                           <div className="flex-1">
                             <label className="block text-sm font-medium text-theme-secondary mb-2">Příslušný obor</label>
                             <select value={overrideDept} onChange={e => setOverrideDept(e.target.value as any)} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none">
                               <option value="UPV">UPV (Učitelství)</option>
                               <option value="KPV">KPV (Poradenství)</option>
                             </select>
                           </div>
                        </div>
                        <div className="flex gap-3">
                           <button onClick={() => executeRouting(overrideCategory, overrideDept)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition">
                             Provést ruční zařazení
                           </button>
                           <button onClick={() => { setRoutingResult(null); setDroppedFile(null); setManualOverride(false); }} className="text-theme-muted hover:text-theme-primary px-4 py-2.5 rounded-lg font-medium transition">
                             Zrušit
                           </button>
                        </div>
                     </>
                   )}
                 </div>
               </div>
            </div>
          )}
        </div>


        {/* Global Department Scope Toggle */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex bg-theme-panel rounded-xl p-1 border border-theme-border shadow-lg backdrop-blur-md">
            <button
              onClick={() => setActiveDept('UPV')}
              className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 flex items-center gap-2 ${activeDept === 'UPV' ? 'bg-indigo-600 text-white shadow-md' : 'text-theme-muted hover:text-theme-primary hover:bg-white/5'}`}
            >
              <span className="text-lg">👩‍🏫</span>
              UPV (Učitelství)
            </button>
            <button
              onClick={() => setActiveDept('KPV')}
              className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 flex items-center gap-2 ${activeDept === 'KPV' ? 'bg-indigo-600 text-white shadow-md' : 'text-theme-muted hover:text-theme-primary hover:bg-white/5'}`}
            >
              <span className="text-lg">🤝</span>
              KPV (Poradenství)
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-theme-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('AI')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'AI' ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20 rounded-t-lg' : 'border-transparent text-theme-muted hover:text-theme-primary'}`}>
            ✨ AI Knowledge Base
          </button>
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'IMPORT' ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20 rounded-t-lg' : 'border-transparent text-theme-muted hover:text-theme-primary'}`}>
            📂 Roster Import
          </button>
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'TEMPLATES' ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20 rounded-t-lg' : 'border-transparent text-theme-muted hover:text-theme-primary'}`}>
            📄 Template Manager
          </button>
          <button
            onClick={() => setActiveTab('COMPLIANCE')}
            className={`py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'COMPLIANCE' ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20 rounded-t-lg' : 'border-transparent text-theme-muted hover:text-theme-primary'}`}>
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
              <div className="bg-slate-800/50 p-4 rounded-xl border border-theme-border mb-6 overflow-y-auto max-h-48">
                <h3 className="text-sm font-semibold text-theme-secondary mb-4 uppercase tracking-wider">Zdrojové dokumenty (AI Rules)</h3>
                {loadingDocs ? (
                  <p className="text-sm text-theme-muted">Načítám soubory...</p>
                ) : docsList.length === 0 ? (
                  <p className="text-sm text-theme-muted italic">Zatím nebyly nahrány žádné dokumenty pro {activeDept}.</p>
                ) : (
                  <ul className="space-y-2">
                    {docsList.map((doc) => (
                      <li key={doc.name} className="flex items-center justify-between p-2 bg-theme-panel rounded-lg border border-theme-border">
                        <span className="text-sm text-theme-primary truncate pr-4 flex-1" title={doc.name}>{doc.name}</span>
                        <div className="flex items-center gap-3">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium whitespace-nowrap">Stáhnout</a>
                            <button
                                onClick={() => handleDeleteDoc(doc.name, 'ai_rules')}
                                disabled={deletingDoc === doc.name}
                                data-testid={`delete-doc-button-${doc.name}`}
                                className="text-red-400 hover:text-red-300 text-sm font-medium whitespace-nowrap disabled:opacity-50"
                            >
                                {deletingDoc === doc.name ? 'Mažu...' : 'Smazat'}
                            </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center justify-between mb-4">
                 <h3 className="font-bold font-sans text-theme-primary flex items-center gap-2">
                    🧠 Upravit pravidla pro {activeDept}
                 </h3>
                 <div className="relative">
                   <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handlePdfAIImport}
                      disabled={parsingPdf}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      title="Nahrát dokument (PDF/DOCX) pro extrakci textu"
                    />
                   <button
                     disabled={parsingPdf}
                     className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-theme-primary px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                     {parsingPdf ? "🧠 Analyzuji dokument..." : "📥 Importovat z PDF/DOCX"}
                   </button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-2">Metodika</label>
                  <textarea
                    className="w-full h-32 p-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
                    value={activeDept === 'UPV' ? rulesUpv.metodika : rulesKpv.metodika}
                    onChange={(e) => activeDept === 'UPV' ? setRulesUpv({...rulesUpv, metodika: e.target.value}) : setRulesKpv({...rulesKpv, metodika: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-2">Uznatelnost</label>
                  <textarea
                    className="w-full h-32 p-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
                    value={activeDept === 'UPV' ? rulesUpv.uznatelnost : rulesKpv.uznatelnost}
                    onChange={(e) => activeDept === 'UPV' ? setRulesUpv({...rulesUpv, uznatelnost: e.target.value}) : setRulesKpv({...rulesKpv, uznatelnost: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-2">Kompetenční rámec</label>
                  <textarea
                    className="w-full h-32 p-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
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
            <div className="flex flex-col h-[600px] bg-slate-800/50 p-4 rounded-xl border border-theme-border">
              <h3 className="font-bold font-sans text-theme-primary mb-2 flex items-center gap-2">
                ▶️
                Otestovat nanečisto
              </h3>
              <p className="text-sm text-theme-muted mb-4">Vyzkoušejte, jak AI ohodnotí text podle aktuálních (neuložených) pravidel výše.</p>

              <textarea
                className="w-full h-32 p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg mb-4 resize-none text-sm"
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

              <div className="flex-1 overflow-auto bg-slate-800/50 border border-theme-border rounded-lg p-4">
                {testResult ? (
                  <div>
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold mb-4 ${testResult.evaluation?.isPass ? 'bg-green-900/40 text-green-300 border border-green-800' : 'bg-red-900/40 text-red-300 border border-red-800'}`}>
                      Výsledek: {testResult.evaluation?.isPass ? 'SPLNĚNO' : 'NESPLNĚNO'}
                    </div>
                    <pre className="text-xs font-mono text-theme-secondary whitespace-pre-wrap">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-theme-muted text-sm">
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
            <div className="flex items-center gap-3 mb-2 border-b border-theme-border pb-4">
              <span className="text-2xl">📂</span>
              <h2 className="text-xl font-bold font-sans text-theme-primary">Roster Import (Excel/CSV student lists)</h2>
            </div>
            <p className="text-theme-muted text-sm mb-6">Nahrávejte a mapujte seznamy studentů z Excelu (.xlsx) nebo CSV pro automatické vytvoření uživatelů.</p>

            {!importStats ? (
                <VisualMappingImport onSuccess={setImportStats} department={activeDept} initialFile={importFileToPass} />
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
                    onClick={() => {
                        setImportStats(null);
                        fetchImportLogs(); // refresh logs after dismiss
                    }}
                    className="inline-flex items-center gap-2 text-sm font-semibold bg-slate-800/50 px-4 py-2 border border-slate-700 rounded-lg text-theme-primary hover:bg-slate-700 transition"
                  >
                    Nahrát další soubor
                  </button>
                </div>
              </div>
            )}

            <div className="mt-12">
                <h3 className="text-lg font-bold text-theme-primary mb-4 border-b border-theme-border pb-2">Historie importů</h3>
                {loadingLogs ? (
                    <p className="text-sm text-theme-muted">Načítám historii...</p>
                ) : importLogs.length === 0 ? (
                    <p className="text-sm text-theme-muted italic">Zatím nebyly provedeny žádné importy.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-theme-secondary">
                            <thead className="text-xs text-theme-muted uppercase bg-theme-panel">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Datum</th>
                                    <th className="px-4 py-3">Přidáno</th>
                                    <th className="px-4 py-3">Aktualizováno</th>
                                    <th className="px-4 py-3">Ignorováno</th>
                                    <th className="px-4 py-3 rounded-tr-lg">Provedl (UID)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {importLogs.map((log) => (
                                    <tr key={log.id} className="border-b border-theme-border bg-slate-800/30 hover:bg-slate-800/50 transition">
                                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                                            {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('cs-CZ') : 'Neznámé'}
                                        </td>
                                        <td className="px-4 py-3 text-green-400">+{log.added}</td>
                                        <td className="px-4 py-3 text-blue-400">~{log.updated}</td>
                                        <td className="px-4 py-3 text-slate-500">{log.ignored}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{log.importedBy}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
          </div>
        )}

                {activeTab === 'TEMPLATES' && (
          <div className="card-glass p-8">
            <div className="flex items-center gap-3 mb-4 border-b border-theme-border pb-4">
              <span className="text-2xl">📄</span>
              <h2 className="text-xl font-bold font-sans text-theme-primary">Template Manager ({activeDept})</h2>
            </div>

            <div className="bg-amber-900/20 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="font-bold text-amber-300 text-sm">Důležité upozornění pro AI</h3>
                <p className="text-amber-400/80 text-sm mt-1">
                  Soubory nahrané do této sekce slouží <strong>pouze ke stažení</strong> pro studenty a mentory.
                  Tyto dokumenty <strong>NEJSOU</strong> čteny ani analyzovány umělou inteligencí. Pro úpravu pravidel hodnocení přejděte na záložku &quot;AI Knowledge Base&quot;.
                </p>
              </div>
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
                 <h2 className="text-xl font-bold font-sans text-theme-primary pointer-events-none">Nahrát šablonu</h2>
                 <p className="text-theme-muted mt-2 pointer-events-none">
                   {uploadingTemplate ? 'Nahrávám...' : 'Klikněte pro nahrání šablony (.pdf, .docx, .pptx) do Firebase Storage.'}
                 </p>
                 <p className="text-slate-500 text-xs mt-2 pointer-events-none">
                   Tip: Přehrání existujícího souboru provedete nahráním souboru se stejným názvem.
                 </p>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-xl border border-theme-border overflow-y-auto h-64">
                <h3 className="text-sm font-semibold text-theme-secondary mb-4 uppercase tracking-wider">Nahrané šablony</h3>
                {loadingDocs ? (
                  <p className="text-sm text-theme-muted">Načítám soubory...</p>
                ) : docsList.length === 0 ? (
                  <p className="text-sm text-theme-muted italic">Zatím nebyly nahrány žádné šablony pro {activeDept}.</p>
                ) : (
                  <ul className="space-y-3">
                    {docsList.map((doc) => (
                      <li key={doc.name} className="flex items-center justify-between p-3 bg-theme-panel rounded-lg border border-theme-border">
                        <span className="text-sm text-theme-primary truncate pr-4 flex-1" title={doc.name}>{doc.name}</span>
                        <div className="flex items-center gap-3">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium whitespace-nowrap">Stáhnout</a>
                            <button
                                onClick={() => handleDeleteDoc(doc.name, 'templates')}
                                disabled={deletingDoc === doc.name}
                                data-testid={`delete-doc-button-${doc.name}`}
                                className="text-red-400 hover:text-red-300 text-sm font-medium whitespace-nowrap disabled:opacity-50"
                            >
                                {deletingDoc === doc.name ? 'Mažu...' : 'Smazat'}
                            </button>
                        </div>
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
            <div className="flex items-center gap-3 mb-4 border-b border-theme-border pb-4">
              <span className="text-2xl">🏛️</span>
              <h2 className="text-xl font-bold font-sans text-theme-primary">Compliance Archive ({activeDept})</h2>
            </div>

            <div className="bg-amber-900/20 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="font-bold text-amber-300 text-sm">Důležité upozornění pro AI</h3>
                <p className="text-amber-400/80 text-sm mt-1">
                  Smlouvy nahrané do této sekce slouží <strong>pouze jako archiv a ke stažení</strong>.
                  Tyto dokumenty <strong>NEJSOU</strong> čteny ani analyzovány umělou inteligencí. Pro úpravu pravidel hodnocení přejděte na záložku &quot;AI Knowledge Base&quot;.
                </p>
              </div>
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
                 <h2 className="text-xl font-bold font-sans text-theme-primary pointer-events-none">Nahrát rámcovou smlouvu</h2>
                 <p className="text-theme-muted mt-2 pointer-events-none">
                   {uploadingCompliance ? 'Nahrávám...' : 'Klikněte pro nahrání rámcové smlouvy (.pdf, .docx, .pptx) do Firebase Storage.'}
                 </p>
                 <p className="text-slate-500 text-xs mt-2 pointer-events-none">
                   Tip: Přehrání existujícího souboru provedete nahráním souboru se stejným názvem.
                 </p>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-xl border border-theme-border overflow-y-auto h-64">
                <h3 className="text-sm font-semibold text-theme-secondary mb-4 uppercase tracking-wider">Nahrané smlouvy</h3>
                {loadingDocs ? (
                  <p className="text-sm text-theme-muted">Načítám soubory...</p>
                ) : docsList.length === 0 ? (
                  <p className="text-sm text-theme-muted italic">Zatím nebyly nahrány žádné smlouvy pro {activeDept}.</p>
                ) : (
                  <ul className="space-y-3">
                    {docsList.map((doc) => (
                      <li key={doc.name} className="flex items-center justify-between p-3 bg-theme-panel rounded-lg border border-theme-border">
                        <span className="text-sm text-theme-primary truncate pr-4 flex-1" title={doc.name}>{doc.name}</span>
                        <div className="flex items-center gap-3">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium whitespace-nowrap">Stáhnout</a>
                            <button
                                onClick={() => handleDeleteDoc(doc.name, 'compliance')}
                                disabled={deletingDoc === doc.name}
                                data-testid={`delete-doc-button-${doc.name}`}
                                className="text-red-400 hover:text-red-300 text-sm font-medium whitespace-nowrap disabled:opacity-50"
                            >
                                {deletingDoc === doc.name ? 'Mažu...' : 'Smazat'}
                            </button>
                        </div>
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
