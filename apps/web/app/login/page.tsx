"use client";

import { useState, useEffect } from "react";
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, functions } from "../../lib/firebase";
import { httpsCallable } from "firebase/functions";
import Link from "next/link";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Handle the Magic Link callback if the user clicked the link in their email
    if (isSignInWithEmailLink(auth, window.location.href)) {
      setLoading(true);
      let emailForSignIn = window.localStorage.getItem('emailForSignIn');
      if (!emailForSignIn) {
        // User opened the link on a different device. Ask for email.
        emailForSignIn = window.prompt('Zadejte prosím svůj e-mail pro potvrzení přihlášení.');
      }

      if (emailForSignIn) {
        signInWithEmailLink(auth, emailForSignIn, window.location.href)
          .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            router.push('/dashboard');
          })
          .catch((error) => {
            console.error(error);
            setError('Přihlášení selhalo nebo platnost odkazu vypršela.');
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      // 1. Resolve identifier to email and check if user exists (Whitelist check)
      const resolveIdentifierFn = httpsCallable(functions, 'resolveLoginIdentifier');
      const resolveResult = await resolveIdentifierFn({ identifier });
      const resolvedEmail = (resolveResult.data as any).email;

      // 2. Prepare Magic Link settings
      const actionCodeSettings = {
        url: window.location.origin + '/login',
        handleCodeInApp: true,
      };

      // 3. Send Magic Link
      await sendSignInLinkToEmail(auth, resolvedEmail, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', resolvedEmail);
      setMessage("Odkaz pro přihlášení byl odeslán na váš e-mail.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Nepodařilo se odeslat e-mail. Zkontrolujte, zda jste zadali správné údaje.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-800 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://images.unsplash.com/photo-1541339907198-e021fc9d13f1?q=80&w=2500&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="relative z-10 text-center text-white max-w-lg">
           <div className="mb-8 flex justify-center">
             <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
               <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
             </div>
           </div>
           <blockquote className="text-3xl font-bold leading-normal mb-6">
             "Méně byrokracie, <br/> více praxe."
           </blockquote>
           <p className="text-blue-100 text-lg opacity-80">
             PraxiHub zjednodušuje správu stáží pro studenty, firmy i univerzity.
           </p>
        </div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl opacity-30"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500 rounded-full mix-blend-screen filter blur-3xl opacity-30"></div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-slate-900 mb-2">
               <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               </div>
               <span><span className="text-blue-600">Praxi</span>Hub</span>
            </Link>
            <h2 className="text-2xl font-bold text-slate-800">Přihlášení bez hesla</h2>
            <p className="text-slate-500 mt-2">Zadejte svůj e-mail a my vám pošleme odkaz pro přihlášení (Magic Link).</p>
          </div>

          {error && (
            <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2" role="alert">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          {message && (
            <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2" role="alert">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {message}
            </div>
          )}

          {!message && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="identifier" className="block text-sm font-semibold text-slate-700 mb-2">
                  E-mail nebo Univerzitní ID
                </label>
                <input
                  type="text"
                  id="identifier"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-slate-900"
                  placeholder="jmeno@priklad.cz nebo 123456"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition shadow-lg shadow-blue-600/20"
              >
                {loading ? "Zpracovávám..." : "Odeslat přihlašovací odkaz"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
