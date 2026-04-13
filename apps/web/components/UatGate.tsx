"use client";

import { useState, useEffect } from "react";

export default function UatGate({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const unlocked = sessionStorage.getItem("uat_unlocked");
    if (unlocked === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === "9999") {
      sessionStorage.setItem("uat_unlocked", "true");
      setIsUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };

  if (!isMounted) {
    return null; // or a simple loading spinner to avoid hydration mismatch
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 text-white">
      <h1 className="text-2xl mb-4 font-semibold">UAT Access Restricted</h1>
      <p className="mb-6 text-gray-400">Please enter the PIN to continue.</p>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter PIN"
          className="px-4 py-2 text-black rounded outline-none border-2 border-transparent focus:border-blue-500"
          autoFocus
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 transition-colors rounded font-medium"
        >
          Unlock
        </button>
        {error && <p className="text-red-500 text-sm mt-2">Incorrect PIN, try again.</p>}
      </form>
    </div>
  );
}
