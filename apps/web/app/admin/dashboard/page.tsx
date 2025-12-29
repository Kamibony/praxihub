'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function CoordinatorDashboard() {
  const [internships, setInternships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className="p-8 text-center text-gray-500">Načítám data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Centrální přehled praxí</h1>
            <p className="text-gray-600 mt-2">Manažment a monitoring všech smluv</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Přihlášen jako: Koordinátor</span>
            <button onClick={() => auth.signOut()} className="text-sm px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700">Odhlásit</button>
          </div>
        </header>

        {/* ŠTATISTIKY */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
           <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
             <p className="text-xs text-gray-500 uppercase font-bold">Celkem smluv</p>
             <p className="text-2xl font-bold text-gray-900">{internships.length}</p>
           </div>
           <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
             <p className="text-xs text-gray-500 uppercase font-bold">Schváleno</p>
             <p className="text-2xl font-bold text-green-600">{internships.filter(i => i.status === 'APPROVED').length}</p>
           </div>
           <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
             <p className="text-xs text-gray-500 uppercase font-bold">Čeká na kontrolu</p>
             <p className="text-2xl font-bold text-yellow-600">{internships.filter(i => i.status === 'NEEDS_REVIEW').length}</p>
           </div>
           <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
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
                {internships.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
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
                           </div>
                        ) : (
                          <span className="text-gray-400 italic text-sm">--</span>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {/* OPRAVA: Použitie formatDateCZ */}
                        {item.start_date ? `${formatDateCZ(item.start_date)} - ${formatDateCZ(item.end_date)}` : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                        item.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : 
                        item.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 
                        item.status === 'NEEDS_REVIEW' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <a 
                        href={`mailto:${item.studentEmail}?subject=Dotaz k praxi&body=Dobrý den, ohledně vaší smlouvy...`} 
                        className="text-gray-400 hover:text-gray-600 inline-block align-middle"
                        title="Napsat email"
                      >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </a>
                      <a 
                        href={item.contract_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-600 hover:text-blue-900 hover:underline inline-block align-middle"
                      >
                        Otevřít PDF
                      </a>
                    </td>
                  </tr>
                ))}
                {internships.length === 0 && (
                    <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                            Zatím žádné nahrané praxe v systému.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
