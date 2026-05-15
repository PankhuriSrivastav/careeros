import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation bar */}
      <nav className="flex justify-between items-center px-8 py-4">
        <span className="text-xl font-bold text-gray-800">CareerOS</span>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Start for Free
          </Link>
        </div>
      </nav>

      {/* Hero section */}
      <div className="flex flex-col items-center justify-center text-center px-4 pt-20 pb-32">
        <h1 className="text-5xl font-bold text-gray-900 mb-4 max-w-3xl">
          AI-Powered Career Platform for Indian Engineering Students
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl">
          Track applications, analyze resumes, and get personalized guidance – all in one place.
        </p>
        <Link
          href="/register"
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg shadow-lg"
        >
          Start for Free
        </Link>
      </div>

      {/* Features cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-4 pb-20">
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold mb-2">📊 Application Tracker</h2>
          <p className="text-sm text-gray-600">
            Track all your job applications in one dashboard with smart reminders
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold mb-2">🤖 AI Resume Analyzer</h2>
          <p className="text-sm text-gray-600">
            Get ATS-friendly feedback on your resume with AI-powered suggestions
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold mb-2">🎯 Career Roadmap</h2>
          <p className="text-sm text-gray-600">
            Personalized week-by-week plan based on your skills and goals
          </p>
        </div>
      </div>
    </main>
  );
}