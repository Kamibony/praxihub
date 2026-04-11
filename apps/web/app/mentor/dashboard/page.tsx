'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from "../../../lib/firebase";
import { collection, query, where, doc, getDoc, updateDoc, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Star, LogOut, Clock, User, Building } from 'lucide-react';
import Chatbot from "@/components/Chatbot";

export default function MentorDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [internships, setInternships] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);

  const router = useRouter();

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

        if (userDoc.exists() && userDoc.data().role === 'mentor') {
          // Fetch internships specifically assigned to this mentor
          const internshipsRef = collection(db, "internships");
          const q = query(
            internshipsRef,
            where("mentorId", "==", currentUser.uid),
            where("status", "in", ["APPROVED", "EVALUATION"])
          );

          unsubscribeFirestore = onSnapshot(q, (snapshot) => {
            const internshipsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
            setInternships(internshipsData);

            // Clean up old listeners
            timeLogsUnsubscribes.forEach(unsub => unsub());
            timeLogsUnsubscribes = [];

            let allLogs: any[] = [];

            internshipsData.forEach(internship => {
              const logsRef = collection(db, "internships", internship.id, "time_logs");
              const logsQ = query(logsRef, orderBy("date", "desc"));

              const unsub = onSnapshot(logsQ, (logsSnapshot) => {
                const logsData = logsSnapshot.docs.map(doc => ({
                  id: doc.id,
                  internshipId: internship.id,
                  studentName: internship.studentName || 'Student',
                  organizationName: internship.companyData?.name || 'Firma',
                  ...doc.data()
                }));

                // Update allLogs and set state
                allLogs = allLogs.filter(l => l.internshipId !== internship.id).concat(logsData);
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

  const updateLogStatus = async (internshipId: string, logId: string, newStatus: string) => {
    try {
      const logRef = doc(db, "internships", internshipId, "time_logs", logId);
      await updateDoc(logRef, { status: newStatus });
    } catch (err) {
      console.error("Chyba při aktualizaci stavu:", err);
      alert("Nepodařilo se aktualizovat stav.");
    }
  };

  const updateLogRating = async (internshipId: string, logId: string, rating: number) => {
     try {
      const logRef = doc(db, "internships", internshipId, "time_logs", logId);
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

  const pendingLogs = timeLogs.filter(log => log.status === 'pending');
  const reviewedLogs = timeLogs.filter(log => log.status !== 'pending');

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
                  <div className="flex border-t border-slate-100 divide-x divide-slate-100">
                    <button
                      onClick={() => updateLogStatus(log.internshipId, log.id, 'approved')}
                      className="flex-1 py-4 flex flex-col items-center justify-center gap-1 text-slate-500 hover:bg-green-50 hover:text-green-700 transition"
                    >
                      <CheckCircle className="w-6 h-6" />
                      <span className="text-xs font-medium">Schválit</span>
                    </button>
                    <button
                      onClick={() => updateLogStatus(log.internshipId, log.id, 'rejected')}
                      className="flex-1 py-4 flex flex-col items-center justify-center gap-1 text-slate-500 hover:bg-red-50 hover:text-red-700 transition"
                    >
                      <XCircle className="w-6 h-6" />
                      <span className="text-xs font-medium">Zamítnout</span>
                    </button>
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
                          onClick={() => updateLogRating(log.internshipId, log.id, star)}
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
