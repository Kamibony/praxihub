'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, where, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function CompanyDashboard() {
  const [user, setUser] = useState<any>(null);
  const [companyIco, setCompanyIco] = useState<string | null>(null);
  const [internships, setInternships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [inputIco, setInputIco] = useState("");
  const router = useRouter();

  // 1. Načítanie používateľa a kontrola IČO v profile
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Ak už má firma nastavené IČO, použijeme ho
          if (userData.companyIco) {
            setCompanyIco(userData.companyIco);
            fetchInternships(userData.companyIco);
          } else {
            setLoading(false); // Nemáme IČO, zobrazíme formulár
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // 2. Funkcia na načítanie stáží podľa IČO
  const fetchInternships = (ico: string) => {
    setLoading(true);
    // Hľadáme zmluvy, kde AI našlo zhodné IČO a sú schválené
    const q = query(
      collection(db, "internships"), 
      where("organization_ico", "==", ico),
      where("status", "==", "APPROVED") 
    );

    // Real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInternships(data);
      setLoading(false);
    });

    return unsubscribe;
  };

  // 3. Uloženie IČO do profilu používateľa
  const handleSaveProfile = async () => {
    if (!user || !inputIco.trim()) return;

    // Odstránenie medzier pre istotu
    const cleanIco = inputIco.replace(/\s/g, ''); 
    
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        companyIco: cleanIco
      });
      setCompanyIco(cleanIco);
      setIsEditing(false);
      fetchInternships(cleanIco);
    } catch (error) {
      console.error("Error updating company profile:", error);
      alert("Nepodarilo sa uložiť profil.");
    }
  };

  if (loading && !companyIco && !user) return <div className="p-8 text-center">Načítavam...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Firemný Portál</h1>
            {companyIco ? (
              <p className="text-gray-600 mt-2 flex items-center gap-2">
                Firma IČO: <span className="font-mono font-semibold bg-gray-200 px-2 rounded text-gray-800">{companyIco}</span>
                <button 
                  onClick={() => { setIsEditing(true); setInputIco(companyIco); }}
                  className="text-xs text-blue-500 hover:underline"
                >
                  (Zmeniť)
                </button>
              </p>
            ) : (
              <p className="text-gray-600 mt-2">Manažment stážistov</p>
            )}
          </div>
          <button onClick={() => auth.signOut()} className="text-sm text-red-600 hover:text-red-800">Odhlásiť</button>
        </header>

        {/* Ak chýba IČO alebo ho editujeme */}
        {(!companyIco || isEditing) && (
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              {isEditing ? "Zmena identifikačných údajov" : "Nastavenie firemného profilu"}
            </h3>
            <p className="text-sm text-blue-700 mb-4">
              Pre automatické párovanie zmlúv potrebujeme vaše IČO. Zadajte ho presne tak, ako je uvedené v obchodnom registri.
            </p>
            <div className="flex gap-2 max-w-md">
              <input 
                type="text" 
                value={inputIco}
                onChange={(e) => setInputIco(e.target.value)}
                placeholder="Zadajte IČO (napr. 12345678)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
              <button 
                onClick={handleSaveProfile}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                Uložiť IČO
              </button>
              {isEditing && companyIco && (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Zrušiť
                </button>
              )}
            </div>
          </div>
        )}

        {/* Hlavný obsah - viditeľný len ak máme IČO a needitujeme */}
        {companyIco && !isEditing && (
          <div className="grid gap-6">
            <section className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Zmluvy priradené k IČO {companyIco}</h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                  {internships.length} Zmlúv
                </span>
              </div>
              
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stážista</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rozpoznaná Firma</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Obdobie</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {internships.map((intern) => (
                              <tr key={intern.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{intern.studentEmail}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{intern.organization_name}</div>
                                    <div className="text-xs text-gray-400 font-mono">IČO: {intern.organization_ico}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {intern.start_date ? (
                                      <>
                                        {intern.start_date} <span className="text-gray-400">až</span> {intern.end_date}
                                      </>
                                    ) : (
                                      <span className="italic text-gray-400">Neurčené</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                      Schválené
                                    </span>
                                  </td>
                              </tr>
                          ))}
                          {internships.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 flex flex-col items-center">
                                  <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  <p>Žiadne zmluvy pre IČO <strong>{companyIco}</strong> zatiaľ neboli nahrané.</p>
                                </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
