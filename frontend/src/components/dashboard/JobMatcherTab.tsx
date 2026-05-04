'use client';

import { useState } from 'react';
import { Target, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface JobMatcherTabProps {
  onMatch: (jobDescription: string) => Promise<any>;
}

export default function JobMatcherTab({ onMatch }: JobMatcherTabProps) {
  const [jobDescription, setJobDescription] = useState('');
  const [matching, setMatching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMatch = async () => {
    if (!jobDescription.trim()) {
      setError('Please enter a job description');
      return;
    }

    setMatching(true);
    setError(null);
    setResult(null);
    try {
      const data = await onMatch(jobDescription);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Matching failed. Please try again.');
    } finally {
      setMatching(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Job Description Matcher</h1>
        <p className="text-gray-600">Paste a job description to see how well your resume matches.</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Description</label>
          <textarea
            rows={8}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Paste the full job description here..."
          />
        </div>
        <button
          onClick={handleMatch}
          disabled={matching}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center justify-center"
        >
          {matching ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Match with Resume'
          )}
        </button>
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Match Results</h2>
          
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Resume-Job Match Score</span>
              <span className="text-2xl font-bold text-green-600">{result.match_percent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: `${result.match_percent}%` }} />
            </div>
          </div>

          {result.suggestions && result.suggestions.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">Suggestions</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {result.suggestions.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Your Resume Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.resume_keywords?.slice(0, 10).map((kw: string, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{kw}</span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" />
                Job Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.job_keywords?.slice(0, 10).map((kw: string, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">{kw}</span>
                ))}
              </div>
            </div>
          </div>

          {result.missing_keywords && result.missing_keywords.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Missing Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.missing_keywords.map((kw: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}