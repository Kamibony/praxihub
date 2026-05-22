"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface UnifiedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: string;
  major?: string;
  studentMajor?: string;
  firstName?: string;
  lastName?: string;
  skills?: string[];
  researchConsent?: boolean;
  [key: string]: any;
}

interface AuthContextType {
  user: UnifiedUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setFirebaseUser(authUser);

      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (!authUser) {
        setUser(null);
        setLoading(false);
      } else {
        const userDocRef = doc(db, "users", authUser.uid);

        // Use onSnapshot to keep the user document synced
        unsubscribeFirestore = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setUser({
                uid: authUser.uid,
                email: authUser.email,
                displayName: authUser.displayName,
                ...data, // merge firestore data
              });
            } else {
              // User document doesn't exist yet (e.g. just signed up, waiting for onboarding)
              setUser({
                uid: authUser.uid,
                email: authUser.email,
                displayName: authUser.displayName,
              });
            }
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching user document in AuthContext:", error);
            setLoading(false);
          }
        );
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
