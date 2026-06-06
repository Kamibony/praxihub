"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { ShieldCheck } from 'lucide-react';

interface PortfolioData {
  displayName: string;
  major: string;
  bio: string;
  avatarUrl?: string;
  skills: { skill: string; level: number }[];
  completedPlacements: number;
  totalHours: number;
}

function PortfolioContent({ studentId }: { studentId: string }) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortfolio() {
      if (!studentId) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'public_portfolios', studentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setPortfolio(docSnap.data() as PortfolioData);
        } else {
          setError('Portfolio nebylo nalezeno.');
        }
      } catch (err: any) {
        console.error('Error fetching portfolio:', err);
        setError('Došlo k chybě při načítání portfolia.');
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolio();
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-slate-900">
        <ShieldCheck className="h-16 w-16 text-slate-500 mb-4" />
        <h1 className="text-2xl font-bold text-theme-primary mb-2">Přístup odepřen</h1>
        <p className="text-theme-muted">{error || 'Portfolio nenalezeno'}</p>
      </div>
    );
  }

  return (
    <div data-testid="portfolio-content" className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Header Profile */}
      <div className="bg-slate-800/75 backdrop-blur-md border border-theme-border rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="h-32 bg-gradient-to-r from-indigo-900 to-slate-800"></div>
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="h-24 w-24 rounded-full bg-slate-800 p-1 shadow-md border border-theme-border">
              <div className="h-full w-full rounded-full bg-slate-700 flex items-center justify-center text-2xl font-bold text-theme-secondary overflow-hidden">
                {portfolio.avatarUrl ? (
                  <img src={portfolio.avatarUrl} alt="Avatar" className="object-cover h-full w-full" />
                ) : (
                  portfolio.displayName.charAt(0)
                )}
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-theme-primary">{portfolio.displayName}</h1>
            <div className="flex items-center space-x-4 mt-2 text-theme-muted">
              <div className="flex items-center">
                🎓 {portfolio.major || 'Student'}
              </div>
            </div>

            <p className="mt-6 text-theme-secondary max-w-3xl leading-relaxed">
              {portfolio.bio || 'Student zatím nepřidal svůj profesní profil.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Stats */}
        <div className="md:col-span-1 space-y-8">
          <div className="card-glass p-6">
            <h2 className="text-lg font-semibold text-theme-primary mb-4 flex items-center">
              💼 Statistiky praxe
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-theme-muted">Dokončené stáže</p>
                <p className="text-2xl font-bold text-theme-primary">{portfolio.completedPlacements || 0}</p>
              </div>
              <div>
                <p className="text-sm text-theme-muted">Odpracované hodiny</p>
                <p className="text-2xl font-bold text-theme-primary">{portfolio.totalHours || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Skill Matrix */}
        <div className="md:col-span-2">
          <div className="card-glass p-6 h-full">
            <h2 className="text-lg font-semibold text-theme-primary mb-6">🌟 Profil Kompetencí (MŠMT KRAU)</h2>

            {portfolio.skills && portfolio.skills.length > 0 ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={portfolio.skills}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Student"
                      dataKey="level"
                      stroke="#818cf8"
                      fill="#818cf8"
                      fillOpacity={0.4}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">
                <p className="text-theme-muted">Zatím nejsou k dispozici žádná data z hodnocení.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useParams } from 'next/navigation';

export default function PublicPortfolioPage() {
  const params = useParams();
  return (
    <div className="min-h-screen dark bg-slate-900 text-theme-primary font-sans">
      <Suspense fallback={<div data-testid="portfolio-loading" className="min-h-screen flex items-center justify-center"><p className="text-theme-secondary">Načítám data...</p></div>}>
        <PortfolioContent studentId={params.studentId as string} />
      </Suspense>
    </div>
  );
}
