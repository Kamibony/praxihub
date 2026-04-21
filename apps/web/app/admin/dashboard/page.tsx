"use client";

import React, { useEffect, useState } from "react";
import { db, auth, functions } from "../../../lib/firebase";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Chatbot from "@/components/Chatbot";
import ContractSignature from "@/components/ContractSignature";
import { Download, Upload, FileText, Trash2, Database } from "lucide-react";
import {
  ref,
  uploadBytes,
  listAll,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../../../lib/firebase";

// Define filter type
type FilterStatus =
  | "ALL"
  | "PENDING_MATCH"
  | "PENDING_INSTITUTION"
  | "PENDING_COORDINATOR"
  | "APPROVED"
  | "ACTIVE"
  | "EVALUATION"
  | "CLOSED";

export default function CoordinatorDashboard() {
  const [placements, setPlacements] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [matchmakingOrgId, setMatchmakingOrgId] = useState<string>("");
  const [linkingPlacementId, setLinkingPlacementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [selectedPlacement, setSelectedPlacement] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  // View mode state
  const [viewMode, setViewMode] = useState<
    "PLACEMENTS" | "DOCUMENTS" | "COMPLIANCE" | "PAYROLL" | "COMMISSIONS"
  >("PLACEMENTS");

  // Commissions state
  const [commissions, setCommissions] = useState<any[]>([]);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  const [generatingDecree, setGeneratingDecree] = useState(false);
  const [selectedGuarantors, setSelectedGuarantors] = useState<{
    [key: string]: string;
  }>({});

  // Institutions (Compliance) state
  const [institutions, setInstitutions] = useState<any[]>([]);

  // Global Documents state
  const [globalDocs, setGlobalDocs] = useState<
    { name: string; url: string; path: string }[]
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const router = useRouter();

  // OPRAVA: Bezpečný useEffect s cleanup logikou
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubOrgs = onSnapshot(query(collection(db, "organizations")), (snap) => {
          setOrganizations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // 1. Vyčistiť predchádzajúci listener
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (!user) {
        router.push("/login");
      } else {
        const q = query(
          collection(db, "placements"),
          orderBy("createdAt", "desc"),
        );

        // 2. Nastaviť nový listener a uložiť funkciu
        unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setPlacements(data);
          setLoading(false);
        });
      }
    });

    // 3. Cleanup pri unmount
    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [router]);

  // Load Global Documents and Institutions
  useEffect(() => {
    if (viewMode === "DOCUMENTS") {
      fetchGlobalDocs();
    }
    if (viewMode === "COMPLIANCE") {
      // Setup listener for institutions
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const insts = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((u: any) => u.role === "institution");
        setInstitutions(insts);
      });
      return () => unsubscribe();
    }
    if (viewMode === "COMMISSIONS") {
      const commQ = query(
        collection(db, "commissions"),
        orderBy("createdAt", "desc"),
      );
      const unsubscribeComm = onSnapshot(commQ, (snapshot) => {
        const comms = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCommissions(comms);
      });

      const userQ = query(collection(db, "users"));
      const unsubscribeUsers = onSnapshot(userQ, (snapshot) => {
        const guarantorsList = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((u: any) => u.role === "coordinator" || u.role === "admin"); // Or specifically guarantors if there is a field
        setGuarantors(guarantorsList);
      });

      return () => {
        unsubscribeComm();
        unsubscribeUsers();
      };
    }
  }, [viewMode]);

  const fetchGlobalDocs = async () => {
    setLoadingDocs(true);
    try {
      const listRef = ref(storage, "global_documents");
      const res = await listAll(listRef);
      const docs = await Promise.all(
        res.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          return {
            name: itemRef.name,
            url,
            path: itemRef.fullPath,
          };
        }),
      );
      setGlobalDocs(docs);
    } catch (error) {
      console.error("Error fetching global docs:", error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleGlobalDocUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const storageRef = ref(storage, `global_documents/${file.name}`);
      await uploadBytes(storageRef, file);
      alert("Dokument úspěšně nahrán.");
      fetchGlobalDocs();
    } catch (error) {
      console.error("Upload failed", error);
      alert("Chyba při nahrávání dokumentu.");
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  };

  const handleGlobalDocDelete = async (path: string) => {
    if (!confirm("Opravdu chcete smazat tento dokument?")) return;
    try {
      const docRef = ref(storage, path);
      await deleteObject(docRef);
      alert("Dokument byl smazán.");
      fetchGlobalDocs();
    } catch (error) {
      console.error("Delete failed", error);
      alert("Chyba při mazání dokumentu.");
    }
  };

  const getCompanyAverageRating = (ico: string) => {
    if (!ico) return null;
    const companyPlacements = placements.filter(
      (i) => i.organization_ico === ico && i.studentRating > 0,
    );
    if (companyPlacements.length === 0) return null;
    const sum = companyPlacements.reduce(
      (acc, curr) => acc + curr.studentRating,
      0,
    );
    return (sum / companyPlacements.length).toFixed(1);
  };

  // OPRAVA: Pridaná funkcia pre formátovanie dátumu (D. M. YYYY)
  const formatDateCZ = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Data = (event.target?.result as string).split(",")[1];
          const importRoster = httpsCallable(functions, "importRoster");

          const response = await importRoster({ fileData: base64Data });
          const data = response.data as {
            added: number;
            updated: number;
            ignored: number;
          };

          setUploadResult({
            success: true,
            message: `Úspěšně importováno. Přidáno/Aktualizováno: ${data.added + data.updated}, Ignorováno (chyby): ${data.ignored}.`,
          });
        } catch (err: any) {
          console.error("Import error:", err);
          setUploadResult({
            success: false,
            message: `Chyba při importu: ${err.message}`,
          });
        } finally {
          setUploading(false);
          // Reset file input
          e.target.value = "";
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("File reading error:", err);
      setUploadResult({
        success: false,
        message: `Chyba při čtení souboru: ${err.message}`,
      });
      setUploading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "Student Name",
      "Email",
      "Organization",
      "ICO",
      "Status",
      "Start Date",
      "End Date",
    ];
    const csvContent = [
      headers.join(","),
      ...placements.map((item) =>
        [
          `"${item.studentName || ""}"`,
          `"${item.studentEmail || ""}"`,
          `"${item.organization_name || ""}"`,
          `"${item.organization_ico || ""}"`,
          `"${item.status || ""}"`,
          `"${item.start_date ? formatDateCZ(item.start_date) : ""}"`,
          `"${item.end_date ? formatDateCZ(item.end_date) : ""}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "praxe_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [exportingPayroll, setExportingPayroll] = useState(false);

  const handleGenerateDecree = async (
    commissionId: string,
    guarantorId: string,
    guarantorName: string,
  ) => {
    try {
      setGeneratingDecree(true);
      const generateCommissionDecree = httpsCallable(
        functions,
        "generateCommissionDecree",
      );
      await generateCommissionDecree({
        commissionId,
        guarantorId,
        guarantorName,
      });
      alert("Dekret byl úspěšně vygenerován.");
    } catch (error: any) {
      console.error("Error generating decree:", error);
      alert(`Chyba při generování dekretu: ${error.message}`);
    } finally {
      setGeneratingDecree(false);
    }
  };

  const promoteToFinalExam = async (placementId: string) => {
    try {
      const transitionPlacementState = httpsCallable(
        functions,
        "transitionPlacementState",
      );
      await transitionPlacementState({ placementId, newState: "FINAL_EXAM" });
      alert("Praxe byla úspěšně posunuta do fáze Státnic (FINAL_EXAM).");
    } catch (error: any) {
      console.error("Error promoting to final exam:", error);
      alert(`Chyba při posunu do FINAL_EXAM: ${error.message}`);
    }
  };

  const handlePayrollExport = async () => {
    setExportingPayroll(true);
    try {
      const generatePayrollReport = httpsCallable(
        functions,
        "generatePayrollReport",
      );
      const result = await generatePayrollReport();
      const data = result.data as {
        mentorName: string;
        mentorId: string;
        organizationName: string;
        organizationId: string;
        totalHours: number;
      }[];

      const headers = [
        "Jméno mentora",
        "ID mentora",
        "Organizace",
        "ID organizace",
        "Celkový počet schválených hodin",
      ];
      const csvContent = [
        headers.join(","),
        ...data.map((item) =>
          [
            `"${item.mentorName || ""}"`,
            `"${item.mentorId || ""}"`,
            `"${item.organizationName || ""}"`,
            `"${item.organizationId || ""}"`,
            `"${item.totalHours || 0}"`,
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "mzdove_vykazy.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Chyba při exportu mzdových výkazů:", error);
      alert("Nepodařilo se exportovat mzdové výkazy.");
    } finally {
      setExportingPayroll(false);
    }
  };

  const updateFrameworkAgreement = async (
    institutionId: string,
    dateStr: string,
  ) => {
    try {
      const userRef = doc(db, "users", institutionId);
      await updateDoc(userRef, {
        frameworkAgreementExpiration: dateStr,
      });
    } catch (error) {
      console.error("Error updating framework agreement:", error);
      alert("Nepodařilo se aktualizovat datum expirace.");
    }
  };

  // Actions for Organization Approval

  const handleMatchPlacement = async (placementId: string) => {
    if (!matchmakingOrgId) {
      alert("Vyberte organizaci pro propojení.");
      return;
    }
    try {
      const placementRef = doc(db, "placements", placementId);
      await updateDoc(placementRef, {
        organizationId: matchmakingOrgId,
        status: "PENDING_INSTITUTION",
        updatedAt: new Date().toISOString()
      });
      alert("Praxe úspěšně propojena s organizací.");
      setLinkingPlacementId(null);
      setMatchmakingOrgId("");
    } catch (error) {
      console.error("Chyba při propojování:", error);
      alert("Nepodařilo se propojit praxi.");
    }
  };


  const handleApproveOrg = async (id: string) => {
    if (!confirm("Opravdu chcete schválit tuto firmu?")) return;
    try {
      const transitionPlacementState = httpsCallable(
        functions,
        "transitionPlacementState",
      );
      await transitionPlacementState({
        placementId: id,
        newState: "ORG_APPROVED",
      });
    } catch (e) {
      console.error("Error approving org:", e);
      alert("Chyba při schvalování.");
    }
  };

  const handleRejectOrg = async (id: string) => {
    const reason = prompt("Zadejte důvod zamítnutí:");
    if (reason === null) return; // Cancelled
    try {
      await updateDoc(doc(db, "placements", id), { ai_error_message: reason });
      const transitionPlacementState = httpsCallable(
        functions,
        "transitionPlacementState",
      );
      await transitionPlacementState({
        placementId: id,
        newState: "REJECTED",
      });
    } catch (e) {
      console.error("Error rejecting org:", e);
      alert("Chyba při zamítání.");
    }
  };

  // Filter Logic
  const filteredPlacements = placements.filter((item) => {
    if (filterStatus === "ALL") return true;
    return item.status === filterStatus;
  });

  const getCardClasses = (status: FilterStatus) => {
    const isActive = filterStatus === status;
    return `bg-white p-4 rounded-lg shadow-sm border cursor-pointer transition-all duration-200 ${
      isActive
        ? "border-blue-500 ring-2 ring-blue-100 transform scale-[1.02]"
        : "border-gray-100 hover:border-blue-300 hover:shadow-md"
    }`;
  };

  const pendingOrgs = placements.filter((i) => i.status === "PENDING_MATCH").length;
  const pendingReview = placements.filter(
    (i) => i.status === "NEEDS_REVIEW",
  ).length;
  const chatbotMessage = `Vítej zpět! Aktuálně máš ke schválení ${pendingOrgs} firem a ${pendingReview} smluv čeká na kontrolu.`;

  // Statistics for Overview Section
  const approvedCount = placements.filter(
    (i) => i.status === "APPROVED" || i.status === "ACTIVE", "ACTIVE",
  ).length;
  const totalCount = placements.length;
  const progressPercentage =
    totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  const companyCounts: Record<string, number> = {};
  placements.forEach((i) => {
    if (i.organization_name) {
      companyCounts[i.organization_name] =
        (companyCounts[i.organization_name] || 0) + 1;
    }
  });
  const topPartners = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Compliance Alerts logic
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const complianceAlerts = institutions.filter((inst) => {
    if (!inst.frameworkAgreementExpiration) return true; // Missing date = alert
    const expDate = new Date(inst.frameworkAgreementExpiration);
    return expDate <= thirtyDaysFromNow; // Expired or expiring within 30 days
  });

  if (loading)
    return <div className="p-8 text-center text-gray-500">Načítám data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <Chatbot initialMessage={chatbotMessage} />
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Centrální přehled praxí
            </h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Manažment a monitoring všech smluv a dokumentů
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
            <button
              onClick={() => router.push("/admin/documents")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded font-bold shadow hover:bg-indigo-700 transition text-sm"
            >
              <Database size={16} />
              Centrum dokumentů
            </button>
            <span className="text-sm text-gray-500 hidden md:inline">
              Přihlášen jako: Koordinátor
            </span>

            <label
              className={`flex items-center gap-2 text-sm px-4 py-2 border rounded transition-colors cursor-pointer ${uploading ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"}`}
            >
              <Upload size={16} />
              {uploading ? "Nahrávám..." : "Importovat Roster"}
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <Download size={16} />
              Exportovat CSV
            </button>
            <button
              onClick={() => auth.signOut()}
              className="text-sm px-4 py-3 md:py-2 bg-white border border-gray-300 rounded-lg md:rounded hover:bg-gray-50 text-gray-700 transition-colors w-full md:w-auto"
            >
              Odhlásit
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setViewMode("PLACEMENTS")}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${viewMode === "PLACEMENTS" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >
            Přehled praxí
          </button>
          <button
            onClick={() => setViewMode("DOCUMENTS")}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === "DOCUMENTS" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >
            <FileText size={16} />
            Globální Dokumenty
          </button>
          <button
            onClick={() => setViewMode("COMPLIANCE")}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === "COMPLIANCE" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >
            Spolupracující instituce
          </button>
          <button
            onClick={() => setViewMode("PAYROLL")}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === "PAYROLL" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >
            Vyúčtování / Payroll
          </button>
          <button
            onClick={() => setViewMode("COMMISSIONS")}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === "COMMISSIONS" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >
            Komise / Commissions
          </button>
          <button
            onClick={() => router.push("/admin/users")}
            className="py-3 px-6 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center gap-2 whitespace-nowrap"
          >
            Správa uživatelů
          </button>
        </div>

        {/* Compliance Alerts Notification */}
        {complianceAlerts.length > 0 && viewMode === "PLACEMENTS" && (
          <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm">
            <h3 className="text-red-800 font-bold flex items-center gap-2 mb-2">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Upozornění na shodu (Compliance Alerts)
            </h3>
            <p className="text-red-700 text-sm mb-3">
              Následující instituce mají chybějící nebo brzy expirující rámcovou
              smlouvu (do 30 dnů):
            </p>
            <ul className="list-disc list-inside text-sm text-red-600">
              {complianceAlerts.map((inst) => (
                <li key={inst.id}>
                  {inst.displayName || inst.email || "Neznámá instituce"}{" "}
                  {inst.frameworkAgreementExpiration
                    ? `(Expirace: ${new Date(inst.frameworkAgreementExpiration).toLocaleDateString("cs-CZ")})`
                    : "(Chybí datum)"}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setViewMode("COMPLIANCE")}
              className="mt-3 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded transition-colors"
            >
              Přejít do správy institucí
            </button>
          </div>
        )}

        {viewMode === "DOCUMENTS" ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Správa Globálních Dokumentů
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Zde můžete nahrát šablony, KRAU metodiky a další veřejné
                  soubory pro studenty.
                </p>
              </div>
              <label
                className={`flex items-center gap-2 text-sm px-4 py-3 md:py-2 border rounded-lg cursor-pointer transition-colors w-full md:w-auto justify-center ${uploadingDoc ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-blue-600 border-blue-700 text-white hover:bg-blue-700"}`}
              >
                <Upload size={16} />
                {uploadingDoc ? "Nahrávám..." : "Nahrát dokument"}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleGlobalDocUpload}
                  disabled={uploadingDoc}
                />
              </label>
            </div>

            {loadingDocs ? (
              <div className="text-center py-8 text-gray-500">
                Načítám dokumenty...
              </div>
            ) : globalDocs.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <h3 className="text-sm font-medium text-gray-900">
                  Žádné dokumenty
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Zatím nebyly nahrány žádné globální dokumenty.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {globalDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all bg-gray-50"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                        <FileText size={20} />
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 hover:underline block"
                        title={doc.name}
                      >
                        {doc.name}
                      </a>
                    </div>
                    <button
                      onClick={() => handleGlobalDocDelete(doc.path)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Smazat dokument"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : viewMode === "PAYROLL" ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Vyúčtování / Payroll
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Generování mzdových výkazů pro mentory.
                </p>
              </div>
              <button
                onClick={handlePayrollExport}
                disabled={exportingPayroll}
                className={`flex items-center justify-center gap-2 text-sm px-4 py-3 md:py-2 bg-indigo-900 text-white rounded-lg shadow hover:bg-indigo-800 transition-colors w-full md:w-auto ${exportingPayroll ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Download size={16} />
                {exportingPayroll
                  ? "Generuji výkaz..."
                  : "Stáhnout mzdové výkazy (CSV)"}
              </button>
            </div>
          </div>
        ) : viewMode === "COMMISSIONS" ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Komise / Jmenovací dekrety
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Správa komisí pro obhajoby a generování jmenovacích dekretů.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Student / Instituce
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Stav
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Garant IVP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Akce
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {commissions.map((comm) => (
                    <tr key={comm.id}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          ID Praxe: {comm.placementId}
                        </div>
                        <div className="text-sm text-gray-500">
                          {comm.principalName} (Ředitel)
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${comm.status === "GENERATED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                        >
                          {comm.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {comm.status === "GENERATED" ? (
                          comm.guarantorName
                        ) : (
                          <select
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={selectedGuarantors[comm.id] || ""}
                            onChange={(e) =>
                              setSelectedGuarantors((prev) => ({
                                ...prev,
                                [comm.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Vyberte garanta...</option>
                            {guarantors.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name || g.email}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {comm.status === "GENERATED" && comm.decreeUrl ? (
                          <a
                            href={comm.decreeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                          >
                            <Download size={16} /> Stáhnout
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              const gId = selectedGuarantors[comm.id];
                              if (!gId) {
                                alert("Vyberte garanta IVP.");
                                return;
                              }
                              const guarantor = guarantors.find(
                                (g) => g.id === gId,
                              );
                              const gName = guarantor
                                ? guarantor.name || guarantor.email
                                : "Neznámý";
                              handleGenerateDecree(comm.id, gId, gName);
                            }}
                            disabled={generatingDecree}
                            className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Generovat dekret
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {commissions.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        Zatím nebyly vytvořeny žádné komise. (Praxe musí být
                        přesunuta do fáze FINAL_EXAM)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-12">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Kandidáti na komisi (Praxe ve stavu CLOSED)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        ID Praxe
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Stav
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Akce
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {placements
                      .filter((p) => p.status === "CLOSED")
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {p.id}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                              CLOSED
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">
                            <button
                              onClick={() => promoteToFinalExam(p.id)}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              Posunout do FINAL_EXAM
                            </button>
                          </td>
                        </tr>
                      ))}
                    {placements.filter((p) => p.status === "CLOSED").length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          Žádní kandidáti ve stavu CLOSED.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : viewMode === "COMPLIANCE" ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Spolupracující instituce
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Správa rámcových smluv a partnerských institucí.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Název instituce
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Expirace rámcové smlouvy
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {institutions.map((inst) => (
                    <tr
                      key={inst.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {inst.displayName || "Neznámá instituce"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {inst.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="date"
                          className="px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                          value={inst.frameworkAgreementExpiration || ""}
                          onChange={(e) =>
                            updateFrameworkAgreement(inst.id, e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {institutions.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-8 text-center text-gray-500 text-sm"
                      >
                        Zatím nejsou zaregistrovány žádné instituce.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <label
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 text-sm px-4 py-3 md:py-2 border rounded-lg md:rounded transition-colors cursor-pointer ${uploading ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"}`}
                >
                  <Upload size={16} />
                  {uploading ? "Nahrávám..." : "Import Roster"}
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
                <button
                  onClick={handleExport}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 text-sm px-4 py-3 md:py-2 bg-white border border-gray-300 rounded-lg md:rounded hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
            </div>

            {uploadResult && (
              <div
                className={`mb-6 p-4 rounded-lg border ${uploadResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"} flex justify-between items-center`}
              >
                <span>{uploadResult.message}</span>
                <button
                  onClick={() => setUploadResult(null)}
                  className="text-sm opacity-70 hover:opacity-100 text-current underline"
                >
                  Zavřít
                </button>
              </div>
            )}

            {/* OVERVIEW SECTION */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Widget 1: Semester Progress */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Stav Ročníku
                  </h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">
                      {progressPercentage} % splněno
                    </span>
                    <span className="text-sm text-gray-400">
                      {approvedCount} / {totalCount} studentů
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Widget 2: Top Partners */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Top Partneři
                  </h3>
                  <ul className="space-y-3">
                    {topPartners.length > 0 ? (
                      topPartners.map(([name, count], index) => (
                        <li
                          key={index}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm font-medium text-gray-700">
                            {index + 1}. {name}
                          </span>
                          <span className="text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                            {count}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-400 italic">
                        Zatím žádná data
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* ŠTATISTIKY / FILTRE */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              <div
                className={getCardClasses("ALL")}
                onClick={() => setFilterStatus("ALL")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">
                  Celkem smluv
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {placements.length}
                </p>
              </div>
              <div
                className={getCardClasses("PENDING_MATCH")} onClick={() => setFilterStatus("PENDING_MATCH")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">Matchmaking</p>
                <p className="text-2xl font-bold text-blue-800">
                  {
                    placements.filter((i) => i.status === "PENDING_MATCH").length
                  }
                </p>
              </div>
              <div
                className={getCardClasses("APPROVED")}
                onClick={() => setFilterStatus("APPROVED")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">
                  Schváleno
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {placements.filter((i) => i.status === "APPROVED" || i.status === "ACTIVE").length}
                </p>
              </div>
              <div
                className={getCardClasses("PENDING_INSTITUTION")} onClick={() => setFilterStatus("PENDING_INSTITUTION")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">Čeká Firma</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {placements.filter((i) => i.status === "PENDING_INSTITUTION").length}
                </p>
              </div>
              <div
                className={getCardClasses("PENDING_COORDINATOR")} onClick={() => setFilterStatus("PENDING_COORDINATOR")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">Čeká Koord</p>
                <p className="text-2xl font-bold text-blue-600">
                  {placements.filter((i) => i.status === "PENDING_COORDINATOR").length}
                </p>
              </div>
            </div>

            {/* TABUĽKA */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Detekovaná Firma
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Termín
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Akce
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPlacements.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedPlacement(item)}
                        className={`cursor-pointer transition-colors ${item.status === "PENDING_ORG_APPROVAL" ? "bg-blue-50/30 hover:bg-blue-100/50" : "hover:bg-blue-50"}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                              {(item.studentName || item.studentEmail || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {item.studentName
                                  ? item.studentName
                                  : item.studentEmail}
                              </div>
                              {item.studentName && (
                                <div className="text-xs text-gray-500">
                                  {item.studentEmail}
                                </div>
                              )}
                              <div className="text-xs text-gray-400">
                                ID: {item.studentId?.substring(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.organization_name ? (
                            <div>
                              <div className="text-sm text-gray-900 font-medium flex items-center gap-2">
                                {item.organization_name}
                                {item.organization_ico &&
                                  (() => {
                                    const rating = getCompanyAverageRating(
                                      item.organization_ico,
                                    );
                                    return rating ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 text-xs font-bold border border-yellow-200">
                                        <span>★</span> {rating}
                                      </span>
                                    ) : null;
                                  })()}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">
                                IČO: {item.organization_ico || "N/A"}
                              </div>
                              {item.organization_web && (
                                <a
                                  href={
                                    item.organization_web.startsWith("http")
                                      ? item.organization_web
                                      : `https://${item.organization_web}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-500 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {item.organization_web}
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-sm">
                              --
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.start_date
                            ? `${formatDateCZ(item.start_date)} - ${formatDateCZ(item.end_date)}`
                            : "--"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                              item.status === "PENDING_MATCH"
                                ? "bg-purple-100 text-purple-800"
                                : item.status === "PENDING_INSTITUTION"
                                  ? "bg-blue-100 text-blue-800"
                                  : item.status === "PENDING_COORDINATOR"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : item.status === "APPROVED" || item.status === "ACTIVE"
                                      ? "bg-green-100 text-green-800"
                                      : item.status === "ACTIVE"
                                        ? "bg-teal-100 text-teal-800"
                                        : item.status === "EVALUATION"
                                          ? "bg-orange-100 text-orange-800"
                                          : item.status === "CLOSED"
                                            ? "bg-gray-100 text-gray-800"
                                            : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            {item.status === "PENDING_MATCH" ? (
                              <div className="flex flex-col gap-1 min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                                <select
                                  className="text-xs p-1 border border-gray-300 rounded"
                                  value={linkingPlacementId === item.id ? matchmakingOrgId : ""}
                                  onChange={(e) => {
                                    setLinkingPlacementId(item.id);
                                    setMatchmakingOrgId(e.target.value);
                                  }}
                                >
                                  <option value="">Vyberte organizaci...</option>
                                  {organizations && organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                  ))}
                                </select>
                                {linkingPlacementId === item.id && matchmakingOrgId && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (typeof handleMatchPlacement === "function") { handleMatchPlacement(item.id); }
                                    }}
                                    className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 mt-1"
                                  >
                                    Propojit
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          {item.status === "PENDING_ORG_APPROVAL" ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveOrg(item.id);
                                }}
                                className="text-green-600 hover:text-green-900 font-bold hover:underline"
                              >
                                Schválit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRejectOrg(item.id);
                                }}
                                className="text-red-600 hover:text-red-900 font-bold hover:underline"
                              >
                                Zamítnout
                              </button>
                            </>
                          ) : (
                            <>
                              <a
                                href={`mailto:${item.studentEmail}?subject=Dotaz k praxi&body=Dobrý den, ohledně vaší smlouvy...`}
                                className="text-gray-400 hover:text-gray-600 inline-block align-middle"
                                title="Napsat email"
                                onClick={(e) => e.stopPropagation()}
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
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                  />
                                </svg>
                              </a>
                              {item.contract_url ? (
                                <a
                                  href={item.contract_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-900 hover:underline inline-block align-middle"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Otevřít PDF
                                </a>
                              ) : (
                                <span className="text-gray-300 cursor-not-allowed">
                                  PDF
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredPlacements.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-10 text-center text-gray-500"
                        >
                          {placements.length === 0
                            ? "Zatím žádné nahrané praxe v systému."
                            : "Žádné záznamy pro tento filtr."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* MODAL - DETAIL VIEW */}
        {selectedPlacement && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedPlacement(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex justify-between items-start p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedPlacement.studentName ||
                      selectedPlacement.studentEmail ||
                      "Detail stáže"}
                  </h2>
                  <div className="mt-2">
                    <span
                      className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                        selectedPlacement.status === "APPROVED" || selectedPlacement.status === "ACTIVE"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : selectedPlacement.status === "ORG_APPROVED"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : selectedPlacement.status ===
                                "PENDING_ORG_APPROVAL"
                              ? "bg-blue-100 text-blue-800 border-blue-300"
                              : selectedPlacement.status === "REJECTED"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : selectedPlacement.status === "NEEDS_REVIEW"
                                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {selectedPlacement.status === "PENDING_ORG_APPROVAL"
                        ? "Čeká na schválení"
                        : selectedPlacement.status === "ORG_APPROVED"
                          ? "Firma schválena"
                          : selectedPlacement.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlacement(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </header>

              <div className="p-6 space-y-6">
                {/* Section 1: Student */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">
                    Student
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedPlacement.studentEmail}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ID studenta</p>
                      <p className="text-sm font-medium text-gray-900 font-mono">
                        {selectedPlacement.studentId}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Organization */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">
                    Organizace
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500">Název firmy</p>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedPlacement.organization_name || "Neznámá firma"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">IČO</p>
                      <p className="text-sm font-medium text-gray-900 font-mono">
                        {selectedPlacement.organization_ico || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Web</p>
                      {selectedPlacement.organization_web ? (
                        <a
                          href={
                            selectedPlacement.organization_web.startsWith(
                              "http",
                            )
                              ? selectedPlacement.organization_web
                              : `https://${selectedPlacement.organization_web}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {selectedPlacement.organization_web}
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
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Neuveden</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Contract */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">
                    Smlouva
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Termín praxe</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedPlacement.start_date
                          ? `${formatDateCZ(selectedPlacement.start_date)} - ${formatDateCZ(selectedPlacement.end_date)}`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Dokument</p>
                      {selectedPlacement.contract_url ? (
                        <>
                          <a
                            href={selectedPlacement.contract_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline mt-1 mb-4"
                          >
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
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            Stáhnout PDF
                          </a>
                          {(selectedPlacement?.studentMajor === "KPV" ||
                            selectedPlacement?.major === "KPV") && (
                            <ContractSignature
                              placementId={selectedPlacement.id}
                              role="coordinator"
                              signatures={selectedPlacement.signatures}
                            />
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          Smlouva nedostupná
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 4: Certificate (if CLOSED) */}
                {selectedPlacement.status === "CLOSED" &&
                  selectedPlacement.certificateUrl && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h3 className="text-sm font-bold text-green-800 uppercase mb-3">
                        Certifikát
                      </h3>
                      <p className="text-xs text-green-700 mb-2">
                        Praxe byla úspěšně uzavřena a certifikát byl
                        vygenerován.
                      </p>
                      <a
                        href={selectedPlacement.certificateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded font-bold shadow hover:bg-green-700 transition text-sm"
                      >
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
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Stáhnout certifikát
                      </a>
                    </div>
                  )}
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setSelectedPlacement(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
                >
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
