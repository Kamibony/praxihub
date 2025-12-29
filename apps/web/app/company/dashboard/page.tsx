'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, where, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import StarRating from "@/components/StarRating";

export default function CompanyDashboard() {
  const [user, setUser] = useState<any>(null);
  const [companyIco, setCompanyIco] = useState<string | null>(null);
  const [internships, setInternships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [inputIco, setInputIco] = useState("");

  // Rating State
  const [ratingInternshipId, setRatingInternshipId] = useState<string | null>(null);
  const [companyRating, setCompanyRating] = useState(0);
  const [companyReview, setCompanyReview] = useState("");

  const router = useRouter();

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
          if (userData.companyIco) {
            setCompanyIco(userData.companyIco);
            fetchInternships(userData.companyIco);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  const fetchInternships = (ico: string) => {
    setLoading(true);
    const q = query(
      collection(db, "internships"), 
      where("organization_ico", "==", ico),
      where("status", "==", "APPROVED") 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInternships(data);
      setLoading(false);
    });

    return unsubscribe;
  };

  const handleSaveProfile = async () => {
    if (!user || !inputIco.trim()) return;
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
      alert("Nepodařilo se uložit profil.");
    }
  };

  const handleRateStudent = async () => {
    if (!ratingInternshipId || companyRating === 0) return;
    try {
      const docRef = doc(db, "internships", ratingInternshipId);
      await updateDoc(docRef, {
        companyRating,
        companyReview
      });
      setRatingInternshipId(null);
      setCompanyRating(0);
      setCompanyReview("");
      alert("Hodnocení uloženo!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Chyba při odesílání hodnocení.");
    }
  };

  const calculateAverageRating = () => {
    const ratedInternships = internships.filter(i => i.studentRating > 0);
    if (ratedInternships.length === 0) return null;
    const sum = ratedInternships.reduce((acc, curr) => acc + curr.studentRating, 0);
    return (sum / ratedInternships.length).toFixed(1);
  };

  const averageRating = calculateAverageRating();

  if (loading && !companyIco && !user) return <div className="p-8 text-center">Načítám...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Firemní Portál</h1>
              {companyIco ? (
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-gray-600 flex items-center gap-2">
                    Firma IČO: <span className="font-mono font-semibold bg-gray-200 px-2 rounded text-gray-800">{companyIco}</span>
                    <button
                      onClick={() => { setIsEditing(true); setInputIco(companyIco); }}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      (Změnit)
                    </button>
                  </p>
                  {averageRating && (
                    <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
                      <span className="text-yellow-500 font-bold text-lg">★</span>
                      <span className="font-bold text-gray-800">{averageRating}</span>
                      <span className="text-xs text-gray-500">Průměrné hodnocení od studentů</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 mt-2">Management stážistů</p>
              )}
            </div>
          </div>
          <button onClick={() => auth.signOut()} className="text-sm text-red-600 hover:text-red-800">Odhlásit se</button>
        </header>

        {(!companyIco || isEditing) && (
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              {isEditing ? "Změna identifikačních údajů" : "Nastavení firemního profilu"}
            </h3>
            <p className="text-sm text-blue-700 mb-4">
              Pro automatické párování smluv potřebujeme vaše IČO. Zadejte ho přesně tak, jak je uvedeno v obchodním rejstříku.
            </p>
            <div className="flex gap-2 max-w-md">
              <input 
                type="text" 
                value={inputIco}
                onChange={(e) => setInputIco(e.target.value)}
                placeholder="Zadejte IČO (např. 12345678)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
              <button 
                onClick={handleSaveProfile}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                Uložit IČO
              </button>
              {isEditing && companyIco && (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Zrušit
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODAL PRO HODNOCENÍ */}
        {ratingInternshipId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Hodnocení stážisty</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jak hodnotíte výkon studenta?</label>
                  <StarRating rating={companyRating} setRating={setCompanyRating} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slovní hodnocení (pro studenta)</label>
                  <textarea
                    value={companyReview}
                    onChange={(e) => setCompanyReview(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={4}
                    placeholder="Napište silné a slabé stránky..."
                  ></textarea>
                </div>
                <div className="flex gap-3 justify-end mt-2">
                  <button
                    onClick={() => setRatingInternshipId(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleRateStudent}
                    disabled={companyRating === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold disabled:opacity-50"
                  >
                    Odeslat hodnocení
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {companyIco && !isEditing && (
          <div className="grid gap-6">
            <section className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Smlouvy přiřazené k IČO {companyIco}</h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                  {internships.length} Smluv
                </span>
              </div>
              
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stážista</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rozpoznaná Firma</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Období</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hodnocení Studenta</th>
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
                                      <span className="italic text-gray-400">Neurčeno</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    {intern.companyRating ? (
                                      <div className="flex items-center gap-2">
                                        <StarRating rating={intern.companyRating} readOnly />
                                        <span className="text-xs text-gray-500">({intern.companyRating}/5)</span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setRatingInternshipId(intern.id);
                                          setCompanyRating(0);
                                          setCompanyReview("");
                                        }}
                                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 font-medium transition"
                                      >
                                        Hodnotit studenta
                                      </button>
                                    )}
                                  </td>
                              </tr>
                          ))}
                          {internships.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 flex flex-col items-center">
                                  <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  <p>Žádné smlouvy pro IČO <strong>{companyIco}</strong> zatím nebyly nahrány.</p>
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
