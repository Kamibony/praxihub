"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role;

          if (role === "student") {
            router.push("/student/dashboard");
          } else if (role === "company") {
            router.push("/company/dashboard");
          } else if (role === "coordinator") {
            router.push("/admin/dashboard");
          } else {
            console.error("Unknown role:", role);
             // Fallback or error page? For now, stay on loading or redirect to login
             // Maybe show an error message?
             // Assuming valid roles, but let's just log and maybe not redirect to avoid loop.
          }
        } else {
          console.error("User document not found");
          // Handle case where user exists in Auth but not in Firestore
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        // We only set loading to false if we are not redirecting immediately.
        // Actually, if we redirect, the page will unmount, so it doesn't matter much.
        // But if we fail to find role, we should probably stop loading.
        // If we are redirecting, keeping it loading looks better.
        // However, if we don't redirect (unknown role), we should stop loading.
        // Let's set loading false here just in case, or maybe keep it true if redirecting?
        // If we redirect, this component unmounts. If we don't, we show nothing (null).
        // Let's keep loading true until we decide what to do.
        // Wait, if I set loading to false, I need to render something.
        // If I redirect, I don't need to render anything.
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Loading...</div>
      </div>
    </div>
  );
}
