"use client";
import { toast } from "react-hot-toast";
import React, { useState, useEffect, useRef } from "react";
import { db, auth, functions, storage } from "../../../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../../../contexts/AuthContext";
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

import QRCode from "react-qr-code";
import SHA256 from "crypto-js/sha256";

import ErrorBoundary from "@/components/ErrorBoundary";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import RoleBadge from "@/components/RoleBadge";
import { PlacementStatus } from "../../../lib/constants/placementStates";

export default function StudentDashboard() {
  return (
    <ErrorBoundary>
      <StudentDashboardContent />
    </ErrorBoundary>
  );
}

function StudentDashboardContent() {
  const { user, loading: authLoading } = useAuth();
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
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | "NEW">("");
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

  // Formularove stavy pre time logs
  const [newLogDate, setNewLogDate] = useState("");
  const [newLogHours, setNewLogHours] = useState("");
  const [newLogDescription, setNewLogDescription] = useState("");
  const [newLogCategory, setNewLogCategory] = useState("shadowing_hours");
  const [submittingLog, setSubmittingLog] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);


  // State for AI Evaluation
  const [reflectionText, setReflectionText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [isCorrectingGrammar, setIsCorrectingGrammar] = useState(false);
  const [isGeneratingMatrix, setIsGeneratingMatrix] = useState(false);

  // State for Voice Dictation
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [activeTab, setActiveTab] = useState("náslechy");
  const [rubrics, setRubrics] = useState<any>({});
  const [systemRubricConfig, setSystemRubricConfig] = useState<any>(null);

  const router = useRouter();

  useEffect(() => {
    async function fetchSystemRubrics() {
      try {
        const configDoc = await getDoc(doc(db, "system_configs", "ai_krau_rules"));
        if (configDoc.exists()) {
           setSystemRubricConfig(configDoc.data());
        }
      } catch (err) {
        console.error("Error fetching system rubrics config:", err);
      }
    }
    fetchSystemRubrics();
  }, []);

  useEffect(() => {
    if (!placement?.id) return;
    const unsub = onSnapshot(
      collection(db, "placements", placement.id, "rubrics"),
      (snapshot) => {
        let currentRubrics: any = {};
        snapshot.forEach((doc) => {
          currentRubrics[doc.id] = doc.data();
        });
        setRubrics(currentRubrics);
      }
    );
    return () => unsub();
  }, [placement?.id]);

  const handleRubricChange = (domainId: string, value: string) => {
     setRubrics((prev: any) => ({
       ...prev,
       [domainId]: { ...prev[domainId], value }
     }));
     debouncedSaveRubric(domainId, value);
  };

  const saveRubricToDb = async (domainId: string, value: string) => {
    if (!placement?.id) return;
    try {
      const rubricRef = doc(collection(db, "placements", placement.id, "rubrics"), domainId);
      await setDoc(rubricRef, { value, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
       console.error("Failed to auto-save rubric:", err);
    }
  };

  const debouncedSaveRubric = useRef(
    // Simple debounce implementation directly in component
    (() => {
      let timer: NodeJS.Timeout;
      return (domainId: string, value: string) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          saveRubricToDb(domainId, value);
        }, 2000);
      };
    })()
  ).current;


  // Fetch time logs
  useEffect(() => {
    if (!placement?.id) return;

    const logsRef = collection(db, "placements", placement.id, "time_logs");
    const q = query(logsRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data() as any,
      }));
      setTimeLogs(logsData);
    });

    return () => unsubscribe();
  }, [placement?.id]);


  // Web Speech API for Dictation
  const handleDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.success("Tvůj prohlížeč nepodporuje hlasové zadávání. Zkus Google Chrome nebo Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'cs-CZ';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsDictating(true);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;

      // Compute the combined text locally
      const currentDescription = newLogDescription;
      const combinedText = currentDescription + (currentDescription ? ' ' : '') + transcript;

      // Update state purely
      setNewLogDescription(combinedText);
      setIsDictating(false);

      // Perform side effects outside of the setState updater
      setIsEnhancing(true);
      try {
        const enhanceVoiceLog = httpsCallable(functions, 'enhanceVoiceLog');
        const result = await enhanceVoiceLog({ text: combinedText });
        const data = result.data as any;
        if (data.enhancedText) {
          setNewLogDescription(data.enhancedText);
        }
      } catch (error) {
        console.error("AI Enhance error:", error);
      } finally {
        setIsEnhancing(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsDictating(false);
      if (event.error !== 'no-speech') {
          toast.error("Chyba při rozpoznávání hlasu.");
      }
    };

    recognition.onend = () => {
      setIsDictating(false);
    };

    recognition.start();
  };

  const handleTimeLogSubmit = async (e: React.FormEvent) => {

    e.preventDefault();
    if (!placement?.id || !newLogDate || !newLogHours || !newLogDescription || !newLogCategory)
      return;

    setSubmittingLog(true);
    try {
      const logsRef = collection(db, "placements", placement.id, "time_logs");
      await addDoc(logsRef, {
        date: newLogDate,
        hours: Number(newLogHours),
        category: newLogCategory,
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
      toast.error("Chyba při ukládání záznamu.");
    } finally {
      setSubmittingLog(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (!user.researchConsent) {
      router.push("/consent");
      return;
    }
    if (!user.major) {
      router.push("/onboarding");
      return;
    }

    setSkills(user.skills || []);

    import("firebase/firestore").then(({ collection, query, where, getDocs }) => {
      const instQ = query(collection(db, "users"), where("role", "==", "institution"));
      getDocs(instQ).then((snap) => {
        setInstitutions(snap.docs.map(d => ({ id: d.id, ...d.data() as any })));
      });
    });

    const q = query(
      collection(db, "placements"),
      where("studentId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(1),
    );

    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
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

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [user, authLoading, router]);

  const handleOrgRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Uživatel není přihlášen.");
      return;
    }

    if (!user.major) {
      toast.error("Chybí studijní obor v profilu. Prosím aktualizujte si profil.");
      router.push("/onboarding");
      return;
    }

    const isKpv = user.major === 'KPV';

    if (selectedInstitutionId === "NEW") {
      if (!orgRequest.name) {
        toast.error("Žádost nelze odeslat: Chybí název organizace.");
        return;
      }
      if (isKpv && !orgRequest.ico) {
        toast.error("Žádost nelze odeslat: Chybí povinné údaje jako IČO.");
        return;
      }
      if (!orgRequest.web) {
        toast.error("Žádost nelze odeslat: Chybí kontaktní email.");
        return;
      }
    }

    setSubmittingOrg(true);
    try {
      let instId = selectedInstitutionId;

      if (selectedInstitutionId === "NEW") {
        const newInstRef = await addDoc(collection(db, "users"), {
          role: "institution",
          displayName: orgRequest.name,
          email: orgRequest.web, // we stored email here
          ico: orgRequest.ico || null, // Optional for UPV
          status: "PENDING_INVITE",
          createdAt: new Date().toISOString()
        });
        instId = newInstRef.id;
      }

      const docRef = await addDoc(collection(db, "placements"), {
        studentId: user.uid,
        status: PlacementStatus.PENDING_ORG_APPROVAL, // Changed to a normal pending state per request
        createdAt: new Date().toISOString(),
        institutionId: instId !== "NEW" ? instId : null,
        organization_name: orgRequest.name,
        organization_ico: orgRequest.ico || null,
        ico: orgRequest.ico || null,
        organization_web: orgRequest.web
      });

      if (isKpv && orgRequest.ico) {
        try {
          const fetchAres = httpsCallable(functions, 'fetchAresAndLink');
          await fetchAres({ ico: orgRequest.ico, placementId: docRef.id });
          toast.success("Žádost odeslána. Organizace byla automaticky ověřena v registru ARES (Fast-Track)!");
        } catch (aresError) {
          console.error("ARES error:", aresError);
          toast.success("Žádost odeslána, ale ověření v ARES se nezdařilo.");
        }
      } else {
        toast.success("Žádost odeslána a čeká na manuální přiřazení koordinátorem.");
      }

      setOrgRequest({ name: "", ico: "", web: "" });
    } catch (error: any) {
      console.error("Error submitting org request:", error);
      toast.error(`Žádost nelze odeslat: ${error.message || "Neočekávaná chyba při komunikaci s databází."}`);
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
          contract_url: downloadURL,
          status: PlacementStatus.DRAFT,
          createdAt: new Date().toISOString(),
          fileName: file.name,
          ico: "00000000" // Placeholder for rules
        });
      }
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Chyba při nahrávání souboru.");
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
        newState: PlacementStatus.APPROVED,
      });
      toast.success("Údaje potvrzeny!");
    } catch (error) {
      console.error("Error confirming data:", error);
      toast.error("Chyba při ukládání.");
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
      toast.success("Hodnocení odesláno!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Chyba při odesílání hodnocení.");
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
      toast.success(`Chyba při opravě textu: ${error.message}`);
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
        toast.success(
          "Gratulujeme! Reflexe byla úspěšně vyhodnocena a praxe je nyní uzavřena.",
        );
      } else {
        toast.success(
          "Reflexe nebyla úspěšně vyhodnocena. Prosím, upravte text podle zpětné vazby a zkuste to znovu.",
        );
      }
    } catch (error: any) {
      console.error("Evaluation Error:", error);
      toast.success(`Chyba při vyhodnocování: ${error.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const handleGenerateKraumMatrix = async () => {
    if (!placement?.id) return;
    setIsGeneratingMatrix(true);
    try {
      const generateMatrixFn = httpsCallable(functions, 'generateSkillMatrixPDF');
      const response = await generateMatrixFn({ placementId: placement.id });
      const data = response.data as any;

      if (data.success && data.url) {
        // Update local state and DB manually just in case listener is slow
        await updateDoc(doc(db, "placements", placement.id), {
           skillMatrixUrl: data.url
        });
        setPlacement({ ...placement, skillMatrixUrl: data.url });
        toast.success("KRAU Matrix byl úspěšně vygenerován.");
      }
    } catch (error: any) {
      console.error("Matrix generation error:", error);
      toast.error("Chyba při generování PDF matice.");
    } finally {
      setIsGeneratingMatrix(false);
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

  // Cognitive Telemetry Logic
  useEffect(() => {
    if (!reflectionText || !user?.uid) return;

    const timeoutId = setTimeout(async () => {
      try {
        const anonymousId = SHA256(user.uid).toString();
        const telemetryRef = collection(db, "research_telemetry");

        await addDoc(telemetryRef, {
          anonymousId,
          textDraft: reflectionText,
          major: user?.major || "UNKNOWN",
          timestamp: new Date().toISOString()
        });
      } catch (err) {
         // Silently fail as telemetry should not disrupt UX
         console.warn("Background telemetry failed", err);
      }
    }, 3000); // 3-second debounce on reflection text drafts

    return () => clearTimeout(timeoutId);
  }, [reflectionText, user?.uid, placement]);

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
        toast.success("Váš prohlížeč nepodporuje rozpoznávání řeči.");
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

  const handleDemoBypass = async () => {
    if (!user) return;
    try {
      if (placement && placement.id) {
        const docRef = doc(db, "placements", placement.id);
        await updateDoc(docRef, {
          status: PlacementStatus.EVALUATION,
          targetHours: 80,
          migratedHours: 80
        });
        toast.success("UAT: Placement status forced to EVALUATION.");
      } else {
        const newPlacement = {
          studentId: user.uid,
          status: PlacementStatus.DRAFT,
          createdAt: new Date().toISOString(),
          organization_name: "UAT Demo Company",
          organization_ico: "12345678",
          ico: "12345678",
          targetHours: 80,
          migratedHours: 80
        };
        await addDoc(collection(db, "placements"), newPlacement);
        toast.success("UAT: Dummy placement created and forced to EVALUATION.");
      }
    } catch (error) {
      console.error("UAT Bypass Error:", error);
      toast.error("Chyba při UAT bypassu.");
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
      case PlacementStatus.PENDING_ORG_APPROVAL:
        return "Právě čekáme na schválení firmy koordinátorem. Dám ti vědět, jakmile to bude hotové.";
      case PlacementStatus.ORG_APPROVED:
        return "Skvělá zpráva! Firma byla schválena. Tvým dalším krokem je vygenerování smlouvy (sekce 'Získat smlouvu').";
      case PlacementStatus.NEEDS_REVIEW:
        return "Analyzoval jsem tvou smlouvu. Prosím, zkontroluj níže, zda jsem všechny údaje přečetl správně.";
      case PlacementStatus.APPROVED:
      case PlacementStatus.ACTIVE:
        return "Vše hotovo! Tvá praxe je schválena. Hodně štěstí!";
      default:
        return undefined;
    }
  };

  // UI Components
  const UploadSection = () => {
    if (user?.major === 'UPV') return null;

    // Ak užívateľ nemá schválenú organizáciu, zobrazíme pôvodnú správu (defenzívne, hoci rodič to kontroluje)
    if (placement?.status !== PlacementStatus.ORG_APPROVED) {
      return (
        <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <p className="text-slate-600">Zatím nemáš žádnou aktivní praxi.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Success Banner */}
        <div className="bg-emerald-50 card-glass border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="shrink-0 text-emerald-500 mt-0.5">
            <span className="text-2xl">✨</span>
          </div>
          <div>
            <h3 className="font-bold text-emerald-900">
              Gratulujeme! Organizace byla schválena.
            </h3>
            <p className="text-emerald-500 text-sm mt-1">
              Nyní si připravte smlouvu a podepsanou ji nahrajte.
            </p>
          </div>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1 */}
          <div className="card-glass p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="bg-brand-50 text-brand-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">
                1
              </span>
              Získat smlouvu
            </h4>

            <div className="flex-1 flex flex-col gap-3">
              {user?.major !== 'UPV' && (
                <Link href="/student/generate" data-testid="generate-contract-link-main" className="block">
                  <div className="w-full h-full p-4 bg-white card-glass border-2 border-brand-100 rounded-3xl hover:border-brand-300 hover:bg-brand-50 transition group cursor-pointer text-center flex flex-col items-center justify-center gap-2">
                    <div className="p-2 card-glass rounded-full text-brand-500 shadow-sm group-hover:scale-110 transition">
                      <span className="text-2xl">📄</span>
                    </div>
                    <span className="font-bold text-brand-600">
                      Generovat novou smlouvu
                    </span>
                    <span className="text-xs text-brand-500/80">
                      Automaticky doplní údaje
                    </span>
                  </div>
                </Link>
              )}

              <div className="text-center mt-2">
                <a
                  href="https://moodle.czu.cz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-600 hover:text-brand-500 hover:underline flex items-center justify-center gap-1"
                >
                  <span className="text-2xl">✨</span>
                  Stáhnout šablonu z Moodle
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="card-glass p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="bg-brand-50 text-brand-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">
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
                  className={`w-full h-full border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-4 transition ${uploading ? "bg-white border-slate-200 cursor-not-allowed" : "border-slate-200 hover:border-blue-400 hover:bg-brand-50"}`}
                >
                  {uploading ? (
                    <div className="text-center">
                      <span className="text-2xl">✨</span>
                      <span className="text-sm text-brand-500 font-medium">
                        Nahrávám a analyzuji...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-slate-700/50 rounded-full text-slate-500 mb-3 group-hover:bg-brand-50 group-hover:text-blue-500 transition">
                        <span className="text-2xl">✨</span>
                      </div>
                      <span className="font-medium text-slate-800 group-hover:text-brand-600">
                        Vybrat soubor
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
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

  if (loadingData || authLoading)
    return <DashboardSkeleton />;

  return (
    <div className="min-h-screen dark bg-slate-900 p-8 font-sans card-glass">
      <Chatbot initialMessage={getChatbotMessage()} />

      {/* SKILLS MODAL */}
      {isSkillsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card-glass rounded-3xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">
                Moje dovednosti
              </h3>
              <button
                onClick={() => setIsSkillsModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-700 mb-4">
              Přidej technologie a nástroje, které ovládáš (např. React, Python,
              Marketing...). Pomůže nám to najít ti lepší praxi.
            </p>

            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSkill()}
                className="flex-1 bg-white border border-slate-200 text-slate-900 rounded-2xl px-3 py-2 outline-none focus:border-blue-500 placeholder-slate-500"
                placeholder="Např. JavaScript"
              />
              <button
                onClick={addSkill}
                className="px-4 py-2 bg-blue-600 text-slate-900 font-medium rounded-2xl hover:bg-blue-700"
              >
                Přidat
              </button>
            </div>

            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
              {skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-white text-brand-600 rounded-full border border-blue-500/20 text-sm font-medium flex items-center gap-2"
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(skill)}
                    className="text-brand-500 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              ))}
              {skills.length === 0 && (
                <p className="text-slate-500 text-sm italic">
                  Zatím žádné dovednosti.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* DEMO BYPASS BUTTON */}
        <div className="mb-8 bg-orange-900/20 border border-orange-500/50 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-orange-400 font-bold">UAT Mode</h3>
            <p className="text-sm text-orange-300/80">Bypass the regular workflow for presentation purposes.</p>
          </div>
          <button
            onClick={handleDemoBypass}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-slate-900 font-bold py-2 px-6 rounded-2xl transition shadow-lg whitespace-nowrap"
          >
            🚀 UAT: Jump to Final Reflection
          </button>
        </div>

        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Můj přehled praxe
              </h1>
              <RoleBadge role={user?.role || "student"} className="hidden md:flex" />
            </div>
            <p className="text-slate-700 mt-1 text-sm md:text-base flex items-center gap-2">
              Vítej, {user?.displayName || user?.email}
              <RoleBadge role={user?.role || "student"} className="md:hidden" />
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch w-full md:w-auto">
            {placement && user?.major !== 'UPV' && [PlacementStatus.ORG_APPROVED, PlacementStatus.NEEDS_REVIEW, PlacementStatus.PENDING_COORDINATOR, PlacementStatus.ANALYZING, PlacementStatus.APPROVED, PlacementStatus.ACTIVE, PlacementStatus.EVALUATION, PlacementStatus.CLOSED, PlacementStatus.FINAL_EXAM].includes(placement.status) && (
              <Link
                href="/student/generate"
                data-testid="generate-contract-link"
                className="text-brand-500 border border-blue-800/50 card-glass px-4 py-3 md:py-2 rounded-2xl font-medium hover:bg-brand-50 transition block text-center"
              >
                + Nová smlouva / Opravit
              </Link>
            )}

            <button
              onClick={() => auth.signOut()}
              className="text-sm px-4 py-3 md:py-2 border border-slate-200 rounded-2xl hover:bg-slate-700/50 transition text-slate-100"
            >
              Odhlásit se
            </button>
          </div>
        </header>

        {/* PROFILE SUMMARY COMPONENT */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-900/50 flex items-center justify-center border-2 border-blue-500/30">
              <span className="text-2xl font-bold text-brand-600">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "S"}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 m-0" data-testid="student-name">
                {user?.displayName || "Student"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span data-testid="student-major" className="px-2 py-0.5 bg-blue-900/30 text-brand-600 text-xs font-bold rounded-full border border-blue-500/20">
                  {user?.major || "Chybí obor"}
                </span>
                <span className="text-slate-600 text-sm">
                  {placement?.organization_name || (
                    <span className="italic">Organizace nepřiřazena</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status Smlouvy
            </span>
            {placement?.contract_url ? (
              <a
                href={placement.contract_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-500 text-sm font-medium rounded-xl border border-emerald-200 hover:bg-green-900/40 transition"
              >
                <span>📄 Stáhnout smlouvu</span>
              </a>
            ) : (
              <span className="text-sm font-medium text-amber-400/80 bg-amber-900/10 px-3 py-1.5 rounded-xl border border-amber-800/30">
                Není nahrána
              </span>
            )}
          </div>
        </div>


        <div className="grid gap-8 lg:grid-cols-3">
          {/* HLAVNÁ KARTA (STAV) */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI MATCHMAKING & SKILLS TEASER */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-slate-900 shadow-lg relative overflow-hidden">
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
                    <button className="px-6 py-2 card-glass text-brand-600 font-bold rounded-2xl shadow-md hover:bg-brand-50 transition">
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
              <div className="absolute -right-10 -bottom-20 w-64 h-64 card-glass opacity-10 rounded-full blur-3xl"></div>
            </div>

            <div className="card-glass p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-2xl">✨</span>
                Aktuální stav
              </h2>

              {/* LOGIC FLOW */}
              {!placement || placement.status === "REJECTED" ? (
                <div className="card-glass p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Žádost o schválení organizace
                  </h3>
                  <p className="text-slate-700 text-sm mb-6">
                    Než začnete s generováním smlouvy, koordinátor musí schválit
                    vámi vybranou organizaci.
                  </p>

                  {placement?.status === "REJECTED" && (
                    <div className="bg-red-900/20 card-glass text-red-400 p-4 rounded-2xl mb-6 border border-red-800/50">
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
                      <label className="block text-sm font-medium text-theme-secondary mb-1">
                        Vyberte organizaci *
                      </label>
                      <select
                        value={selectedInstitutionId}
                        onChange={(e) => {
                          setSelectedInstitutionId(e.target.value);
                          if (e.target.value !== "NEW" && e.target.value !== "") {
                            const inst = institutions.find(i => i.id === e.target.value);
                            if (inst) {
                              setOrgRequest({ ...orgRequest, name: inst.displayName || inst.email, ico: inst.ico || "", web: inst.web || "" });
                            }
                          } else {
                            setOrgRequest({ name: "", ico: "", web: "" });
                          }
                        }}
                        className="w-full bg-theme-panel border border-theme-border text-theme-primary rounded-2xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="" disabled>-- Vyberte registrovanou organizaci --</option>
                        {institutions.map(inst => (
                          <option key={inst.id} value={inst.id}>
                            {inst.displayName || inst.email} {inst.ico ? `(IČO: ${inst.ico})` : ''}
                          </option>
                        ))}
                        <option value="NEW">+ Registrovat novou instituci</option>
                      </select>
                    </div>

                    {selectedInstitutionId === "NEW" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-theme-secondary mb-1">
                            Název organizace *
                          </label>
                          <input
                            type="text"
                            value={orgRequest.name}
                            onChange={(e) =>
                              setOrgRequest({ ...orgRequest, name: e.target.value })
                            }
                            className="w-full bg-theme-panel border border-theme-border text-theme-primary rounded-2xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 placeholder-theme-muted"
                            placeholder="Např. Acme Corp s.r.o."
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-theme-secondary mb-1">
                            IČO *
                          </label>
                          <input
                            type="text"
                            value={orgRequest.ico}
                            onChange={(e) =>
                              setOrgRequest({ ...orgRequest, ico: e.target.value })
                            }
                            className="w-full bg-theme-panel border border-theme-border text-theme-primary rounded-2xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 placeholder-theme-muted"
                            placeholder="12345678"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-theme-secondary mb-1">
                            Kontaktní email společnosti *
                          </label>
                          <input
                            type="email"
                            value={orgRequest.web} // We reuse web as email for simplicity
                            onChange={(e) =>
                              setOrgRequest({ ...orgRequest, web: e.target.value })
                            }
                            className="w-full bg-theme-panel border border-theme-border text-theme-primary rounded-2xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 placeholder-theme-muted"
                            placeholder="kontakt@firma.cz"
                            required
                          />
                        </div>
                      </>
                    )}
                    <button
                      type="submit"
                      disabled={submittingOrg}
                      className="w-full py-2 bg-blue-600 text-slate-900 font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {submittingOrg ? "Odesílám..." : "Odeslat žádost"}
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  {/* PENDING APPROVAL */}
                  {placement.status === PlacementStatus.PENDING_ORG_APPROVAL && (
                    <div className="text-center py-10 bg-white card-glass rounded-2xl border border-brand-100">
                      <div className="mx-auto w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4">
                        <span className="text-xl">⏱️</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        Čeká se na schválení organizace
                      </h3>
                      <p className="text-slate-700 max-w-md mx-auto">
                        Váš požadavek na praxi v{" "}
                        <strong>{placement.organization_name}</strong> čeká na
                        schválení koordinátorem. O výsledku budete informováni.
                      </p>
                    </div>
                  )}

                  {/* ORG APPROVED - Show Upload/Generate Buttons */}
                  {placement.status === PlacementStatus.ORG_APPROVED && <UploadSection />}

                  {/* EXISTING STATUSES */}
                  {(placement.status === PlacementStatus.ANALYZING ||
                    placement.status === PlacementStatus.NEEDS_REVIEW ||
                    placement.status === PlacementStatus.APPROVED || placement.status === PlacementStatus.ACTIVE ||
                    placement.status === PlacementStatus.EVALUATION ||
                    placement.status === PlacementStatus.CLOSED) && (
                    <div className="space-y-6">
                      {/* STATUS BAR */}
                      <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200">
                        <div
                          className={`p-3 rounded-full ${
                            placement.status === PlacementStatus.ANALYZING
                              ? "bg-brand-50 text-brand-500"
                              : placement.status === PlacementStatus.APPROVED || placement.status === PlacementStatus.ACTIVE
                                ? "bg-green-800/40 text-emerald-500"
                                : placement.status === PlacementStatus.NEEDS_REVIEW
                                  ? "bg-yellow-800/40 text-yellow-400"
                                  : "bg-slate-700/50 text-slate-700"
                          }`}
                        >
                          {placement.status === PlacementStatus.ANALYZING && (
                            <span className="text-2xl">✨</span>
                          )}
                          {placement.status === PlacementStatus.APPROVED || placement.status === PlacementStatus.ACTIVE && (
                            <span className="text-sm">✨</span>
                          )}
                          {(placement.status === PlacementStatus.EVALUATION ||
                            placement.status === PlacementStatus.CLOSED) && (
                            <span className="text-sm">✨</span>
                          )}
                          {placement.status === PlacementStatus.NEEDS_REVIEW && (
                            <span className="text-2xl">🚨</span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-900">
                            {placement.status === PlacementStatus.ANALYZING &&
                              "AI zpracovává dokument..."}
                            {placement.status === PlacementStatus.NEEDS_REVIEW &&
                              "Nutná kontrola údajů"}
                            {placement.status === PlacementStatus.APPROVED || placement.status === PlacementStatus.ACTIVE &&
                              "Praxe je oficiálně schválena"}
                            {placement.status === PlacementStatus.EVALUATION &&
                              "Čeká se na hodnocení"}
                            {placement.status === PlacementStatus.CLOSED && "Praxe uzavřena"}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {placement.status === PlacementStatus.ANALYZING &&
                              "Čekejte prosím, čtu data ze smlouvy."}
                            {placement.status === PlacementStatus.NEEDS_REVIEW &&
                              "AI předvyplnila data. Prosím o vaši kontrolu níže."}
                            {placement.status === PlacementStatus.APPROVED || placement.status === PlacementStatus.ACTIVE &&
                              `Schváleno dne ${formatDateCZ(placement.approvedAt)}. E-mail odeslán firmě.`}
                            {placement.status === PlacementStatus.EVALUATION &&
                              "Napiš svou reflexi z praxe."}
                            {placement.status === PlacementStatus.CLOSED &&
                              "Tvá praxe byla úspěšně hodnocena."}
                          </p>
                        </div>
                      </div>

                      {/* FORMULÁR NA KONTROLU (Iba ak NEEDS_REVIEW) */}
                      {placement.status === PlacementStatus.NEEDS_REVIEW && (
                        <div className="bg-yellow-900/20 card-glass p-6 rounded-2xl border border-yellow-800/50">
                          <h4 className="font-bold text-yellow-300 mb-4">
                            Zkontrolujte údaje nalezené AI:
                          </h4>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1 uppercase">
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
                                className="w-full bg-white border border-yellow-700/50 text-slate-900 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none placeholder-slate-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1 uppercase">
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
                                className="w-full bg-white border border-yellow-700/50 text-slate-900 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none placeholder-slate-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1 uppercase">
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
                                className="w-full bg-white border border-yellow-700/50 text-slate-900 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none placeholder-slate-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1 uppercase">
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
                                className="w-full bg-white border border-yellow-700/50 text-slate-900 rounded p-2 focus:ring-2 focus:ring-yellow-500 outline-none placeholder-slate-500"
                              />
                            </div>
                          </div>
                          <button
                            onClick={confirmData}
                            className="w-full mt-4 bg-yellow-900/20 card-glass hover:bg-yellow-600 text-slate-900 py-3 rounded-2xl font-bold shadow-sm transition"
                          >
                            Potvrdit správnost údajů
                          </button>
                        </div>
                      )}

                      {/* SCHVÁLENÉ ÚDAJE (Iba ak APPROVED alebo EVALUATION alebo CLOSED) */}
                      {(placement.status === PlacementStatus.APPROVED || placement.status === PlacementStatus.ACTIVE ||
                        placement.status === PlacementStatus.EVALUATION ||
                        placement.status === PlacementStatus.CLOSED) && (
                        <div className="space-y-6">
                          <div className="card-glass rounded-2xl border border-slate-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <tbody className="divide-y divide-gray-200">
                                <tr>
                                  <td className="px-4 py-3 bg-white font-medium text-slate-600 w-1/3">
                                    Firma
                                  </td>
                                  <td className="px-4 py-3 text-slate-900 font-bold">
                                    {placement.organization_name}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-4 py-3 bg-white font-medium text-slate-600">
                                    IČO
                                  </td>
                                  <td className="px-4 py-3 text-slate-900 font-mono">
                                    {placement.organization_ico}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-4 py-3 bg-white font-medium text-slate-600">
                                    Termín
                                  </td>
                                  <td className="px-4 py-3 text-slate-900">
                                    {placement.start_date} —{" "}
                                    {placement.end_date}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* 3-PILLAR PRACTICE UI (Náslechy, Výstupy, Reflexe) */}
                          {(placement.status === PlacementStatus.APPROVED || placement.status === PlacementStatus.ACTIVE || placement.status === PlacementStatus.EVALUATION || placement.status === PlacementStatus.CLOSED) && (

                            <div className="mt-8 bg-white card-glass rounded-3xl overflow-hidden border border-slate-200">
                               <div className="flex border-b border-slate-200">
                                  <button onClick={() => setActiveTab('náslechy')} className={`flex-1 py-4 text-sm font-bold tracking-wider uppercase transition-colors ${activeTab === 'náslechy' ? 'bg-blue-600/20 text-brand-500 border-b-2 border-blue-500' : 'text-slate-600 hover:bg-white/5'}`}>Náslechy</button>
                                  <button onClick={() => setActiveTab('výstupy')} className={`flex-1 py-4 text-sm font-bold tracking-wider uppercase transition-colors ${activeTab === 'výstupy' ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-600 hover:bg-white/5'}`}>Výstupy</button>
                                  <button onClick={() => setActiveTab('reflexe')} className={`flex-1 py-4 text-sm font-bold tracking-wider uppercase transition-colors ${activeTab === 'reflexe' ? 'bg-purple-600/20 text-purple-400 border-b-2 border-purple-500' : 'text-slate-600 hover:bg-white/5'}`}>Reflexe</button>
                               </div>

                               <div className="p-6">
                                  {/* PILLAR 1: NÁSLECHY (LIVE TRACKER) */}
                                  {activeTab === 'náslechy' && (
                                    <div className="space-y-6">
                                      <h3 className="font-bold text-brand-500 text-lg flex items-center gap-2">
                                        <span className="text-xl">⏱️</span> Evidence hodin a náslechy
                                      </h3>

                                      <form
                                        onSubmit={handleTimeLogSubmit}
                                        className="mb-6 card-glass p-4 rounded-2xl border border-brand-100 shadow-sm"
                                      >
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                          <div>
                                            <label className="block text-xs font-bold text-blue-200 uppercase mb-1">
                                              Datum
                                            </label>
                                            <input
                                              type="date"
                                              required
                                              value={newLogDate}
                                              onChange={(e) =>
                                                setNewLogDate(e.target.value)
                                              }
                                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-slate-900 placeholder-slate-500"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-bold text-blue-200 uppercase mb-1">
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
                                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-slate-900 placeholder-slate-500"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-bold text-blue-200 uppercase mb-1">
                                              Kategorie
                                            </label>
                                            <select
                                              required
                                              value={newLogCategory}
                                              onChange={(e) => setNewLogCategory(e.target.value)}
                                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-slate-900 placeholder-slate-500"
                                            >
                                              {(placement?.major || placement?.major || user?.major) === 'UPV' ? (
                                                <>
                                                  <option value="theoretical_observations">Teoretické náslechy</option>
                                                  <option value="practical_observations">Praktické náslechy</option>
                                                </>
                                              ) : (
                                                <>
                                                  <option value="shadowing_hours">Stínování</option>
                                                  <option value="case_studies">Případové studie</option>
                                                </>
                                              )}
                                            </select>
                                          </div>

                                          <div className="md:col-span-3 relative">
                                            <label className="block text-xs font-bold text-blue-200 uppercase mb-1">
                                              Popis činnosti (Co jsi dělal/a?)
                                            </label>
                                            <div className="relative">
                                              <textarea
                                                required
                                                rows={2}
                                                value={newLogDescription}
                                                onChange={(e) =>
                                                  setNewLogDescription(e.target.value)
                                                }
                                                placeholder="Např.: Práce na backendu v Node.js..."
                                                className="w-full px-3 py-2 pr-12 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-slate-900 placeholder-slate-500"
                                              />
                                              <button
                                                type="button"
                                                onClick={handleDictation}
                                                disabled={isDictating || isEnhancing}
                                                title="Nadiktovat"
                                                className={`absolute right-2 bottom-2 p-2 rounded-xl transition-all ${
                                                    isDictating ? 'bg-red-500/20 text-red-400 animate-pulse' :
                                                    isEnhancing ? 'bg-blue-500/20 text-brand-500' :
                                                    'bg-slate-700/50 text-slate-700 hover:bg-slate-600/50'
                                                }`}
                                              >
                                                {isEnhancing ? '✨' : '🎙️'}
                                              </button>
                                            </div>
                                            {isEnhancing && <p className="text-xs text-brand-500 mt-1 flex items-center gap-1"><span>✨</span> AI upravuje gramatiku a stylistiku...</p>}
                                          </div>

                                        </div>
                                        <button
                                          type="submit"
                                          disabled={submittingLog}
                                          className="px-4 py-2 bg-blue-600 text-slate-900 rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 transition"
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
                                          <p className="text-sm text-brand-600 italic">
                                            Zatím nebyly zapsány žádné hodiny.
                                          </p>
                                        ) : (
                                          timeLogs.map((log) => (
                                            <div
                                              key={log.id}
                                              className="card-glass p-4 rounded-2xl border border-brand-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 shadow-sm"
                                            >
                                              <div>
                                                <p className="font-bold text-slate-900">
                                                  {new Date(
                                                    log.date,
                                                  ).toLocaleDateString("cs-CZ")}{" "}
                                                  <span className="text-brand-500 ml-2">
                                                    {log.hours} h
                                                  </span>
                                                </p>
                                                <p className="text-sm text-slate-600">
                                                  {log.description}
                                                </p>
                                                <p className="text-brand-500 text-xs mt-1 font-medium">
                                                  {log.category === 'theoretical_observations' && "Teoretické náslechy"}
                                                  {log.category === 'practical_observations' && "Praktické náslechy"}
                                                  {log.category === 'shadowing_hours' && "Stínování"}
                                                  {log.category === 'case_studies' && "Případové studie"}
                                                </p>
                                              </div>
                                              <div className="shrink-0">
                                                {log.status === "pending" && (
                                                  <span className="px-2 py-1 bg-yellow-800/40 text-yellow-300 text-xs font-bold rounded-full">
                                                    Čeká na schválení
                                                  </span>
                                                )}
                                                {log.status === "approved" && (
                                                  <span className="px-2 py-1 bg-green-800/40 text-emerald-900 text-xs font-bold rounded-full">
                                                    Schváleno
                                                  </span>
                                                )}
                                                {log.status === "rejected" && (
                                                  <span className="px-2 py-1 bg-red-800/40 text-red-300 text-xs font-bold rounded-full">
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

                                  {/* PILLAR 2: VÝSTUPY (MICROTEACHING RUBRICS) */}
                                  {activeTab === 'výstupy' && (
                                    <div className="space-y-6">
                                      <h3 className="font-bold text-indigo-400 text-lg flex items-center gap-2">
                                        <span className="text-xl">📊</span> Kompetenční rámec (MŠMT KRAU)
                                      </h3>
                                      <p className="text-sm text-slate-600">
                                         Hodnotící matice vychází přímo z předpisů MŠMT KRAU. Změny se ukládají automaticky.
                                      </p>

                                      <div className="space-y-4 mt-4">
                                        {systemRubricConfig ? (
                                           <div className="text-sm text-slate-100 bg-slate-800/40 p-4 rounded-xl mb-4 border border-slate-700">
                                              <p className="font-bold mb-2 text-indigo-300">{systemRubricConfig.title}</p>
                                              <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: systemRubricConfig.content?.substring(0, 300) + '...' }} />
                                           </div>
                                        ) : (
                                          <p className="text-xs text-slate-500 italic">Načítám kompetenční rámec...</p>
                                        )}

                                        {/* Domains based on generic KRAU criteria */}
                                        {systemRubricConfig?.domains ? systemRubricConfig.domains.map((domain: string, idx: number) => {
                                          const domainId = `domain_${idx + 1}`;
                                          return (
                                            <div key={domainId} className="card-glass p-4 rounded-2xl border border-indigo-800/30">
                                               <label className="block text-sm font-bold text-indigo-200 mb-2">{domain}</label>
                                               <textarea
                                                  value={rubrics[domainId]?.value || ""}
                                                  onChange={(e) => handleRubricChange(domainId, e.target.value)}
                                                  rows={3}
                                                  placeholder="Důkazy a hodnocení studenta v této oblasti..."
                                                  className="w-full p-3 bg-white text-slate-900 border border-indigo-800/50 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm placeholder-slate-600 transition"
                                               />
                                               <div className="flex justify-end mt-1">
                                                 <span className="text-[10px] text-slate-500">Automaticky se ukládá...</span>
                                               </div>
                                            </div>
                                          )
                                        }) : <p className="text-xs text-slate-500 italic">Načítám oblasti hodnocení...</p>}
                                      </div>
                                    </div>
                                  )}

                                  {/* PILLAR 3: REFLEXE A AI HODNOCENÍ */}
                                  {activeTab === 'reflexe' && (
                                     <div className="space-y-6">
                                        <div className="bg-purple-900/20 card-glass p-6 rounded-2xl border border-purple-800/50">
                                            <h3 className="font-bold text-purple-300 text-lg mb-2 flex items-center gap-2">
                                              <span className="text-2xl">✨</span>
                                              Závěrečná reflexe
                                            </h3>
                                            <p className="text-sm text-purple-400 mb-4">
                                              Aby byla vaše praxe úspěšně uzavřena, vypracujte stručnou reflexi. AI Sensei váš text vyhodnotí podle KRAU kritérií.
                                            </p>

                                            {placement.evaluationResult && !placement.evaluationResult.isPass && (
                                                <div className="bg-red-900/20 card-glass text-red-400 p-4 rounded mb-4 text-sm border border-red-800/50">
                                                  <p className="font-bold mb-2">Hodnocení AI – Reflexe nesplňuje metodiku (MŠMT KRAU)</p>
                                                  <div className="grid grid-cols-1 gap-2 mt-2">
                                                    {['didacticCompetence', 'pedagogicalCompetence', 'socialCompetence', 'reflectiveCompetence'].map((compKey) => {
                                                        const comp = placement.evaluationResult[compKey];
                                                        if (!comp) return null;
                                                        return (
                                                          <div key={compKey} className="card-glass p-3 rounded border border-red-800/30">
                                                            <span className="font-bold text-red-300">{compKey} ({comp.score}/100):</span>
                                                            <p className="text-red-400 mt-1">{comp.reasoning}</p>
                                                          </div>
                                                        )
                                                    })}
                                                  </div>
                                                </div>
                                            )}

                                            <div className="relative mb-4">
                                              <textarea
                                                value={reflectionText}
                                                onChange={(e) => setReflectionText(e.target.value)}
                                                rows={8}
                                                className="w-full p-4 pr-14 bg-white text-slate-900 border border-purple-800/50 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-sm placeholder-slate-500"
                                                placeholder="Zde napište nebo nadiktujte svou závěrečnou reflexi..."
                                              />
                                              <button
                                                onClick={toggleRecording}
                                                className={`absolute bottom-4 right-4 p-3 rounded-full transition-all shadow-lg ${isRecording ? "bg-red-600 text-slate-900 animate-pulse" : "bg-purple-600 text-slate-900 hover:bg-purple-500"}`}
                                                title="Diktovat hlasem"
                                              >
                                                {isRecording ? <span className="text-xl">🛑</span> : <span className="text-xl">🎙️</span>}
                                              </button>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3 mt-4">
                                              <button
                                                onClick={handleImproveWithAI}
                                                disabled={isCorrectingGrammar || reflectionText.trim().length === 0}
                                                className="flex-1 py-3 bg-purple-800/40 text-purple-300 rounded-xl font-bold hover:bg-purple-800/60 disabled:opacity-50 transition flex items-center justify-center gap-2"
                                              >
                                                <span className="text-xl">✨</span> {isCorrectingGrammar ? "Vylepšujem..." : "Vylepšit gramatiku (AI)"}
                                              </button>
                                              <button
                                                onClick={handleEvaluateReflection}
                                                disabled={evaluating || isCorrectingGrammar || reflectionText.trim().length === 0 || placement.status === PlacementStatus.CLOSED}
                                                className="flex-1 py-3 bg-purple-600 text-slate-900 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 transition"
                                              >
                                                {evaluating ? "Hodnocení..." : "Odeslat k hodnocení AI"}
                                              </button>
                                            </div>
                                        </div>

                                        {placement.status === PlacementStatus.CLOSED && placement.evaluationResult && (
                                            <div className="bg-emerald-50 card-glass p-6 rounded-2xl border border-emerald-200 mt-6">
                                                <h3 className="font-bold text-emerald-500 text-lg mb-2 flex items-center gap-2">
                                                    <span className="text-2xl">🏆</span> Praxe úspěšně uzavřena
                                                </h3>
                                                <p className="text-sm text-emerald-900 mb-4">Vaše reflexe byla schválena AI Senseiem.</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {['didacticCompetence', 'pedagogicalCompetence', 'socialCompetence', 'reflectiveCompetence'].map((compKey) => {
                                                        const comp = placement.evaluationResult[compKey];
                                                        if (!comp) return null;
                                                        return (
                                                          <div key={compKey} className="card-glass p-3 rounded border border-green-800/30">
                                                            <span className="font-bold text-emerald-900">{compKey} ({comp.score}/100):</span>
                                                            <p className="text-emerald-500 mt-1 italic">"{comp.reasoning}"</p>
                                                          </div>
                                                        )
                                                    })}
                                                </div>

                                                <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4 border-t border-green-800/30 pt-6">
                                                   {placement.skillMatrixUrl ? (
                                                      <a
                                                        href={placement.skillMatrixUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-green-700 text-slate-900 rounded-2xl font-bold shadow-md hover:bg-green-600 transition"
                                                      >
                                                        <span className="text-xl">📄</span> Stáhnout KRAU Matrix
                                                      </a>
                                                   ) : (
                                                      <button
                                                        onClick={handleGenerateKraumMatrix}
                                                        disabled={isGeneratingMatrix}
                                                        className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-indigo-600 text-slate-900 rounded-2xl font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 transition"
                                                      >
                                                        <span className="text-xl">⚙️</span> {isGeneratingMatrix ? 'Generuji PDF...' : 'Generovat KRAU Matrix'}
                                                      </button>
                                                   )}
                                                </div>
                                            </div>
                                        )}
                                  </div>
                                  )}
                               </div>
                            </div>

                          )}

                          {/* HODNOCENÍ PRAXE (Dostupné pro APPROVED, EVALUATION, CLOSED) */}
                          <div className="bg-purple-900/20 card-glass p-6 rounded-2xl border border-purple-800/50">
                            <h3 className="font-bold text-purple-300 text-lg mb-4 flex items-center gap-2">
                              <span className="text-2xl">✨</span>
                              Hodnocení praxe
                            </h3>

                            {placement.studentRating ? (
                              <div>
                                <p className="text-sm text-purple-400 mb-2 font-medium">
                                  Vaše hodnocení firmy:
                                </p>
                                <div className="flex items-center gap-3 mb-3">
                                  <StarRating
                                    rating={placement.studentRating}
                                    readOnly
                                  />
                                  <span className="font-bold text-purple-300">
                                    {placement.studentRating}/5
                                  </span>
                                </div>
                                {placement.studentReview && (
                                  <div className="card-glass p-3 rounded border border-purple-100 text-slate-800 text-sm italic">
                                    "{placement.studentReview}"
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-purple-400 mb-4">
                                  Jak jste byli spokojeni s průběhem praxe? Vaše
                                  zpětná vazba pomůže dalším studentům.
                                </p>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-xs font-bold text-purple-400 uppercase mb-1">
                                      Celkové hodnocení
                                    </label>
                                    <StarRating
                                      rating={studentRating}
                                      setRating={setStudentRating}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-purple-400 uppercase mb-1">
                                      Slovní hodnocení (nepovinné)
                                    </label>
                                    <textarea
                                      value={studentReview}
                                      onChange={(e) =>
                                        setStudentReview(e.target.value)
                                      }
                                      className="w-full p-3 bg-white text-slate-900 border border-purple-800/50 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-sm placeholder-slate-500"
                                      rows={3}
                                      placeholder="Popište svou zkušenost..."
                                    ></textarea>
                                  </div>
                                  <button
                                    onClick={handleRateCompany}
                                    disabled={studentRating === 0}
                                    className="px-6 py-2 bg-purple-600 text-slate-900 rounded-2xl font-bold shadow-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
            {placement && [PlacementStatus.APPROVED, PlacementStatus.ACTIVE, PlacementStatus.EVALUATION, PlacementStatus.CLOSED].includes(placement.status) && (

              <div className="card-glass p-6 rounded-3xl shadow-sm border border-slate-200 text-center">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                  Postup praxe
                </h3>
                {(() => {
                  const isUPV = (placement?.major || placement?.major || user?.major) === 'UPV';

                  const renderCircle = (label: string, total: number, target: number) => {
                    const progressPercent = Math.min(100, Math.round((total / target) * 100));
                    const circleRadius = 30;
                    const circleCircumference = 2 * Math.PI * circleRadius;
                    const strokeDashoffset = circleCircumference - (progressPercent / 100) * circleCircumference;
                    return (
                      <div className="flex flex-col items-center" key={label}>
                        <div className="relative w-20 h-20 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                            {/* Background Circle */}
                            <circle
                              className="text-slate-700"
                              strokeWidth="6"
                              stroke="currentColor"
                              fill="transparent"
                              r={circleRadius}
                              cx="40"
                              cy="40"
                            />
                            {/* Progress Circle */}
                            <circle
                              className={`${progressPercent >= 100 ? 'text-green-500' : 'text-brand-500'} transition-all duration-1000 ease-out`}
                              strokeWidth="6"
                              strokeDasharray={circleCircumference}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="transparent"
                              r={circleRadius}
                              cx="40"
                              cy="40"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-sm font-bold text-slate-900">{total}</span>
                            <span className="text-[10px] text-slate-600">/ {target} h</span>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-700 font-medium text-center leading-tight h-6">
                          {label}
                        </p>
                      </div>
                    );
                  };

                  if (isUPV) {
                    const theoreticalHours = timeLogs.filter(log => log.status === 'approved' && log.category === 'theoretical_observations').reduce((sum, log) => sum + (Number(log.hours) || 0), 0);
                    const practicalHours = timeLogs.filter(log => log.status === 'approved' && log.category === 'practical_observations').reduce((sum, log) => sum + (Number(log.hours) || 0), 0);
                    return (
                      <div className="flex justify-around gap-2">
                         {renderCircle("Teoretické náslechy", theoreticalHours, 10)}
                         {renderCircle("Praktické náslechy", practicalHours, 2)}
                      </div>
                    )
                  } else {
                    const shadowingHours = timeLogs.filter(log => log.status === 'approved' && log.category === 'shadowing_hours').reduce((sum, log) => sum + (Number(log.hours) || 0), 0);
                    const caseStudiesHours = timeLogs.filter(log => log.status === 'approved' && log.category === 'case_studies').reduce((sum, log) => sum + (Number(log.hours) || 0), 0);
                     return (
                      <div className="flex justify-around gap-2">
                         {renderCircle("Stínování", shadowingHours, 20)}
                         {renderCircle("Případové studie", caseStudiesHours, 10)}
                      </div>
                    )
                  }
                })()}
              </div>

            )}

            {/* QR Kód pro mentora */}
            {placement && placement.status !== PlacementStatus.PENDING_ORG_APPROVAL && placement.status !== PlacementStatus.REJECTED && (
              <div className="card-glass p-6 rounded-3xl shadow-sm border border-slate-200 text-center">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                  QR kód pro mentora
                </h3>
                <p className="text-xs text-slate-600 mb-4">
                  Mentor může naskenovat tento kód ve svém rozhraní pro rychlý přístup k vaší praxi.
                </p>
                <div className="flex justify-center p-4 card-glass border-2 border-dashed border-slate-200 rounded-3xl">
                  <QRCode value={placement.id} size={150} />
                </div>
              </div>
            )}

            {/* Dokument Karta */}
            {user?.major !== 'UPV' && (
              <div className="card-glass p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                  Dokumentace
                </h3>
                {placement && placement.contract_url ? (
                  <div>
                    <div className="flex items-center gap-3 p-3 bg-white card-glass rounded-2xl mb-4">
                      <span className="text-2xl">📄</span>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {placement.fileName}
                        </p>
                        <p className="text-xs text-slate-600">
                          Nahráno: {formatDateCZ(placement.createdAt)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={placement.contract_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full text-center py-2 border border-blue-800/50 text-brand-500 rounded-2xl hover:bg-brand-50 text-sm font-medium transition mb-4"
                    >
                      Stáhnout originál
                    </a>
                    {((placement?.major || placement?.major || user?.major) === "KPV") && (
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
                  <p className="text-sm text-slate-600 italic">
                    {placement?.status === PlacementStatus.PENDING_ORG_APPROVAL
                      ? "Čeká se na schválení firmy."
                      : placement?.status === PlacementStatus.ORG_APPROVED
                        ? "Čeká se na nahrání smlouvy."
                        : "Žádný dokument nebyl nahrán."}
                  </p>
                )}
              </div>
            )}

            {/* Interactive Traffic Light (Semafor) & Contextual Manual */}
            <div className="card card-gradient mb-6">
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-6 text-center">
                Stav praxe & Další kroky
              </h3>

              {(() => {
                const hasMajor = user?.major || user?.major;
                const pStatus = placement?.status;

                // Determine State
                let lightState = "RED"; // Default fallback
                if (!hasMajor || !placement || pStatus === PlacementStatus.REJECTED) {
                  lightState = "RED";
                } else if ([PlacementStatus.PENDING_ORG_APPROVAL, PlacementStatus.ORG_APPROVED, PlacementStatus.ANALYZING, PlacementStatus.NEEDS_REVIEW].includes(pStatus)) {
                  lightState = "YELLOW";
                } else if ([PlacementStatus.APPROVED, PlacementStatus.ACTIVE, PlacementStatus.EVALUATION, PlacementStatus.CLOSED].includes(pStatus)) {
                  lightState = "GREEN";
                }

                // Determine Manual Text
                let manualText = "Vyberte si obor pro zahájení procesu.";
                if (lightState === "RED" && hasMajor) {
                  manualText = pStatus === PlacementStatus.REJECTED ? "Vaše praxe byla zamítnuta. Podat nový návrh." : "Vyplňte žádost o schválení firmy a začněte svou praxi.";
                } else if (lightState === "YELLOW") {
                   if (pStatus === PlacementStatus.PENDING_ORG_APPROVAL) manualText = "Čeká se na schválení organizace firmou nebo koordinátorem.";
                   if (hasMajor === "UPV" && pStatus === PlacementStatus.ORG_APPROVED) manualText = "Organizace schválena! Můžete začít logovat hodiny."; // defensive fallback
                   else if (pStatus === PlacementStatus.ORG_APPROVED) manualText = "Organizace schválena! Vaším dalším krokem je vygenerovat a nahrát smlouvu.";
                   if ([PlacementStatus.ANALYZING, PlacementStatus.NEEDS_REVIEW].includes(pStatus)) manualText = "Smlouva se kontroluje. Čeká se na finální schválení koordinátorem.";
                } else if (lightState === "GREEN") {
                   if ([PlacementStatus.APPROVED, PlacementStatus.ACTIVE].includes(pStatus)) manualText = "Praxe schválena! Nyní můžete začít logovat své hodiny a náslechy.";
                   if (pStatus === PlacementStatus.EVALUATION) manualText = "Vyplňte a vyhodnoťte svou závěrečnou reflexi.";
                   if (pStatus === PlacementStatus.CLOSED) manualText = "Praxe úspěšně ukončena. Skvělá práce!";
                }

                // Click Actions
                const handleLightClick = (color: string) => {
                  if (color === "RED" && lightState === "RED") {
                     if (!hasMajor) router.push("/onboarding");
                     else document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth" });
                  } else if (color === "YELLOW" && lightState === "YELLOW") {
                     document.getElementById("upload-section")?.scrollIntoView({ behavior: "smooth" });
                  } else if (color === "GREEN" && lightState === "GREEN") {
                     document.getElementById("hours-section")?.scrollIntoView({ behavior: "smooth" });
                  }
                };

                return (
                  <div className="flex flex-col items-center">
                    {/* The Traffic Light Box */}
                    <div className="bg-slate-900 border-4 border-slate-700 p-4 rounded-[40px] flex md:flex-row flex-col gap-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                      {/* Red Light */}
                      <button
                        onClick={() => handleLightClick("RED")}
                        className={`w-16 h-16 rounded-full border-4 transition-all duration-300 shadow-inner ${
                          lightState === "RED"
                            ? "bg-red-500 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.6)] cursor-pointer hover:scale-105"
                            : "bg-red-950 border-red-900 opacity-50 cursor-default"
                        }`}
                        aria-label="Onboarding incomplete"
                      />
                      {/* Yellow Light */}
                      <button
                        onClick={() => handleLightClick("YELLOW")}
                        className={`w-16 h-16 rounded-full border-4 transition-all duration-300 shadow-inner ${
                          lightState === "YELLOW"
                            ? "bg-yellow-400 border-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.6)] cursor-pointer hover:scale-105"
                            : "bg-yellow-950 border-yellow-900 opacity-50 cursor-default"
                        }`}
                        aria-label="Pending approval"
                      />
                      {/* Green Light */}
                      <button
                        onClick={() => handleLightClick("GREEN")}
                        className={`w-16 h-16 rounded-full border-4 transition-all duration-300 shadow-inner ${
                          lightState === "GREEN"
                            ? "bg-green-500 border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.6)] cursor-pointer hover:scale-105"
                            : "bg-green-950 border-green-900 opacity-50 cursor-default"
                        }`}
                        aria-label="Active"
                      />
                    </div>

                    {/* Contextual Manual (Next Step) */}
                    <div className="mt-8 p-5 bg-white rounded-2xl border border-blue-500/30 text-center max-w-md w-full shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                      <span className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-2 flex items-center justify-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Aktuální úkol
                      </span>
                      <p className="text-sm font-medium text-slate-800 mt-1">
                        {manualText}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
