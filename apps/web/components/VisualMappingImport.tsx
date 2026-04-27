"use client";

import React, { useState } from 'react';
import * as xlsx from 'xlsx';
import { Database, CheckCircle, AlertTriangle, ArrowRight, Upload } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface VisualMappingImportProps {
  onSuccess: (stats: any) => void;
  department?: 'UPV' | 'KPV';
}

export default function VisualMappingImport({ onSuccess, department }: VisualMappingImportProps) {
  const [fileData, setFileData] = useState<any[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [validationReport, setValidationReport] = useState<any>(null);

  // Mapping state: destination field -> source column index
  const [mapping, setMapping] = useState({
    uid: -1,
    firstName: -1,
    lastName: -1,
    email: -1,
    organizationId: -1,
    ico: -1,
    year: -1,
    major: -1,
    migratedHours: -1,
    targetHours: -1,
    name: -1 // Optional: combined name
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const wb = xlsx.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      // Basic heuristic to find headers (first non-empty row)
      let headerRowIndex = 0;
      for (let i = 0; i < data.length; i++) {
          if (data[i] && data[i].length > 0 && data[i].some(c => typeof c === 'string')) {
              headerRowIndex = i;
              break;
          }
      }

      const rawHeaders = data[headerRowIndex] || [];
      const cleanHeaders = rawHeaders.map((h, i) => h ? String(h) : `Sloupec ${i + 1}`);

      setHeaders(cleanHeaders);
      setFileData(data.slice(headerRowIndex + 1).filter(r => r && r.length > 0)); // Skip headers and empty rows

      // Auto-guess some mappings
      const newMapping = { ...mapping };
      cleanHeaders.forEach((h, i) => {
          const lower = h.toLowerCase();
          if (lower.includes('id') || lower.includes('uid')) newMapping.uid = i;
          if (lower.includes('jméno') && !lower.includes('příjmení')) newMapping.firstName = i;
          if (lower.includes('příjmení')) newMapping.lastName = i;
          if (lower.includes('jméno') && lower.includes('příjmení')) newMapping.name = i;
          if (lower.includes('email') || lower.includes('e-mail')) newMapping.email = i;
          if (lower.includes('škola') || lower.includes('organizace') || lower.includes('lokace')) newMapping.organizationId = i;
          if (lower.includes('ičo') || lower.includes('ico') || lower.includes('ič')) newMapping.ico = i;
          if (lower.includes('ročník') || lower.includes('rok')) newMapping.year = i;
          if (lower.includes('major') || lower.includes('zaměření') || lower.includes('obor')) newMapping.major = i;
          if (lower.includes('hodiny') || lower.includes('hours') || lower.includes('odpracováno')) newMapping.migratedHours = i;
          if (lower.includes('cílový počet') || lower.includes('cíl') || lower.includes('target')) newMapping.targetHours = i;
      });
      setMapping(newMapping);
    };
    reader.readAsBinaryString(file);
  };

  const handleMappingChange = (field: string, val: string) => {
      setMapping(prev => ({ ...prev, [field]: parseInt(val) }));
  };

  const generateValidationReport = () => {
    if (!fileData) return null;

    if (mapping.name === -1 && (mapping.firstName === -1 || mapping.lastName === -1)) {
        alert("Musíte namapovat buď Celé jméno, nebo Jméno a Příjmení.");
        return null;
    }

    const mappedData = [];
    let activeSchoolId = null;
    let fallbackEmailCount = 0;
    const orgs = new Set<string>();

    for (const row of fileData) {
        if (mapping.organizationId !== -1 && row[mapping.organizationId]) {
            activeSchoolId = row[mapping.organizationId];
        }

        const mappedRow: any = {};

        if (mapping.ico !== -1) mappedRow.ico = row[mapping.ico];

        if (mapping.uid !== -1) mappedRow.uid = row[mapping.uid];
        if (mapping.name !== -1) mappedRow.name = row[mapping.name];
        if (mapping.firstName !== -1) mappedRow.firstName = row[mapping.firstName];
        if (mapping.lastName !== -1) mappedRow.lastName = row[mapping.lastName];
        if (mapping.email !== -1) mappedRow.email = row[mapping.email];
        if (mapping.year !== -1) mappedRow.year = row[mapping.year];
        if (department) {
            mappedRow.major = department;
        } else if (mapping.major !== -1) {
            mappedRow.major = row[mapping.major];
        }
        if (mapping.migratedHours !== -1) mappedRow.migratedHours = Number(row[mapping.migratedHours]) || 0;
        if (mapping.targetHours !== -1) mappedRow.targetHours = Number(row[mapping.targetHours]) || 15;

        mappedRow.organizationId = mapping.organizationId !== -1 ? (row[mapping.organizationId] || activeSchoolId) : null;

        if (mappedRow.name || mappedRow.firstName || mappedRow.lastName) {
            mappedData.push(mappedRow);
            if (!mappedRow.email) fallbackEmailCount++;
            if (mappedRow.organizationId) orgs.add(String(mappedRow.organizationId).trim());
        }
    }

    return {
        mappedData,
        placementCount: mappedData.length,
        orgCount: orgs.size,
        fallbackEmailCount
    };
  };

  const handleValidate = () => {
     const report = generateValidationReport();
     if (report) {
         setValidationReport(report);
     }
  };

  const executeImport = async () => {
    if (!validationReport) return;
    setImporting(true);

    try {
        const importFn = httpsCallable(functions, 'importRoster');
        const res = await importFn({ mappedData: validationReport.mappedData });
        onSuccess(res.data);
    } catch (error) {
        console.error("Import execution failed", error);
        alert('Chyba při vykonávání importu. Zkontrolujte konzoli.');
    } finally {
        setImporting(false);
    }
  };

  if (!fileData) {
      return (
        <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center bg-transparent relative hover:bg-slate-800 transition">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center pointer-events-none">
            <div className="text-5xl mb-4 opacity-50">📤</div>
            <p className="font-medium text-slate-200 text-lg">
              Klikněte nebo přetáhněte Excel soubor s rosterem
            </p>
            <p className="text-sm text-slate-400 mt-2">.xlsx, .xls</p>
          </div>
        </div>
      );
  }

  return (
      <div className="space-y-6">
          <div className="bg-indigo-900/20 border border-indigo-800/50 rounded-lg p-4 flex items-start gap-3">
              <span className="text-xl">📂</span>
              <div>
                  <h3 className="font-bold text-indigo-300">Mapování sloupců (ETL)</h3>
                  <p className="text-sm text-indigo-400 mt-1">
                      Přiřaďte sloupce z vašeho Excelu k našim databázovým polím. Pro sloupec "Škola/Organizace" podporujeme rolovací stav (spojené buňky).
                  </p>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mapping Controls */}
              <div className="space-y-3 bg-slate-800/50 p-4 rounded-xl border border-white/10">
                  <h4 className="font-semibold text-slate-100 border-b pb-2">Požadovaná pole</h4>

                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">Celé Jméno</label>
                      <select value={mapping.name} onChange={(e) => handleMappingChange('name', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Ignorovat --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>
                  <div className="text-xs text-slate-400 text-center">- NEBO -</div>
                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">Křestní jméno</label>
                      <select value={mapping.firstName} onChange={(e) => handleMappingChange('firstName', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Ignorovat --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">IČO Instituce</label>
                      <select value={mapping.ico} onChange={(e) => handleMappingChange('ico', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Ignorovat --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">Příjmení</label>
                      <select value={mapping.lastName} onChange={(e) => handleMappingChange('lastName', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Ignorovat --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>

                  <h4 className="font-semibold text-slate-100 border-b pb-2 mt-4 pt-2">Volitelná pole</h4>

                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">ID Studenta (UID)</label>
                      <select value={mapping.uid} onChange={(e) => handleMappingChange('uid', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Generovat automaticky --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">Email</label>
                      <select value={mapping.email} onChange={(e) => handleMappingChange('email', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Generovat automaticky --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">Škola / Organizace</label>
                      <select value={mapping.organizationId} onChange={(e) => handleMappingChange('organizationId', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Ignorovat --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">Ročník</label>
                      <select value={mapping.year} onChange={(e) => handleMappingChange('year', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Ignorovat --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">Zaměření (Major)</label>
                      {department ? (
                        <div className="w-48 text-right text-sm font-medium text-indigo-300">
                           {department} (Vynuceno filtrem)
                        </div>
                      ) : (
                        <select value={mapping.major} onChange={(e) => handleMappingChange('major', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                            <option value={-1}>-- Ignorovat --</option>
                            {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                        </select>
                      )}
                  </div>
                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">Odpracované hodiny</label>
                      <select value={mapping.migratedHours} onChange={(e) => handleMappingChange('migratedHours', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Ignorovat --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-200">Cílový počet hodin</label>
                      <select value={mapping.targetHours} onChange={(e) => handleMappingChange('targetHours', e.target.value)} className="border border-white/10 p-1.5 rounded text-sm w-48 bg-slate-950/50 text-slate-100">
                          <option value={-1}>-- Výchozí (15) --</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                  </div>
              </div>

              {/* Data Preview */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-white/10 overflow-x-auto">
                  <h4 className="font-semibold text-slate-100 border-b pb-2 mb-3">Náhled dat (první 3 řádky)</h4>
                  <table className="min-w-full text-xs text-left">
                      <thead className="bg-slate-800/50">
                          <tr>
                              {headers.map((h, i) => (
                                  <th key={i} className="px-2 py-1.5 border-b border-white/10 text-slate-300 font-medium whitespace-nowrap">{h}</th>
                              ))}
                          </tr>
                      </thead>
                      <tbody>
                          {fileData.slice(0, 3).map((row, rowIdx) => (
                              <tr key={rowIdx} className="border-b border-white/5 last:border-0">
                                  {headers.map((_, colIdx) => (
                                      <td key={colIdx} className="px-2 py-1.5 text-slate-200 max-w-[150px] truncate">
                                          {row[colIdx] !== undefined ? String(row[colIdx]) : ''}
                                      </td>
                                  ))}
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  <div className="mt-3 text-xs text-slate-400 italic">
                      Celkem načteno {fileData.length} datových řádků.
                  </div>
              </div>
          </div>

          {!validationReport ? (
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                      onClick={() => setFileData(null)}
                      className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
                  >
                      Zrušit a vybrat jiný soubor
                  </button>
                  <button
                      onClick={handleValidate}
                      className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                  >
                      Pokračovat k validaci
                      ➡️
                  </button>
              </div>
          ) : (
              <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-6 mt-6">
                  <div className="flex items-start gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div className="flex-1">
                          <h3 className="text-lg font-bold text-yellow-300 mb-2">Validační Report: Připraveno k importu</h3>
                          <p className="text-sm text-yellow-400 mb-4">
                              Zkontrolujte prosím následující údaje před definitivním zapsáním do databáze.
                          </p>
                          <ul className="list-disc pl-5 text-sm text-yellow-400 space-y-1 mb-6">
                              <li>Bude vytvořeno nebo aktualizováno <strong>{validationReport.placementCount} Placementů</strong>.</li>
                              <li>Bude zpracováno <strong>{validationReport.orgCount} Organizací (nových či existujících)</strong>.</li>
                              <li>Bude vygenerováno <strong>{validationReport.fallbackEmailCount} fallback e-mailů</strong> (pro studenty bez zadaného e-mailu).</li>
                          </ul>

                          <div className="flex justify-end gap-3 pt-4 border-t border-yellow-800/50">
                              <button
                                  onClick={() => setValidationReport(null)}
                                  disabled={importing}
                                  className="px-4 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-800/50 rounded-lg transition"
                              >
                                  Zpět k mapování
                              </button>
                              <button
                                  onClick={executeImport}
                                  disabled={importing}
                                  className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50"
                              >
                                  {importing ? 'Importuji...' : 'Potvrdit a importovat'}
                                  {!importing && "✅"}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
}
