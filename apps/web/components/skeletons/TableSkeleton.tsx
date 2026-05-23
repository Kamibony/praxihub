"use client";

import React from "react";

export default function TableSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3"><div className="h-4 bg-gray-200 rounded w-24"></div></th>
              <th className="px-6 py-3"><div className="h-4 bg-gray-200 rounded w-32"></div></th>
              <th className="px-6 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></th>
              <th className="px-6 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></th>
              <th className="px-6 py-3"><div className="h-4 bg-gray-200 rounded w-16 float-right"></div></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                    <div className="space-y-2">
                       <div className="h-4 bg-gray-200 rounded w-32"></div>
                       <div className="h-3 bg-gray-100 rounded w-24"></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-40"></div>
                  <div className="h-3 bg-gray-100 rounded w-24"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-6 bg-gray-200 rounded-full w-24"></div>
                </td>
                <td className="px-6 py-4">
                   <div className="flex justify-end gap-2">
                      <div className="w-6 h-6 rounded bg-gray-200"></div>
                      <div className="w-6 h-6 rounded bg-gray-200"></div>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
