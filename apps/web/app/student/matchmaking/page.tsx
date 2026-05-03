'use client';

import React, { useEffect, useState } from 'react';
import { auth, functions } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Match {
  organizationId: string;
  companyName: string;
  companyEmail: string;
  matchScore: number;
  reasoning: string;
  lookingFor: string[];
}

export default function MatchmakingPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        findMatches();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const findMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const findMatchesFn = httpsCallable(functions, 'findMatches');
      const result = await findMatchesFn();
      const data = result.data as any;

      if (data.matches) {
        setMatches(data.matches);
      } else if (data.message) {
        setError(data.message);
      }
    } catch (err: any) {
      console.error("Matchmaking error:", err);
      setError("Nepodařilo se načíst doporučení. Zkuste to prosím později.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 bg-emerald-900/20 border-emerald-800/50";
    if (score >= 50) return "text-yellow-400 bg-yellow-900/20 border-yellow-800/50";
    return "text-slate-400 bg-slate-800/50 border-slate-700/50";
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8 font-sans text-slate-100">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <Link href="/student/dashboard" className="text-sm text-slate-400 hover:text-slate-200 mb-2 inline-block transition">
              ← Zpět na dashboard
            </Link>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">✨ AI Matchmaking</h1>
            <p className="text-slate-400 mt-1">Hledáme pro tebe ideální firmu na základě tvých dovedností.</p>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-lg text-slate-300 font-medium">✨ Gemini AI analyzuje tvůj profil a porovnává ho s firmami...</p>
          </div>
        ) : error ? (
          <div className="bg-slate-800/75 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/10 text-center">
             <div className="text-red-400 mb-4">
               <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Ups, něco se nepovedlo</h3>
             <p className="text-slate-400 mb-6">{error}</p>
             <Link href="/student/dashboard">
               <button className="px-6 py-2 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-md">
                 Spravovat dovednosti
               </button>
             </Link>
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-slate-800/75 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/10 text-center">
             <p className="text-slate-400">Nenašli jsme žádnou shodu. Zkus přidat více dovedností na svém profilu.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {matches.map((match) => (
              <div key={match.organizationId} className="bg-slate-800/75 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-white/10 hover:border-indigo-500/50 transition relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-indigo-600/20 transition"></div>
                <div className="flex justify-between items-start gap-4 relative z-10">
                  <div>
                    <h2 className="text-xl font-bold text-white">{match.companyName}</h2>
                    <p className="text-sm text-slate-400 mb-2">{match.companyEmail}</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {match.lookingFor && match.lookingFor.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-900/50 text-slate-300 text-xs rounded-full border border-slate-700/50">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="bg-indigo-900/20 p-4 rounded-2xl border border-indigo-800/50 mt-4">
                      <p className="text-sm text-indigo-300 flex items-start gap-2">
                        <span className="font-bold mr-1">✨</span>
                        "{match.reasoning}
                      </p>
                    </div>
                  </div>

                  <div className={`flex flex-col items-center justify-center p-4 rounded-2xl border min-w-[100px] shadow-sm ${getScoreColor(match.matchScore)}`}>
                    <span className="text-3xl font-bold">{match.matchScore}%</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 mt-1">Shoda</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
