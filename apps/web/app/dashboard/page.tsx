export default function DashboardPage() {
  return (
    <div className="min-h-screen p-8 font-sans">
      <main className="max-w-6xl mx-auto space-y-8">

        {/* Welcome Header */}
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome back, Student
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Track your internship progress and manage your contracts.
          </p>
        </section>

        {/* Status Card */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="p-6 bg-white border rounded-xl shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Internship Status
            </h3>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
              No Active Internship
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              You haven't started an internship yet. Upload a contract to get started.
            </p>
          </div>

          {/* Upload Contract Button */}
          <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:border-gray-600 dark:hover:border-blue-400 dark:hover:bg-gray-800 transition-colors group">
            <div className="p-3 mb-3 bg-blue-100 rounded-full group-hover:bg-blue-200 dark:bg-gray-700 dark:group-hover:bg-gray-600 text-blue-600 dark:text-blue-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-8 h-8"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              Upload Contract
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              PDF files only
            </span>
          </button>
        </div>

        {/* Recent Activity */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Recent Activity
          </h2>
          <div className="bg-white border rounded-xl shadow-sm dark:bg-gray-800 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            {/* Mock Data Item 1 */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Account Created</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Your student account was set up.</p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">2 days ago</span>
            </div>

            {/* Mock Data Item 2 */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Profile Updated</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">You updated your contact information.</p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">1 day ago</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
