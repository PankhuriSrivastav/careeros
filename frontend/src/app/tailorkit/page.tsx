'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import TailorKitContent from '@/components/tailorkit/TailorKitContent';
import Sidebar from '@/components/dashboard/Sidebar';
import { ArrowLeft } from 'lucide-react';

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
  const router = useRouter();

  // Load resume versions and applications on mount
  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      router.push('/login');
      return;
    }

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
  }, [router]);

  const handleLogout = () => {
    apiService.logout();
    localStorage.clear();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Header */}
      <header className="bg-white shadow-sm px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">TailorKit</h1>
            <p className="text-gray-600 text-sm">Tailor your resume for each company</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
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
    </div>
  );
}

export default function TailorKitPage() {
  const [activeTab] = useState<
    'applications' | 'resume' | 'match' | 'analytics' | 'skill-gap' | 'opportunities'
  >('applications'); // TailorKit is accessed via direct link, not a tab
  const router = useRouter();

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    apiService.logout();
    localStorage.clear();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar activeTab={activeTab} onTabChange={() => {}} onLogout={handleLogout} />
      <Suspense
        fallback={
          <div className="flex-1 min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        }
      >
        <TailorKitPageContent />
      </Suspense>
    </div>
  );
}
