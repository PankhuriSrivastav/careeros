'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import { LogOut } from 'lucide-react';

interface InterviewIntelLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function InterviewIntelLayout({ children, title }: InterviewIntelLayoutProps) {
  const [activeTab, setActiveTab] = useState<
    'applications' | 'resume' | 'match' | 'analytics' | 'skill-gap' | 'opportunities' | 'tailorkit' | 'coding-intel' | 'interview-intel'
  >('interview-intel');
  const router = useRouter();

  const handleTabChange = (tab: typeof activeTab) => {
    if (tab === 'interview-intel') {
      return; // Stay on current page
    }
    setActiveTab(tab);
    router.push('/dashboard');
    // Set active tab in session storage so dashboard knows which tab to show
    sessionStorage.setItem('activeTab', tab);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.clear();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} />
      
      <div className="flex-1 flex flex-col overflow-auto">
        <header className="bg-white shadow-sm px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-xl font-semibold text-gray-800">
            {title || 'Interview Intel'}
          </h1>
          <div className="flex items-center space-x-3">
            <a
              href="/referral-finder"
              className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition font-medium text-sm"
            >
              🤝 Referral Finder
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
