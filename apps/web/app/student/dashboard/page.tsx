'use client';

import React, { useState, useEffect } from 'react';
import { auth, db, storage } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, addDoc, orderBy, limit } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";

export default function StudentDashboard() {
  const [user, setUser] = useState<any>(null);
  const [internship, setInternship] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();

  // 1. Načítanie užívateľa a jeho stáže
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        
        // Listener na stáž pre tohto študenta
        const q = query(
          collection(db, "internships"),
          where("studentId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(1)
        );

        const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            setInternship({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
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

  // 2. Funkcia na upload zmluvy
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;
    
    const file = e.target.files[0];
    setUploading(true);

    try {
      // A. Upload do Storage
      const storageRef = ref(storage, `contracts/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // B. Vytvorenie dokumentu v Firestore (spustí Cloud Function)
      await addDoc(collection(db, "internships"), {
        studentId: user.uid,
        studentEmail: user.email,
        contract_url: downloadURL,
        status: "ANALYZING", // Trigger pre Cloud Function
        createdAt: new Date().toISOString(),
        fileName: file.name
      });

    } catch (error) {
      console.error("Upload failed", error);
      alert("Chyba pri nahrávaní súboru.");
    } finally {
      setUploading(false);
    }
  };

  if (loadingData) return <div className="p-8 text-center">Načítavam dáta...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Študentský Dashboard</h1>
            <p className="text-gray-600 mt-2">Vitaj, {user?.email}</p>
          </div>
          <button onClick={() => auth.signOut()} className="text-sm text-red-600 hover:text-red-800">Odhlásiť</button>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Status Karta */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
             <h2 className="text-xl font-semibold text-gray-800 mb-4">Stav praxe</h2>
             
             {!internship ? (
               <div className="text-gray-500">Zatiaľ nemáš žiadnu aktívnu prax.</div>
             ) : (
               <div className="space-y-4">
                 <div className="flex items-center space-x-3">
                    <span className={`inline-block w-4 h-4 rounded-full ${
                      internship.status === 'ANALYZING' ? 'bg-blue-400 animate-pulse' :
                      internship.status === 'APPROVED' ? 'bg-green-500' :
                      internship.status === 'REJECTED' ? 'bg-red-500' : 'bg-gray-300'
                    }`}></span>
                    <span className="font-medium text-lg text-gray-700">
                      {internship.status === 'ANALYZING' && 'AI Analyzuje zmluvu...'}
                      {internship.status === 'APPROVED' && 'Schválené'}
                      {internship.status === 'REJECTED' && 'Zamietnuté'}
                    </span>
                 </div>

                 {internship.organization_name && (
                   <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                     <p><span className="font-semibold">Firma:</span> {internship.organization_name}</p>
                     <p><span className="font-semibold">Od:</span> {internship.start_date || 'Neznáme'}</p>
                     <p><span className="font-semibold">Do:</span> {internship.end_date || 'Neznáme'}</p>
                   </div>
                 )}
                 
                 {internship.ai_error_message && (
                    <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                      Chyba: {internship.ai_error_message}
                    </div>
                 )}
               </div>
             )}
          </div>

          {/* Actions Karta */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Akcie</h2>
            
            {!internship || internship.status === 'REJECTED' ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="sr-only">Vyber zmluvu</span>
                  <input 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      cursor-pointer disabled:opacity-50"
                  />
                </label>
                {uploading && <p className="text-sm text-blue-600 animate-pulse">Nahrávam a spracovávam...</p>}
                <p className="text-xs text-gray-400">Podporované: PDF, JPG (Max 5MB). AI automaticky prečíta údaje.</p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Zmluva odoslaná. Čakajte na potvrdenie.</p>
                <a href={internship.contract_url} target="_blank" rel="noreferrer" className="text-blue-500 text-sm hover:underline mt-2 block">
                  Zobraziť nahranú zmluvu
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
