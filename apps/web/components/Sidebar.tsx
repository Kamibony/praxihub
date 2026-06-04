'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, FileText, Settings, LogOut, Users } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, firebaseUser } = useAuth();
  const logout = () => signOut(auth);

  const role = user?.role || 'student';

  const navItems = [
    { name: 'Dashboard', href: role === 'student' ? '/student/dashboard' : role === 'institution' ? '/institution/dashboard' : '/admin/dashboard', icon: LayoutDashboard },
  ];

  if (role === 'admin' || role === 'coordinator') {
      navItems.push({ name: 'Dokumenty', href: '/admin/documents', icon: FileText });
      navItems.push({ name: 'Uživatelé', href: '/admin/users', icon: Users });
      navItems.push({ name: 'Vyúčtování', href: '/admin/payroll', icon: FileText });
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-[300px] bg-white border-r border-slate-200 hidden md:flex flex-col z-40 shadow-sm transition-transform duration-300">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <span className="text-xl font-bold text-slate-900 tracking-tight">Praxi<span className="text-brand-500">Hub</span></span>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-3 mt-4">Hlavní menu</div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-50 text-brand-500 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-500' : 'text-slate-400'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-brand-500 flex items-center justify-center font-bold text-lg uppercase shadow-inner">
              {user?.name?.[0] || user?.email?.[0] || 'U'}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold text-slate-900 truncate">{user?.name || user?.email}</span>
              <span className="text-xs text-slate-500 capitalize font-medium">{role}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 mt-1 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100"
          >
            <LogOut size={16} /> Odhlásit se
          </button>
        </div>
      </div>
    </aside>
  );
}
