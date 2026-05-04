'use client';

import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface ResumeAnalyzerTabProps {
  onAnalyze: (file: File) => Promise<any>;
}

export default function ResumeAnalyzerTab({ onAnalyze }: ResumeAnalyzerTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
      const data = await onAnalyze(file);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Resume Analyzer</h1>
        <p className="text-gray-600">Upload your resume (PDF) to get an ATS score and keyword suggestions</p>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}