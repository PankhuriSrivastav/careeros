'use client';

import { useState } from 'react';
import { apiService } from '@/lib/api';
import { TailoredOutput, ResumeVersion } from '@/app/tailorkit/page';
import { Download, Save, RotateCcw, Loader } from 'lucide-react';

interface OutputDisplayProps {
  output: TailoredOutput;
  onSaved: (newVersion: ResumeVersion) => void;
  onStartOver: () => void;
}

export default function OutputDisplay({ output, onSaved, onStartOver }: OutputDisplayProps) {
  const [editedTailoredResume, setEditedTailoredResume] = useState(output.tailored_resume);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveAsVersion = async () => {
    try {
      setSaving(true);
      setError(null);

      const result = await apiService.saveTailoredResume(
        editedTailoredResume,
        output.company_name,
        output.original_match,
        output.tailored_match
      );

      // Create a new version object from the response
      const newVersion: ResumeVersion = {
        id: result.id,
        label: result.label,
        ats_score: result.ats_score,
        score_diff: result.score_diff,
        upload_date: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        is_tailored: true,
        tailored_for_company: output.company_name,
        created_at: new Date().toISOString(),
      };

      onSaved(newVersion);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save resume');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadAsText = () => {
    const element = document.createElement('a');
    const file = new Blob([editedTailoredResume], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `resume-${output.company_name}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Match Score Comparison */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Tailored for {output.company_name}</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Original Match */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 mb-2">Original Match</p>
            <p className="text-3xl font-bold text-gray-900">{output.original_match}%</p>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center">
            <div className="text-2xl text-gray-400">→</div>
          </div>

          {/* Tailored Match */}
          <div className="bg-white rounded-lg p-4 border border-green-300 bg-green-50">
            <p className="text-xs text-gray-600 mb-2">Tailored Match</p>
            <p className="text-3xl font-bold text-green-600">{output.tailored_match}%</p>
          </div>

          {/* Improvement */}
          <div className="col-span-2 md:col-span-1 bg-white rounded-lg p-4 border border-blue-200">
            <p className="text-xs text-gray-600 mb-2">Improvement</p>
            <p className="text-3xl font-bold text-blue-600">+{output.match_improvement}%</p>
          </div>
        </div>
      </div>

      {/* Side by side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
        {/* Original Resume */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Original Resume</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-96 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700">
            {output.original_resume}
          </div>
        </div>

        {/* Tailored Resume */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Tailored for {output.company_name}</h3>
          <textarea
            value={editedTailoredResume}
            onChange={(e) => setEditedTailoredResume(e.target.value)}
            className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 pb-6 border-t border-gray-200 pt-6 flex flex-col md:flex-row gap-3">
        <button
          onClick={handleSaveAsVersion}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition"
        >
          {saving ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save as Version
            </>
          )}
        </button>

        <button
          onClick={handleDownloadAsText}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900 py-2 px-4 rounded-lg font-medium transition"
        >
          <Download className="h-4 w-4" />
          Download as Text
        </button>

        <button
          onClick={onStartOver}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 px-4 rounded-lg font-medium transition"
        >
          <RotateCcw className="h-4 w-4" />
          Start Over
        </button>
      </div>

      {error && (
        <div className="px-6 pb-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
