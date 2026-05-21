'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiService } from '@/lib/api';
import VersionHistoryPanel from '@/components/tailorkit/VersionHistoryPanel';
import TailoringWorkspace from '@/components/tailorkit/TailoringWorkspace';
import OutputDisplay from '@/components/tailorkit/OutputDisplay';
import { MessageCircle } from 'lucide-react';

export interface ResumeVersion {
  id: string;
  label: string;
  ats_score: number | null;
  score_diff: number | null;
  upload_date: string;
  is_tailored: boolean;
  tailored_for_company: string | null;
  created_at: string;
}

export interface TailoredOutput {
  original_resume: string;
  tailored_resume: string;
  original_match: number;
  tailored_match: number;
  match_improvement: number;
  company_name: string;
}

export default function TailorKitPage() {
  const searchParams = useSearchParams();
  const appId = searchParams.get('app_id');
  const companyName = searchParams.get('company');

  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ResumeVersion | null>(null);
  const [tailoredOutput, setTailoredOutput] = useState<TailoredOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<any[]>([]);

  // Load resume versions and applications on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [versionsData, appsData] = await Promise.all([
          apiService.getResumeVersions(),
          apiService.getApplications(),
        ]);
        setVersions(versionsData);
        setApplications(appsData);

        // Set selected version to the first one or the latest
        if (versionsData.length > 0) {
          setSelectedVersion(versionsData[0]);
        }
      } catch (err) {
        setError('Failed to load resume versions');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Find application if app_id is in URL
  useEffect(() => {
    if (appId && applications.length > 0) {
      // Pre-select the application (handled in TailoringWorkspace)
    }
  }, [appId, applications]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">TailorKit</h1>
          <p className="text-gray-600 mt-2">Tailor your resume for each company to maximize match scores</p>
        </div>

        {/* Main Container - two column on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side - Version History Panel (1/3 width on desktop) */}
          <div className="lg:col-span-1">
            <VersionHistoryPanel
              versions={versions}
              selectedVersion={selectedVersion}
              onSelectVersion={setSelectedVersion}
              onVersionsUpdated={(newVersions) => setVersions(newVersions)}
              loading={loading}
            />
          </div>

          {/* Right side - Main workspace (2/3 width on desktop) */}
          <div className="lg:col-span-2">
            {tailoredOutput ? (
              <OutputDisplay
                output={tailoredOutput}
                onSaved={(newVersion) => {
                  setVersions([newVersion, ...versions]);
                  setTailoredOutput(null);
                  setSelectedVersion(newVersion);
                }}
                onStartOver={() => setTailoredOutput(null)}
              />
            ) : (
              <TailoringWorkspace
                selectedVersion={selectedVersion}
                onTailorComplete={setTailoredOutput}
                applications={applications}
                preSelectedCompany={companyName}
                preSelectedAppId={appId}
                onVersionChanged={setSelectedVersion}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
