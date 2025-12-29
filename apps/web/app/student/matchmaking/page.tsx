'use client';

import React, { useEffect, useState } from 'react';
import { auth, functions } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Match {
  companyId: string;
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
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <Link href="/student/dashboard" className="text-sm text-gray-500 hover:text-gray-900 mb-2 inline-block">
              ← Zpět na dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">AI Matchmaking</h1>
            <p className="text-gray-600 mt-1">Hledáme pro tebe ideální firmu na základě tvých dovedností.</p>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-lg text-gray-600 font-medium">Gemini AI analyzuje tvůj profil a porovnává ho s firmami...</p>
          </div>
        ) : error ? (
          <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-gray-200">
             <div className="text-gray-400 mb-4">
               <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <h3 className="text-xl font-bold text-gray-900 mb-2">Ups, něco se nepovedlo</h3>
             <p className="text-gray-600 mb-6">{error}</p>
             <Link href="/student/dashboard">
               <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                 Spravovat dovednosti
               </button>
             </Link>
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-gray-200">
             <p className="text-gray-600">Nenašli jsme žádnou shodu. Zkus přidat více dovedností na svém profilu.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {matches.map((match) => (
              <div key={match.companyId} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{match.companyName}</h2>
                    <p className="text-sm text-gray-500 mb-2">{match.companyEmail}</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {match.lookingFor && match.lookingFor.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
                      <p className="text-sm text-blue-900 italic">
                        <span className="font-bold not-italic mr-2">🤖 Gemini:</span>
                        "{match.reasoning}"
                      </p>
                    </div>
                  </div>

                  <div className={`flex flex-col items-center justify-center p-4 rounded-lg border min-w-[100px] ${getScoreColor(match.matchScore)}`}>
                    <span className="text-3xl font-bold">{match.matchScore}%</span>
                    <span className="text-xs font-medium uppercase tracking-wider">Shoda</span>
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
