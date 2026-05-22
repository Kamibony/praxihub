'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function DashboardRouter() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const role = user.role;

    if (!role) {
      // User document not found or missing role, need onboarding
      router.push('/onboarding');
      return;
    }

    if (role === 'student' || role === 'mentor') {
      if (!user.researchConsent) {
        router.push('/consent');
        return;
      }
    }

    if (role === 'student') {
      router.push('/student/dashboard');
    } else if (role === 'institution' || role === 'company' || role === 'mentor') {
      router.push('/institution/dashboard');
    } else if (role === 'coordinator' || role === 'admin') {
      router.push('/admin/dashboard');
    } else {
      console.error('Unknown role:', role);
      router.push('/login');
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Načítání...</h2>
        <p className="text-sm text-gray-500">Přesměrovávám...</p>
      </div>
    </div>
  );
}
