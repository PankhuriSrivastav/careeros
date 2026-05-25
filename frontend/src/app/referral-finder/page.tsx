'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CompanySelector from '@/components/referral/CompanySelector';
import ProfessionalsPanel from '@/components/referral/ProfessionalsPanel';
import { getApplications } from '@/lib/api';
import { LogOut } from 'lucide-react';

export default function ReferralFinderPage() {
  const router = useRouter();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadApplications = async () => {
      try {
        const apps = await getApplications();
        setApplications(apps);
      } catch (error) {
        console.error('Failed to load applications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadApplications();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">CareerOS</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={handleBackToDashboard}
            className="w-full flex items-center space-x-3 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <span>← Back to Dashboard</span>
          </button>
          <div className="border-t my-2"></div>
          <div className="px-4 py-2 text-sm font-semibold text-gray-700">Referral Finder</div>
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Referral Finder</h1>
            <p className="text-gray-600 mt-2">Find professionals at target companies and draft personalized outreach</p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Company Selector (sticky on desktop) */}
            <div className="lg:col-span-1">
              <CompanySelector
                applications={applications}
                selectedCompany={selectedCompany}
                onSelectCompany={(company, role) => {
                  setSelectedCompany(company);
                  setSelectedRole(role);
                }}
                loading={loading}
              />
            </div>

            {/* Right Column - Professionals Panel */}
            <div className="lg:col-span-2">
              {selectedCompany && selectedRole ? (
                <ProfessionalsPanel
                  company={selectedCompany}
                  role={selectedRole}
                  application_id={
                    applications.find(a => a.company === selectedCompany)?.id
                  }
                />
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <div className="text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <h3 className="text-lg font-medium mb-2">Select a company to begin</h3>
                    <p className="text-sm">Choose from your applications or search manually</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
