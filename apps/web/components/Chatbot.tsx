'use client';

import React, { useState, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface ChatbotProps {
  initialMessage?: string;
}

export default function Chatbot({ initialMessage }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showToast, setShowToast] = useState(!!initialMessage);
  const [messages, setMessages] = useState<{role: 'user' | 'bot', text: string}[]>([
    { role: 'bot', text: 'Dobrý den! Jsem AI průvodce PraxiHubem. Jak vám mohu pomoci?' }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState("visitor");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Zistíme rolu používateľa pre lepší kontext
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const d = await getDoc(doc(db, "users", u.uid));
          if (d.exists()) setUserRole(d.data().role);
        } catch (e) { console.error(e); }
      } else {
        setUserRole("visitor");
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (initialMessage) {
      setShowToast(true);
    }
  }, [initialMessage]);

  // Auto-scroll na spodok
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleOpenFromToast = () => {
    setIsOpen(true);
    setShowToast(false);
    if (initialMessage) {
      setMessages(prev => {
        // Prevent duplicate injection if the user closes and reopens or clicks multiple times
        if (prev.some(m => m.text === initialMessage)) return prev;
        return [{ role: 'bot', text: initialMessage }, ...prev];
      });
    }
  };

  const handleLauncherClick = () => {
    setIsOpen(true);
    setShowToast(false);
  };

  const handleCloseToast = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowToast(false);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const chatFn = httpsCallable(functions, 'chatWithAI');
      const result: any = await chatFn({ message: userMsg, role: userRole });
      
      setMessages(prev => [...prev, { role: 'bot', text: result.data.response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'bot', text: 'Omlouvám se, momentálně se nemohu spojit se serverem.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans flex flex-col items-end gap-4">

      {/* TOAST BUBBLE */}
      {showToast && !isOpen && initialMessage && (
        <div
          onClick={handleOpenFromToast}
          className="bg-white shadow-xl rounded-xl border border-gray-100 max-w-xs p-4 cursor-pointer relative animate-fade-in-up hover:scale-105 transition-transform"
        >
          <button
            onClick={handleCloseToast}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex gap-3">
             <div className="shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <p className="text-sm text-gray-800 leading-relaxed pr-4">
               {initialMessage}
             </p>
          </div>
          {/* Arrow pointing down */}
          <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white border-b border-r border-gray-100 transform rotate-45"></div>
        </div>
      )}

      {/* CHAT OKNO */}
      {isOpen && (
        <div className="bg-white w-80 h-96 rounded-2xl shadow-2xl flex flex-col mb-4 border border-gray-200 overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="bg-blue-600 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <h3 className="text-white font-bold text-sm">PraxiHub Asistent</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-blue-200 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 p-2 rounded-xl rounded-bl-none animate-pulse">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Napište dotaz..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
            <button 
              onClick={handleSend}
              disabled={loading}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* FLOATING BUTTON */}
      {!isOpen && (
        <button 
          onClick={handleLauncherClick}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center group relative"
        >
          {/* This tooltip might be redundant now with the toast, but I'll leave it as it only shows on hover */}
          <span className="absolute right-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mr-2 pointer-events-none">
            Potřebujete poradit?
          </span>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        </button>
      )}
    </div>
  );
}
