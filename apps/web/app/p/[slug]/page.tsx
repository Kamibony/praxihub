"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
import { MapPin, Briefcase, GraduationCap, Mail, ShieldCheck } from 'lucide-react';

interface PortfolioData {
  displayName: string;
  major: string;
  bio: string;
  avatarUrl?: string;
  skills: { skill: string; level: number }[];
  completedPlacements: number;
  totalHours: number;
}

export default function PublicPortfolioPage() {
  const { slug } = useParams() as { slug: string };
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortfolio() {
      if (!slug) return;
      try {
        const docRef = doc(db, 'public_portfolios', slug);
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
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
        <ShieldCheck className="h-16 w-16 text-slate-400 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Přístup odepřen</h1>
        <p className="text-slate-600">{error || 'Portfolio nenalezeno'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Header Profile */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="h-24 w-24 rounded-full bg-white p-1 shadow-md">
              <div className="h-full w-full rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-500 overflow-hidden">
                {portfolio.avatarUrl ? (
                  <img src={portfolio.avatarUrl} alt="Avatar" className="object-cover h-full w-full" />
                ) : (
                  portfolio.displayName.charAt(0)
                )}
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-slate-900">{portfolio.displayName}</h1>
            <div className="flex items-center space-x-4 mt-2 text-slate-600">
              <div className="flex items-center">
                <GraduationCap className="h-4 w-4 mr-1" />
                {portfolio.major || 'Student'}
              </div>
            </div>

            <p className="mt-6 text-slate-700 max-w-3xl leading-relaxed">
              {portfolio.bio || 'Student zatím nepřidal svůj profesní profil.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Stats */}
        <div className="md:col-span-1 space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <Briefcase className="h-5 w-5 mr-2 text-indigo-600" />
              Statistiky praxe
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Dokončené stáže</p>
                <p className="text-2xl font-bold text-slate-900">{portfolio.completedPlacements || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Odpracované hodiny</p>
                <p className="text-2xl font-bold text-slate-900">{portfolio.totalHours || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Skill Matrix */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Profil Kompetencí (MŠMT KRAU)</h2>

            {portfolio.skills && portfolio.skills.length > 0 ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={portfolio.skills}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Student"
                      dataKey="level"
                      stroke="#4f46e5"
                      fill="#4f46e5"
                      fillOpacity={0.4}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500">Zatím nejsou k dispozici žádná data z hodnocení.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
