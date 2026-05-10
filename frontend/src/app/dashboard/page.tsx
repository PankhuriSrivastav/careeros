'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService, JobApplication } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import ApplicationsTab from '@/components/dashboard/ApplicationsTab';
import ResumeAnalyzerTab from '@/components/dashboard/ResumeAnalyzerTab';
import JobMatcherTab from '@/components/dashboard/JobMatcherTab';
import AnalyticsPage from './analytics/page';
import SkillGapAnalyzerPage from './skill-gap/page';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'applications' | 'resume' | 'match' | 'analytics' | 'skill-gap'>('applications');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      router.push('/login');
    } else {
      loadApplications();
    }
  }, []);

  const loadApplications = async () => {
    try {
      const data = await apiService.getApplications();
      setApplications(data);
    } catch (error: any) {
      console.error('Error loading applications:', error);
      if (error?.response?.status === 401) {
        apiService.logout();
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApplication = async (app: { company: string; role: string; status: string }) => {
    const newApp = {
      company: app.company,
      role: app.role,
      status: app.status as 'Applied' | 'OA' | 'Interview' | 'Offer' | 'Rejected',
      applied_date: new Date().toISOString().split('T')[0],
    };
    await apiService.createApplication(newApp);
    await loadApplications();
  };

  const handleDeleteApplication = async (id: string) => {
    await apiService.deleteApplication(id);
    await loadApplications();
  };

  const handleUpdateApplication = async (id: string, app: Omit<JobApplication, 'id'>) => {
    try {
      await apiService.updateApplication(id, app);
      await loadApplications();
    } catch (error: any) {
      console.error('Error updating application:', error);
      if (error?.response?.status === 401) {
        apiService.logout();
        router.push('/login');
      }
    }
  };

  const handleLogout = () => {
    apiService.logout();
    localStorage.clear();
    router.push('/login');
  };

  // Show loading only on first load for applications tab
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />
      
      <div className="flex-1 flex flex-col overflow-auto">
        <header className="bg-white shadow-sm px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-xl font-semibold text-gray-800">
            {activeTab === 'applications' && 'Job Tracker'}
            {activeTab === 'resume' && 'Resume AI'}
            {activeTab === 'match' && 'Job Matcher'}
            {activeTab === 'analytics' && 'Analytics Dashboard'}
            {activeTab === 'skill-gap' && 'Skill Gap Analyzer'}
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
          >
            Logout
          </button>
        </header>

        <div className="p-8">
          {activeTab === 'applications' && (
            <ApplicationsTab
              applications={applications}
              onCreate={handleCreateApplication}
              onDelete={handleDeleteApplication}
              onUpdate={handleUpdateApplication}
            />
          )}
          {activeTab === 'resume' && (
            <ResumeAnalyzerTab onAnalyze={async (file) => apiService.analyzeResume(file)} />
          )}
          {activeTab === 'match' && (
            <JobMatcherTab onMatch={async (jd) => apiService.matchJob(jd)} />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsPage />
          )}
          {activeTab === 'skill-gap' && (
            <SkillGapAnalyzerPage />
          )}
        </div>
      </div>
    </div>
  );
}