'use client';

import React from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { usePathname } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Determine if we should show the shell based on the route
  const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname === '/onboarding';
  const isPublicRoute = pathname.startsWith('/p/') || pathname === '/' || pathname === '/consent';

  if (loading) {
    return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center"></div>;
  }

  const showShell = user && !isAuthRoute && !isPublicRoute;

  if (!showShell) {
    return <div className="min-h-screen bg-[#f8fafc] text-slate-900">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-[300px] flex flex-col transition-all duration-300">
        <div className="flex-1 w-full p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
