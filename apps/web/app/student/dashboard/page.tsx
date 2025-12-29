'use client';

import React, { useState, useEffect } from 'react';
import { auth, db, storage } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, addDoc, orderBy, limit, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StarRating from "@/components/StarRating";
import Chatbot from "@/components/Chatbot";

export default function StudentDashboard() {
  const [user, setUser] = useState<any>(null);
  const [internship, setInternship] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Skills
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);
  
  // State pre editáciu údajov (Review)
  const [reviewData, setReviewData] = useState({
    organization_name: "",
    organization_ico: "",
    start_date: "",
    end_date: ""
  });

  // State pre žiadosť o schválenie organizácie
  const [orgRequest, setOrgRequest] = useState({
    name: "",
    ico: "",
    web: ""
  });
  const [submittingOrg, setSubmittingOrg] = useState(false);

  // State pre hodnotenie
  const [studentRating, setStudentRating] = useState(0);
  const [studentReview, setStudentReview] = useState("");

  const router = useRouter();

  // OPRAVA: Bezpečný useEffect s cleanup logikou
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // 1. Vyčistiť predchádzajúci listener ak existuje
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        
        // Fetch user skills
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setSkills(userDoc.data().skills || []);
          }
        } catch (err) {
          console.error("Error fetching skills:", err);
        }

        const q = query(
          collection(db, "internships"),
          where("studentId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(1)
        );

        // 2. Nastaviť nový listener a uložiť funkciu na odhlásenie
        unsubscribeFirestore = onSnapshot(q, (snapshot) => {
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
      }
    });

    // 3. Cleanup pri unmount
    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [router]);

  const handleOrgRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgRequest.name || !orgRequest.ico) {
        alert("Vyplňte prosím povinné údaje (Název a IČO).");
        return;
    }
    setSubmittingOrg(true);
    try {
        await addDoc(collection(db, "internships"), {
            studentId: user.uid,
            studentEmail: user.email,
            studentName: user.displayName || user.email,
            status: 'PENDING_ORG_APPROVAL',
            createdAt: new Date().toISOString(),
            organization_name: orgRequest.name,
            organization_ico: orgRequest.ico,
            organization_web: orgRequest.web
        });
        setOrgRequest({ name: "", ico: "", web: "" });
    } catch (error) {
        console.error("Error submitting org request:", error);
        alert("Chyba při odesílání žádosti.");
    } finally {
        setSubmittingOrg(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const storageRef = ref(storage, `contracts/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Save internship with student name for easier display in Coordinator Dashboard
      if (internship && internship.id) {
        const docRef = doc(db, "internships", internship.id);
        await updateDoc(docRef, {
            contract_url: downloadURL,
            fileName: file.name,
            status: "ANALYZING"
        });
      } else {
         // Fallback - should not happen in this flow if strictly following APPROVED path
         await addDoc(collection(db, "internships"), {
            studentId: user.uid,
            studentEmail: user.email,
            studentName: user.displayName || user.email,
            contract_url: downloadURL,
            status: "ANALYZING",
            createdAt: new Date().toISOString(),
            fileName: file.name
         });
      }

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
        approvedAt: new Date().toISOString() 
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

  const addSkill = async () => {
    if (!newSkill.trim() || !user) return;
    const updatedSkills = [...skills, newSkill.trim()];
    setSkills(updatedSkills);
    setNewSkill("");

    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { skills: updatedSkills }, { merge: true });
    } catch (error) {
      console.error("Error saving skill:", error);
    }
  };

  const removeSkill = async (skillToRemove: string) => {
    if (!user) return;
    const updatedSkills = skills.filter(s => s !== skillToRemove);
    setSkills(updatedSkills);

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { skills: updatedSkills });
    } catch (error) {
      console.error("Error removing skill:", error);
    }
  };

  // Helper funkcia pre formátovanie dátumu
  const formatDateCZ = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; 
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
  };

  const getChatbotMessage = () => {
    if (!internship) return "Ahoj! Vítám tě v PraxiHubu. Začni tím, že vyplníš žádost o schválení firmy.";
    switch (internship.status) {
      case 'PENDING_ORG_APPROVAL': return "Právě čekáme na schválení firmy koordinátorem. Dám ti vědět, jakmile to bude hotové.";
      case 'ORG_APPROVED': return "Skvělá zpráva! Firma byla schválena. Tvým dalším krokem je vygenerování smlouvy (sekce 'Získat smlouvu').";
      case 'NEEDS_REVIEW': return "Analyzoval jsem tvou smlouvu. Prosím, zkontroluj níže, zda jsem všechny údaje přečetl správně.";
      case 'APPROVED': return "Vše hotovo! Tvá praxe je schválena. Hodně štěstí!";
      default: return undefined;
    }
  };

  // UI Components
  const UploadSection = () => {
    // Ak užívateľ nemá schválenú organizáciu, zobrazíme pôvodnú správu (defenzívne, hoci rodič to kontroluje)
    if (internship?.status !== 'ORG_APPROVED') {
        return (
            <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <p className="text-gray-500">Zatím nemáš žádnou aktivní praxi.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Success Banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <div className="shrink-0 text-green-600 mt-0.5">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <h3 className="font-bold text-green-800">Gratulujeme! Organizace byla schválena.</h3>
                    <p className="text-green-700 text-sm mt-1">Nyní si připravte smlouvu a podepsanou ji nahrajte.</p>
                </div>
            </div>

            {/* Steps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Step 1 */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span>
                        Získat smlouvu
                    </h4>

                    <div className="flex-1 flex flex-col gap-3">
                        <Link href="/student/generate" className="block">
                            <div className="w-full h-full p-4 bg-blue-50 border-2 border-blue-100 rounded-xl hover:border-blue-300 hover:bg-blue-100 transition group cursor-pointer text-center flex flex-col items-center justify-center gap-2">
                                <div className="p-2 bg-white rounded-full text-blue-600 shadow-sm group-hover:scale-110 transition">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <span className="font-bold text-blue-700">Generovat novou smlouvu</span>
                                <span className="text-xs text-blue-600/80">Automaticky doplní údaje</span>
                            </div>
                        </Link>

                        <div className="text-center mt-2">
                            <a
                            href="https://moodle.czu.cz"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-500 hover:text-blue-600 hover:underline flex items-center justify-center gap-1"
                            >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Stáhnout šablonu z Moodle
                            </a>
                        </div>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span>
                        Nahrát podepsaný sken
                    </h4>

                    <div className="flex-1">
                        <label className="block w-full h-full min-h-[140px] cursor-pointer group">
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploading} className="hidden" />
                            <div className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 transition ${uploading ? 'bg-gray-50 border-gray-300 cursor-not-allowed' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                                {uploading ? (
                                    <div className="text-center">
                                        <svg className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <span className="text-sm text-blue-600 font-medium">Nahrávám a analyzuji...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-3 bg-gray-100 rounded-full text-gray-400 mb-3 group-hover:bg-blue-100 group-hover:text-blue-500 transition">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        </div>
                                        <span className="font-medium text-gray-700 group-hover:text-blue-700">Vybrat soubor</span>
                                        <span className="text-xs text-gray-400 mt-1">PDF, JPG, PNG (max 10MB)</span>
                                    </>
                                )}
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const OrgRequestForm = () => (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Žádost o schválení organizace</h3>
        <p className="text-gray-600 text-sm mb-6">Než začnete s generováním smlouvy, koordinátor musí schválit vámi vybranou organizaci.</p>

        {internship?.status === 'REJECTED' && (
             <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200">
                 <p className="font-bold">Vaša predchádzajúca žiadosť bola zamietnutá.</p>
                 {internship.ai_error_message && <p className="text-sm mt-1">Důvod: {internship.ai_error_message}</p>}
                 <p className="text-sm mt-2">Prosím, skontrolujte údaje a podajte novú žiadosť.</p>
             </div>
        )}

        <form onSubmit={handleOrgRequestSubmit} className="space-y-4 max-w-lg">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Název organizace *</label>
                <input
                    type="text"
                    value={orgRequest.name}
                    onChange={(e) => setOrgRequest({...orgRequest, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Např. Acme Corp s.r.o."
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IČO *</label>
                <input
                    type="text"
                    value={orgRequest.ico}
                    onChange={(e) => setOrgRequest({...orgRequest, ico: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12345678"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webové stránky (nepovinné)</label>
                <input
                    type="text"
                    value={orgRequest.web}
                    onChange={(e) => setOrgRequest({...orgRequest, web: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="www.example.com"
                />
            </div>
            <button
                type="submit"
                disabled={submittingOrg}
                className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
                {submittingOrg ? "Odesílám..." : "Odeslat žádost"}
            </button>
        </form>
    </div>
  );

  if (loadingData) return <div className="p-8 text-center">Načítám data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <Chatbot initialMessage={getChatbotMessage()} />

      {/* SKILLS MODAL */}
      {isSkillsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Moje dovednosti</h3>
                <button onClick={() => setIsSkillsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
             </div>

             <p className="text-sm text-gray-600 mb-4">Přidej technologie a nástroje, které ovládáš (např. React, Python, Marketing...). Pomůže nám to najít ti lepší praxi.</p>

             <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                  placeholder="Např. JavaScript"
                />
                <button onClick={addSkill} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">Přidat</button>
             </div>

             <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                {skills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="text-blue-400 hover:text-blue-900">×</button>
                  </span>
                ))}
                {skills.length === 0 && <p className="text-gray-400 text-sm italic">Zatím žádné dovednosti.</p>}
             </div>
           </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex justify-between items-center border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Můj přehled praxe</h1>
            <p className="text-gray-600 mt-1">Vítej, {user?.displayName || user?.email}</p>
          </div>
          <div className="flex gap-3 items-center">
            {/* Tlačidlo pre generovanie zmluvy je teraz podmienené stavom */}
            {(internship?.status === 'ORG_APPROVED' || !internship) && (
                 // Ukážeme tlačidlo iba ak je schválená alebo žiadna (ale ak žiadna, tak je tam formulár)
                 // V novom flow tlačidlo v hlavičke možno nie je potrebné, ak je vo formulári.
                 // Ponecháme ho skryté v počiatočnej fáze.
                 null
            )}

            <button onClick={() => auth.signOut()} className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition">Odhlásit se</button>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* HLAVNÁ KARTA (STAV) */}
          <div className="lg:col-span-2 space-y-6">

            {/* AI MATCHMAKING & SKILLS TEASER */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
               <div className="relative z-10">
                 <h2 className="text-2xl font-bold mb-2">Hledáš ideální praxi?</h2>
                 <p className="mb-6 opacity-90 max-w-lg">Využij AI Matchmaking. Na základě tvých dovedností ti najdeme firmu, která ti sedne nejlépe.</p>

                 <div className="flex flex-wrap gap-4 items-center">
                    <Link href="/student/matchmaking">
                      <button className="px-6 py-2 bg-white text-blue-700 font-bold rounded-lg shadow-md hover:bg-blue-50 transition">
                         🔍 Najít praxi pomocí AI
                      </button>
                    </Link>
                    <button onClick={() => setIsSkillsModalOpen(true)} className="text-sm font-medium underline hover:text-blue-100 transition">
                      {skills.length > 0 ? `Spravovat dovednosti (${skills.length})` : "+ Přidat moje dovednosti"}
                    </button>
                 </div>
               </div>
               {/* Decorative background circle */}
               <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                 <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 Aktuální stav
               </h2>
               
               {/* LOGIC FLOW */}
               {!internship ? (
                 <OrgRequestForm />
               ) : (
                 <>
                   {/* PENDING APPROVAL */}
                   {internship.status === 'PENDING_ORG_APPROVAL' && (
                       <div className="text-center py-10 bg-blue-50 rounded-lg border border-blue-100">
                           <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                               <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           </div>
                           <h3 className="text-xl font-bold text-gray-900 mb-2">Čeká se na schválení organizace</h3>
                           <p className="text-gray-600 max-w-md mx-auto">Váš požadavek na praxi v <strong>{internship.organization_name}</strong> čeká na schválení koordinátorem. O výsledku budete informováni.</p>
                       </div>
                   )}

                   {/* REJECTED - Show Form Again */}
                   {internship.status === 'REJECTED' && (
                       <OrgRequestForm />
                   )}

                   {/* ORG APPROVED - Show Upload/Generate Buttons */}
                   {internship.status === 'ORG_APPROVED' && (
                       <UploadSection />
                   )}

                   {/* EXISTING STATUSES */}
                   {(internship.status === 'ANALYZING' || internship.status === 'NEEDS_REVIEW' || internship.status === 'APPROVED') && (
                    <div className="space-y-6">
                        {/* STATUS BAR */}
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className={`p-3 rounded-full ${
                                internship.status === 'ANALYZING' ? 'bg-blue-100 text-blue-600' :
                                internship.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                                internship.status === 'NEEDS_REVIEW' ? 'bg-yellow-100 text-yellow-600' :
                                'bg-gray-100 text-gray-600'
                            }`}>
                                {internship.status === 'ANALYZING' && <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                {internship.status === 'APPROVED' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                {internship.status === 'NEEDS_REVIEW' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">
                                {internship.status === 'ANALYZING' && 'AI zpracovává dokument...'}
                                {internship.status === 'NEEDS_REVIEW' && 'Nutná kontrola údajů'}
                                {internship.status === 'APPROVED' && 'Praxe je oficiálně schválena'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                {internship.status === 'ANALYZING' && 'Čekejte prosím, čtu data ze smlouvy.'}
                                {internship.status === 'NEEDS_REVIEW' && 'AI předvyplnila data. Prosím o vaši kontrolu níže.'}
                                {internship.status === 'APPROVED' && `Schváleno dne ${formatDateCZ(internship.approvedAt)}. E-mail odeslán firmě.`}
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
                 </>
               )}
            </div>
          </div>

          {/* BOČNÝ PANEL (INFO & LOG) */}
          <div className="space-y-6">
            {/* Dokument Karta */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Dokumentace</h3>
              {internship && internship.contract_url ? (
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
                <p className="text-sm text-gray-500 italic">
                    {internship?.status === 'PENDING_ORG_APPROVAL' ? 'Čeká se na schválení firmy.' :
                     internship?.status === 'ORG_APPROVED' ? 'Čeká se na nahrání smlouvy.' :
                     'Žádný dokument nebyl nahrán.'}
                </p>
              )}
            </div>

            {/* Časová os (Timeline) */}
            {internship && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Průběh zpracování</h3>
                <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">

                  {/* Step: Org Request */}
                  {(internship.status === 'PENDING_ORG_APPROVAL' || internship.status === 'ORG_APPROVED' || internship.status === 'ANALYZING' || internship.status === 'NEEDS_REVIEW' || internship.status === 'APPROVED' || internship.status === 'REJECTED') && (
                      <div className="relative">
                        <div className={`absolute -left-[21px] h-3 w-3 rounded-full border-2 border-white ${
                            internship.status === 'PENDING_ORG_APPROVAL' ? 'bg-blue-500' :
                            internship.status === 'REJECTED' ? 'bg-red-500' :
                            'bg-green-500'
                        }`}></div>
                        <p className="text-xs text-gray-500">{formatDateCZ(internship.createdAt)}</p>
                        <p className="text-sm font-medium text-gray-900">
                            {internship.status === 'PENDING_ORG_APPROVAL' ? 'Žádost o schválení firmy' : 'Žádost odeslána'}
                        </p>
                      </div>
                  )}

                  {/* Step: Upload Contract */}
                  {(internship.status === 'ANALYZING' || internship.status === 'NEEDS_REVIEW' || internship.status === 'APPROVED' || (internship.status === 'REJECTED' && internship.fileName)) && (
                    <div className="relative">
                        <div className="absolute -left-[21px] bg-green-500 h-3 w-3 rounded-full border-2 border-white"></div>
                        <p className="text-sm font-medium text-gray-900">Smlouva nahrána</p>
                    </div>
                  )}

                  {/* Krok 2 AI */}
                  {(internship.status === 'NEEDS_REVIEW' || internship.status === 'APPROVED' || (internship.status === 'REJECTED' && internship.fileName)) && (
                     <div className="relative">
                       <div className="absolute -left-[21px] bg-blue-500 h-3 w-3 rounded-full border-2 border-white"></div>
                       <p className="text-sm font-medium text-gray-900">AI Analýza</p>
                     </div>
                  )}
                  {/* Krok 3 Approved */}
                  {internship.status === 'APPROVED' && (
                     <div className="relative">
                       <div className="absolute -left-[21px] bg-green-500 h-3 w-3 rounded-full border-2 border-white"></div>
                       <p className="text-xs text-gray-500">{formatDateCZ(internship.approvedAt)}</p>
                       <p className="text-sm font-bold text-green-700">Schváleno</p>
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
