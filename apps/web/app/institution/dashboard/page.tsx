'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, where, doc, getDoc, updateDoc, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Star, LogOut, Clock, User, Building } from 'lucide-react';
import Chatbot from "@/components/Chatbot";
import QrScanner from "@/components/QrScanner";

export default function InstitutionDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [placements, setPlacements] = useState<any[]>([]);
  const [hydratedPlacements, setHydratedPlacements] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);

  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const hydratePlacements = async () => {
      if (!placements || placements.length === 0) {
        if (isMounted) setHydratedPlacements([]);
        return;
      }

      const newHydrated = await Promise.all(placements.map(async (placement) => {
        let studentData: any = {};
        if (placement.studentId) {
          const studentDoc = await getDoc(doc(db, "users", placement.studentId));
          if (studentDoc.exists()) {
            studentData = studentDoc.data();
          }
        }
        return {
          ...placement,
          studentEmail: studentData.email || 'Email neuveden',
          studentMajor: studentData.major || placement.major || 'Zaměření neuvedeno'
        };
      }));

      if (isMounted) {
        setHydratedPlacements(newHydrated);
      }
    };

    hydratePlacements();
    return () => { isMounted = false; };
  }, [placements]);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    let timeLogsUnsubscribes: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      timeLogsUnsubscribes.forEach(unsub => unsub());
      timeLogsUnsubscribes = [];

      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && ['institution', 'mentor', 'company'].includes(userDoc.data().role)) {
          if (!userDoc.data().researchConsent) {
            router.push('/consent');
            return;
          }
          // Fetch placements specifically assigned to this institution
          const placementsRef = collection(db, "placements");
          const q = query(
            placementsRef,
            where("institutionId", "==", currentUser.uid)
          );

          unsubscribeFirestore = onSnapshot(q, (snapshot) => {
            const rawPlacements = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
            setPlacements(rawPlacements);

            // Clean up old listeners
            timeLogsUnsubscribes.forEach(unsub => unsub());
            timeLogsUnsubscribes = [];

            let allLogs: any[] = [];

            rawPlacements.forEach(placement => {
              const logsRef = collection(db, "placements", placement.id, "time_logs");
              const logsQ = query(logsRef, orderBy("date", "desc"));

              const unsub = onSnapshot(logsQ, (logsSnapshot) => {
                const logsData = logsSnapshot.docs.map(doc => ({
                  id: doc.id,
                  placementId: placement.id,
                  studentName: placement.studentName || 'Student',
                  organizationName: placement.companyData?.name || 'Firma',
                  ...doc.data()
                }));

                // Update allLogs and set state
                allLogs = allLogs.filter(l => l.placementId !== placement.id).concat(logsData);
                // Sort combined logs by date desc
                allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setTimeLogs([...allLogs]);
              });

              timeLogsUnsubscribes.push(unsub);
            });

            setLoading(false);
          });
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Chyba při načítání dat:", err);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
      timeLogsUnsubscribes.forEach(unsub => unsub());
    };
  }, [router]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  const updateLogStatus = async (placementId: string, logId: string, newStatus: string) => {
    try {
      const logRef = doc(db, "placements", placementId, "time_logs", logId);
      await updateDoc(logRef, { status: newStatus });
    } catch (err) {
      console.error("Chyba při aktualizaci stavu:", err);
      alert("Nepodařilo se aktualizovat stav.");
    }
  };

  const updateLogRating = async (placementId: string, logId: string, rating: number) => {
     try {
      const logRef = doc(db, "placements", placementId, "time_logs", logId);
      await updateDoc(logRef, { mentorRating: rating });
    } catch (err) {
      console.error("Chyba při hodnocení:", err);
      alert("Nepodařilo se uložit hodnocení.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-blue-600 animate-spin w-8 h-8 border-4 border-current border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleScanSuccess = async (scannedId: string) => {
    // Optionally alert the mentor or verify the ID format
    try {
      const placementRef = doc(db, "placements", scannedId);
      const placementDoc = await getDoc(placementRef);
      if (placementDoc.exists()) {
        const data = placementDoc.data();
        if (data.institutionId === user.uid || data.mentorId === user.uid) {
           alert("Praxe úspěšně načtena pomocí QR kódu.");
           // Since the snapshot already fetches based on institutionId/mentorId, it might already be loaded.
           // This provides a manual check for immediate sync if needed, or visual feedback.
        } else {
           alert("Nemáte oprávnění spravovat tuto praxi.");
        }
      } else {
        alert("Praxe nebyla nalezena.");
      }
    } catch (err) {
      console.error("Error reading scanned placement:", err);
      alert("Chyba při čtení praxe z QR kódu. Zkontrolujte, zda máte oprávnění.");
    }
  };

  const pendingLogs = timeLogs.filter(log => log.status === 'pending');
  const reviewedLogs = timeLogs.filter(log => log.status !== 'pending');
  const approvedHours = timeLogs.filter(log => log.status === 'approved').reduce((acc, log) => acc + (Number(log.hours) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      {/* Mobile-first Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Mentor Hub</h1>
          <p className="text-xs text-slate-500">Schvalování praxí</p>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition"
          aria-label="Odhlásit se"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">

        {/* QR Scanner Hub */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
           <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Naskenovat QR kód studenta</h2>
           <p className="text-xs text-slate-500 mb-4">Naskenujte QR kód z aplikace studenta pro rychlé ověření nebo načtení praxe.</p>
           <QrScanner onScanSuccess={handleScanSuccess} />
        </section>

        {/* Hour Balance Card */}
        <section>
          <div className="card bg-indigo-900 text-white p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center">
            <h2 className="text-sm font-medium text-indigo-200 uppercase tracking-wider mb-2">Konto hodin / Hour Balance</h2>
            <div className="text-5xl font-black">{approvedHours}</div>
            <p className="text-indigo-200 mt-2 text-sm">Celkový počet schválených hodin</p>
          </div>
        </section>

        {/* Assigned Students List */}
        {placements.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Přiřazení studenti ({placements.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(hydratedPlacements.length > 0 ? hydratedPlacements : placements).map((placement: any) => (
                <div key={placement.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-slate-900">{placement.studentName}</div>
                      <div className="text-xs text-slate-500 font-normal">
                        {hydratedPlacements.length > 0 ? placement.studentEmail : 'Načítám...'}
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                      {placement.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    <div>{hydratedPlacements.length > 0 ? placement.studentMajor : (placement.major || 'Načítám...')} &bull; {placement.organization_name || placement.companyData?.name || 'Organizace neuvedena'}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pending Approvals */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Čeká na schválení ({pendingLogs.length})
          </h2>

          {pendingLogs.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-2" />
              <p>Všechny záznamy jsou vyřízené.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingLogs.map(log => (
                <div key={log.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <User className="w-4 h-4" /> <span className="font-medium text-slate-900">{log.studentName}</span>
                      </div>
                      <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {log.hours} hod
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      <Building className="w-3 h-3" /> {log.organizationName} &bull; {new Date(log.date).toLocaleDateString('cs-CZ')}
                    </div>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {log.description}
                    </p>
                  </div>

                  {/* Icon System Actions */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button
                        onClick={() => updateLogStatus(log.placementId, log.id, 'approved')}
                        className="p-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl hover:border-green-500 hover:text-green-600 hover:bg-green-50 transition flex flex-col items-center justify-center gap-2 shadow-sm"
                      >
                        <CheckCircle className="w-8 h-8" />
                        <span className="text-sm font-bold">Schválit</span>
                      </button>
                      <button
                        onClick={() => updateLogStatus(log.placementId, log.id, 'rejected')}
                        className="p-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl hover:border-red-500 hover:text-red-600 hover:bg-red-50 transition flex flex-col items-center justify-center gap-2 shadow-sm"
                      >
                        <XCircle className="w-8 h-8" />
                        <span className="text-sm font-bold">Zamítnout</span>
                      </button>
                      <button
                        onClick={() => {
                          const rating = window.prompt("Zadejte hodnocení (1-5 hvězdiček):", "5");
                          if (rating && !isNaN(Number(rating))) {
                            updateLogRating(log.placementId, log.id, Number(rating));
                          }
                        }}
                        className="p-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition flex flex-col items-center justify-center gap-2 shadow-sm"
                      >
                        <Star className="w-8 h-8" />
                        <span className="text-sm font-bold">Hodnotit</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reviewed History */}
        {reviewedLogs.length > 0 && (
          <section className="pt-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Historie hodnocení</h2>
            <div className="space-y-3">
              {reviewedLogs.slice(0, 10).map(log => (
                <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center opacity-80 hover:opacity-100 transition">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{log.studentName} <span className="text-slate-500 font-normal">({log.hours} hod)</span></p>
                    <p className="text-xs text-slate-500 truncate max-w-xs">{log.description}</p>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => updateLogRating(log.placementId, log.id, star)}
                          className={`focus:outline-none transition-transform hover:scale-110 ${log.mentorRating >= star ? 'text-yellow-400' : 'text-slate-200'}`}
                        >
                          <Star className="w-5 h-5 fill-current" />
                        </button>
                      ))}
                    </div>

                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${log.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {log.status === 'approved' ? 'Schváleno' : 'Zamítnuto'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      <Chatbot initialMessage="Dobrý den, potřebujete poradit s hodnocením studentů?" />
    </div>
  );
}
