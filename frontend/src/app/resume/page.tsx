'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function ResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check authentication only on the client side
    if (!apiService.isAuthenticated()) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const data = await apiService.analyzeResume(file);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Show loading while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI Resume Analyzer</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="resume-upload"
            />
            <label htmlFor="resume-upload" className="cursor-pointer inline-flex flex-col items-center">
              <Upload className="w-12 h-12 text-gray-400 mb-2" />
              <span className="text-gray-600">
                {file ? file.name : 'Click to select a PDF file'}
              </span>
            </label>
          </div>

          {file && (
            <div className="mt-4">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze Resume'
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <span className="text-red-700">{error}</span>
            </div>
          )}
        </div>

        {result && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Analysis Results</h2>
            
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">ATS Compatibility Score</span>
                <span className="text-2xl font-bold text-blue-600">{result.score}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${result.score}%` }} />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {result.score >= 80
                  ? 'Excellent! Your resume is well-optimized.'
                  : result.score >= 60
                  ? 'Good, but there is room for improvement.'
                  : 'Consider adding more relevant keywords and skills.'}
              </p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Extracted Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.keywords.map((kw: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">{kw}</span>
                ))}
              </div>
            </div>

            {result.missing && result.missing.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  Missing Important Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.missing.map((skill: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">{skill}</span>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Consider adding these keywords to improve ATS score.
                </p>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                Extracted Text Preview
              </h3>
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 max-h-40 overflow-y-auto">
                {result.text_preview}
                {result.text_preview.length < 500 && '...'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}