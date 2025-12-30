'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Menu, X, User as UserIcon, LogIn, BookOpen } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          }
        } catch (e) {
          console.error("Error fetching role", e);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Hide navbar on dashboard pages and auth pages where we want custom layout
  const isHidden =
    pathname.startsWith('/student') ||
    pathname.startsWith('/company') ||
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/signup';

  if (isHidden) {
    return null;
  }

  const getDashboardLink = () => {
    if (role === 'student') return '/student/dashboard';
    if (role === 'company') return '/company/dashboard';
    if (role === 'coordinator') return '/admin/dashboard';
    return '/';
  };

  return (
    <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-100 py-4 px-6 fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-slate-900 group">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
           </div>
           <span><span className="text-blue-600">Praxi</span>Hub</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
           <Link href="/manual" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition flex items-center gap-2">
             <BookOpen size={16} /> Manuál
           </Link>
           {!loading && (
             <>
               {user ? (
                 <Link href={getDashboardLink()} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm hover:shadow">
                   <UserIcon size={18} /> Dashboard
                 </Link>
               ) : (
                 <Link href="/login" className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition flex items-center gap-2 shadow-sm hover:shadow">
                   <LogIn size={18} /> Přihlásit se
                 </Link>
               )}
             </>
           )}
        </div>

        {/* Mobile Menu Button */}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-slate-900 p-2 hover:bg-slate-100 rounded-lg transition">
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-100 p-4 flex flex-col gap-4 shadow-xl">
           <Link href="/manual" className="flex items-center gap-2 text-slate-600 font-medium p-2 hover:bg-slate-50 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
             <BookOpen size={18} /> Manuál
           </Link>
           {user ? (
              <Link href={getDashboardLink()} className="flex items-center gap-2 text-blue-600 font-bold p-2 hover:bg-blue-50 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                <UserIcon size={18} /> Dashboard
              </Link>
           ) : (
              <Link href="/login" className="flex items-center gap-2 text-slate-900 font-bold p-2 hover:bg-slate-50 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                <LogIn size={18} /> Přihlásit se
              </Link>
           )}
        </div>
      )}
    </nav>
  );
}
