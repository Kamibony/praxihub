'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, XCircle } from 'lucide-react';

import { Suspense } from 'react';

function VerifyCertificateContent() {
    const searchParams = useSearchParams();
    const snapshotId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [snapshot, setSnapshot] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSnapshot = async () => {
            if (!snapshotId) {
                setError('Certifikát nenalezen. Záznam neexistuje nebo je neplatný.');
                setLoading(false);
                return;
            }
            try {
                const docRef = doc(db, 'archived_placements', snapshotId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setSnapshot(docSnap.data());
                } else {
                    setError('Certifikát nenalezen. Záznam neexistuje nebo je neplatný.');
                }
            } catch (err: any) {
                console.error("Error fetching snapshot:", err);
                setError('Nastala chyba při ověřování certifikátu.');
            } finally {
                setLoading(false);
            }
        };

        fetchSnapshot();
    }, [snapshotId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error || !snapshot) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Neplatný certifikát</h1>
                    <p className="text-slate-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full">
                <div className="text-center mb-8">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Ověřený certifikát</h1>
                    <p className="text-slate-600">Tento záznam je oficiální a nezměnitelný ze systému PraxiHub.</p>
                </div>

                <div className="space-y-6">
                    <div className="border-b pb-4">
                        <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-1">Student</h2>
                        <p className="text-xl font-medium text-slate-900">{snapshot.studentName}</p>
                    </div>

                    <div className="border-b pb-4">
                        <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-1">Společnost</h2>
                        <p className="text-xl font-medium text-slate-900">
                            {snapshot.companyName || snapshot.organization_name || 'Neznámá'}
                            {snapshot.companyIco && <span className="text-sm text-slate-500 ml-2">(IČO: {snapshot.companyIco})</span>}
                        </p>
                    </div>

                    {(snapshot.start_date && snapshot.end_date) && (
                        <div className="border-b pb-4">
                            <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-1">Termín praxe</h2>
                            <p className="text-lg text-slate-900">{snapshot.start_date} – {snapshot.end_date}</p>
                        </div>
                    )}

                    <div className="border-b pb-4">
                        <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-1">Hodnocení AI (MŠMT KRAU)</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                                Úspěšně splněno
                            </span>
                        </div>
                        {snapshot.evaluationResult?.didacticCompetence?.score && (
                            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                <div className="bg-slate-50 p-3 rounded border">
                                    <span className="block text-slate-500">Oborová a didaktická</span>
                                    <span className="font-bold">{snapshot.evaluationResult.didacticCompetence.score}/100</span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded border">
                                    <span className="block text-slate-500">Pedagogická a psychologická</span>
                                    <span className="font-bold">{snapshot.evaluationResult.pedagogicalCompetence.score}/100</span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded border">
                                    <span className="block text-slate-500">Sociální a komunikativní</span>
                                    <span className="font-bold">{snapshot.evaluationResult.socialCompetence.score}/100</span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded border">
                                    <span className="block text-slate-500">Reflektivní</span>
                                    <span className="font-bold">{snapshot.evaluationResult.reflectiveCompetence.score}/100</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-1">ID Záznamu</h2>
                        <p className="text-sm font-mono text-slate-600 bg-slate-100 p-2 rounded">{snapshotId}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function VerifyCertificatePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        }>
            <VerifyCertificateContent />
        </Suspense>
    );
}
