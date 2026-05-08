'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService, JobApplication } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import ApplicationsTab from '@/components/dashboard/ApplicationsTab';
import ResumeAnalyzerTab from '@/components/dashboard/ResumeAnalyzerTab';
import JobMatcherTab from '@/components/dashboard/JobMatcherTab';
import AnalyticsPage from './analytics/page';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'applications' | 'resume' | 'match' | 'analytics'>('applications');
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
      console.error(error);
      if (error?.response?.status === 401) {
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
        router.push('/login');
      }
    }
  };

  const handleAnalyzeResume = async (file: File) => {
    return await apiService.analyzeResume(file);
  };

  const handleMatchJob = async (jobDescription: string) => {
    return await apiService.matchJob(jobDescription);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      apiService.logout();
      router.push('/login');
    }
  };

  if (loading && activeTab === 'applications') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading dashboard...</div>
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
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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
            <ResumeAnalyzerTab onAnalyze={handleAnalyzeResume} />
          )}
          {activeTab === 'match' && (
            <JobMatcherTab onMatch={handleMatchJob} />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsPage />
          )}
        </div>
      </div>
    </div>
  );
}