import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      
      {/* --- NAVIGÁCIA --- */}
      <nav className="w-full py-6 px-8 flex justify-between items-center max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          PraxiHub
        </div>
        <div className="space-x-4">
          <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium px-4 py-2">
            Prihlásiť sa
          </Link>
          <Link href="/signup" className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-blue-700 transition shadow-lg hover:shadow-xl">
            Registrácia
          </Link>
        </div>
      </nav>

      {/* --- HERO SEKCIA --- */}
      <main className="flex-grow">
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
            <span className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide uppercase mb-6 inline-block">
              Powered by Google Gemini AI
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-tight mb-8">
              Budúcnosť správy <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                odborných stáží
              </span>
            </h1>
            <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Zabudnite na papierovanie. PraxiHub prepája študentov, firmy a univerzitu do jedného inteligentného ekosystému, ktorý automatizuje byrokraciu.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/signup" className="px-8 py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-700 transition shadow-lg hover:-translate-y-1">
                Začať používať zdarma
              </Link>
              <Link href="/login" className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-xl text-lg font-semibold hover:bg-gray-50 transition">
                Mám už účet
              </Link>
            </div>
          </div>
          
          {/* Dekoratívne pozadie */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full h-full z-0 opacity-40 pointer-events-none">
            <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
            <div className="absolute top-20 right-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
          </div>
        </section>

        {/* --- ÚČASTNÍCI (Karty) --- */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-16">Jeden systém, tri pohľady</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Karta: Študent */}
              <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 group-hover:w-full transition-all duration-300 opacity-5"></div>
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6 relative z-10">
                   <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 relative z-10">Študent</h3>
                <p className="text-gray-600 relative z-10">
                  Nahrávanie zmlúv fotkou, okamžitá AI kontrola údajov a sledovanie stavu schválenia v reálnom čase. Žiadne behanie po kanceláriách.
                </p>
              </div>

              {/* Karta: Firma */}
              <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-purple-500 group-hover:w-full transition-all duration-300 opacity-5"></div>
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-6 relative z-10">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 relative z-10">Firma</h3>
                <p className="text-gray-600 relative z-10">
                  Prehľad všetkých stážistov na jednom mieste. Automatické párovanie zmlúv podľa IČO a digitálna správa dokumentácie.
                </p>
              </div>

              {/* Karta: Koordinátor */}
              <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-green-500 group-hover:w-full transition-all duration-300 opacity-5"></div>
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-6 relative z-10">
                   <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 relative z-10">Koordinátor</h3>
                <p className="text-gray-600 relative z-10">
                  Absolútny prehľad. Dashboard s metrikami, filtrovanie podľa ročníkov a firiem, automatické notifikácie problémových zmlúv.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- AKO TO FUNGUJE (Proces) --- */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-16">Ako funguje AI Analýza?</h2>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 relative">
              {/* Connecting Line (Desktop) */}
              <div className="hidden md:block absolute top-1/2 left-20 right-20 h-0.5 bg-gray-200 -z-10 transform -translate-y-1/2"></div>

              {/* Krok 1 */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 w-full md:w-80 text-center relative">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4 relative z-10">1</div>
                <h4 className="font-bold text-lg mb-2">Upload Zmluvy</h4>
                <p className="text-sm text-gray-500">Študent nahrá PDF alebo odfotí zmluvu mobilom.</p>
              </div>

              {/* Krok 2 */}
              <div className="bg-white p-6 rounded-xl border-2 border-blue-500 shadow-lg w-full md:w-80 text-center relative transform md:-translate-y-4">
                 <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">AI Proces</div>
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4">2</div>
                <h4 className="font-bold text-lg mb-2">Gemini Analýza</h4>
                <p className="text-sm text-gray-500">AI prečíta údaje: názov firmy, IČO, dátumy a validuje ich.</p>
              </div>

              {/* Krok 3 */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 w-full md:w-80 text-center relative">
                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4">3</div>
                <h4 className="font-bold text-lg mb-2">Schválenie</h4>
                <p className="text-sm text-gray-500">Dáta sa zapíšu do databázy a priradia sa firme.</p>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* --- FOOTER --- */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <span className="text-2xl font-bold tracking-tight">PraxiHub</span>
            <p className="text-gray-400 text-sm mt-1">© 2025 University Systems. All rights reserved.</p>
          </div>
          <div className="flex gap-6">
            <Link href="#" className="text-gray-400 hover:text-white transition">Podpora</Link>
            <Link href="#" className="text-gray-400 hover:text-white transition">Ochrana údajov</Link>
            <Link href="#" className="text-gray-400 hover:text-white transition">Kontakt</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
