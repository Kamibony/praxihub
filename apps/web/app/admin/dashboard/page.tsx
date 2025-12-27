'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth"; // Pridaný import
import { useRouter } from "next/navigation";

export default function CoordinatorDashboard() {
  const [internships, setInternships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Pridaný loading stav
  const router = useRouter();

  useEffect(() => {
    // Čakáme na overenie prihlásenia
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Ak nie je prihlásený, presmerujeme na login (alebo len nenačítame dáta)
        router.push("/login");
      } else {
        // Až keď máme usera, spustíme listener na dáta
        const q = query(collection(db, "internships"), orderBy("createdAt", "desc"));
        
        const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setInternships(data);
          setLoading(false);
        }, (error) => {
           console.error("Firestore error:", error);
           // Ignorujeme permission-denied ak sa stane pri odhlasovaní
        });

        // Cleanup funkcia pre Firestore listener
        return () => unsubscribeFirestore();
      }
    });

    // Cleanup funkcia pre Auth listener
    return () => unsubscribeAuth();
  }, [router]);

  if (loading) return <div className="p-8 text-center">Načítavam dáta...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* ... zvyšok kódu (renderovanie tabuľky) ostáva rovnaký ... */}
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Administrátorský Prehľad</h1>
            <p className="text-gray-600 mt-2">Manažment všetkých praxí a zmlúv.</p>
          </div>
          <button onClick={() => auth.signOut()} className="text-sm text-gray-600 hover:text-gray-900">Odhlásiť</button>
        </header>

        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Študent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma (AI Data)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dátumy</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Zmluva</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {internships.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.studentEmail}</div>
                        <div className="text-xs text-gray-400">{item.studentId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {item.organization_name || <span className="text-gray-400 italic">Čaká na analýzu...</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{item.start_date}</div>
                        <div>{item.end_date}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        item.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                        item.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 
                        'bg-blue-100 text-blue-800 animate-pulse'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a href={item.contract_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-900 hover:underline">
                        Otvoriť PDF
                      </a>
                    </td>
                  </tr>
                ))}
                {internships.length === 0 && (
                    <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                            Zatiaľ žiadne nahrané praxe.
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
