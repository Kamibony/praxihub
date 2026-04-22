"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, auth, functions, storage } from "../../../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  limit,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StarRating from "@/components/StarRating";
import Chatbot from "@/components/Chatbot";
import ContractSignature from "@/components/ContractSignature";
import { Mic, MicOff } from "lucide-react";
import QRCode from "react-qr-code";

export default function StudentDashboard() {


  const [user, setUser] = useState<any>(null);
  const [placement, setPlacement] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Skills
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);

  // State pre editáciu údajov (Review)
  const [reviewData, setReviewData] = useState({
    organization_name: "",
    organization_ico: "",
    start_date: "",
    end_date: "",
  });

  // State pre žiadosť o schválenie organizácie
  const [orgRequest, setOrgRequest] = useState({
    name: "",
    ico: "",
    web: "",
  });
  const [submittingOrg, setSubmittingOrg] = useState(false);

  // State pre hodnotenie
  const [studentRating, setStudentRating] = useState(0);
  const [studentReview, setStudentReview] = useState("");

  // State for Time Logs
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [newLogDate, setNewLogDate] = useState("");
  const [newLogHours, setNewLogHours] = useState("");
  const [newLogDescription, setNewLogDescription] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);

  // State for AI Evaluation
  const [reflectionText, setReflectionText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [isCorrectingGrammar, setIsCorrectingGrammar] = useState(false);

  // State for Voice Dictation
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const router = useRouter();

  // Fetch time logs
  useEffect(() => {
    if (!placement?.id) return;

    const logsRef = collection(db, "placements", placement.id, "time_logs");
    const q = query(logsRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTimeLogs(logsData);
    });

    return () => unsubscribe();
  }, [placement?.id]);

  const handleTimeLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placement?.id || !newLogDate || !newLogHours || !newLogDescription)
      return;

    setSubmittingLog(true);
    try {
      const logsRef = collection(db, "placements", placement.id, "time_logs");
      await addDoc(logsRef, {
        date: newLogDate,
        hours: Number(newLogHours),
        description: newLogDescription,
        status: "pending",
        mentorId: placement.mentorId || null,
        organizationId: placement.organizationId || null,
        createdAt: new Date().toISOString(),
      });

      setNewLogDate("");
      setNewLogHours("");
      setNewLogDescription("");
    } catch (error) {
      console.error("Error adding time log: ", error);
      alert("Chyba při ukládání záznamu.");
    } finally {
      setSubmittingLog(false);
    }
  };

  // OPRAVA: Bezpečný useEffect s cleanup logikou
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // 1. Vyčistiť predchádzajúci listener ak existuje
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);

        // Fetch user skills
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (!data.researchConsent) {
              router.push("/consent");
              return;
            }
            setSkills(userDoc.data().skills || []);
          }
        } catch (err) {
          console.error("Error fetching skills:", err);
        }

        const q = query(
          collection(db, "placements"),
          where("studentId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(1),
        );

        // 2. Nastaviť nový listener a uložiť funkciu na odhlásenie
        unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            const id = snapshot.docs[0].id;
            setPlacement({ id, ...data });

            if (data.status === "NEEDS_REVIEW") {
              setReviewData({
                organization_name: data.organization_name || "",
                organization_ico: data.organization_ico || "",
                start_date: data.start_date || "",
                end_date: data.end_date || "",
              });
            }
            if (data.studentRating) {
              setStudentRating(data.studentRating);
            }
            if (data.studentReview) {
              setStudentReview(data.studentReview);
            }
          } else {
            setPlacement(null);
          }
          setLoadingData(false);
        });
      }
    });

    // 3. Cleanup pri unmount
    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [router]);

  const handleOrgRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgRequest.name || !orgRequest.ico) {
      alert("Vyplňte prosím povinné údaje (Název a IČO).");
      return;
    }
    setSubmittingOrg(true);
    try {
      const isKpv = user.major === 'KPV' || user.studentMajor === 'KPV';

      const docRef = await addDoc(collection(db, "placements"), {
        studentId: user.uid,
        studentEmail: user.email,
        studentName: user.displayName || user.email,
        status: "DRAFT", // Start as DRAFT
        createdAt: new Date().toISOString(),
        organization_name: orgRequest.name,
        organization_ico: orgRequest.ico,
        organization_web: orgRequest.web,
        major: user.major || 'UPV',
        studentMajor: user.major || 'UPV'
      });

      if (isKpv) {
        try {
          const fetchAres = httpsCallable(functions, 'fetchAresAndLink');
          await fetchAres({ ico: orgRequest.ico, placementId: docRef.id });
          alert("Žádost odeslána. Organizace byla automaticky ověřena v registru ARES (Fast-Track)!");
        } catch (aresError) {
          console.error("ARES error:", aresError);
          // Fallback if ARES fails
          const transitionFn = httpsCallable(functions, 'transitionPlacementState');
          await transitionFn({ placementId: docRef.id, newState: 'PENDING_MATCH' });
          alert("Žádost odeslána, ale ověření v ARES se nezdařilo. Přesunuto k manuálnímu schválení.");
        }
      } else {
        const transitionFn = httpsCallable(functions, 'transitionPlacementState');
        await transitionFn({ placementId: docRef.id, newState: 'PENDING_MATCH' });
        alert("Žádost odeslána a čeká na manuální přiřazení koordinátorem (UPV).");
      }

      setOrgRequest({ name: "", ico: "", web: "" });
    } catch (error) {
      console.error("Error submitting org request:", error);
      alert("Chyba při odesílání žádosti.");
    } finally {
      setSubmittingOrg(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const storageRef = ref(
        storage,
        `contracts/${user.uid}/${Date.now()}_${file.name}`,
      );
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Save placement with student name for easier display in Coordinator Dashboard
      if (placement && placement.id) {
        const docRef = doc(db, "placements", placement.id);
        await updateDoc(docRef, {
          contract_url: downloadURL,
          fileName: file.name,
        });
        const transitionPlacementState = httpsCallable(
          functions,
          "transitionPlacementState",
        );
        await transitionPlacementState({
          placementId: placement.id,
          newState: "ANALYZING",
        });
      } else {
        // Fallback - should not happen in this flow if strictly following APPROVED path
        await addDoc(collection(db, "placements"), {
          studentId: user.uid,
          studentEmail: user.email,
          studentName: user.displayName || user.email,
          contract_url: downloadURL,
          status: "ANALYZING",
          createdAt: new Date().toISOString(),
          fileName: file.name,
        });
      }
    } catch (error) {
      console.error("Upload failed", error);
      alert("Chyba při nahrávání souboru.");
    } finally {
      setUploading(false);
    }
  };

  const confirmData = async () => {
    if (!placement) return;
    try {
      const docRef = doc(db, "placements", placement.id);
      await updateDoc(docRef, {
        ...reviewData,
        is_verified: true,
        approvedAt: new Date().toISOString(),
      });
      const transitionPlacementState = httpsCallable(
        functions,
        "transitionPlacementState",
      );
      await transitionPlacementState({
        placementId: placement.id,
        newState: "APPROVED",
      });
      alert("Údaje potvrzeny!");
    } catch (error) {
      console.error("Error confirming data:", error);
      alert("Chyba při ukládání.");
    }
  };

  const handleRateCompany = async () => {
    if (!placement || studentRating === 0) return;
    try {
      const docRef = doc(db, "placements", placement.id);
      await updateDoc(docRef, {
        studentRating,
        studentReview,
      });
      alert("Hodnocení odesláno!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Chyba při odesílání hodnocení.");
    }
  };

  const handleImproveWithAI = async () => {
    if (!reflectionText.trim()) return;
    setIsCorrectingGrammar(true);
    try {
      const correctGrammarFn = httpsCallable(
        functions,
        "correctReflectionGrammar",
      );
      const response = await correctGrammarFn({ text: reflectionText });
      const data = response.data as { correctedText: string };
      setReflectionText(data.correctedText);
    } catch (error: any) {
      console.error("Grammar Correction Error:", error);
      alert(`Chyba při opravě textu: ${error.message}`);
    } finally {
      setIsCorrectingGrammar(false);
    }
  };

  const handleEvaluateReflection = async () => {
    if (!placement || !reflectionText.trim()) return;
    setEvaluating(true);
    try {
      const evaluateReflectionFn = httpsCallable(
        functions,
        "evaluateReflection",
      );
      const response = await evaluateReflectionFn({
        placementId: placement.id,
        reflectionText: reflectionText,
      });

      const data = response.data as any;
      if (data.evaluation.isPass) {
        alert(
          "Gratulujeme! Reflexe byla úspěšně vyhodnocena a praxe je nyní uzavřena.",
        );
      } else {
        alert(
          "Reflexe nebyla úspěšně vyhodnocena. Prosím, upravte text podle zpětné vazby a zkuste to znovu.",
        );
      }
    } catch (error: any) {
      console.error("Evaluation Error:", error);
      alert(`Chyba při vyhodnocování: ${error.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const addSkill = async () => {
    if (!newSkill.trim() || !user) return;
    const updatedSkills = [...skills, newSkill.trim()];
    setSkills(updatedSkills);
    setNewSkill("");

    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { skills: updatedSkills }, { merge: true });
    } catch (error) {
      console.error("Error saving skill:", error);
    }
  };

  const removeSkill = async (skillToRemove: string) => {
    if (!user) return;
    const updatedSkills = skills.filter((s) => s !== skillToRemove);
    setSkills(updatedSkills);

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { skills: updatedSkills });
    } catch (error) {
      console.error("Error removing skill:", error);
    }
  };

  // Web Speech API Logic
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "cs-CZ";

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setReflectionText(
            (prev) =>
              prev +
              (prev.endsWith(" ") || prev === "" ? "" : " ") +
              finalTranscript,
          );
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!recognitionRef.current) {
        alert("Váš prohlížeč nepodporuje rozpoznávání řeči.");
        return;
      }
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Helper funkcia pre formátovanie dátumu
  const formatDateCZ = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
  };

  const getChatbotMessage = () => {
    if (!placement)
      return "Ahoj! Vítám tě v PraxiHubu. Začni tím, že vyplníš žádost o schválení firmy.";
    switch (placement.status) {
      case "PENDING_ORG_APPROVAL":
        return "Právě čekáme na schválení firmy koordinátorem. Dám ti vědět, jakmile to bude hotové.";
      case "ORG_APPROVED":
        return "Skvělá zpráva! Firma byla schválena. Tvým dalším krokem je vygenerování smlouvy (sekce 'Získat smlouvu').";
      case "NEEDS_REVIEW":
        return "Analyzoval jsem tvou smlouvu. Prosím, zkontroluj níže, zda jsem všechny údaje přečetl správně.";
      case "APPROVED":
      case "ACTIVE":
        return "Vše hotovo! Tvá praxe je schválena. Hodně štěstí!";
      default:
        return undefined;
    }
  };

  // UI Components
  const UploadSection = () => {
    // Ak užívateľ nemá schválenú organizáciu, zobrazíme pôvodnú správu (defenzívne, hoci rodič to kontroluje)
    if (placement?.status !== "ORG_APPROVED") {
      return (
        <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-gray-500">Zatím nemáš žádnou aktivní praxi.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Success Banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <div className="shrink-0 text-green-600 mt-0.5">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-green-800">
              Gratulujeme! Organizace byla schválena.
            </h3>
            <p className="text-green-700 text-sm mt-1">
              Nyní si připravte smlouvu a podepsanou ji nahrajte.
            </p>
          </div>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1 */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">
                1
              </span>
              Získat smlouvu
            </h4>

            <div className="flex-1 flex flex-col gap-3">
              <Link href="/student/generate" className="block">
                <div className="w-full h-full p-4 bg-blue-50 border-2 border-blue-100 rounded-xl hover:border-blue-300 hover:bg-blue-100 transition group cursor-pointer text-center flex flex-col items-center justify-center gap-2">
                  <div className="p-2 bg-white rounded-full text-blue-600 shadow-sm group-hover:scale-110 transition">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <span className="font-bold text-blue-700">
                    Generovat novou smlouvu
                  </span>
                  <span className="text-xs text-blue-600/80">
                    Automaticky doplní údaje
                  </span>
                </div>
              </Link>

              <div className="text-center mt-2">
                <a
                  href="https://moodle.czu.cz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-blue-600 hover:underline flex items-center justify-center gap-1"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Stáhnout šablonu z Moodle
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">
                2
              </span>
              Nahrát podepsaný sken
            </h4>

            <div className="flex-1">
              <label className="block w-full h-full min-h-[140px] cursor-pointer group">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <div
                  className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 transition ${uploading ? "bg-gray-50 border-gray-300 cursor-not-allowed" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"}`}
                >
                  {uploading ? (
                    <div className="text-center">
                      <svg
                        className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span className="text-sm text-blue-600 font-medium">
                        Nahrávám a analyzuji...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-gray-100 rounded-full text-gray-400 mb-3 group-hover:bg-blue-100 group-hover:text-blue-500 transition">
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                      </div>
                      <span className="font-medium text-gray-700 group-hover:text-blue-700">
                        Vybrat soubor
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        PDF, JPG, PNG (max 10MB)
                      </span>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loadingData)
    return <div className="p-8 text-center">Načítám data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans card-glass">
      <Chatbot initialMessage={getChatbotMessage()} />

      {/* SKILLS MODAL */}
      {isSkillsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Moje dovednosti
              </h3>
              <button
                onClick={() => setIsSkillsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Přidej technologie a nástroje, které ovládáš (např. React, Python,
              Marketing...). Pomůže nám to najít ti lepší praxi.
            </p>

            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSkill()}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Např. JavaScript"
              />
              <button
                onClick={addSkill}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                Přidat
              </button>
            </div>

            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
              {skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2"
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(skill)}
                    className="text-blue-400 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              ))}
              {skills.length === 0 && (
                <p className="text-gray-400 text-sm italic">
                  Zatím žádné dovednosti.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Můj přehled praxe
            </h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">
              Vítej, {user?.displayName || user?.email}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch w-full md:w-auto">
            <Link
              href="/student/generate"
              className="text-blue-600 border border-blue-200 bg-white px-4 py-3 md:py-2 rounded-lg font-medium hover:bg-blue-50 transition block text-center"
            >
              + Nová smlouva / Opravit
            </Link>

            <button
              onClick={() => auth.signOut()}
              className="text-sm px-4 py-3 md:py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
            >
              Odhlásit se
            </button>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* HLAVNÁ KARTA (STAV) */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI MATCHMAKING & SKILLS TEASER */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2">
                  Hledáš ideální praxi?
                </h2>
                <p className="mb-6 opacity-90 max-w-lg">
                  Využij AI Matchmaking. Na základě tvých dovedností ti najdeme
                  firmu, která ti sedne nejlépe.
                </p>

                <div className="flex flex-wrap gap-4 items-center">
                  <Link href="/student/matchmaking">
                    <button className="px-6 py-2 bg-white text-blue-700 font-bold rounded-lg shadow-md hover:bg-blue-50 transition">
                      🔍 Najít praxi pomocí AI
                    </button>
                  </Link>
                  <button
                    onClick={() => setIsSkillsModalOpen(true)}
                    className="text-sm font-medium underline hover:text-blue-100 transition"
                  >
                    {skills.length > 0
                      ? `Spravovat dovednosti (${skills.length})`
                      : "+ Přidat moje dovednosti"}
                  </button>
                </div>
              </div>
              {/* Decorative background circle */}
              <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Aktuální stav
              </h2>

              {/* LOGIC FLOW */}
              {!placement || placement.status === "REJECTED" ? (
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    Žádost o schválení organizace
                  </h3>
                  <p className="text-gray-600 text-sm mb-6">
                    Než začnete s generováním smlouvy, koordinátor musí schválit
                    vámi vybranou organizaci.
                  </p>

                  {placement?.status === "REJECTED" && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200">
                      <p className="font-bold">
                        Vaša predchádzajúca žiadosť bola zamietnutá.
                      </p>
                      {placement.ai_error_message && (
                        <p className="text-sm mt-1">
                          Důvod: {placement.ai_error_message}
                        </p>
                      )}
                      <p className="text-sm mt-2">
                        Prosím, skontrolujte údaje a podajte novú žiadosť.
                      </p>
                    </div>
                  )}

                  <form
                    onSubmit={handleOrgRequestSubmit}
                    className="space-y-4 max-w-lg"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Název organizace *
                      </label>
                      <input
                        type="text"
                        value={orgRequest.name}
                        onChange={(e) =>
                          setOrgRequest({ ...orgRequest, name: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Např. Acme Corp s.r.o."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IČO *
                      </label>
                      <input
                        type="text"
                        value={orgRequest.ico}
                        onChange={(e) =>
                          setOrgRequest({ ...orgRequest, ico: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="12345678"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Webové stránky (nepovinné)
                      </label>
                      <input
                        type="text"
                        value={orgRequest.web}
                        onChange={(e) =>
                          setOrgRequest({ ...orgRequest, web: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="www.example.com"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submittingOrg}
                      className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {submittingOrg ? "Odesílám..." : "Odeslat žádost"}
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  {/* PENDING APPROVAL */}
                  {placement.status === "PENDING_ORG_APPROVAL" && (
                    <div className="text-center py-10 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <svg
                          className="w-8 h-8 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Čeká se na schválení organizace
                      </h3>
                      <p className="text-gray-600 max-w-md mx-auto">
                        Váš požadavek na praxi v{" "}
                        <strong>{placement.organization_name}</strong> čeká na
                        schválení koordinátorem. O výsledku budete informováni.
                      </p>
                    </div>
                  )}

                  {/* ORG APPROVED - Show Upload/Generate Buttons */}
                  {placement.status === "ORG_APPROVED" && <UploadSection />}

                  {/* EXISTING STATUSES */}
                  {(placement.status === "ANALYZING" ||
                    placement.status === "NEEDS_REVIEW" ||
                    placement.status === "APPROVED" || placement.status === "ACTIVE" ||
                    placement.status === "EVALUATION" ||
                    placement.status === "CLOSED") && (
                    <div className="space-y-6">
                      {/* STATUS BAR */}
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div
                          className={`p-3 rounded-full ${
                            placement.status === "ANALYZING"
                              ? "bg-blue-100 text-blue-600"
                              : placement.status === "APPROVED" || placement.status === "ACTIVE"
                                ? "bg-green-100 text-green-600"
                                : placement.status === "NEEDS_REVIEW"
                                  ? "bg-yellow-100 text-yellow-600"
                                  : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {placement.status === "ANALYZING" && (
                            <svg
                              className="w-6 h-6 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          )}
                          {placement.status === "APPROVED" || placement.status === "ACTIVE" && (
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                          {(placement.status === "EVALUATION" ||
                            placement.status === "CLOSED") && (
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                          {placement.status === "NEEDS_REVIEW" && (
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-900">
                            {placement.status === "ANALYZING" &&
                              "AI zpracovává dokument..."}
                            {placement.status === "NEEDS_REVIEW" &&
                              "Nutná kontrola údajů"}
                            {placement.status === "APPROVED" || placement.status === "ACTIVE" &&
                              "Praxe je oficiálně schválena"}
                            {placement.status === "EVALUATION" &&
                              "Čeká se na hodnocení"}
                            {placement.status === "CLOSED" && "Praxe uzavřena"}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {placement.status === "ANALYZING" &&
                              "Čekejte prosím, čtu data ze smlouvy."}
                            {placement.status === "NEEDS_REVIEW" &&
                              "AI předvyplnila data. Prosím o vaši kontrolu níže."}
                            {placement.status === "APPROVED" || placement.status === "ACTIVE" &&
                              `Schváleno dne ${formatDateCZ(placement.approvedAt)}. E-mail odeslán firmě.`}
                            {placement.status === "EVALUATION" &&
                              "Napiš svou reflexi z praxe."}
                            {placement.status === "CLOSED" &&
                              "Tvá praxe byla úspěšně hodnocena."}
                          </p>
                        </div>
                      </div>

                      {/* FORMULÁR NA KONTROLU (Iba ak NEEDS_REVIEW) */}
                      {placement.status === "NEEDS_REVIEW" && (
                        <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                          <h4 className="font-bold text-yellow-800 mb-4">
                            Zkontrolujte údaje nalezené AI:
                          </h4>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">
                                Název Firmy
                              </label>
                              <input
                                type="text"
                                value={reviewData.organization_name}
                                onChange={(e) =>
                                  setReviewData({
                                    ...reviewData,
                                    organization_name: e.target.value,
                                  })
                                }
                                className="w-full border border-yellow-300 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">
                                IČO
                              </label>
                              <input
                                type="text"
                                value={reviewData.organization_ico}
                                onChange={(e) =>
                                  setReviewData({
                                    ...reviewData,
                                    organization_ico: e.target.value,
                                  })
                                }
                                className="w-full border border-yellow-300 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">
                                Datum od
                              </label>
                              <input
                                type="text"
                                value={reviewData.start_date}
                                onChange={(e) =>
                                  setReviewData({
                                    ...reviewData,
                                    start_date: e.target.value,
                                  })
                                }
                                className="w-full border border-yellow-300 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">
                                Datum do
                              </label>
                              <input
                                type="text"
                                value={reviewData.end_date}
                                onChange={(e) =>
                                  setReviewData({
                                    ...reviewData,
                                    end_date: e.target.value,
                                  })
                                }
                                className="w-full border border-yellow-300 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                              />
                            </div>
                          </div>
                          <button
                            onClick={confirmData}
                            className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-lg font-bold shadow-sm transition"
                          >
                            Potvrdit správnost údajů
                          </button>
                        </div>
                      )}

                      {/* SCHVÁLENÉ ÚDAJE (Iba ak APPROVED alebo EVALUATION alebo CLOSED) */}
                      {(placement.status === "APPROVED" || placement.status === "ACTIVE" ||
                        placement.status === "EVALUATION" ||
                        placement.status === "CLOSED") && (
                        <div className="space-y-6">
                          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <tbody className="divide-y divide-gray-200">
                                <tr>
                                  <td className="px-4 py-3 bg-gray-50 font-medium text-gray-500 w-1/3">
                                    Firma
                                  </td>
                                  <td className="px-4 py-3 text-gray-900 font-bold">
                                    {placement.organization_name}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-4 py-3 bg-gray-50 font-medium text-gray-500">
                                    IČO
                                  </td>
                                  <td className="px-4 py-3 text-gray-900 font-mono">
                                    {placement.organization_ico}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-4 py-3 bg-gray-50 font-medium text-gray-500">
                                    Termín
                                  </td>
                                  <td className="px-4 py-3 text-gray-900">
                                    {placement.start_date} —{" "}
                                    {placement.end_date}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* AI HODNOCENÍ REFLEXE (EVALUATION STATE) */}
                          {placement.status === "EVALUATION" && (
                            <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200 mt-6">
                              <h3 className="font-bold text-indigo-900 text-lg mb-2 flex items-center gap-2">
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                  />
                                </svg>
                                Závěrečná reflexe
                              </h3>
                              <p className="text-sm text-indigo-800 mb-4">
                                Aby byla vaše praxe úspěšně uzavřena, vypracujte
                                stručnou reflexi (co jste se naučili, jaké
                                problémy jste řešili, přínos pro vaši kariéru).
                                AI Sensei váš text vyhodnotí.
                              </p>

                              {placement.evaluationResult &&
                                !placement.evaluationResult.isPass && (
                                  <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm border border-red-200">
                                    <p className="font-bold mb-2">
                                      Hodnocení AI – Reflexe nesplňuje metodiku
                                      (MŠMT KRAU)
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                      {placement.evaluationResult
                                        .didacticCompetence && (
                                        <div className="bg-white p-3 rounded border border-red-100">
                                          <span className="font-bold text-red-800">
                                            Oborově-předmětová a didaktická kom.
                                            (
                                            {
                                              placement.evaluationResult
                                                .didacticCompetence.score
                                            }
                                            /100):
                                          </span>
                                          <p className="text-red-600 mt-1">
                                            {
                                              placement.evaluationResult
                                                .didacticCompetence.reasoning
                                            }
                                          </p>
                                        </div>
                                      )}
                                      {placement.evaluationResult
                                        .pedagogicalCompetence && (
                                        <div className="bg-white p-3 rounded border border-red-100">
                                          <span className="font-bold text-red-800">
                                            Pedagogická a psychologická kom. (
                                            {
                                              placement.evaluationResult
                                                .pedagogicalCompetence.score
                                            }
                                            /100):
                                          </span>
                                          <p className="text-red-600 mt-1">
                                            {
                                              placement.evaluationResult
                                                .pedagogicalCompetence.reasoning
                                            }
                                          </p>
                                        </div>
                                      )}
                                      {placement.evaluationResult
                                        .socialCompetence && (
                                        <div className="bg-white p-3 rounded border border-red-100">
                                          <span className="font-bold text-red-800">
                                            Komunikativní a sociální kom. (
                                            {
                                              placement.evaluationResult
                                                .socialCompetence.score
                                            }
                                            /100):
                                          </span>
                                          <p className="text-red-600 mt-1">
                                            {
                                              placement.evaluationResult
                                                .socialCompetence.reasoning
                                            }
                                          </p>
                                        </div>
                                      )}
                                      {placement.evaluationResult
                                        .reflectiveCompetence && (
                                        <div className="bg-white p-3 rounded border border-red-100">
                                          <span className="font-bold text-red-800">
                                            Profesní a sebereflektivní kom. (
                                            {
                                              placement.evaluationResult
                                                .reflectiveCompetence.score
                                            }
                                            /100):
                                          </span>
                                          <p className="text-red-600 mt-1">
                                            {
                                              placement.evaluationResult
                                                .reflectiveCompetence.reasoning
                                            }
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                              <div className="relative mb-4">
                                <textarea
                                  value={reflectionText}
                                  onChange={(e) =>
                                    setReflectionText(e.target.value)
                                  }
                                  rows={6}
                                  className="w-full p-3 pr-12 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                  placeholder="Zde napište svou reflexi..."
                                />
                                <button
                                  onClick={toggleRecording}
                                  className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${isRecording ? "bg-red-100 text-red-600 animate-pulse" : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"}`}
                                  title="Diktovat hlasem"
                                >
                                  {isRecording ? (
                                    <MicOff size={20} />
                                  ) : (
                                    <Mic size={20} />
                                  )}
                                </button>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                <button
                                  onClick={handleImproveWithAI}
                                  disabled={
                                    isCorrectingGrammar ||
                                    reflectionText.trim().length === 0
                                  }
                                  className="w-full sm:w-auto px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-bold shadow-sm hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                                >
                                  {isCorrectingGrammar ? (
                                    <>
                                      <svg
                                        className="animate-spin h-4 w-4 text-indigo-700"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                      >
                                        <circle
                                          className="opacity-25"
                                          cx="12"
                                          cy="12"
                                          r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                        ></circle>
                                        <path
                                          className="opacity-75"
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                      </svg>
                                      Vylepšujem...
                                    </>
                                  ) : (
                                    <>
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M13 10V3L4 14h7v7l9-11h-7z"
                                        />
                                      </svg>
                                      Vylepšiť pomocou AI
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={handleEvaluateReflection}
                                  disabled={
                                    evaluating ||
                                    isCorrectingGrammar ||
                                    reflectionText.trim().length === 0
                                  }
                                  className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                  {evaluating
                                    ? "Hodnocení..."
                                    : "Odeslat k hodnocení AI"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* UZAVŘENÁ PRAXE (CLOSED STATE) */}
                          {placement.status === "CLOSED" && (
                            <div className="bg-green-50 p-6 rounded-lg border border-green-200 mt-6">
                              <h3 className="font-bold text-green-900 text-lg mb-2 flex items-center gap-2">
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Praxe úspěšně uzavřena
                              </h3>
                              <p className="text-sm text-green-800 mb-4">
                                Gratulujeme! Vaše reflexe byla schválena a praxe
                                je oficiálně uzavřena.
                              </p>
                              {placement.evaluationResult && (
                                <div className="bg-white p-4 rounded-lg border border-green-100 text-sm mt-4">
                                  <p className="font-bold text-green-700 mb-3 text-base">
                                    Zpětná vazba od AI Sensei (dle MŠMT KRAU)
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {placement.evaluationResult
                                      .didacticCompetence && (
                                      <div className="bg-green-50 p-3 rounded border border-green-200">
                                        <span className="font-bold text-green-800">
                                          Oborově-předmětová a didaktická kom. (
                                          {
                                            placement.evaluationResult
                                              .didacticCompetence.score
                                          }
                                          /100):
                                        </span>
                                        <p className="text-gray-700 mt-1 italic">
                                          "
                                          {
                                            placement.evaluationResult
                                              .didacticCompetence.reasoning
                                          }
                                          "
                                        </p>
                                      </div>
                                    )}
                                    {placement.evaluationResult
                                      .pedagogicalCompetence && (
                                      <div className="bg-green-50 p-3 rounded border border-green-200">
                                        <span className="font-bold text-green-800">
                                          Pedagogická a psychologická kom. (
                                          {
                                            placement.evaluationResult
                                              .pedagogicalCompetence.score
                                          }
                                          /100):
                                        </span>
                                        <p className="text-gray-700 mt-1 italic">
                                          "
                                          {
                                            placement.evaluationResult
                                              .pedagogicalCompetence.reasoning
                                          }
                                          "
                                        </p>
                                      </div>
                                    )}
                                    {placement.evaluationResult
                                      .socialCompetence && (
                                      <div className="bg-green-50 p-3 rounded border border-green-200">
                                        <span className="font-bold text-green-800">
                                          Komunikativní a sociální kom. (
                                          {
                                            placement.evaluationResult
                                              .socialCompetence.score
                                          }
                                          /100):
                                        </span>
                                        <p className="text-gray-700 mt-1 italic">
                                          "
                                          {
                                            placement.evaluationResult
                                              .socialCompetence.reasoning
                                          }
                                          "
                                        </p>
                                      </div>
                                    )}
                                    {placement.evaluationResult
                                      .reflectiveCompetence && (
                                      <div className="bg-green-50 p-3 rounded border border-green-200">
                                        <span className="font-bold text-green-800">
                                          Profesní a sebereflektivní kom. (
                                          {
                                            placement.evaluationResult
                                              .reflectiveCompetence.score
                                          }
                                          /100):
                                        </span>
                                        <p className="text-gray-700 mt-1 italic">
                                          "
                                          {
                                            placement.evaluationResult
                                              .reflectiveCompetence.reasoning
                                          }
                                          "
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {placement.certificateUrl && (
                                <div className="mt-6 flex justify-center">
                                  <a
                                    href={placement.certificateUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition"
                                  >
                                    <svg
                                      className="w-5 h-5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                      />
                                    </svg>
                                    Stáhnout certifikát
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {/* EVIDENCE HODIN (Time Logs) - Zobrazia sa len ak je APPROVED alebo EVALUATION alebo CLOSED */}
                          {(placement.status === "APPROVED" || placement.status === "ACTIVE" ||
                            placement.status === "EVALUATION" ||
                            placement.status === "CLOSED") && (
                            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mb-6">
                              <h3 className="font-bold text-blue-900 text-lg mb-4 flex items-center gap-2">
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Evidence hodin
                              </h3>

                              <form
                                onSubmit={handleTimeLogSubmit}
                                className="mb-6 bg-white p-4 rounded-lg border border-blue-100 shadow-sm"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                  <div>
                                    <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                                      Datum
                                    </label>
                                    <input
                                      type="date"
                                      required
                                      value={newLogDate}
                                      onChange={(e) =>
                                        setNewLogDate(e.target.value)
                                      }
                                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                                      Počet hodin
                                    </label>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0.5"
                                      required
                                      value={newLogHours}
                                      onChange={(e) =>
                                        setNewLogHours(e.target.value)
                                      }
                                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                                    />
                                  </div>
                                  <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                                      Popis činnosti
                                    </label>
                                    <textarea
                                      required
                                      rows={2}
                                      value={newLogDescription}
                                      onChange={(e) =>
                                        setNewLogDescription(e.target.value)
                                      }
                                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                                      placeholder="Co jste dělali?"
                                    />
                                  </div>
                                </div>
                                <button
                                  type="submit"
                                  disabled={submittingLog}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition"
                                >
                                  {submittingLog
                                    ? "Ukládám..."
                                    : "Přidat záznam"}
                                </button>
                              </form>

                              <div className="space-y-3">
                                <h4 className="font-semibold text-blue-900">
                                  Historie záznamů
                                </h4>
                                {timeLogs.length === 0 ? (
                                  <p className="text-sm text-blue-700 italic">
                                    Zatím nebyly zapsány žádné hodiny.
                                  </p>
                                ) : (
                                  timeLogs.map((log) => (
                                    <div
                                      key={log.id}
                                      className="bg-white p-4 rounded-lg border border-blue-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 shadow-sm"
                                    >
                                      <div>
                                        <p className="font-bold text-slate-900">
                                          {new Date(
                                            log.date,
                                          ).toLocaleDateString("cs-CZ")}{" "}
                                          <span className="text-blue-600 ml-2">
                                            {log.hours} h
                                          </span>
                                        </p>
                                        <p className="text-sm text-slate-600">
                                          {log.description}
                                        </p>
                                      </div>
                                      <div className="shrink-0">
                                        {log.status === "pending" && (
                                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
                                            Čeká na schválení
                                          </span>
                                        )}
                                        {log.status === "approved" && (
                                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                                            Schváleno
                                          </span>
                                        )}
                                        {log.status === "rejected" && (
                                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                                            Zamítnuto
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          {/* HODNOCENÍ PRAXE (Dostupné pro APPROVED, EVALUATION, CLOSED) */}
                          <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                            <h3 className="font-bold text-purple-900 text-lg mb-4 flex items-center gap-2">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                              </svg>
                              Hodnocení praxe
                            </h3>

                            {placement.studentRating ? (
                              <div>
                                <p className="text-sm text-purple-800 mb-2 font-medium">
                                  Vaše hodnocení firmy:
                                </p>
                                <div className="flex items-center gap-3 mb-3">
                                  <StarRating
                                    rating={placement.studentRating}
                                    readOnly
                                  />
                                  <span className="font-bold text-purple-900">
                                    {placement.studentRating}/5
                                  </span>
                                </div>
                                {placement.studentReview && (
                                  <div className="bg-white p-3 rounded border border-purple-100 text-gray-700 text-sm italic">
                                    "{placement.studentReview}"
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-purple-800 mb-4">
                                  Jak jste byli spokojeni s průběhem praxe? Vaše
                                  zpětná vazba pomůže dalším studentům.
                                </p>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-xs font-bold text-purple-800 uppercase mb-1">
                                      Celkové hodnocení
                                    </label>
                                    <StarRating
                                      rating={studentRating}
                                      setRating={setStudentRating}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-purple-800 uppercase mb-1">
                                      Slovní hodnocení (nepovinné)
                                    </label>
                                    <textarea
                                      value={studentReview}
                                      onChange={(e) =>
                                        setStudentReview(e.target.value)
                                      }
                                      className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                      rows={3}
                                      placeholder="Popište svou zkušenost..."
                                    ></textarea>
                                  </div>
                                  <button
                                    onClick={handleRateCompany}
                                    disabled={studentRating === 0}
                                    className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold shadow-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                  >
                                    Odeslat hodnocení
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* BOČNÝ PANEL (INFO & LOG) */}
          <div className="space-y-6">
            {/* Circular Progress Component */}
            {placement && ["APPROVED", "ACTIVE", "EVALUATION", "CLOSED"].includes(placement.status) && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Postup praxe
                </h3>
                {(() => {
                  const targetHours = placement.targetHours || 15;
                  const migratedHours = placement.migratedHours || 0;
                  const approvedHours = timeLogs.filter(log => log.status === 'approved').reduce((sum, log) => sum + (Number(log.hours) || 0), 0);
                  const totalHours = migratedHours + approvedHours;
                  const progressPercent = Math.min(100, Math.round((totalHours / targetHours) * 100));

                  const circleRadius = 50;
                  const circleCircumference = 2 * Math.PI * circleRadius;
                  const strokeDashoffset = circleCircumference - (progressPercent / 100) * circleCircumference;

                  return (
                    <div className="flex flex-col items-center">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                          {/* Background Circle */}
                          <circle
                            className="text-gray-100"
                            strokeWidth="10"
                            stroke="currentColor"
                            fill="transparent"
                            r={circleRadius}
                            cx="60"
                            cy="60"
                          />
                          {/* Progress Circle */}
                          <circle
                            className={`${progressPercent >= 100 ? 'text-green-500' : 'text-blue-600'} transition-all duration-1000 ease-out`}
                            strokeWidth="10"
                            strokeDasharray={circleCircumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r={circleRadius}
                            cx="60"
                            cy="60"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-gray-900">{totalHours}</span>
                          <span className="text-xs text-gray-500">/ {targetHours} hod</span>
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-gray-600 font-medium">
                        Splněno <span className={progressPercent >= 100 ? "text-green-600 font-bold" : "text-blue-600 font-bold"}>{progressPercent}%</span>
                      </p>
                      {migratedHours > 0 && (
                        <p className="text-xs text-gray-400 mt-2">
                          (Z toho {migratedHours} hod migrováno)
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* QR Kód pro mentora */}
            {placement && placement.status !== "PENDING_ORG_APPROVAL" && placement.status !== "REJECTED" && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  QR kód pro mentora
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Mentor může naskenovat tento kód ve svém rozhraní pro rychlý přístup k vaší praxi.
                </p>
                <div className="flex justify-center p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl">
                  <QRCode value={placement.id} size={150} />
                </div>
              </div>
            )}

            {/* Dokument Karta */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                Dokumentace
              </h3>
              {placement && placement.contract_url ? (
                <div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg mb-4">
                    <svg
                      className="w-8 h-8 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {placement.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Nahráno: {formatDateCZ(placement.createdAt)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={placement.contract_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full text-center py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium transition mb-4"
                  >
                    Stáhnout originál
                  </a>
                  {(placement?.studentMajor === "KPV" ||
                    placement?.major === "KPV") && (
                    <div className="mt-4 border-t pt-4">
                      <ContractSignature
                        placementId={placement.id}
                        role="student"
                        signatures={placement.signatures}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  {placement?.status === "PENDING_ORG_APPROVAL"
                    ? "Čeká se na schválení firmy."
                    : placement?.status === "ORG_APPROVED"
                      ? "Čeká se na nahrání smlouvy."
                      : "Žádný dokument nebyl nahrán."}
                </p>
              )}
            </div>

            {/* Semaphore Stepper */}
            {placement && (
              <div className="card">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-8">
                  Průběh zpracování
                </h3>

                <div className="flex items-center justify-between relative px-2">
                  <div className="absolute left-6 right-6 top-4 -translate-y-1/2 h-1 bg-slate-100 z-0 rounded-full"></div>

                  {(() => {
                    const steps = [
                      { id: "DRAFT", label: "Návrh" },
                      { id: "CONTRACT", label: "Smlouva" },
                      { id: "ACTIVE", label: "Probíhá" },
                      { id: "EVALUATION", label: "Hodnocení" },
                      { id: "CLOSED", label: "Uzavřeno" },
                    ];

                    let currentStepIndex = 0;
                    if (
                      ["ANALYZING", "NEEDS_REVIEW"].includes(placement.status)
                    )
                      currentStepIndex = 1;
                    if (placement.status === "APPROVED" || placement.status === "ACTIVE") currentStepIndex = 2;
                    if (placement.status === "EVALUATION") currentStepIndex = 3;
                    if (placement.status === "CLOSED") currentStepIndex = 4;
                    if (placement.status === "REJECTED") currentStepIndex = -1;

                    return steps.map((step, index) => {
                      const isCompleted =
                        index < currentStepIndex ||
                        placement.status === "CLOSED";
                      const isActive =
                        index === currentStepIndex &&
                        placement.status !== "REJECTED";
                      const isRejected =
                        placement.status === "REJECTED" && index === 0;

                      let bgColor = "bg-slate-200";
                      let textColor = "text-slate-400";
                      let borderColor = "border-white";

                      if (isCompleted) {
                        bgColor = "bg-green-500";
                        textColor = "text-green-700";
                      } else if (isActive) {
                        bgColor = "bg-indigo-600";
                        textColor = "text-indigo-900";
                      } else if (isRejected) {
                        bgColor = "bg-red-500";
                        textColor = "text-red-700";
                      }

                      return (
                        <div
                          key={step.id}
                          className="relative z-10 flex flex-col items-center gap-3 bg-white px-1"
                        >
                          <div
                            className={`w-8 h-8 rounded-full border-4 flex items-center justify-center ${bgColor} ${borderColor} shadow-sm transition-all duration-300`}
                          >
                            {isCompleted && (
                              <svg
                                className="w-4 h-4 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <span className={`text-xs font-bold ${textColor}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Na tahu:
                  </span>
                  <p className="text-sm font-bold text-slate-800 mt-1">
                    {placement.status === "PENDING_ORG_APPROVAL" &&
                      "Firma (čeká se na schválení organizace)"}
                    {placement.status === "ORG_APPROVED" &&
                      "Student (čeká se na nahrání smlouvy)"}
                    {["ANALYZING", "NEEDS_REVIEW"].includes(placement.status) &&
                      "Koordinátor (kontrola smlouvy)"}
                    {placement.status === "APPROVED" || placement.status === "ACTIVE" &&
                      "Student (vykonává praxi)"}
                    {placement.status === "EVALUATION" &&
                      "Student / AI (vyplnění a vyhodnocení reflexe)"}
                    {placement.status === "CLOSED" &&
                      "Hotovo (praxe úspěšně ukončena)"}
                    {placement.status === "REJECTED" &&
                      "Student (nutno podat nový návrh)"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
