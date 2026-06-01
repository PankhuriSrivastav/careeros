'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, Zap } from 'lucide-react';
import Link from 'next/link';

interface Session {
  id: string;
  company_name: string;
  mode: string;
  status: string;
  overall_score?: number;
  created_at: string;
}

interface InterviewHistoryProps {
  sessions: Session[];
}

export default function InterviewHistory({ sessions }: InterviewHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow border border-gray-200 text-center">
        <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No interviews yet. Start your first mock interview!</p>
      </div>
    );
  }

  const chartData = sessions
    .filter(s => s.overall_score)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(s => ({
      date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: s.overall_score,
      company: s.company_name,
    }));

  return (
    <div className="space-y-6">
      {/* Score Trend Chart */}
      {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-4">Score Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip
                formatter={(value) => `${value}/100`}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                dot={{ fill: '#3b82f6' }}
                name="Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sessions List */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">Interview Sessions</h3>
        </div>
        <div className="divide-y">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={session.status === 'completed' ? `/dashboard/interview-intel/session/${session.id}/debrief` : `/dashboard/interview-intel/session/${session.id}`}
              className="block p-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{session.company_name}</p>
                  <div className="flex items-center space-x-4 mt-1 text-xs text-gray-600">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(session.created_at).toLocaleDateString()}</span>
                    </span>
                    <span className="capitalize">{session.mode}</span>
                    <span className={`px-2 py-1 rounded ${
                      session.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {session.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                </div>
                {session.overall_score && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{session.overall_score}</p>
                    <p className="text-xs text-gray-500">/100</p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
