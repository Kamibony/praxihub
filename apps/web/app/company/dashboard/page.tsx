'use client';

import React from 'react';

export default function CompanyDashboard() {
  // Mock data for internships
  const activeInternships = [
    { id: 1, student: 'Alice Johnson', role: 'Software Engineering Intern', startDate: '2023-11-01', status: 'Active' },
    { id: 2, student: 'Bob Smith', role: 'Product Design Intern', startDate: '2023-11-15', status: 'Contract Pending' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Company Portal</h1>
          <p className="text-gray-600 mt-2">Manage your interns and contracts.</p>
        </header>

        <div className="grid gap-6">
          {/* Active Internships Section */}
          <section className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Active Internships</h2>
              <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">View All</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intern Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeInternships.map((internship) => (
                    <tr key={internship.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{internship.student}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{internship.role}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{internship.startDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          internship.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {internship.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {internship.status === 'Contract Pending' ? (
                          <button className="text-blue-600 hover:text-blue-900 font-medium hover:underline">
                            Sign Contract
                          </button>
                        ) : (
                          <span className="text-gray-400">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Quick Actions / Placeholder */}
          <section className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-4">
               <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center w-full sm:w-64 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer">
                 <span className="text-4xl text-gray-400 mb-2">+</span>
                 <span className="text-gray-600 font-medium">Post New Internship</span>
               </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
