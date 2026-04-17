'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function ConsentPage() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists() && userDoc.data().researchConsent) {
        router.push("/dashboard");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleConsent = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        researchConsent: true
      });
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Chyba při ukládání souhlasu.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans p-4">
      <div className="w-full max-w-lg p-10 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="text-center mb-8">
           <div className="w-12 h-12 bg-indigo-900 rounded-xl flex items-center justify-center text-white mx-auto mb-4">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
           </div>
           <h2 className="text-2xl font-bold text-slate-900">Souhlas se zpracováním údajů</h2>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-slate-700 text-sm mb-8 leading-relaxed">
          <p className="font-medium text-center">
            "Súhlasím so spracovaním anonymizovaných údajov o interakcii so systémom na účely vedeckého výskumu a zvyšovania kvality vzdelávania na IVP."
          </p>
        </div>

        <button
          onClick={handleConsent}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Ukládám..." : "Souhlasím a chci pokračovat"}
        </button>
      </div>
    </div>
  );
}
