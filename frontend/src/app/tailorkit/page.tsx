'use client';

import { useState, useEffect, Suspense } from 'react';
import { apiService } from '@/lib/api';
import TailorKitContent from '@/components/tailorkit/TailorKitContent';

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

function TailorKitPageContent() {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        setError('Failed to load resume versions');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
          <Suspense
            fallback={
              <div className="lg:col-span-2 col-span-1">
                <div className="bg-white rounded-lg shadow-sm animate-pulse h-96"></div>
              </div>
            }
          >
            <TailorKitContent
              versions={versions}
              applications={applications}
              onVersionsUpdated={setVersions}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function TailorKitPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <TailorKitPageContent />
    </Suspense>
  );
}
