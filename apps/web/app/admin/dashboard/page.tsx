'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function CoordinatorDashboard() {
  const [internships, setInternships] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Jednoduchá ochrana - v reálnom app by sme kontrolovali rolu aj tu
    if (!auth.currentUser) {
        // router.push("/login"); // Commented out for smoother dev testing
    }

    const q = query(collection(db, "internships"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInternships(data);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
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
