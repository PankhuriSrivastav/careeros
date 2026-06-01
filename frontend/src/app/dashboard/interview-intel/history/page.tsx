'use client';

import { useEffect, useState } from 'react';
import { getInterviewSessions } from '@/lib/api';
import InterviewHistory from '@/components/interview-intel/InterviewHistory';
import InterviewIntelLayout from '@/components/interview-intel/InterviewIntelLayout';
import Link from 'next/link';
import { Plus } from 'lucide-react';

interface Session {
  id: string;
  company_name: string;
  mode: string;
  status: string;
  overall_score?: number;
  created_at: string;
}

export default function InterviewHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const data = await getInterviewSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      setError('Failed to load sessions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading your interview history...</p>
        </div>
      </div>
    );
  }

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Interview History</h1>
          <p className="text-gray-600 mt-1">Track your mock interview progress</p>
        </div>
        <Link
          href="/dashboard/interview-intel"
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition"
        >
          <Plus className="w-5 h-5" />
          <span>New Interview</span>
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* History Content */}
      <InterviewHistory sessions={sessions} />
    </div>
  );

  return (
    <InterviewIntelLayout title="Interview History">
      {content}
    </InterviewIntelLayout>
  );
}
