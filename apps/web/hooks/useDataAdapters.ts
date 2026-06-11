import { useState, useEffect } from 'react';
import { db } from "../lib/firebase";
import { collection, query, onSnapshot, where, getDoc, doc } from "firebase/firestore";

export const useHydratedPlacements = (customQuery?: any) => {
    const [placements, setPlacements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const placementsRef = collection(db, "placements");
        if (customQuery === null) {
            setPlacements([]);
            setLoading(false);
            return;
        }

        const q = customQuery || query(placementsRef);

        const unsubscribe = onSnapshot(q, async (snapshot: any) => {
            const rawPlacements = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

            const studentIds = [...new Set(rawPlacements.map((p: any) => p.studentId).filter(Boolean))];
            const instIds = [...new Set(rawPlacements.map((p: any) => p.institutionId).filter(Boolean))];

            const userCache: Record<string, any> = {};

            // Fetch all unique users involved
            const fetchUser = async (id: string) => {
               if (userCache[id]) return userCache[id];
               const d = await getDoc(doc(db, "users", id));
               userCache[id] = d.exists() ? d.data() : null;
               return userCache[id];
            };

            await Promise.all([...studentIds, ...instIds].map(id => fetchUser(id as string)));

            const newHydrated = rawPlacements.map((placement: any) => {
                let isDeleted = false;
                let studentData = placement.studentId ? userCache[placement.studentId] : null;
                let institutionData = placement.institutionId ? userCache[placement.institutionId] : null;

                let isOrphaned = false;
                if (placement.studentId) {
                    if (!studentData || studentData.isDeleted) {
                        isOrphaned = true;
                    }
                }
                if (placement.isDeleted === true) {
                    isDeleted = true;
                }

                return {
                    ...placement,
                    studentData,
                    institutionData,
                    isDeleted,
                    isOrphaned
                };
            });

            // Filter out deleted
            setPlacements(newHydrated.filter((p: any) => !p.isDeleted));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [customQuery]);

    return { placements, loading };
}

export const useActiveUsers = (customQuery?: any) => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const usersRef = collection(db, "users");
        // By default, only get non-deleted users or users where isDeleted is not true
        // FireStore does not easily support "field does not exist or == false", so we handle in memory
        const q = customQuery || query(usersRef);

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
             const data = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data() as any
             })).filter((user: any) => user.isDeleted !== true);

             setUsers(data);
             setLoading(false);
        });
        return () => unsubscribe();
    }, [customQuery]);

    return { users, loading };
}
