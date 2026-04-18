'use client';

import React, { useEffect, useState } from 'react';
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          if (idTokenResult.claims.impersonatorUid) {
            setIsImpersonating(true);
            document.body.style.paddingTop = '40px';

            // Fetch name for display
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                setTargetName(userDoc.data().name || userDoc.data().displayName || 'Uživatel');
            }
          } else {
            setIsImpersonating(false);
            setTargetName(null);
            document.body.style.paddingTop = '0px';
          }
        } catch (error) {
           console.error("Error checking claims:", error);
           document.body.style.paddingTop = '0px';
        }
      } else {
         setIsImpersonating(false);
         setTargetName(null);
         document.body.style.paddingTop = '0px';
      }
    });

    return () => {
      unsubscribe();
      document.body.style.paddingTop = '0px';
    };
  }, [pathname]); // Re-run if path changes just in case, though onAuthStateChanged is the real driver

  const handleReturn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const functions = getFunctions();
      const stopImpersonating = httpsCallable(functions, 'stopImpersonating');
      const result = await stopImpersonating();
      const data = result.data as { returnToken: string };

      if (data.returnToken) {
          await signInWithCustomToken(auth, data.returnToken);
          router.push('/admin/dashboard');
      }
    } catch (error) {
      console.error('Error returning to admin session:', error);
      alert('Chyba při návratu do administrátorského účtu.');
    } finally {
        setLoading(false);
    }
  };

  if (!isImpersonating || !targetName) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-[40px] bg-red-600 text-white flex items-center justify-between px-4 z-[9999] shadow-md text-sm font-medium">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} />
        <span>Právě jste přihlášeni jako <strong>{targetName}</strong></span>
      </div>
      <button
        onClick={handleReturn}
        disabled={loading}
        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition px-3 py-1 rounded disabled:opacity-50"
      >
        <LogOut size={14} />
        {loading ? 'Návrat...' : 'Návrat do Adminu'}
      </button>
    </div>
  );
}
