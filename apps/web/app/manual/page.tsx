
'use client';

import React from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Users,
  Building2,
  ArrowLeft,
  CheckCircle,
  Bot,
  FileText
} from 'lucide-react';

export default function ManualPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold text-blue-600 flex items-center gap-2">
            PraxiHub
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Zpět na Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-20">

        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-gray-900">
            PraxiHub Manuál
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 leading-relaxed">
            Méně byrokracie, více praxe. Digitální platforma pro řízení odborných stáží.
          </p>
        </section>

        {/* Section 1: Pro koho je PraxiHub? */}
        <section>
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Pro koho je PraxiHub?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">

            {/* Student */}
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 prose prose-blue">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-6">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-4 mt-0">Student</h3>
                <p className="text-gray-600 mb-0">
                  Konec zmatků. Jasný postup krok za krokem, AI Matchmaking pro nalezení firmy a automatické generování smluv bez přepisování.
                </p>
              </div>
            </div>

            {/* Koordinátor */}
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 prose prose-indigo">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-6">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-4 mt-0">Koordinátor</h3>
                <p className="text-gray-600 mb-0">
                  Centrální přehled všech stáží. Schvalování firem a smluv na jedno kliknutí, automatická kontrola dat a pokročilé filtrování.
                </p>
              </div>
            </div>

            {/* Firma */}
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 prose prose-green">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-4 mt-0">Firma</h3>
                <p className="text-gray-600 mb-0">
                  Přístup k talentům dle dovedností. Snadná digitální administrativa, stažení smluv a rychlé hodnocení studentů.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Section 2: Klíčové Funkce */}
        <section className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-200">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Klíčové Funkce
          </h2>
          <div className="grid md:grid-cols-3 gap-12">

            <div className="flex flex-col items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Dvoufázové Schvalování</h3>
              <p className="text-gray-600 leading-relaxed">
                Nejprve koordinátor schválí firmu, až poté student generuje smlouvu. Tím předcházíme chybám.
              </p>
            </div>

            <div className="flex flex-col items-start gap-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Inteligentní Chatbot</h3>
              <p className="text-gray-600 leading-relaxed">
                Průvodce, který radí v každém kroku. Upozorní na čekající úkoly a nové žádosti.
              </p>
            </div>

            <div className="flex flex-col items-start gap-4">
              <div className="p-3 bg-green-50 rounded-xl text-green-600">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">AI & PDF Generátor</h3>
              <p className="text-gray-600 leading-relaxed">
                Systém automaticky vyplní smlouvy a při nahrání zkontroluje správnost údajů.
              </p>
            </div>

          </div>
        </section>

        {/* Section 3: Jak to funguje? */}
        <section>
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-900">
            Jak to funguje?
          </h2>

          <div className="space-y-12">

            {/* Pohled Studenta */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-blue-50 px-8 py-4 border-b border-blue-100">
                <h3 className="text-xl font-bold text-blue-800 flex items-center gap-3">
                  <GraduationCap className="w-5 h-5" />
                  Pohled Studenta
                </h3>
              </div>
              <div className="p-8">
                <ol className="space-y-4 list-decimal list-inside text-gray-700 marker:text-blue-600 marker:font-bold">
                  <li className="pl-2"><span className="ml-2">Vyplníte žádost o schválení firmy (IČO, Název).</span></li>
                  <li className="pl-2"><span className="ml-2">Počkáte na schválení koordinátorem (Chatbot vás upozorní).</span></li>
                  <li className="pl-2"><span className="ml-2">Po schválení vygenerujete smlouvu, necháte podepsat a nahrajete sken.</span></li>
                </ol>
              </div>
            </div>

            {/* Pohled Koordinátora */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-indigo-50 px-8 py-4 border-b border-indigo-100">
                <h3 className="text-xl font-bold text-indigo-800 flex items-center gap-3">
                  <Users className="w-5 h-5" />
                  Pohled Koordinátora
                </h3>
              </div>
              <div className="p-8">
                <ol className="space-y-4 list-decimal list-inside text-gray-700 marker:text-indigo-600 marker:font-bold">
                  <li className="pl-2"><span className="ml-2">V Dashboardu vidíte nové žádosti o schválení firmy.</span></li>
                  <li className="pl-2"><span className="ml-2">Schválíte nebo zamítnete firmu jedním kliknutím.</span></li>
                  <li className="pl-2"><span className="ml-2">Finálně zkontrolujete a schválíte nahranou smlouvu.</span></li>
                </ol>
              </div>
            </div>

            {/* Pohled Firmy */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-green-50 px-8 py-4 border-b border-green-100">
                <h3 className="text-xl font-bold text-green-800 flex items-center gap-3">
                  <Building2 className="w-5 h-5" />
                  Pohled Firmy
                </h3>
              </div>
              <div className="p-8">
                <ol className="space-y-4 list-decimal list-inside text-gray-700 marker:text-green-600 marker:font-bold">
                  <li className="pl-2"><span className="ml-2">Nastavíte si profil a koho hledáte (Skills).</span></li>
                  <li className="pl-2"><span className="ml-2">V přehledu si stáhnete smlouvu pro své HR/Účetní.</span></li>
                  <li className="pl-2"><span className="ml-2">Na konci praxe vyplníte hodnocení studenta.</span></li>
                </ol>
              </div>
            </div>

          </div>
        </section>

      </main>

      <footer className="bg-white border-t border-gray-200 mt-20 py-12 text-center text-gray-500 text-sm">
        <p>© 2025 PraxiHub. Všechna práva vyhrazena.</p>
      </footer>

    </div>
  );
}
