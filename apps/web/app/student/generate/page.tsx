'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { db, auth, functions, storage } from "../../../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft, Check, FileText, Download } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";

export default function GenerateContractPage() {
  const router = useRouter();
  const { user: unifiedUser, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    studentName: "",
    companyName: "",
    ico: "",
    startDate: "",
    endDate: "",
    position: "",
    contactEmail: ""
  });
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [placementId, setPlacementId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | "NEW">("");

  useEffect(() => {
    if (authLoading) return;

    if (!unifiedUser) {
      router.push("/login");
      setIsReady(true);
      return;
    }

    const fetchData = async () => {
      try {
        const instQ = query(collection(db, "users"), where("role", "==", "institution"));
        const instSnap = await getDocs(instQ);
        setInstitutions(instSnap.docs.map(d => ({ id: d.id, ...d.data() as any })));

        // Fetch existing approved placement
        const q = query(
            collection(db, "placements"),
            where("studentId", "==", unifiedUser.uid),
            where("status", "==", "ORG_APPROVED"),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docData = snapshot.docs[0].data();
            setPlacementId(snapshot.docs[0].id);
            setFormData(prev => ({
                ...prev,
                companyName: docData.organization_name || "",
                ico: docData.organization_ico || "",
                studentName: unifiedUser.displayName || unifiedUser.email || ""
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                studentName: unifiedUser.displayName || unifiedUser.email || ""
            }));
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsReady(true);
      }
    };

    fetchData();
  }, [unifiedUser, authLoading, router]);

  // Load draft data
  useEffect(() => {
    if (!isReady || !unifiedUser) return;
    const draft = localStorage.getItem(`generate_contract_draft_${unifiedUser.uid}`);
    if (draft && !placementId) { // Only load draft if we don't have pre-filled data from a placement
      try {
        const parsed = JSON.parse(draft);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {}
    }
  }, [isReady, placementId, unifiedUser]);

  // Save draft data
  useEffect(() => {
    if (isReady && !generatedUrl && unifiedUser) {
      localStorage.setItem(`generate_contract_draft_${unifiedUser.uid}`, JSON.stringify(formData));
    }
  }, [formData, isReady, generatedUrl, unifiedUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unifiedUser) return;
    setLoading(true);

    try {
      // 1. Fetch Font
      const fontRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf');
      if (!fontRes.ok) throw new Error("Failed to fetch font: " + fontRes.statusText);
      const fontBytes = await fontRes.arrayBuffer();

      // 2. PDF Creation
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const customFont = await pdfDoc.embedFont(fontBytes);
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size

      page.drawText('Smlouva o odborné praxi', { x: 50, y: 750, size: 24, font: customFont });
      page.drawText(`Student: ${formData.studentName}`, { x: 50, y: 700, size: 12, font: customFont });
      page.drawText(`Společnost: ${formData.companyName} (IČO: ${formData.ico})`, { x: 50, y: 670, size: 12, font: customFont });
      page.drawText(`Pozice: ${formData.position}`, { x: 50, y: 640, size: 12, font: customFont });
      page.drawText(`Termín: od ${formData.startDate} do ${formData.endDate}`, { x: 50, y: 610, size: 12, font: customFont });

      const pdfBytes = await pdfDoc.save();

      // 3. Upload to Storage
      const fileName = `contracts/${unifiedUser.uid}_${Date.now()}.pdf`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, pdfBytes);
      const downloadURL = await getDownloadURL(storageRef);

      // 4. Update Firestore
      let instId = selectedInstitutionId;

      if (!placementId && selectedInstitutionId === "NEW") {
        const newInstRef = await addDoc(collection(db, "users"), {
          role: "institution",
          displayName: formData.companyName,
          email: formData.contactEmail,
          ico: formData.ico,
          status: "PENDING_INVITE",
          createdAt: new Date().toISOString()
        });
        instId = newInstRef.id;
      }

      if (placementId) {
          await updateDoc(doc(db, "placements", placementId), {
             contractUrl: downloadURL,
             status: "PENDING_COORDINATOR",
             updatedAt: new Date().toISOString()
          });
      } else {
         await addDoc(collection(db, "placements"), {
             studentId: unifiedUser.uid,
             institutionId: instId !== "NEW" && instId ? instId : null,
             organization_name: formData.companyName,
             organization_ico: formData.ico,
             ico: formData.ico,
             position: formData.position,
             startDate: formData.startDate,
             endDate: formData.endDate,
             contractUrl: downloadURL,
             status: "DRAFT", // Must be DRAFT or PENDING_ORG_APPROVAL
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString()
         });
      }

      setGeneratedUrl(downloadURL);
      if (unifiedUser) {
        localStorage.removeItem(`generate_contract_draft_${unifiedUser.uid}`);
      }
      toast.success("Smlouva byla úspěšně vygenerována!");

    } catch (error) {
      console.error("Error generating contract:", error);
      toast.error("Chyba při generování smlouvy: " + (error instanceof Error ? error.message : "Neznámá chyba"));
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.studentName) {
        toast.error("Prosím vyplňte všechna povinná pole v tomto kroku.");
        return;
      }

      if (!placementId && (selectedInstitutionId === "NEW" || selectedInstitutionId === "")) {
        if (!formData.companyName || !formData.ico || !formData.contactEmail) {
          toast.error("Prosím vyplňte všechna povinná pole v tomto kroku.");
          return;
        }
      }
    }
    if (step === 2 && (!formData.position || !formData.startDate || !formData.endDate)) {
        toast.error("Prosím vyplňte všechna povinná pole v tomto kroku.");
        return;
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  if (!isReady) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {!generatedUrl && (
          <div className="h-1 w-full bg-slate-100">
             <motion.div
               className="h-full bg-blue-600"
               initial={{ width: "33%" }}
               animate={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
               transition={{ duration: 0.3 }}
             />
          </div>
        )}

        <div className="p-8 md:p-10">
          <div className="text-center mb-8">
             <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-sm">
               <FileText className="w-6 h-6" />
             </div>
             <h1 className="text-2xl font-bold text-slate-900">Generování smlouvy</h1>
             {!generatedUrl && <p className="text-slate-500 mt-2">Krok {step} ze 3</p>}
          </div>

          {!generatedUrl ? (
            <form onSubmit={step === 3 ? handleGenerate : (e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Jméno studenta</label>
                      <input
                        type="text"
                        name="studentName"
                        value={formData.studentName}
                        onChange={handleChange}
                        placeholder="Zadejte své jméno"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition opacity-70 cursor-not-allowed dark:bg-slate-800 dark:text-white dark:border-slate-700"
                        required
                        readOnly
                      />
                    </div>
                    {!placementId ? (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Vyberte společnost</label>
                        <select
                          value={selectedInstitutionId}
                          onChange={(e) => {
                            setSelectedInstitutionId(e.target.value);
                            if (e.target.value !== "NEW" && e.target.value !== "") {
                              const inst = institutions.find(i => i.id === e.target.value);
                              if (inst) {
                                setFormData({ ...formData, companyName: inst.displayName || inst.email, ico: inst.ico || "" });
                              }
                            } else {
                              setFormData({ ...formData, companyName: "", ico: "", contactEmail: "" });
                            }
                          }}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition"
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
                    ) : null}

                    {(!placementId && selectedInstitutionId === "NEW") || placementId ? (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Název společnosti</label>
                          <input
                            type="text"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleChange}
                            className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition ${placementId ? 'opacity-70 cursor-not-allowed' : ''}`}
                            required
                            readOnly={!!placementId}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">IČO</label>
                          <input
                            type="text"
                            name="ico"
                            value={formData.ico}
                            onChange={handleChange}
                            className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition ${placementId ? 'opacity-70 cursor-not-allowed' : ''}`}
                            required
                            readOnly={!!placementId}
                          />
                        </div>
                        {!placementId && (
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Kontaktní email společnosti *</label>
                            <input
                              type="email"
                              name="contactEmail"
                              value={formData.contactEmail}
                              onChange={handleChange}
                              className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition`}
                              required
                            />
                          </div>
                        )}
                      </>
                    ) : null}
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Pozice</label>
                      <input
                        type="text"
                        name="position"
                        value={formData.position}
                        onChange={handleChange}
                        placeholder="např. IT Stážista"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition dark:bg-slate-800 dark:text-white dark:border-slate-700"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Datum od</label>
                        <input
                          type="date"
                          name="startDate"
                          value={formData.startDate}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition dark:bg-slate-800 dark:text-white dark:border-slate-700"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Datum do</label>
                        <input
                          type="date"
                          name="endDate"
                          value={formData.endDate}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition dark:bg-slate-800 dark:text-white dark:border-slate-700"
                          required
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                     <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 space-y-3">
                       <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">Shrnutí údajů</h3>
                       <div className="grid grid-cols-2 gap-y-2 text-sm">
                         <span className="text-slate-500">Student:</span>
                         <span className="font-medium text-slate-900">{formData.studentName}</span>
                         <span className="text-slate-500">Společnost:</span>
                         <span className="font-medium text-slate-900">{formData.companyName}</span>
                         <span className="text-slate-500">IČO:</span>
                         <span className="font-medium text-slate-900">{formData.ico}</span>
                         <span className="text-slate-500">Pozice:</span>
                         <span className="font-medium text-slate-900">{formData.position}</span>
                         <span className="text-slate-500">Termín:</span>
                         <span className="font-medium text-slate-900">{formData.startDate} - {formData.endDate}</span>
                       </div>
                     </div>
                     <p className="text-sm text-slate-600 text-center">Zkontrolujte prosím údaje výše. Pokud jsou v pořádku, klikněte na "Generovat smlouvu".</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3 pt-6 border-t border-slate-100">
                 {step > 1 && (
                   <button
                     type="button"
                     onClick={prevStep}
                     className="px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition flex items-center justify-center"
                   >
                     <ArrowLeft className="w-5 h-5" />
                   </button>
                 )}
                 {step < 3 ? (
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
                     {loading ? "Generuji..." : <>Generovat smlouvu <Check className="w-5 h-5" /></>}
                   </button>
                 )}
              </div>
            </form>
          ) : (
            <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="text-center py-4"
            >
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Check className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Smlouva je připravena!</h2>
              <p className="mb-8 text-slate-600">Vaše smlouva byla úspěšně vygenerována a odeslána ke schválení koordinátorovi.</p>

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                 <a
                   href={generatedUrl}
                   target="_blank"
                   rel="noreferrer"
                   className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition"
                 >
                   <Download className="w-5 h-5" /> Stáhnout PDF
                 </a>
                 <button
                   onClick={() => router.push('/student/dashboard')}
                   className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition"
                 >
                   Zpět na Dashboard
                 </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
