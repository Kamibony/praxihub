'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Chatbot from "@/components/Chatbot";
import { Download } from 'lucide-react';

// Define filter type
type FilterStatus = 'ALL' | 'PENDING_ORG_APPROVAL' | 'APPROVED' | 'NEEDS_REVIEW' | 'ANALYZING';

export default function CoordinatorDashboard() {
  const [internships, setInternships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [selectedInternship, setSelectedInternship] = useState<any>(null);
  const router = useRouter();

  // OPRAVA: Bezpečný useEffect s cleanup logikou
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // 1. Vyčistiť predchádzajúci listener
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (!user) {
        router.push("/login");
      } else {
        const q = query(collection(db, "internships"), orderBy("createdAt", "desc"));
        
        // 2. Nastaviť nový listener a uložiť funkciu
        unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setInternships(data);
          setLoading(false);
        });
      }
    });

    // 3. Cleanup pri unmount
    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [router]);

  const getCompanyAverageRating = (ico: string) => {
    if (!ico) return null;
    const companyInternships = internships.filter(i => i.organization_ico === ico && i.studentRating > 0);
    if (companyInternships.length === 0) return null;
    const sum = companyInternships.reduce((acc, curr) => acc + curr.studentRating, 0);
    return (sum / companyInternships.length).toFixed(1);
  };

  // OPRAVA: Pridaná funkcia pre formátovanie dátumu (D. M. YYYY)
  const formatDateCZ = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
  };

  const handleExport = () => {
    const headers = ["Student Name", "Email", "Organization", "ICO", "Status", "Start Date", "End Date"];
    const csvContent = [
      headers.join(","),
      ...internships.map(item => [
        `"${item.studentName || ''}"`,
        `"${item.studentEmail || ''}"`,
        `"${item.organization_name || ''}"`,
        `"${item.organization_ico || ''}"`,
        `"${item.status || ''}"`,
        `"${item.start_date ? formatDateCZ(item.start_date) : ''}"`,
        `"${item.end_date ? formatDateCZ(item.end_date) : ''}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "praxe_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Actions for Organization Approval
  const handleApproveOrg = async (id: string) => {
    if (!confirm("Opravdu chcete schválit tuto firmu?")) return;
    try {
        await updateDoc(doc(db, "internships", id), {
            status: 'ORG_APPROVED'
        });
    } catch (e) {
        console.error("Error approving org:", e);
        alert("Chyba při schvalování.");
    }
  };

  const handleRejectOrg = async (id: string) => {
    const reason = prompt("Zadejte důvod zamítnutí:");
    if (reason === null) return; // Cancelled
    try {
        await updateDoc(doc(db, "internships", id), {
            status: 'REJECTED',
            ai_error_message: reason
        });
    } catch (e) {
        console.error("Error rejecting org:", e);
        alert("Chyba při zamítání.");
    }
  };

  // Filter Logic
  const filteredInternships = internships.filter(item => {
    if (filterStatus === 'ALL') return true;
    return item.status === filterStatus;
  });

  const getCardClasses = (status: FilterStatus) => {
    const isActive = filterStatus === status;
    return `bg-white p-4 rounded-lg shadow-sm border cursor-pointer transition-all duration-200 ${
      isActive
        ? 'border-blue-500 ring-2 ring-blue-100 transform scale-[1.02]'
        : 'border-gray-100 hover:border-blue-300 hover:shadow-md'
    }`;
  };

  const pendingOrgs = internships.filter(i => i.status === 'PENDING_ORG_APPROVAL').length;
  const pendingReview = internships.filter(i => i.status === 'NEEDS_REVIEW').length;
  const chatbotMessage = `Vítej zpět! Aktuálně máš ke schválení ${pendingOrgs} firem a ${pendingReview} smluv čeká na kontrolu.`;

  // Statistics for Overview Section
  const approvedCount = internships.filter(i => i.status === 'APPROVED').length;
  const totalCount = internships.length;
  const progressPercentage = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  const companyCounts: Record<string, number> = {};
  internships.forEach(i => {
    if (i.organization_name) {
      companyCounts[i.organization_name] = (companyCounts[i.organization_name] || 0) + 1;
    }
  });
  const topPartners = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (loading) return <div className="p-8 text-center text-gray-500">Načítám data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <Chatbot initialMessage={chatbotMessage} />
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Centrální přehled praxí</h1>
            <p className="text-gray-600 mt-2">Manažment a monitoring všech smluv</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Přihlášen jako: Koordinátor</span>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <Download size={16} />
              Exportovat CSV
            </button>
            <button onClick={() => auth.signOut()} className="text-sm px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 transition-colors">Odhlásit</button>
          </div>
        </header>

        {/* OVERVIEW SECTION */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Widget 1: Semester Progress */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Stav Ročníku</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{progressPercentage} % splněno</span>
                <span className="text-sm text-gray-400">{approvedCount} / {totalCount} studentů</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Widget 2: Top Partners */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Partneři</h3>
              <ul className="space-y-3">
                {topPartners.length > 0 ? (
                  topPartners.map(([name, count], index) => (
                    <li key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{index + 1}. {name}</span>
                      <span className="text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">{count}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-400 italic">Zatím žádná data</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* ŠTATISTIKY / FILTRE */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
           <div
             className={getCardClasses('ALL')}
             onClick={() => setFilterStatus('ALL')}
           >
             <p className="text-xs text-gray-500 uppercase font-bold">Celkem smluv</p>
             <p className="text-2xl font-bold text-gray-900">{internships.length}</p>
           </div>
           <div
             className={getCardClasses('PENDING_ORG_APPROVAL')}
             onClick={() => setFilterStatus('PENDING_ORG_APPROVAL')}
           >
             <p className="text-xs text-gray-500 uppercase font-bold">Žádosti o schválení</p>
             <p className="text-2xl font-bold text-blue-800">{internships.filter(i => i.status === 'PENDING_ORG_APPROVAL').length}</p>
           </div>
           <div
             className={getCardClasses('APPROVED')}
             onClick={() => setFilterStatus('APPROVED')}
           >
             <p className="text-xs text-gray-500 uppercase font-bold">Schváleno</p>
             <p className="text-2xl font-bold text-green-600">{internships.filter(i => i.status === 'APPROVED').length}</p>
           </div>
           <div
             className={getCardClasses('NEEDS_REVIEW')}
             onClick={() => setFilterStatus('NEEDS_REVIEW')}
           >
             <p className="text-xs text-gray-500 uppercase font-bold">Čeká na kontrolu</p>
             <p className="text-2xl font-bold text-yellow-600">{internships.filter(i => i.status === 'NEEDS_REVIEW').length}</p>
           </div>
           <div
             className={getCardClasses('ANALYZING')}
             onClick={() => setFilterStatus('ANALYZING')}
           >
             <p className="text-xs text-gray-500 uppercase font-bold">AI zpracovává</p>
             <p className="text-2xl font-bold text-blue-600">{internships.filter(i => i.status === 'ANALYZING').length}</p>
           </div>
        </div>

        {/* TABUĽKA */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detekovaná Firma</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Termín</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akce</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInternships.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedInternship(item)}
                    className={`cursor-pointer transition-colors ${item.status === 'PENDING_ORG_APPROVAL' ? 'bg-blue-50/30 hover:bg-blue-100/50' : 'hover:bg-blue-50'}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                            {(item.studentName || item.studentEmail || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.studentName ? item.studentName : item.studentEmail}
                            </div>
                            {item.studentName && (
                              <div className="text-xs text-gray-500">{item.studentEmail}</div>
                            )}
                            <div className="text-xs text-gray-400">ID: {item.studentId?.substring(0,8)}...</div>
                          </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        {item.organization_name ? (
                           <div>
                             <div className="text-sm text-gray-900 font-medium flex items-center gap-2">
                               {item.organization_name}
                               {item.organization_ico && (() => {
                                 const rating = getCompanyAverageRating(item.organization_ico);
                                 return rating ? (
                                   <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 text-xs font-bold border border-yellow-200">
                                     <span>★</span> {rating}
                                   </span>
                                 ) : null;
                               })()}
                             </div>
                             <div className="text-xs text-gray-500 font-mono">IČO: {item.organization_ico || 'N/A'}</div>
                             {item.organization_web && (
                                <a
                                  href={item.organization_web.startsWith('http') ? item.organization_web : `https://${item.organization_web}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-500 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                    {item.organization_web}
                                </a>
                             )}
                           </div>
                        ) : (
                          <span className="text-gray-400 italic text-sm">--</span>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.start_date ? `${formatDateCZ(item.start_date)} - ${formatDateCZ(item.end_date)}` : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                        item.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : 
                        item.status === 'ORG_APPROVED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        item.status === 'PENDING_ORG_APPROVAL' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        item.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 
                        item.status === 'NEEDS_REVIEW' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                      }`}>
                         {item.status === 'PENDING_ORG_APPROVAL' ? 'Schválení firmy' :
                          item.status === 'ORG_APPROVED' ? 'Firma schválena' :
                          item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      {item.status === 'PENDING_ORG_APPROVAL' ? (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); handleApproveOrg(item.id); }} className="text-green-600 hover:text-green-900 font-bold hover:underline">Schválit</button>
                            <button onClick={(e) => { e.stopPropagation(); handleRejectOrg(item.id); }} className="text-red-600 hover:text-red-900 font-bold hover:underline">Zamítnout</button>
                          </>
                      ) : (
                          <>
                            <a
                                href={`mailto:${item.studentEmail}?subject=Dotaz k praxi&body=Dobrý den, ohledně vaší smlouvy...`}
                                className="text-gray-400 hover:text-gray-600 inline-block align-middle"
                                title="Napsat email"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </a>
                            {item.contract_url ? (
                                <a
                                    href={item.contract_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:text-blue-900 hover:underline inline-block align-middle"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Otevřít PDF
                                </a>
                            ) : (
                                <span className="text-gray-300 cursor-not-allowed">PDF</span>
                            )}
                          </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredInternships.length === 0 && (
                    <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                            {internships.length === 0
                                ? "Zatím žádné nahrané praxe v systému."
                                : "Žádné záznamy pro tento filtr."}
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* MODAL - DETAIL VIEW */}
        {selectedInternship && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedInternship(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <header className="flex justify-between items-start p-6 border-b border-gray-100">
                <div>
                   <h2 className="text-2xl font-bold text-gray-900">
                     {selectedInternship.studentName || selectedInternship.studentEmail || "Detail stáže"}
                   </h2>
                   <div className="mt-2">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                        selectedInternship.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                        selectedInternship.status === 'ORG_APPROVED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        selectedInternship.status === 'PENDING_ORG_APPROVAL' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        selectedInternship.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                        selectedInternship.status === 'NEEDS_REVIEW' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                         {selectedInternship.status === 'PENDING_ORG_APPROVAL' ? 'Čeká na schválení' :
                          selectedInternship.status === 'ORG_APPROVED' ? 'Firma schválena' :
                          selectedInternship.status}
                      </span>
                   </div>
                </div>
                <button
                  onClick={() => setSelectedInternship(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </header>

              <div className="p-6 space-y-6">
                {/* Section 1: Student */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Student</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm font-medium text-gray-900">{selectedInternship.studentEmail}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ID studenta</p>
                      <p className="text-sm font-medium text-gray-900 font-mono">{selectedInternship.studentId}</p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Organization */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Organizace</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500">Název firmy</p>
                      <p className="text-lg font-bold text-gray-900">{selectedInternship.organization_name || "Neznámá firma"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">IČO</p>
                      <p className="text-sm font-medium text-gray-900 font-mono">{selectedInternship.organization_ico || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Web</p>
                      {selectedInternship.organization_web ? (
                         <a
                            href={selectedInternship.organization_web.startsWith('http') ? selectedInternship.organization_web : `https://${selectedInternship.organization_web}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                         >
                            {selectedInternship.organization_web}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                         </a>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Neuveden</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Contract */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Smlouva</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Termín praxe</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedInternship.start_date ? `${formatDateCZ(selectedInternship.start_date)} - ${formatDateCZ(selectedInternship.end_date)}` : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Dokument</p>
                      {selectedInternship.contract_url ? (
                        <a
                          href={selectedInternship.contract_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline mt-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Stáhnout PDF
                        </a>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Smlouva nedostupná</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setSelectedInternship(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
                >
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
