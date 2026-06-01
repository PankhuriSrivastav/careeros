'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getInterviewDebrief } from '@/lib/api';
import InterviewDebrief from '@/components/interview-intel/InterviewDebrief';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Debrief {
  overall_score: number;
  overall_feedback: any;
  round_breakdowns: any;
  strengths: string[];
  improvements: string[];
}

export default function DebriefPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDebrief();
  }, [sessionId]);

  async function loadDebrief() {
    try {
      const data = await getInterviewDebrief(sessionId);
      setDebrief(data);
    } catch (err) {
      setError('Failed to load debrief');
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
          <p className="text-gray-600 mt-4">Loading debrief...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-lg border border-red-200 text-center">
        <p className="text-red-800 font-medium">{error}</p>
        <Link href="/dashboard/interview-intel/history" className="text-red-600 hover:text-red-700 mt-3 inline-flex items-center space-x-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to History</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Interview Debrief</h1>
          <p className="text-gray-600 mt-1">Detailed analysis of your performance</p>
        </div>
        <Link
          href="/dashboard/interview-intel/history"
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to History</span>
        </Link>
      </div>

      {/* Debrief Content */}
      {debrief && <InterviewDebrief debrief={debrief} />}

      {/* Action Buttons */}
      <div className="flex space-x-3 pt-4">
        <Link
          href="/dashboard/interview-intel"
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium text-center transition"
        >
          Start New Interview
        </Link>
        <Link
          href="/dashboard/interview-intel/history"
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-medium text-center transition"
        >
          View All Sessions
        </Link>
      </div>
    </div>
  );
}
