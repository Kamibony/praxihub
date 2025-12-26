'use client';

import React from 'react';

export default function StudentDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Manage your internship documents here.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Status Card */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Internship Status</h2>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
              <span className="text-gray-700 font-medium">Current Internship: None</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              You haven't started an internship yet. Upload a contract to get started.
            </p>
          </div>

          {/* Actions Card */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 flex flex-col justify-center items-start">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Actions</h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out w-full sm:w-auto shadow-sm">
              Upload Contract
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
