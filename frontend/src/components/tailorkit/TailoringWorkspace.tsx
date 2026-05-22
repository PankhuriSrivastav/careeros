'use client';

import { useState, useEffect } from 'react';
import { apiService, JobApplication } from '@/lib/api';
import { TailoredOutput, ResumeVersion } from '@/app/tailorkit/page';
import { ChevronRight, Loader } from 'lucide-react';

interface TailoringWorkspaceProps {
  selectedVersion: ResumeVersion | null;
  onTailorComplete: (output: TailoredOutput) => void;
  applications: JobApplication[];
  preSelectedCompany: string | null;
  preSelectedAppId: string | null;
  onVersionChanged: (version: ResumeVersion) => void;
}

type StepState = 'pending' | 'completed' | 'active';

export default function TailoringWorkspace({
  selectedVersion,
  onTailorComplete,
  applications,
  preSelectedCompany,
  preSelectedAppId,
  onVersionChanged,
}: TailoringWorkspaceProps) {
  // Step 1 - Company Selection
  const [selectedCompany, setSelectedCompany] = useState<string>(preSelectedCompany || '');
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  // Step 2 - Job Description
  const [jobDescription, setJobDescription] = useState('');
  const [keywordCount, setKeywordCount] = useState(0);

  // Step 3 - Resume Version (pre-selected)
  // Step 4 - Generate
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine step states
  const step1Complete = !!selectedCompany;
  const step2Complete = jobDescription.trim().length > 0;
  const step3Complete = !!selectedVersion;
  const canGenerate = step1Complete && step2Complete && step3Complete;

  // Initialize with pre-selected company if provided
  useEffect(() => {
    if (preSelectedAppId && applications.length > 0) {
      const app = applications.find((a) => a.id === preSelectedAppId);
      if (app) {
        console.log('Found app from preSelectedAppId:', app);
        setSelectedApp(app);
        setSelectedCompany(app.company);
        if (app.job_description) {
          setJobDescription(app.job_description);
        }
        return;
      }
    }

    // Fallback: try to find by company name
    if (preSelectedCompany && applications.length > 0) {
      const app = applications.find((a) => a.company.toLowerCase() === preSelectedCompany.toLowerCase());
      if (app) {
        console.log('Found app from preSelectedCompany:', app);
        setSelectedApp(app);
        setSelectedCompany(app.company);
        if (app.job_description) {
          setJobDescription(app.job_description);
        }
        return;
      } else {
        // If no exact match found, just set the company name
        console.log('No app found for company:', preSelectedCompany, 'Available apps:', applications.map(a => a.company));
        setSelectedCompany(preSelectedCompany);
      }
    }
  }, [preSelectedAppId, preSelectedCompany, applications]);

  // Calculate keyword count
  useEffect(() => {
    const keywords = jobDescription
      .toLowerCase()
      .match(/\b[a-z]+\b/g)
      ?.filter((w) => w.length > 3) || [];
    const uniqueKeywords = new Set(keywords);
    setKeywordCount(uniqueKeywords.size);
  }, [jobDescription]);

  // When company is selected, pre-fill JD if available
  const handleCompanyChange = (company: string) => {
    setSelectedCompany(company);
    const app = applications.find((a) => a.company === company);
    if (app) {
      setSelectedApp(app);
      if (app.job_description) {
        setJobDescription(app.job_description);
      }
    }
  };

  // Group applications by status
  const groupedApplications = {
    'Actively applying': applications.filter((a) => a.status === 'Applied' || a.status === 'OA' || a.status === 'Interview'),
    'Interested': applications.filter((a) => a.status === 'Interested'),
    'Other': applications.filter((a) => !['Applied', 'OA', 'Interview', 'Interested'].includes(a.status)),
  };

  const handleGenerate = async () => {
    if (!selectedVersion || !selectedCompany || !jobDescription.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const result = await apiService.tailorResume(
        selectedVersion.id,
        jobDescription,
        selectedCompany,
        selectedApp?.id
      );

      onTailorComplete(result);
    } catch (err: any) {
      // Handle 429 quota exceeded errors
      if (err.response?.status === 429) {
        setError('AI is temporarily unavailable due to high usage. Please try again in a few hours.');
      } else {
        setError(err.response?.data?.detail || 'Failed to tailor resume');
      }
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-8">Tailor Your Resume</h2>

      {/* Step 1 - Company Selection */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold ${
            step1Complete ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {step1Complete ? '✓' : '1'}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Company Selection</h3>
          {step1Complete && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Complete</span>}
        </div>

        <select
          value={selectedCompany}
          onChange={(e) => handleCompanyChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a company...</option>
          {Object.entries(groupedApplications).map(([group, apps]) => (
            apps.length > 0 && (
              <optgroup key={group} label={group}>
                {apps.map((app) => (
                  <option key={app.id} value={app.company}>
                    {app.company} - {app.role}
                  </option>
                ))}
              </optgroup>
            )
          ))}
        </select>

        {selectedApp && (
          <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200 text-sm">
            <div className="mb-2">
              <p className="font-semibold text-gray-900">{selectedApp.company}</p>
              <p className="text-gray-700">{selectedApp.role}</p>
            </div>
            <p className="text-gray-700">
              JD stored on <span className="font-semibold">{new Date(selectedApp.applied_date).toLocaleDateString()}</span>
              {!selectedApp.job_description && ' - No JD stored. Paste below.'}
            </p>
          </div>
        )}
      </div>

      {/* Step 2 - Job Description */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold ${
            step2Complete ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {step2Complete ? '✓' : '2'}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Job Description</h3>
          {step2Complete && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Complete</span>}
        </div>

        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description here for best results."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={8}
        />

        <div className="mt-2 text-sm text-gray-600">
          <span className="font-semibold">{keywordCount}</span> keywords detected in this JD
        </div>
      </div>

      {/* Step 3 - Resume Version Confirmation */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full flex items-center justify-center font-semibold bg-green-100 text-green-700">
            ✓
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Resume Version</h3>
        </div>

        {selectedVersion && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{selectedVersion.label}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedVersion.ats_score && `ATS Score: ${selectedVersion.ats_score}`}
                </p>
              </div>
              <button
                onClick={() => {
                  // Scroll to version history (this would be handled by parent component in mobile)
                  alert('Click a version in the history panel to change');
                }}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Change
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 4 - Generate */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold ${
            canGenerate ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
          }`}>
            4
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Generate</h3>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          className={`w-full py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
            canGenerate && !generating
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          {generating ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              Generate Tailored Resume
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="text-xs text-gray-600 mt-3 text-center">
          Gemini will rewrite your resume content to highlight skills matching this JD. Your experience and
          achievements will not be changed — only presentation and emphasis.
        </p>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-semibold text-red-900 mb-2">Error</p>
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button
            onClick={() => {
              setError(null);
              handleGenerate();
            }}
            disabled={generating || !canGenerate}
            className="text-sm font-medium text-red-700 hover:text-red-800 underline"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
