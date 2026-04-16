'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, onSnapshot, orderBy, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Search, Filter } from 'lucide-react';

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
  const router = useRouter();

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
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'student': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Student</span>;
      case 'mentor': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Mentor</span>;
      case 'company': return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">Firma</span>;
      case 'coordinator': return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">Koordinátor</span>;
      case 'admin': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">Admin</span>;
      case 'institution': return <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-semibold">Instituce</span>;
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
                <option value="mentor">Mentoři</option>
                <option value="company">Firmy</option>
                <option value="coordinator">Koordinátoři</option>
                <option value="institution">Instituce</option>
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
                  <th className="px-6 py-4 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
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
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name || u.displayName)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium transition"
                        >
                          Odstranit
                        </button>
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
    </div>
  );
}
