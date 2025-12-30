'use client';

import React, { useEffect, useState } from 'react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { GraduationCap, Building2, UserCheck, CheckCircle2, Bot, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- LOGIKA PRESMEROVANIA ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Používateľ je prihlásený, zistíme rolu a presmerujeme
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role === "student") router.push("/student/dashboard");
            else if (role === "company") router.push("/company/dashboard");
            else if (role === "coordinator") router.push("/admin/dashboard");
            else setLoading(false); // Neznáma rola, ukážeme web
          } else {
            setLoading(false); // Dokument chýba, ukážeme web
          }
        } catch (error) {
          console.error("Chyba pri získavaní role:", error);
          setLoading(false);
        }
      } else {
        // Používateľ nie je prihlásený, ukážeme Landing Page
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Kým overujeme prihlásenie, zobrazíme loader (aby stránka "nepreblikla")
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          <div className="text-slate-500 font-medium">Načítám PraxiHub...</div>
        </div>
      </div>
    );
  }

  // --- SAMOTNÁ LANDING PAGE ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* --- HERO SEKCE --- */}
      <main className="flex-grow pt-24 pb-12 md:pt-32 md:pb-24">
        <section className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
            <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide uppercase mb-6 inline-flex items-center gap-2">
              <Bot size={16} />
              Poháněno Google Gemini AI
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-tight mb-8 tracking-tight">
              PraxiHub: Budoucnost <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                studentských stáží.
              </span>
            </h1>
            <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Digitální platforma, která zbavuje univerzity papírování a spojuje studenty s praxí.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/login?role=student" className="px-8 py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-700 transition shadow-lg hover:-translate-y-1">
                Jsem Student
              </Link>
              <Link href="/login?role=company" className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl text-lg font-semibold hover:bg-slate-50 transition shadow-sm hover:-translate-y-1">
                Jsem Firma
              </Link>
              <Link href="/manual" className="px-8 py-4 text-slate-500 font-semibold hover:text-blue-600 transition flex items-center justify-center gap-2">
                Pro Univerzity
              </Link>
            </div>
          </div>
          
          {/* Dekorativní pozadí */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full h-full z-0 opacity-40 pointer-events-none">
            <div className="absolute top-20 left-10 w-96 h-96 bg-blue-200/50 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
            <div className="absolute top-20 right-10 w-96 h-96 bg-indigo-200/50 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          </div>
        </section>

        {/* --- FEATURE GRID (BENTO STYLE) --- */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Karta: Student */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition group">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition duration-300">
                  <GraduationCap size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Pro Studenty</h3>
                <p className="text-slate-600 leading-relaxed">
                  Nahrajte smlouvu mobilem, AI zkontroluje údaje a automaticky vše pošle ke schválení. Žádné fronty na studijním.
                </p>
              </div>

              {/* Karta: Koordinátor */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-200 transition group md:mt-12">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition duration-300">
                  <UserCheck size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Pro Koordinátory</h3>
                <p className="text-slate-600 leading-relaxed">
                  Dashboard s přehledem všech studentů. Schvalování na jedno kliknutí a automatické notifikace při problémech.
                </p>
              </div>

              {/* Karta: Firma */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-200 transition group">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition duration-300">
                  <Building2 size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Pro Firmy</h3>
                <p className="text-slate-600 leading-relaxed">
                  Efektivní nábor stážistů a digitální správa dokumentace. Všechny smlouvy a hodnocení na jednom místě.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- TRUST SECTION --- */}
        <section className="py-16 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-lg font-semibold text-slate-400 uppercase tracking-wider mb-8">Důvěřují nám moderní univerzity</h2>
            <div className="flex flex-wrap justify-center items-center gap-12 opacity-50 grayscale hover:grayscale-0 transition duration-500">
              {/* Placeholders for logos */}
              <div className="h-12 w-32 bg-slate-200 rounded animate-pulse flex items-center justify-center text-slate-400 font-bold text-xs">UNIVERZITA A</div>
              <div className="h-12 w-32 bg-slate-200 rounded animate-pulse flex items-center justify-center text-slate-400 font-bold text-xs">VYSOKÁ ŠKOLA B</div>
              <div className="h-12 w-32 bg-slate-200 rounded animate-pulse flex items-center justify-center text-slate-400 font-bold text-xs">TECH INSTITUT</div>
              <div className="h-12 w-32 bg-slate-200 rounded animate-pulse flex items-center justify-center text-slate-400 font-bold text-xs">AKADEMIE VĚD</div>
            </div>
          </div>
        </section>
      </main>

      {/* --- FOOTER --- */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="text-xl font-bold text-slate-900">PraxiHub</span>
          </div>

          <div className="flex gap-8 text-sm font-medium text-slate-600">
            <Link href="/manual" className="hover:text-blue-600 transition">Manuál</Link>
            <Link href="/login" className="hover:text-blue-600 transition">Přihlášení</Link>
            <Link href="#" className="hover:text-blue-600 transition">Kontakt</Link>
          </div>

          <div className="text-slate-400 text-sm">
            © 2025 University Systems.
          </div>
        </div>
      </footer>
    </div>
  );
}
