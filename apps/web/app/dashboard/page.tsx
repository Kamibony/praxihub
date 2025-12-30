'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Loader2 } from 'lucide-react';

export default function DashboardRouter() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role;

          if (role === 'student') {
            router.push('/student/dashboard');
          } else if (role === 'company') {
            router.push('/company/dashboard');
          } else if (role === 'coordinator' || role === 'admin') {
            router.push('/admin/dashboard');
          } else {
            console.error('Unknown role:', role);
            router.push('/login');
          }
        } else {
          // User document not found
          router.push('/login');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Načítání...</h2>
        <p className="text-sm text-gray-500">Přesměrovávám na váš dashboard</p>
      </div>
    </div>
  );
}
