'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, onSnapshot, orderBy, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Search, Filter, X } from 'lucide-react';

export default function UserManagementPage() {
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Opravdu chcete smazat uživatele ${userName || 'Bez jména'}? Tato akce je nevratná.`)) {
      try {
        await deleteDoc(doc(db, "users", userId));
        // Note: In a full app, you might also want to delete the user from Firebase Auth using an Admin SDK cloud function.
        // For cleaning up ghost accounts in Firestore during this database wipe phase, deleting the doc is often the primary goal.
      } catch (error) {
        console.error("Chyba při mazání uživatele:", error);
        alert("Nepodařilo se smazat uživatele.");
      }
    }
  };

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const router = useRouter();

  const handleImpersonate = async (userId: string, userName: string) => {
    if (!window.confirm(`Opravdu se chcete přihlásit jako uživatel ${userName || 'Bez jména'}?`)) {
      return;
    }

    setImpersonating(userId);
    try {
      const functions = getFunctions();
      const getImpersonationToken = httpsCallable(functions, 'getImpersonationToken');
      const result = await getImpersonationToken({ targetUserId: userId });
      const data = result.data as { targetToken: string };

      if (data.targetToken) {
        await signInWithCustomToken(auth, data.targetToken);
        router.push('/dashboard'); // Route based on user role
      } else {
        throw new Error("Missing token in response.");
      }
    } catch (error) {
      console.error("Chyba při přihlašování za uživatele:", error);
      alert("Nepodařilo se přihlásit jako tento uživatel.");
    } finally {
      setImpersonating(null);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      } else {
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setUsers(data);
          setLoading(false);
        });
        return () => unsubscribeFirestore();
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());

    let matchesRole = false;
    if (roleFilter === 'ALL') {
      matchesRole = true;
    } else if (roleFilter === 'institution') {
      matchesRole = u.role === 'institution' || u.role === 'company' || u.role === 'mentor';
    } else if (roleFilter === 'coordinator') {
      matchesRole = u.role === 'coordinator' || u.role === 'admin';
    } else {
      matchesRole = u.role === roleFilter;
    }

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'student': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Student</span>;
      case 'institution':
      case 'company':
      case 'mentor':
        return <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-semibold">Instituce</span>;
      case 'coordinator':
      case 'admin':
        return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">Koordinátor</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-semibold">{role}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Users className="text-blue-600" size={32} />
              Správa uživatelů
            </h1>
            <p className="text-slate-600 mt-2">Komplexní přehled a správa všech uživatelů v systému.</p>
          </div>
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            Zpět na Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Hledat podle jména nebo e-mailu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="text-slate-400" size={18} />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm w-full md:w-auto"
              >
                <option value="ALL">Všechny role</option>
                <option value="student">Studenti</option>
                <option value="institution">Instituce</option>
                <option value="coordinator">Koordinátoři</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Jméno / E-mail</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Zaměření (Major)</th>
                  <th className="px-6 py-4">Ročník</th>
                  <th className="px-6 py-4">Škola / Organizace</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => setSelectedUser(u)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{u.name || u.displayName || 'Bez jména'}</div>
                        <div className="text-slate-500 text-xs">{u.email || 'Bez e-mailu'}</div>
                      </td>
                      <td className="px-6 py-4">
                        {getRoleBadge(u.role)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {u.major || '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {u.year || '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {u.organizationId || u.companyName || u.organizationName || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className="text-blue-600 font-medium text-sm">Detail &rarr;</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      Žádní uživatelé nenalezeni pro zadaná kritéria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
            <span>Celkem zobrazeno: {filteredUsers.length}</span>
            <span>Systémový modul správy uživatelů</span>
          </div>
        </div>
      </div>

      {/* Slide-over CRM Panel */}
      {selectedUser && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setSelectedUser(null)}
          ></div>
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto border-l border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900">Detail uživatele</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-slate-200 rounded-lg transition text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-grow flex flex-col gap-6">
               <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                    {(selectedUser.name || selectedUser.displayName || 'U')[0].toUpperCase()}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">{selectedUser.name || selectedUser.displayName || 'Bez jména'}</h3>
                  <p className="text-slate-500">{selectedUser.email || 'Bez e-mailu'}</p>
                  <div className="mt-2">
                    {getRoleBadge(selectedUser.role)}
                  </div>
               </div>

               <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Informace</h4>
                  <div className="grid grid-cols-2 gap-y-4 text-sm">
                    <div>
                      <span className="block text-slate-500 mb-1">ID Uživatele</span>
                      <span className="font-medium font-mono text-xs text-slate-700">{selectedUser.id}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 mb-1">Založeno</span>
                      <span className="font-medium text-slate-900">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('cs-CZ') : '-'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 mb-1">Zaměření (Major)</span>
                      <span className="font-medium text-slate-900">{selectedUser.major || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 mb-1">Ročník</span>
                      <span className="font-medium text-slate-900">{selectedUser.year || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-slate-500 mb-1">Organizace / Škola</span>
                      <span className="font-medium text-slate-900">{selectedUser.organizationId || selectedUser.companyName || selectedUser.organizationName || '-'}</span>
                    </div>
                  </div>
               </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3">
               <button
                  onClick={() => {
                    handleImpersonate(selectedUser.id, selectedUser.name || selectedUser.displayName);
                  }}
                  disabled={impersonating === selectedUser.id || selectedUser.role === 'admin' || selectedUser.role === 'coordinator'}
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
               >
                 {impersonating === selectedUser.id ? 'Načítání...' : 'Přihlásit se jako tento uživatel'}
               </button>
               <button
                  onClick={() => {
                    handleDeleteUser(selectedUser.id, selectedUser.name || selectedUser.displayName);
                    setSelectedUser(null);
                  }}
                  className="w-full py-3 bg-white text-red-600 border border-red-200 font-semibold rounded-lg hover:bg-red-50 transition flex items-center justify-center gap-2"
               >
                 Odstranit uživatele
               </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
