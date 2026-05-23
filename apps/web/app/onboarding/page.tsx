'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft, Check, User } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function OnboardingPage() {
  const { user, firebaseUser, loading: authLoading } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [major, setMajor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState("student");
  const [step, setStep] = useState(1);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (user.firstName && user.lastName && user.major) {
      router.push("/dashboard");
    } else {
      if (user.role) {
        setRole(user.role);
      }
    }
  }, [user, authLoading, router]);

  // Load draft data from localStorage or pre-fill from user displayName
  useEffect(() => {
    if (!user) return;
    const draft = localStorage.getItem(`onboarding_draft_${user.uid}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.firstName) setFirstName(parsed.firstName);
        if (parsed.lastName) setLastName(parsed.lastName);
        if (parsed.major) setMajor(parsed.major);
      } catch (e) {
        // ignore
      }
    } else if (user.displayName && !firstName && !lastName) {
      // Auto-fill from displayName if no draft and names are empty
      const parts = user.displayName.split(" ");
      if (parts.length > 0) {
        setFirstName(parts[0]);
        if (parts.length > 1) {
          setLastName(parts.slice(1).join(" "));
        }
      }
    }
  }, [user]);

  // Save draft data to localStorage
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`onboarding_draft_${user.uid}`, JSON.stringify({ firstName, lastName, major }));
  }, [firstName, lastName, major, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firebaseUser) return;

    setLoading(true);
    setError("");

    try {
      await updateProfile(firebaseUser, {
        displayName: `${firstName} ${lastName}`.trim()
      });

      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`.trim(),
        major,
        role,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      localStorage.removeItem(`onboarding_draft_${user.uid}`);
      toast.success("Profil úspěšně uložen!");
      // Allow AuthContext to sync before router push
      setTimeout(() => router.push("/dashboard"), 500);
    } catch (err: any) {
      console.error(err);
      setError("Nepodařilo se uložit profil.");
      toast.error("Něco se pokazilo. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!firstName || !lastName || !major)) {
      toast.error("Prosím vyplňte všechna pole, včetně oboru.");
      return;
    }
    setStep(2);
  };

  const prevStep = () => setStep(1);

  if (!user) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-100">
           <motion.div
             className="h-full bg-blue-600"
             initial={{ width: "50%" }}
             animate={{ width: step === 1 ? "50%" : "100%" }}
             transition={{ duration: 0.3 }}
           />
        </div>

        <div className="p-10">
          <div className="text-center mb-8">
             <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-sm">
               <User className="w-6 h-6" />
             </div>
             <h2 className="text-2xl font-bold text-slate-900">Dokončení profilu</h2>
             <p className="text-slate-500 mt-2">Krok {step} ze 2</p>
          </div>

          {error && (
            <div className="p-4 mb-6 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2" role="alert">
               <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block mb-2 text-sm font-semibold text-slate-700">Jméno</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition"
                      placeholder="Jan"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-semibold text-slate-700">Příjmení</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition"
                      placeholder="Novák"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-semibold text-slate-700">Studijní obor</label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={`cursor-pointer border rounded-xl p-4 text-center transition-all ${major === 'UPV' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                        <input type="radio" name="major" value="UPV" className="hidden" onChange={() => setMajor('UPV')} checked={major === 'UPV'} />
                        <span className="font-semibold text-slate-900">UPV</span>
                        <p className="text-xs text-slate-500 mt-1">Učitelství praktického vyučování</p>
                      </label>
                      <label className={`cursor-pointer border rounded-xl p-4 text-center transition-all ${major === 'KPV' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                        <input type="radio" name="major" value="KPV" className="hidden" onChange={() => setMajor('KPV')} checked={major === 'KPV'} />
                        <span className="font-semibold text-slate-900">KPV</span>
                        <p className="text-xs text-slate-500 mt-1">Klinická pedagogická praxe (OV)</p>
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5 text-center"
                >
                   <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                     <p className="text-sm text-slate-500 font-medium mb-1">Vaše jméno</p>
                     <p className="text-xl font-bold text-slate-900 mb-4">{firstName} {lastName}</p>
                     <p className="text-sm text-slate-500 font-medium mb-1">Studijní obor</p>
                     <p className="text-lg font-bold text-slate-900">{major}</p>
                   </div>
                   <p className="text-sm text-slate-600">Vše je připraveno! Kliknutím níže dokončíte registraci a vstoupíte do aplikace.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 pt-4">
               {step === 2 && (
                 <button
                   type="button"
                   onClick={prevStep}
                   className="px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition"
                 >
                   <ArrowLeft className="w-5 h-5" />
                 </button>
               )}
               {step === 1 ? (
                 <button
                   type="submit"
                   className="flex-1 flex justify-center items-center gap-2 py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition shadow-lg shadow-blue-600/20"
                 >
                   Pokračovat <ArrowRight className="w-5 h-5" />
                 </button>
               ) : (
                 <button
                   type="submit"
                   disabled={loading}
                   className="flex-1 flex justify-center items-center gap-2 py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-70 transition shadow-lg shadow-blue-600/20"
                 >
                   {loading ? "Ukládám..." : <>Dokončit registraci <Check className="w-5 h-5" /></>}
                 </button>
               )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
