export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-3xl text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          AI-Powered Career Platform for Indian Engineering Students
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Track applications, analyze resumes, and get personalized guidance – all in one place.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-semibold mb-2">📊 Application Tracker</h2>
            <p className="text-sm text-gray-600">Track all your job applications in one dashboard with smart reminders</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-semibold mb-2">🤖 AI Resume Analyzer</h2>
            <p className="text-sm text-gray-600">Get ATS-friendly feedback on your resume with AI-powered suggestions</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-semibold mb-2">🎯 Career Roadmap</h2>
            <p className="text-sm text-gray-600">Personalized week-by-week plan based on your skills and goals</p>
          </div>
        </div>
      </div>
    </main>
  );
}