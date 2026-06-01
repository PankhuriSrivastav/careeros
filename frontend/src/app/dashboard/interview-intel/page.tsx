'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startInterviewSession } from '@/lib/api';
import { Send, Loader } from 'lucide-react';
import Link from 'next/link';

export default function InterviewIntelPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [jdText, setJdText] = useState('');
  const [mode, setMode] = useState<'full' | 'single_round'>('full');
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rounds = [
    { id: 'dsa', name: 'DSA Round', description: 'Test data structures & algorithms' },
    { id: 'technical', name: 'Technical Round', description: 'Project deep dive & systems knowledge' },
    { id: 'system_design', name: 'System Design', description: 'Architecture & scalability' },
    { id: 'hr', name: 'HR Round', description: 'Behavioral & culture fit' },
  ];

  async function handleStartInterview() {
    if (!companyName.trim()) {
      setError('Please enter a company name');
      return;
    }

    if (mode === 'single_round' && !selectedRound) {
      setError('Please select a round for single-round mode');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await startInterviewSession(
        companyName,
        jdText || undefined,
        undefined,
        mode,
        mode === 'single_round' ? [selectedRound] : undefined
      );

      router.push(`/dashboard/interview-intel/session/${response.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-8 rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold mb-2">Interview Intel</h1>
        <p className="text-blue-100">Practice with realistic mock interviews powered by AI</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Setup Form */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">Start Your Interview</h2>

          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Google, Amazon, Meta..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* JD Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Description (Optional)
            </label>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description to get company-specific questions..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interview Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="full"
                  checked={mode === 'full'}
                  onChange={(e) => {
                    setMode(e.target.value as 'full' | 'single_round');
                    setSelectedRound('');
                  }}
                  className="w-4 h-4"
                />
                <span className="text-gray-700">Full Interview (All 4 Rounds)</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="single_round"
                  checked={mode === 'single_round'}
                  onChange={(e) => setMode(e.target.value as 'full' | 'single_round')}
                  className="w-4 h-4"
                />
                <span className="text-gray-700">Single Round</span>
              </label>
            </div>
          </div>

          {/* Single Round Selection */}
          {mode === 'single_round' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Round *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {rounds.map((round) => (
                  <button
                    key={round.id}
                    onClick={() => setSelectedRound(round.id)}
                    className={`p-3 rounded-lg border-2 text-left transition ${
                      selectedRound === round.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-sm">{round.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{round.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleStartInterview}
            disabled={isLoading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center space-x-2 transition"
          >
            {isLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Starting Interview...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Start Interview</span>
              </>
            )}
          </button>
        </div>

        {/* Info Cards */}
        <div className="space-y-4">
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="font-bold text-gray-800 mb-2">📊 What's Included</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ 4 realistic interview rounds</li>
              <li>✓ AI-powered interviewer personas</li>
              <li>✓ Company-specific DSA patterns</li>
              <li>✓ Detailed performance scoring</li>
              <li>✓ Personalized feedback & improvement areas</li>
            </ul>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
            <h3 className="font-bold text-gray-800 mb-2">🎯 The Four Rounds</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li><strong>DSA:</strong> Problem-solving & algorithms</li>
              <li><strong>Technical:</strong> Your projects & systems</li>
              <li><strong>System Design:</strong> Architecture thinking</li>
              <li><strong>HR:</strong> Behavioral & culture fit</li>
            </ul>
          </div>

          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h3 className="font-bold text-gray-800 mb-2">💡 Pro Tips</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• Think out loud and explain your approach</li>
              <li>• Ask clarifying questions</li>
              <li>• Discuss tradeoffs and complexity</li>
              <li>• Be specific with examples from your experience</li>
            </ul>
          </div>

          <Link
            href="/dashboard/interview-intel/history"
            className="block text-center bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-medium transition"
          >
            View Your Interview History
          </Link>
        </div>
      </div>
    </div>
  );
}
