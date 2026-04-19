import React, { useState } from 'react';
import { db, functions } from "../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { doc, updateDoc } from "firebase/firestore";
import { CheckCircle2, PenTool, Loader2 } from "lucide-react";

interface ContractSignatureProps {
  placementId: string;
  role: 'student' | 'coordinator' | 'institution';
  signatures?: {
    student?: { timestamp: any; userId: string };
    coordinator?: { timestamp: any; userId: string };
    institution?: { timestamp: any; userId: string };
    company?: { timestamp: any; userId: string };
  };
}

export default function ContractSignature({ placementId, role, signatures }: ContractSignatureProps) {
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signatureData = signatures?.[role === 'institution' ? 'company' : role]; // Map institution to company for legacy signatures if needed
  const isSigned = !!signatureData;

  const handleSign = async () => {
    setIsSigning(true);
    setError(null);
    try {
      const signContract = httpsCallable(functions, "signContract");
      await signContract({ placementId, role });
    } catch (err: any) {
      console.error("Signature failed:", err);
      setError(err.message || "Nepodařilo se podepsat smlouvu.");
    } finally {
      setIsSigning(false);
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'student': return 'Student';
      case 'coordinator': return 'Koordinátor';
      case 'institution': return 'Společnost';
    }
  };

  if (isSigned) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-semibold">Podepsáno ({getRoleLabel()})</p>
          <p className="text-xs text-green-700 opacity-80">
            {signatureData.timestamp ? new Date(signatureData.timestamp.toMillis ? signatureData.timestamp.toMillis() : signatureData.timestamp).toLocaleString('cs-CZ') : 'Právě podepsáno'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h4 className="font-semibold text-gray-900 mb-1">Digitální podpis ({getRoleLabel()})</h4>
      <p className="text-xs text-gray-500 mb-3">
        Kliknutím níže stvrzujete souhlas s podmínkami smlouvy. Tento úkon má právní závaznost v rámci modulu KPV. Bude zaznamenána IP adresa a časový údaj.
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <button
        onClick={handleSign}
        disabled={isSigning}
        className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 transition disabled:opacity-50"
      >
        {isSigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
        Podepsat smlouvu
      </button>
    </div>
  );
}
