'use client';

import React, { useState, useEffect } from 'react';
import { auth, db, storage } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, addDoc, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";

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
            
            // Ak je v stave na kontrolu, predvyplníme formulár
            if (data.status === 'NEEDS_REVIEW') {
              setReviewData({
                organization_name: data.organization_name || "",
                organization_ico: data.organization_ico || "",
                start_date: data.start_date || "",
                end_date: data.end_date || ""
              });
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
      await addDoc(collection(db, "internships"), {
        studentId: user.uid,
        studentEmail: user.email,
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
        is_verified: true
      });
      alert("Údaje potvrzeny!");
    } catch (error) {
      console.error("Error confirming data:", error);
      alert("Chyba při ukládání.");
    }
  };

  if (loadingData) return <div className="p-8 text-center">Načítám data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Studentský Dashboard</h1>
            <p className="text-gray-600 mt-2">Vítej, {user?.email}</p>
          </div>
          <button onClick={() => auth.signOut()} className="text-sm text-red-600 hover:text-red-800">Odhlásit se</button>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Status Karta */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
             <h2 className="text-xl font-semibold text-gray-800 mb-4">Stav praxe</h2>
             
             {!internship ? (
               <div className="text-gray-500">Zatím nemáš žádnou aktivní praxi.</div>
             ) : (
               <div className="space-y-4">
                 <div className="flex items-center space-x-3">
                    <span className={`inline-block w-4 h-4 rounded-full ${
                      internship.status === 'ANALYZING' ? 'bg-blue-400 animate-pulse' :
                      internship.status === 'APPROVED' ? 'bg-green-500' :
                      internship.status === 'NEEDS_REVIEW' ? 'bg-yellow-400' :
                      internship.status === 'REJECTED' ? 'bg-red-500' : 'bg-gray-300'
                    }`}></span>
                    <span className="font-medium text-lg text-gray-700">
                      {internship.status === 'ANALYZING' && 'AI Analyzuje smlouvu...'}
                      {internship.status === 'NEEDS_REVIEW' && 'Vyžaduje kontrolu'}
                      {internship.status === 'APPROVED' && 'Schváleno'}
                      {internship.status === 'REJECTED' && 'Zamítnuto'}
                    </span>
                 </div>

                 {/* Ak je stav NEEDS_REVIEW, zobrazíme formulár na úpravu */}
                 {internship.status === 'NEEDS_REVIEW' && (
                   <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mt-4 space-y-3">
                     <p className="text-sm text-yellow-800 font-medium">AI přečetla tyto údaje. Prosím, zkontrolujte je a potvrďte.</p>
                     
                     <div>
                       <label className="block text-xs text-gray-500">Název Firmy</label>
                       <input 
                         type="text" 
                         value={reviewData.organization_name}
                         onChange={(e) => setReviewData({...reviewData, organization_name: e.target.value})}
                         className="w-full border rounded p-1 text-sm"
                       />
                     </div>
                     <div>
                       <label className="block text-xs text-gray-500">IČO</label>
                       <input 
                         type="text" 
                         value={reviewData.organization_ico}
                         onChange={(e) => setReviewData({...reviewData, organization_ico: e.target.value})}
                         className="w-full border rounded p-1 text-sm"
                       />
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500">Od</label>
                          <input type="text" value={reviewData.start_date} onChange={(e) => setReviewData({...reviewData, start_date: e.target.value})} className="w-full border rounded p-1 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Do</label>
                          <input type="text" value={reviewData.end_date} onChange={(e) => setReviewData({...reviewData, end_date: e.target.value})} className="w-full border rounded p-1 text-sm" />
                        </div>
                     </div>
                     <button onClick={confirmData} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded font-medium mt-2">
                       Potvrdit správnost
                     </button>
                   </div>
                 )}

                 {internship.status === 'APPROVED' && (
                   <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                     <p><span className="font-semibold">Firma:</span> {internship.organization_name}</p>
                     <p><span className="font-semibold">IČO:</span> {internship.organization_ico}</p>
                     <p><span className="font-semibold">Od:</span> {internship.start_date}</p>
                     <p><span className="font-semibold">Do:</span> {internship.end_date}</p>
                   </div>
                 )}
               </div>
             )}
          </div>

          {/* Actions Karta */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Akce</h2>
            {!internship || internship.status === 'REJECTED' ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="sr-only">Vyber smlouvu</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50" />
                </label>
                {uploading && <p className="text-sm text-blue-600 animate-pulse">Nahrávám a zpracovávám...</p>}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Smlouva odeslána. {internship.status === 'NEEDS_REVIEW' ? 'Čeká na vaši kontrolu.' : 'Čekejte na potvrzení.'}</p>
                <a href={internship.contract_url} target="_blank" rel="noreferrer" className="text-blue-500 text-sm hover:underline mt-2 block">Zobrazit nahranou smlouvu</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
