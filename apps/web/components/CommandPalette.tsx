'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, User, FileText, LayoutDashboard, MonitorPlay, BookOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          }
        } catch (e) {
          console.error("Error fetching role for command palette", e);
        }
      } else {
        setRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Close palette when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 sm:pt-[20vh] bg-slate-900/50 backdrop-blur-sm p-4">
      <Command
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
          }
        }}
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 mr-2" />
          <Command.Input
            autoFocus
            placeholder="Hledat nebo zadat příkaz (⌘K)"
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none text-lg"
          />
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-slate-500 text-sm">Nic nebylo nalezeno.</Command.Empty>

          <Command.Group heading="Navigace" className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Command.Item
              onSelect={() => runCommand(() => router.push('/'))}
              className="flex items-center px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 transition"
            >
              <LayoutDashboard className="w-4 h-4 mr-3" /> Domů
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => router.push('/manual'))}
              className="flex items-center px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 transition"
            >
              <BookOpen className="w-4 h-4 mr-3" /> Manuál
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => router.push('/showcase'))}
              className="flex items-center px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 transition"
            >
              <MonitorPlay className="w-4 h-4 mr-3" /> Prezentační mód
            </Command.Item>
          </Command.Group>

          {role === 'admin' || role === 'coordinator' ? (
            <Command.Group heading="Administrace" className="px-2 py-1.5 mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Command.Item
                onSelect={() => runCommand(() => router.push('/admin/dashboard'))}
                className="flex items-center px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 transition"
              >
                <LayoutDashboard className="w-4 h-4 mr-3" /> Admin Dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/admin/users'))}
                className="flex items-center px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 transition"
              >
                <User className="w-4 h-4 mr-3" /> Správa Uživatelů
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/admin/documents'))}
                className="flex items-center px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 transition"
              >
                <FileText className="w-4 h-4 mr-3" /> Centrum Dokumentů
              </Command.Item>
            </Command.Group>
          ) : null}

          {role === 'institution' ? (
             <Command.Group heading="Organizace" className="px-2 py-1.5 mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
               <Command.Item
                 onSelect={() => runCommand(() => router.push('/institution/dashboard'))}
                 className="flex items-center px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 transition"
               >
                 <LayoutDashboard className="w-4 h-4 mr-3" /> Instituce Dashboard
               </Command.Item>
             </Command.Group>
          ) : null}

          {role === 'student' ? (
             <Command.Group heading="Student" className="px-2 py-1.5 mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
               <Command.Item
                 onSelect={() => runCommand(() => router.push('/student/dashboard'))}
                 className="flex items-center px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 transition"
               >
                 <LayoutDashboard className="w-4 h-4 mr-3" /> Student Dashboard
               </Command.Item>
               <Command.Item
                 onSelect={() => runCommand(() => router.push('/student/generate'))}
                 className="flex items-center px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 transition"
               >
                 <FileText className="w-4 h-4 mr-3" /> Generovat Smlouvu
               </Command.Item>
             </Command.Group>
          ) : null}

        </Command.List>
      </Command>
    </div>
  );
}
