'use client';

import { LayoutDashboard, FileText, Target, LogOut, BarChart3, TrendingUp } from 'lucide-react';

interface SidebarProps {
  activeTab: 'applications' | 'resume' | 'match' | 'analytics' | 'skill-gap';
  onTabChange: (tab: 'applications' | 'resume' | 'match' | 'analytics' | 'skill-gap') => void;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, onTabChange, onLogout }: SidebarProps) {
  return (
    <div className="w-64 bg-white shadow-lg flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-800">CareerOS</h2>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => onTabChange('applications')}
          className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition ${
            activeTab === 'applications' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => onTabChange('resume')}
          className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition ${
            activeTab === 'resume' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Resume Analyzer</span>
        </button>
        <button
          onClick={() => onTabChange('match')}
          className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition ${
            activeTab === 'match' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Target className="w-5 h-5" />
          <span>Job Matcher</span>
        </button>
        <button
          onClick={() => onTabChange('analytics')}
          className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition ${
            activeTab === 'analytics' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span>Analytics</span>
        </button>
        <button
          onClick={() => onTabChange('skill-gap')}
          className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition ${
            activeTab === 'skill-gap' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Skill Gap</span>
        </button>
      </nav>
      <div className="p-4 border-t">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}