'use client';

import React, { useState } from 'react';
import { httpsCallable } from "firebase/functions";
import { functions, auth, db } from "../../../lib/firebase"; // adjust path if needed
import { useRouter } from "next/navigation";
import { addDoc, collection, query, where, getDocs, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import axios from "axios";

export default function GenerateContractPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    studentName: "",
    companyName: "",
    ico: "",
    startDate: "",
    endDate: "",
    position: ""
  });
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [internshipId, setInternshipId] = useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Fetch existing approved internship
        const q = query(
            collection(db, "internships"),
            where("studentId", "==", currentUser.uid),
            where("status", "==", "ORG_APPROVED"),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docData = snapshot.docs[0].data();
            setInternshipId(snapshot.docs[0].id);
            setFormData(prev => ({
                ...prev,
                companyName: docData.organization_name || "",
                ico: docData.organization_ico || "",
                studentName: currentUser.displayName || currentUser.email || ""
            }));
        } else {
             // Optional: Redirect or warn if no ORG_APPROVED internship found
             // But maybe they want to generate it anyway? Requirement says "Pre-fill Data ... fetch the current user's internship"
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      const token = await auth.currentUser.getIdToken();
      // Using axios to call the HTTP function directly to support CORS handling
      // Note: We need the function URL. Assuming standard Firebase structure:
      // https://<region>-<project-id>.cloudfunctions.net/generateContractPDF
      // or using a relative path if rewritten.
      // Since we don't have the exact URL handy in env, we construct it or use a relative path if served from same domain (unlikely for dev).
      // We will try to rely on the firebase config 'projectId' if available or hardcode based on known project id 'praxihub-app'.

      // Dynamically get project ID from the initialized auth instance
      const projectId = auth.app.options.projectId;
      const region = 'us-central1'; // Default region for Firebase Functions

      if (!projectId) {
         throw new Error("Firebase Project ID not found in configuration.");
      }

      const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/generateContractPDF`;

      const response = await axios.post(functionUrl, {
        data: {
          ...formData,
          studentName: formData.studentName || auth.currentUser.displayName || auth.currentUser.email
        }
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const { downloadURL, fileName } = response.data.data;
      setGeneratedUrl(downloadURL);

      if (internshipId) {
        // UPDATE existing document
        const docRef = doc(db, "internships", internshipId);
        await updateDoc(docRef, {
            contract_url: downloadURL,
            fileName: fileName,
            start_date: formData.startDate,
            end_date: formData.endDate,
            status: "NEEDS_REVIEW",
            generated: true
        });
      } else {
         // Fallback if no internship found (should we allow this? Requirements imply updating existing)
         // But let's keep addDoc as fallback or just create new if not found
         await addDoc(collection(db, "internships"), {
            studentId: auth.currentUser.uid,
            studentEmail: auth.currentUser.email,
            studentName: formData.studentName || auth.currentUser.displayName,
            contract_url: downloadURL,
            fileName: fileName,
            organization_name: formData.companyName,
            organization_ico: formData.ico,
            start_date: formData.startDate,
            end_date: formData.endDate,
            status: "NEEDS_REVIEW",
            createdAt: new Date().toISOString(),
            generated: true
         });
      }

      alert("Smlouva byla vygenerována a uložena!");

    } catch (error) {
      console.error("Error generating contract:", error);
      alert("Chyba při generování smlouvy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Generovat Smlouvu</h1>

        {!generatedUrl ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Jméno studenta</label>
              <input
                type="text"
                name="studentName"
                value={formData.studentName}
                onChange={handleChange}
                placeholder="Zadejte své jméno"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Název společnosti</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 ${internshipId ? 'bg-gray-100' : ''}`}
                required
                readOnly={!!internshipId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">IČO</label>
              <input
                type="text"
                name="ico"
                value={formData.ico}
                onChange={handleChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 ${internshipId ? 'bg-gray-100' : ''}`}
                required
                readOnly={!!internshipId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Pozice</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="např. IT Stážista"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Datum od</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Datum do</label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                  required
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between">
               <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Zpět
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? "Generuji..." : "Generovat a Uložit"}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8">
            <div className="mb-4 text-green-600 font-bold text-xl">Smlouva úspěšně vygenerována!</div>
            <p className="mb-6 text-gray-600">Smlouva byla uložena do vašeho dashboardu.</p>
            <div className="flex justify-center gap-4">
               <a
                 href={generatedUrl}
                 target="_blank"
                 rel="noreferrer"
                 className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
               >
                 Stáhnout PDF
               </a>
               <button
                 onClick={() => router.push('/student/dashboard')}
                 className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition"
               >
                 Zpět na Dashboard
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
