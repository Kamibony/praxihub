'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, where, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import StarRating from "@/components/StarRating";
import Chatbot from "@/components/Chatbot";

export default function CompanyDashboard() {
  const [user, setUser] = useState<any>(null);
  const [companyIco, setCompanyIco] = useState<string | null>(null);
  const [internships, setInternships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [inputIco, setInputIco] = useState("");

  // Looking For (Tags)
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isTagsOpen, setIsTagsOpen] = useState(false);

  // Detail Modal & Rating State
  const [selectedInternship, setSelectedInternship] = useState<any>(null);
  const [companyRating, setCompanyRating] = useState(0);
  const [companyReview, setCompanyReview] = useState("");

  const router = useRouter();

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

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

          if (userData.lookingFor) {
            setLookingFor(userData.lookingFor);
          }

          if (userData.companyIco) {
            setCompanyIco(userData.companyIco);
            unsubscribeFirestore = fetchInternships(userData.companyIco);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
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

  const formatDateCZ = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
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

  const addTag = async () => {
    if (!newTag.trim() || !user) return;
    const updatedTags = [...lookingFor, newTag.trim()];
    setLookingFor(updatedTags);
    setNewTag("");

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        lookingFor: updatedTags
      });
    } catch (error) {
      console.error("Error updating tags:", error);
    }
  };

  const removeTag = async (tagToRemove: string) => {
    if (!user) return;
    const updatedTags = lookingFor.filter(t => t !== tagToRemove);
    setLookingFor(updatedTags);

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        lookingFor: updatedTags
      });
    } catch (error) {
      console.error("Error removing tag:", error);
    }
  };

  const openModal = (internship: any) => {
    setSelectedInternship(internship);
    setCompanyRating(internship.companyRating || 0);
    setCompanyReview(internship.companyReview || "");
  };

  const closeModal = () => {
    setSelectedInternship(null);
    setCompanyRating(0);
    setCompanyReview("");
  };

  const handleRateStudent = async () => {
    if (!selectedInternship || companyRating === 0) return;
    try {
      const docRef = doc(db, "internships", selectedInternship.id);
      await updateDoc(docRef, {
        companyRating,
        companyReview
      });
      // We don't close the modal so the user can continue viewing details
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
  const chatbotMessage = "Dobrý den! Zde vidíte přehled všech vašich stážistů. Kliknutím na studenta zobrazíte detaily.";

  if (loading && !companyIco && !user) return <div className="p-8 text-center">Načítám...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Chatbot initialMessage={chatbotMessage} />
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

        {/* LOOKING FOR TAGS (Hledáme) */}
        {companyIco && !isEditing && (
           <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm mb-6">
             <div className="flex justify-between items-start mb-4">
               <div>
                 <h3 className="text-lg font-semibold text-gray-800">Koho hledáme? (AI Matchmaking)</h3>
                 <p className="text-sm text-gray-500">Zadejte technologie a dovednosti, které u stážistů preferujete (např. React, Python, Marketing).</p>
               </div>
               <button onClick={() => setIsTagsOpen(!isTagsOpen)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                 {isTagsOpen ? "Zavřít nastavení" : "Upravit požadavky"}
               </button>
             </div>

             <div className="flex flex-wrap gap-2">
               {lookingFor.map((tag, idx) => (
                 <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium flex items-center gap-2 border border-indigo-100">
                   {tag}
                   {isTagsOpen && <button onClick={() => removeTag(tag)} className="text-indigo-400 hover:text-indigo-900 ml-1">×</button>}
                 </span>
               ))}
               {lookingFor.length === 0 && <span className="text-gray-400 text-sm italic">Zatím jste nezadali žádné požadavky.</span>}
             </div>

             {isTagsOpen && (
               <div className="mt-4 flex gap-2 max-w-md">
                 <input
                   type="text"
                   value={newTag}
                   onChange={(e) => setNewTag(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && addTag()}
                   placeholder="Přidat dovednost (např. SQL)"
                   className="flex-1 border border-gray-300 rounded px-3 py-2 outline-none focus:border-indigo-500 text-sm"
                 />
                 <button onClick={addTag} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700">Přidat</button>
               </div>
             )}
           </div>
        )}

        {/* UNIFIED DETAIL MODAL */}
        {selectedInternship && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-fade-in">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedInternship.studentEmail}</h3>
                  <p className="text-sm text-gray-500">Detail stáže a hodnocení</p>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Section 1: Contract */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="text-md font-semibold text-gray-800 mb-2">Smlouva o stáži</h4>
                  {selectedInternship.contract_url ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 truncate mr-4">
                        {/* Try to get filename from url, fallback to simple text */}
                        {decodeURIComponent(selectedInternship.contract_url.split('/').pop()?.split('?')[0] || "smlouva.pdf")}
                      </span>
                      <a
                        href={selectedInternship.contract_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Stáhnout smlouvu
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-red-500 italic">Smlouva není k dispozici ke stažení.</p>
                  )}
                </div>

                {/* Section 2: Rating */}
                <div className="border-t border-gray-100 pt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Hodnocení stážisty</h4>
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
                        placeholder="Napište silné a slabé stránky, zpětnou vazbu..."
                      ></textarea>
                    </div>
                    <div className="flex gap-3 justify-end mt-2">
                      <button
                        onClick={closeModal}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Zavřít
                      </button>
                      <button
                        onClick={handleRateStudent}
                        disabled={companyRating === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold disabled:opacity-50"
                      >
                        Uložit hodnocení
                      </button>
                    </div>
                  </div>
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
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hodnocení / Akce</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {internships.map((intern) => (
                              <tr
                                key={intern.id}
                                onClick={() => openModal(intern)}
                                className="hover:bg-gray-50 transition-colors cursor-pointer group"
                              >
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{intern.studentEmail}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{intern.organization_name}</div>
                                    <div className="text-xs text-gray-400 font-mono">IČO: {intern.organization_ico}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {intern.start_date ? (
                                      <>
                                        {formatDateCZ(intern.start_date)} <span className="text-gray-400">až</span> {formatDateCZ(intern.end_date)}
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
                                      <span className="text-blue-600 text-sm font-medium opacity-80 group-hover:opacity-100">
                                        Zobrazit detail
                                      </span>
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
