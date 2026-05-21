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
  FileText,
  Lock,
  Unlock,
  PlayCircle
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
            Manuál pro UAT Testování
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 leading-relaxed">
            Vyzkoušejte si systém od nuly bez zkratek. Tento průvodce vás provede autentickou cestou nového studenta i procesem schvalování.
          </p>
        </section>

        {/* Příprava účtů */}
        <section className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Příprava před testováním
          </h2>
          <div className="text-gray-700 space-y-4">
            <p>Pro správný průběh testování potřebujete dva přístupy:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li><strong>Účet koordinátora:</strong> Použijte připravený účet (např. <code>admin@praxihub.cz</code>).</li>
              <li><strong>Nový účet studenta:</strong> Vytvořte si zcela nový účet pomocí registrační stránky (<code>/signup</code>) nebo použijte čistý testovací e-mail.</li>
            </ul>
          </div>
        </section>

        {/* Cesta Krok za Krokem */}
        <section>
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-900">
            Průběh testování (Příběh ve třech fázích)
          </h2>

          <div className="space-y-12">

            {/* Fáze 1 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-blue-50 px-8 py-6 border-b border-blue-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-blue-800 flex items-center gap-3">
                    <span className="bg-blue-200 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm">1</span>
                    Fáze 1: Nováček (Pohled Studenta)
                  </h3>
                  <p className="text-blue-600 mt-1 ml-11 text-sm font-medium">Navození prvního kontaktu se systémem</p>
                </div>
                <GraduationCap className="w-8 h-8 text-blue-300 hidden sm:block" />
              </div>
              <div className="p-8">
                <ol className="space-y-6 list-decimal list-inside text-gray-700 marker:text-blue-600 marker:font-bold">
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Registrace a Login:</span> Zaregistrujte se a přihlaste jako nový student.
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Vyplnění profilu (Onboarding):</span> Projděte vstupním dotazníkem a vyplňte své údaje.
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Výběr oboru:</span> Zvolte si svůj obor (UPV nebo KPV).
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Založení praxe:</span> Vyhledejte a požádejte o propojení s institucí (školkou/školou).
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Generování smlouvy:</span> Nechte si vygenerovat trojdohodu a "podepište" ji.
                  </li>
                </ol>
                <div className="mt-6 bg-slate-50 p-4 rounded-lg flex items-start gap-3 border border-slate-200">
                  <Lock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-600">
                    <strong>Všimněte si:</strong> V této chvíli jsou všechny záložky v Dashboardu (Náslechy, Výstupy, Reflexe) zamčené. Toto je záměrný stav, systém čeká na schválení koordinátorem!
                  </p>
                </div>
              </div>
            </div>

            {/* Fáze 2 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-indigo-50 px-8 py-6 border-b border-indigo-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-indigo-800 flex items-center gap-3">
                    <span className="bg-indigo-200 text-indigo-800 rounded-full w-8 h-8 flex items-center justify-center text-sm">2</span>
                    Fáze 2: Schválení (Pohled Koordinátora)
                  </h3>
                  <p className="text-indigo-600 mt-1 ml-11 text-sm font-medium">Odemknutí cesty pro studenta</p>
                </div>
                <Users className="w-8 h-8 text-indigo-300 hidden sm:block" />
              </div>
              <div className="p-8">
                <ol className="space-y-6 list-decimal list-inside text-gray-700 marker:text-indigo-600 marker:font-bold">
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Přihlášení Koordinátora:</span> Odhlaste se a přihlaste se jako koordinátor (<code>admin@praxihub.cz</code>).
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Lokalizace žádosti:</span> V administraci najděte žádost nového studenta o zahájení praxe.
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Aktivace:</span> Zkontrolujte údaje a klikněte na "Schválit" / "Aktivovat". Tímto krokem stvrzujete smlouvu.
                  </li>
                </ol>
              </div>
            </div>

            {/* Fáze 3 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-emerald-50 px-8 py-6 border-b border-emerald-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-3">
                    <span className="bg-emerald-200 text-emerald-800 rounded-full w-8 h-8 flex items-center justify-center text-sm">3</span>
                    Fáze 3: Aktivní Praxe (Návrat Studenta)
                  </h3>
                  <p className="text-emerald-600 mt-1 ml-11 text-sm font-medium">Plnění úkolů a evaluace</p>
                </div>
                <PlayCircle className="w-8 h-8 text-emerald-300 hidden sm:block" />
              </div>
              <div className="p-8">
                <ol className="space-y-6 list-decimal list-inside text-gray-700 marker:text-emerald-600 marker:font-bold">
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Návrat k profilu:</span> Přihlaste se zpět jako testovací student.
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Ověření odemčení:</span> Zkontrolujte Dashboard – modul 3 pilířů (Náslechy, Výstupy, Reflexe) by měl být nyní <strong>odemčen</strong>.
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Záznam hodin:</span> Zapište si hodiny (využijte kategorizaci dle oboru nebo stopky).
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">AI Reflexe:</span> Vyplňte a odešlete závěrečnou reflexi, kterou následně vyhodnotí AI.
                  </li>
                  <li className="pl-2">
                    <span className="font-semibold text-gray-900">Ukončení a certifikát:</span> Klikněte na uzavření praxe a stáhněte si verifikovaný Skill Matrix PDF dokument.
                  </li>
                </ol>
                <div className="mt-6 bg-emerald-50 p-4 rounded-lg flex items-start gap-3 border border-emerald-200">
                  <Unlock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-800 font-medium">
                    Tímto jste úspěšně prošli celým autentickým procesem tak, jak jej zažije každý nový uživatel systému PraxiHub!
                  </p>
                </div>
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
