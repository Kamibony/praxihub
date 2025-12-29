'use client';

import React, { useState, useEffect } from 'react';
import { auth, db, storage } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, addDoc, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StarRating from "@/components/StarRating";

export default function StudentDashboard() {
  const [user, setUser] = useState<any>(null);
  const [internship, setInternship] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  // State pre editáciu údajov (Review)
  const [reviewData, setReviewData] = useState({
    organization_name: "",
    organization_ico: "",
    start_date: "",
    end_date: ""
  });

  // State pre hodnotenie
  const [studentRating, setStudentRating] = useState(0);
  const [studentReview, setStudentReview] = useState("");

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        
        const q = query(
          collection(db, "internships"),
          where("studentId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(1)
        );

        const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            const id = snapshot.docs[0].id;
            setInternship({ id, ...data });
            
            if (data.status === 'NEEDS_REVIEW') {
              setReviewData({
                organization_name: data.organization_name || "",
                organization_ico: data.organization_ico || "",
                start_date: data.start_date || "",
                end_date: data.end_date || ""
              });
            }
            if (data.studentRating) {
              setStudentRating(data.studentRating);
            }
            if (data.studentReview) {
              setStudentReview(data.studentReview);
            }
          } else {
            setInternship(null);
          }
          setLoadingData(false);
        });

        return () => unsubscribeFirestore();
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const storageRef = ref(storage, `contracts/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Save internship with student name for easier display in Coordinator Dashboard
      await addDoc(collection(db, "internships"), {
        studentId: user.uid,
        studentEmail: user.email,
        studentName: user.displayName || user.email, // Added for Coordinator Dashboard (Task 2)
        contract_url: downloadURL,
        status: "ANALYZING",
        createdAt: new Date().toISOString(),
        fileName: file.name
      });
    } catch (error) {
      console.error("Upload failed", error);
      alert("Chyba při nahrávání souboru.");
    } finally {
      setUploading(false);
    }
  };

  const confirmData = async () => {
    if (!internship) return;
    try {
      const docRef = doc(db, "internships", internship.id);
      await updateDoc(docRef, {
        ...reviewData,
        status: "APPROVED",
        is_verified: true,
        approvedAt: new Date().toISOString() // Pridáme čas schválenia
      });
      alert("Údaje potvrzeny!");
    } catch (error) {
      console.error("Error confirming data:", error);
      alert("Chyba při ukládání.");
    }
  };

  const handleRateCompany = async () => {
    if (!internship || studentRating === 0) return;
    try {
      const docRef = doc(db, "internships", internship.id);
      await updateDoc(docRef, {
        studentRating,
        studentReview
      });
      alert("Hodnocení odesláno!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Chyba při odesílání hodnocení.");
    }
  };

  // Helper funkcia pre formátovanie dátumu
  const formatDateCZ = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Fallback if invalid date
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
  };

  if (loadingData) return <div className="p-8 text-center">Načítám data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex justify-between items-center border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Můj přehled praxe</h1>
            <p className="text-gray-600 mt-1">Vítej, {user?.displayName || user?.email}</p>
          </div>
          <button onClick={() => auth.signOut()} className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition">Odhlásit se</button>
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* HLAVNÁ KARTA (STAV) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                 <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 Aktuální stav
               </h2>
               
               {!internship ? (
                 <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                   <p className="text-gray-500 mb-4">Zatím nemáš žádnou aktivní praxi.</p>
                   <div className="flex justify-center gap-4">
                     <label className="inline-block">
                      <span className="sr-only">Nahrát smlouvu</span>
                      <div className="px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Nahrát novou smlouvu
                      </div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploading} className="hidden" />
                    </label>
                    <Link href="/student/generate">
                      <div className="px-6 py-3 bg-white border border-blue-600 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-50 transition font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Generovat novou smlouvu
                      </div>
                    </Link>
                   </div>
                  {uploading && <p className="text-sm text-blue-600 mt-3 animate-pulse">Nahrávám a analyzuji...</p>}
                 </div>
               ) : (
                 <div className="space-y-6">
                   {/* STATUS BAR */}
                   <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className={`p-3 rounded-full ${
                        internship.status === 'ANALYZING' ? 'bg-blue-100 text-blue-600' :
                        internship.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                        internship.status === 'NEEDS_REVIEW' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {internship.status === 'ANALYZING' && <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {internship.status === 'APPROVED' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                        {internship.status === 'NEEDS_REVIEW' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                        {internship.status === 'REJECTED' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">
                          {internship.status === 'ANALYZING' && 'AI zpracovává dokument...'}
                          {internship.status === 'NEEDS_REVIEW' && 'Nutná kontrola údajů'}
                          {internship.status === 'APPROVED' && 'Praxe je oficiálně schválena'}
                          {internship.status === 'REJECTED' && 'Smlouva byla zamítnuta'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {internship.status === 'ANALYZING' && 'Čekejte prosím, čtu data ze smlouvy.'}
                          {internship.status === 'NEEDS_REVIEW' && 'AI předvyplnila data. Prosím o vaši kontrolu níže.'}
                          {internship.status === 'APPROVED' && `Schváleno dne ${formatDateCZ(internship.approvedAt)}. E-mail odeslán firmě.`}
                          {internship.status === 'REJECTED' && 'Důvod: ' + (internship.ai_error_message || 'Neznámá chyba')}
                        </p>
                      </div>
                   </div>

                   {/* FORMULÁR NA KONTROLU (Iba ak NEEDS_REVIEW) */}
                   {internship.status === 'NEEDS_REVIEW' && (
                     <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                       <h4 className="font-bold text-yellow-800 mb-4">Zkontrolujte údaje nalezené AI:</h4>
                       <div className="grid md:grid-cols-2 gap-4">
                         <div>
                           <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Název Firmy</label>
                           <input type="text" value={reviewData.organization_name} onChange={(e) => setReviewData({...reviewData, organization_name: e.target.value})} className="w-full border border-yellow-300 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none" />
                         </div>
                         <div>
                           <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">IČO</label>
                           <input type="text" value={reviewData.organization_ico} onChange={(e) => setReviewData({...reviewData, organization_ico: e.target.value})} className="w-full border border-yellow-300 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none" />
                         </div>
                         <div>
                           <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Datum od</label>
                           <input type="text" value={reviewData.start_date} onChange={(e) => setReviewData({...reviewData, start_date: e.target.value})} className="w-full border border-yellow-300 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none" />
                         </div>
                         <div>
                           <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Datum do</label>
                           <input type="text" value={reviewData.end_date} onChange={(e) => setReviewData({...reviewData, end_date: e.target.value})} className="w-full border border-yellow-300 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none" />
                         </div>
                       </div>
                       <button onClick={confirmData} className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-lg font-bold shadow-sm transition">
                         Potvrdit správnost údajů
                       </button>
                     </div>
                   )}

                   {/* SCHVÁLENÉ ÚDAJE (Iba ak APPROVED) */}
                   {internship.status === 'APPROVED' && (
                     <div className="space-y-6">
                       <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                         <table className="min-w-full divide-y divide-gray-200 text-sm">
                           <tbody className="divide-y divide-gray-200">
                             <tr>
                               <td className="px-4 py-3 bg-gray-50 font-medium text-gray-500 w-1/3">Firma</td>
                               <td className="px-4 py-3 text-gray-900 font-bold">{internship.organization_name}</td>
                             </tr>
                             <tr>
                               <td className="px-4 py-3 bg-gray-50 font-medium text-gray-500">IČO</td>
                               <td className="px-4 py-3 text-gray-900 font-mono">{internship.organization_ico}</td>
                             </tr>
                             <tr>
                               <td className="px-4 py-3 bg-gray-50 font-medium text-gray-500">Termín</td>
                               <td className="px-4 py-3 text-gray-900">{internship.start_date} — {internship.end_date}</td>
                             </tr>
                           </tbody>
                         </table>
                       </div>

                       {/* HODNOCENÍ PRAXE */}
                       <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                         <h3 className="font-bold text-purple-900 text-lg mb-4 flex items-center gap-2">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                           Hodnocení praxe
                         </h3>

                         {internship.studentRating ? (
                           <div>
                             <p className="text-sm text-purple-800 mb-2 font-medium">Vaše hodnocení firmy:</p>
                             <div className="flex items-center gap-3 mb-3">
                               <StarRating rating={internship.studentRating} readOnly />
                               <span className="font-bold text-purple-900">{internship.studentRating}/5</span>
                             </div>
                             {internship.studentReview && (
                               <div className="bg-white p-3 rounded border border-purple-100 text-gray-700 text-sm italic">
                                 "{internship.studentReview}"
                               </div>
                             )}
                           </div>
                         ) : (
                           <div>
                             <p className="text-sm text-purple-800 mb-4">
                               Jak jste byli spokojeni s průběhem praxe? Vaše zpětná vazba pomůže dalším studentům.
                             </p>
                             <div className="space-y-4">
                               <div>
                                 <label className="block text-xs font-bold text-purple-800 uppercase mb-1">Celkové hodnocení</label>
                                 <StarRating rating={studentRating} setRating={setStudentRating} />
                               </div>
                               <div>
                                 <label className="block text-xs font-bold text-purple-800 uppercase mb-1">Slovní hodnocení (nepovinné)</label>
                                 <textarea
                                   value={studentReview}
                                   onChange={(e) => setStudentReview(e.target.value)}
                                   className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                   rows={3}
                                   placeholder="Popište svou zkušenost..."
                                 ></textarea>
                               </div>
                               <button
                                 onClick={handleRateCompany}
                                 disabled={studentRating === 0}
                                 className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold shadow-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                               >
                                 Odeslat hodnocení
                               </button>
                             </div>
                           </div>
                         )}
                       </div>
                     </div>
                   )}
                 </div>
               )}
            </div>
          </div>

          {/* BOČNÝ PANEL (INFO & LOG) */}
          <div className="space-y-6">
            {/* Dokument Karta */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Dokumentace</h3>
              {internship ? (
                <div>
                   <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg mb-4">
                     <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     <div className="overflow-hidden">
                       <p className="text-sm font-medium text-gray-900 truncate">{internship.fileName}</p>
                       <p className="text-xs text-gray-500">Nahráno: {formatDateCZ(internship.createdAt)}</p>
                     </div>
                   </div>
                   <a href={internship.contract_url} target="_blank" rel="noreferrer" className="block w-full text-center py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium transition">
                     Stáhnout originál
                   </a>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Žádný dokument nebyl nahrán.</p>
              )}
            </div>

            {/* Časová os (Timeline) */}
            {internship && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Průběh zpracování</h3>
                <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
                  {/* Krok 1 */}
                  <div className="relative">
                    <div className="absolute -left-[21px] bg-blue-500 h-3 w-3 rounded-full border-2 border-white"></div>
                    <p className="text-xs text-gray-500">{formatDateCZ(internship.createdAt)}</p>
                    <p className="text-sm font-medium text-gray-900">Nahrání dokumentu</p>
                  </div>
                  {/* Krok 2 */}
                  {(internship.status === 'NEEDS_REVIEW' || internship.status === 'APPROVED' || internship.status === 'REJECTED') && (
                     <div className="relative">
                       <div className="absolute -left-[21px] bg-blue-500 h-3 w-3 rounded-full border-2 border-white"></div>
                       <p className="text-sm font-medium text-gray-900">AI Analýza dokončena</p>
                       <p className="text-xs text-gray-500">Gemini extrahovalo data</p>
                     </div>
                  )}
                  {/* Krok 3 */}
                  {internship.status === 'APPROVED' && (
                     <div className="relative">
                       <div className="absolute -left-[21px] bg-green-500 h-3 w-3 rounded-full border-2 border-white"></div>
                       <p className="text-xs text-gray-500">{formatDateCZ(internship.approvedAt)}</p>
                       <p className="text-sm font-bold text-green-700">Schváleno studentem</p>
                     </div>
                  )}
                   {/* Krok 3 Rejected */}
                   {internship.status === 'REJECTED' && (
                     <div className="relative">
                       <div className="absolute -left-[21px] bg-red-500 h-3 w-3 rounded-full border-2 border-white"></div>
                       <p className="text-sm font-bold text-red-700">Zamítnuto</p>
                     </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
