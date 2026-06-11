'use client';
import { toast } from "react-hot-toast";

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, where, doc, getDoc, updateDoc, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Star, LogOut, Clock, User, Building } from 'lucide-react';
import Chatbot from "@/components/Chatbot";
import QrScanner from "@/components/QrScanner";
import { PLACEMENT_STATUS_LABELS } from "../../../lib/constants/placementStates";
import { useHydratedPlacements } from "../../../hooks/useDataAdapters";

export default function InstitutionDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userQ, setUserQ] = useState<any>(null);

  useEffect(() => {
    if (user && user.uid) {
       setUserQ(query(collection(db, "placements"), where("institutionId", "==", user.uid)));
    } else {
       setUserQ(null);
    }
  }, [user?.uid]);

  const { placements: hydratedPlacementsRaw, loading: hydratedLoading } = useHydratedPlacements(userQ);
  const placements = hydratedPlacementsRaw || [];
  const hydratedPlacements = hydratedPlacementsRaw || [];
  const [timeLogs, setTimeLogs] = useState<any[]>([]);

  const router = useRouter();

  useEffect(() => {
    if (!hydratedPlacements || hydratedPlacements.length === 0) return;


    let timeLogsUnsubscribes: (() => void)[] = [];
    let allLogs: any[] = [];

    hydratedPlacements.forEach(placement => {
      const logsRef = collection(db, "placements", placement.id, "time_logs");
      const logsQ = query(logsRef, orderBy("date", "desc"));

      const unsub = onSnapshot(logsQ, (logsSnapshot) => {
        const logsData = logsSnapshot.docs.map(doc => ({
          id: doc.id,
          placementId: placement.id,
          studentName: placement.studentData?.displayName || placement.studentName || "Student",
          organizationName: placement.companyData?.name || 'Firma',
          ...doc.data() as any
        }));

        allLogs = [...allLogs.filter(log => log.placementId !== placement.id), ...logsData];
        allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTimeLogs([...allLogs]);
      });
      timeLogsUnsubscribes.push(unsub);
    });

    return () => {
      timeLogsUnsubscribes.forEach(unsub => unsub());
    };
  }, [hydratedPlacements]);




  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
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
          setLoading(false);
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
      toast.error("Nepodařilo se aktualizovat stav.");
    }
  };

  const updateLogRating = async (placementId: string, logId: string, rating: number) => {
     try {
      const logRef = doc(db, "placements", placementId, "time_logs", logId);
      await updateDoc(logRef, { mentorRating: rating });
    } catch (err) {
      console.error("Chyba při hodnocení:", err);
      toast.error("Nepodařilo se uložit hodnocení.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-panel">
        <div className="text-blue-600 animate-spin w-8 h-8 border-4 border-current border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleScanSuccess = async (scannedText: string) => {
    try {
      // Expecting URL like https://praxihub.cz/verify?id=[docId] or just [docId]
      let docId = scannedText;
      if (scannedText.includes('verify?id=')) {
        const url = new URL(scannedText);
        docId = url.searchParams.get('id') || scannedText;
      } else if (scannedText.includes('/verify/')) {
        const parts = scannedText.split('/');
        docId = parts[parts.length - 1];
      }

      // Check if it's an audit_log/document or placement
      // Let's open the verify page directly for full validation
      router.push(`/verify?id=${docId}`);
    } catch (err) {
      console.error("Error reading scanned placement:", err);
      toast.error("Chyba při čtení praxe z QR kódu.");
    }
  };


  const getStudentNameForLog = (logId: string, placementId: string, defaultName: string) => {
    const hp = hydratedPlacements.find(p => p.id === placementId);
    return hp?.studentName && hp.studentName !== 'Student neuveden' ? hp.studentName : defaultName;
  };

  const pendingLogs = timeLogs.filter(log => log.status === 'pending');

  const reviewedLogs = timeLogs.filter(log => log.status !== 'pending');
  const approvedHours = timeLogs.filter(log => log.status === 'approved').reduce((acc, log) => acc + (Number(log.hours) || 0), 0);

  return (
    <div className="min-h-screen bg-theme-panel pb-20 md:pb-0">
      {/* Mobile-first Header */}
      <header className="bg-theme-panel border-b border-theme-border sticky top-0 z-10 px-4 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-theme-primary">Mentor Hub</h1>
          <p className="text-xs text-theme-muted">Schvalování praxí</p>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-theme-muted hover:text-red-600 hover:bg-red-50 rounded-full transition"
          aria-label="Odhlásit se"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">

        {/* QR Scanner Hub */}
        <section className="bg-slate-800/75 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-lg text-center">
           <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-4 flex items-center justify-center gap-2">📷 QR Hub Scanner</h2>
           <p className="text-xs text-theme-muted mb-4">Naskenujte QR kód ze smlouvy nebo certifikátu pro bezpečné ověření pravosti (Audit Logs).</p>
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
            <h2 className="text-sm font-bold text-theme-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Přiřazení studenti ({placements.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(hydratedPlacements.length > 0 ? hydratedPlacements : placements).map((placement: any) => (
                <div key={placement.id} data-testid="assigned-student-card" className="bg-theme-panel p-4 rounded-xl border border-theme-border shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-theme-primary" data-testid="student-name">{placement.studentData?.displayName || placement.studentName || 'Načítám...'}</div>
                      <div className="text-xs text-theme-muted font-normal">
                        {placement.studentData?.email || placement.studentEmail || 'Načítám...'}
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-theme-panel text-theme-secondary px-2 py-1 rounded-full">
                      {PLACEMENT_STATUS_LABELS[placement.status] || placement.status}
                    </span>
                  </div>
                  <div className="text-xs text-theme-muted">
                    <div><span className="font-semibold">Zaměření:</span> <span data-testid="student-major">{placement.major || 'Načítám...'}</span> &bull; <span className="font-semibold">Organizace:</span> {placement.organization_name || placement.companyData?.name || 'Organizace neuvedena'}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pending Approvals */}
        <section>
          <h2 className="text-sm font-bold text-theme-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Čeká na schválení ({pendingLogs.length})
          </h2>

          {pendingLogs.length === 0 ? (
            <div className="bg-theme-panel p-8 rounded-2xl border border-theme-border text-center text-theme-muted">
              <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-2" />
              <p>Všechny záznamy jsou vyřízené.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingLogs.map(log => (
                <div key={log.id} className="bg-theme-panel rounded-2xl border border-theme-border shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-theme-border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 text-sm text-theme-secondary">
                        <User className="w-4 h-4" /> <span className="font-medium text-theme-primary">{getStudentNameForLog(log.id, log.placementId, log.studentName)}</span>
                      </div>
                      <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {log.hours} hod
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-theme-muted mb-3">
                      <Building className="w-3 h-3" /> {log.organizationName} &bull; {new Date(log.date).toLocaleDateString('cs-CZ')}
                    </div>
                    <p className="text-sm text-theme-secondary bg-theme-panel p-3 rounded-xl border border-theme-border">
                      {log.description}
                    </p>
                  </div>

                  {/* Icon System Actions */}
                  <div className="p-4 bg-theme-panel border-t border-theme-border">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button
                        onClick={() => updateLogStatus(log.placementId, log.id, 'approved')}
                        className="p-4 bg-theme-panel border-2 border-theme-border text-theme-secondary rounded-2xl hover:border-green-500 hover:text-green-600 hover:bg-green-50 transition flex flex-col items-center justify-center gap-2 shadow-sm"
                      >
                        <CheckCircle className="w-8 h-8" />
                        <span className="text-sm font-bold">Schválit</span>
                      </button>
                      <button
                        onClick={() => updateLogStatus(log.placementId, log.id, 'rejected')}
                        className="p-4 bg-theme-panel border-2 border-theme-border text-theme-secondary rounded-2xl hover:border-red-500 hover:text-red-600 hover:bg-red-50 transition flex flex-col items-center justify-center gap-2 shadow-sm"
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
                        className="p-4 bg-theme-panel border-2 border-theme-border text-theme-secondary rounded-2xl hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition flex flex-col items-center justify-center gap-2 shadow-sm"
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
            <h2 className="text-sm font-bold text-theme-muted uppercase tracking-wider mb-4">Historie hodnocení</h2>
            <div className="space-y-3">
              {reviewedLogs.slice(0, 10).map(log => (
                <div key={log.id} className="bg-theme-panel p-4 rounded-xl border border-theme-border shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center opacity-80 hover:opacity-100 transition">
                  <div>
                    <p className="text-sm font-bold text-theme-primary">{getStudentNameForLog(log.id, log.placementId, log.studentName)} <span className="text-theme-muted font-normal">({log.hours} hod)</span></p>
                    <p className="text-xs text-theme-muted truncate max-w-xs">{log.description}</p>
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
