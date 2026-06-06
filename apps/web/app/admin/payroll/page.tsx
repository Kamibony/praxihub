'use client';

import React, { useState, useEffect } from 'react';
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Link from 'next/link';


export default function PayrollModule() {
  const [loading, setLoading] = useState(true);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [rates, setRates] = useState<any>({ UPV: 150, KPV: 200 }); // Default fallbacks
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    async function fetchPayroll() {
      try {
        // Fetch payroll settings (rates)
        const configDoc = await getDoc(doc(db, "system_configs", "payroll_settings"));
        let currentRates = { UPV: 150, KPV: 200 };
        if (configDoc.exists() && configDoc.data().rates) {
           currentRates = configDoc.data().rates;
           setRates(currentRates);
        }

        // Fetch valid placements
        const placementsRef = collection(db, "placements");
        const evaluationQ = query(placementsRef, where("status", "==", "EVALUATION"));
        const closedQ = query(placementsRef, where("status", "==", "CLOSED"));

        const [evalSnap, closedSnap] = await Promise.all([getDocs(evaluationQ), getDocs(closedQ)]);
        const allPlacements: any[] = [...evalSnap.docs, ...closedSnap.docs].map(d => ({ id: d.id, ...(d.data() as any) }));

        const groupedData: Record<string, any> = {};

        for (const placement of allPlacements) {
            const orgId = placement.institutionId || placement.mentorId || placement.organization_name; // Fallback mapping for institution grouping
            if (!orgId) continue;

            if (!groupedData[orgId]) {
                groupedData[orgId] = {
                   institutionName: placement.organization_name || "Neznámá organizace",
                   institutionIco: placement.organization_ico || "-",
                   approvedHoursUPV: 0,
                   approvedHoursKPV: 0,
                   totalPayout: 0,
                   placements: []
                };
            }

            const userRef = await getDoc(doc(db, "users", placement.studentId));
            const major = userRef.exists() ? userRef.data().major : null;

            // To calculate approved hours, we must fetch time_logs.
            const timeLogsRef = collection(db, "placements", placement.id, "time_logs");
            const approvedLogsQ = query(timeLogsRef, where("status", "==", "approved"));
            const logsSnap = await getDocs(approvedLogsQ);

            const placementApprovedHours = logsSnap.docs.reduce((sum, logDoc) => sum + (Number(logDoc.data().hours) || 0), 0);

            if (major === "UPV") {
                groupedData[orgId].approvedHoursUPV += placementApprovedHours;
                groupedData[orgId].totalPayout += placementApprovedHours * currentRates.UPV;
            } else if (major === "KPV") {
                groupedData[orgId].approvedHoursKPV += placementApprovedHours;
                groupedData[orgId].totalPayout += placementApprovedHours * currentRates.KPV;
            } else {
                console.warn(`Záznam praxe ${placement.id} nemá nastavený obor (UPV/KPV). Hodiny nebudou započítány do mzdy.`);
            }

            groupedData[orgId].placements.push({
               placementId: placement.id,
               studentName: userRef.exists() ? (userRef.data().displayName || userRef.data().email) : placement.studentId,
               hours: placementApprovedHours,
               major: major
            });
        }

        const formattedData = Object.values(groupedData);
        setPayrollData(formattedData);

        const total = formattedData.reduce((sum, row) => sum + row.totalPayout, 0);
        setTotalCost(total);

      } catch (err) {
        console.error("Error fetching payroll data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPayroll();
  }, []);

  const downloadCSV = () => {
     let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM for excel
     csvContent += "Organizace,IČO,Schválené hodiny (UPV),Schválené hodiny (KPV),Odměna celkem (CZK)\n";

     payrollData.forEach(row => {
         const line = `"${row.institutionName}","${row.institutionIco}",${row.approvedHoursUPV},${row.approvedHoursKPV},${row.totalPayout}`;
         csvContent += line + "\n";
     });

     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", "payroll_export.csv");
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  if (loading) return <div className="p-8 text-theme-primary">Načítám výkaz...</div>;

  return (

    <div className="min-h-screen bg-transparent">
      <Navbar />
      <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-3xl font-bold font-sans text-theme-primary">Mzdový modul (Payroll)</h1>
          <Link
            href="/admin/dashboard"
            className="text-sm font-medium text-theme-secondary hover:text-blue-400 transition"
          >
            &larr; Zpět na Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card-glass p-6 rounded-2xl border border-theme-border">
                <p className="text-sm font-bold text-theme-muted uppercase tracking-wider mb-2">Sazba UPV</p>
                <p className="text-3xl font-bold text-theme-primary">{rates.UPV} CZK / h</p>
            </div>
            <div className="card-glass p-6 rounded-2xl border border-theme-border">
                <p className="text-sm font-bold text-theme-muted uppercase tracking-wider mb-2">Sazba KPV</p>
                <p className="text-3xl font-bold text-theme-primary">{rates.KPV} CZK / h</p>
            </div>
            <div className="card-glass p-6 rounded-2xl border border-green-500/30 bg-green-900/10">
                <p className="text-sm font-bold text-green-400 uppercase tracking-wider mb-2">Celkové odměny</p>
                <p className="text-3xl font-bold text-green-300">{totalCost.toLocaleString('cs-CZ')} CZK</p>
            </div>
        </div>

        <div className="card-glass rounded-3xl overflow-hidden border border-theme-border">
          <div className="flex justify-between items-center p-6 border-b border-theme-border bg-theme-panel">
            <h2 className="text-xl font-bold text-theme-primary">Výkaz odměn mentorů podle organizace</h2>
            <button
                onClick={downloadCSV}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-sm flex items-center gap-2"
            >
                <span>⬇️</span> Exportovat CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-theme-secondary">
              <thead className="bg-theme-panel text-theme-muted font-bold">
                <tr>
                  <th className="px-6 py-4">Organizace</th>
                  <th className="px-6 py-4">IČO</th>
                  <th className="px-6 py-4">Hodiny UPV</th>
                  <th className="px-6 py-4">Hodiny KPV</th>
                  <th className="px-6 py-4 text-right">Odměna celkem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payrollData.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">Žádné schválené praxe k vyúčtování.</td></tr>
                ) : (
                    payrollData.map((row, idx) => (
                    <tr key={idx} data-testid="payroll-row" className="hover:bg-slate-800/30 transition">
                        <td className="px-6 py-4 font-bold text-theme-primary" data-testid="institution-name">{row.institutionName}</td>
                        <td className="px-6 py-4 font-mono text-theme-muted">{row.institutionIco}</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded-md font-mono">{row.approvedHoursUPV} h</span></td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-900/30 text-indigo-300 rounded-md font-mono">{row.approvedHoursKPV} h</span></td>
                        <td className="px-6 py-4 text-right font-bold text-green-400 text-base">{row.totalPayout.toLocaleString('cs-CZ')} CZK</td>
                    </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

  );
}
