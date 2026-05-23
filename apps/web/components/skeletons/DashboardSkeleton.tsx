"use client";

import React from "react";

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--background)] p-8 font-sans">
      <div className="max-w-5xl mx-auto animate-pulse">

        {/* Header Skeleton */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-black/10 dark:border-white/10 pb-4 gap-4">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-black/10 dark:bg-white/10 rounded-lg"></div>
            <div className="h-4 w-40 bg-black/10 dark:bg-white/10 rounded"></div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
             <div className="h-10 w-32 bg-black/10 dark:bg-white/10 rounded-2xl"></div>
             <div className="h-10 w-24 bg-black/10 dark:bg-white/10 rounded-2xl"></div>
          </div>
        </div>

        {/* Profile Summary Component Skeleton */}
        <div className="bg-white/50 dark:bg-slate-800/80 border border-black/5 dark:border-slate-700/50 p-6 rounded-3xl shadow-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-black/10 dark:bg-white/10"></div>
            <div className="space-y-3">
              <div className="h-6 w-48 bg-black/10 dark:bg-white/10 rounded-lg"></div>
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-black/10 dark:bg-white/10 rounded-full"></div>
                <div className="h-5 w-32 bg-black/10 dark:bg-white/10 rounded-full"></div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
             <div className="h-4 w-24 bg-black/10 dark:bg-white/10 rounded"></div>
             <div className="h-8 w-32 bg-black/10 dark:bg-white/10 rounded-xl"></div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Card Skeleton */}
          <div className="lg:col-span-2 space-y-6">
             <div className="h-48 bg-black/5 dark:bg-white/5 rounded-3xl"></div>
             <div className="card-glass p-6 rounded-3xl h-96 bg-black/5 dark:bg-white/5">
                <div className="h-6 w-40 bg-black/10 dark:bg-white/10 rounded-lg mb-6"></div>
                <div className="space-y-4">
                   <div className="h-20 bg-black/10 dark:bg-white/10 rounded-2xl"></div>
                   <div className="h-32 bg-black/10 dark:bg-white/10 rounded-2xl"></div>
                   <div className="h-10 w-1/3 bg-black/10 dark:bg-white/10 rounded-2xl"></div>
                </div>
             </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="space-y-6">
             <div className="card-glass p-6 rounded-3xl h-64 bg-black/5 dark:bg-white/5">
               <div className="h-4 w-32 bg-black/10 dark:bg-white/10 rounded mb-4 mx-auto"></div>
               <div className="flex justify-center mt-8">
                 <div className="w-32 h-32 rounded-full bg-black/10 dark:bg-white/10"></div>
               </div>
             </div>

             <div className="card-glass p-6 rounded-3xl h-48 bg-black/5 dark:bg-white/5">
                <div className="h-4 w-32 bg-black/10 dark:bg-white/10 rounded mb-4"></div>
                <div className="h-12 bg-black/10 dark:bg-white/10 rounded-2xl mb-4"></div>
                <div className="h-10 bg-black/10 dark:bg-white/10 rounded-2xl"></div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
