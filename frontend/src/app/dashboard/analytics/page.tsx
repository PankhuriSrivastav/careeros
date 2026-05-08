'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Calendar, TrendingUp, Target, Clock, Award, AlertCircle } from 'lucide-react';

interface AnalyticsData {
  totalApplications: number;
  applied: number;
  interview: number;
  offer: number;
  rejected: number;
  responseRate: number;
  successRate: number;
  averageResponseTime: number;
  applicationsOverTime: { date: string; count: number }[];
  statusBreakdown: { name: string; value: number; color: string }[];
  topCompanies: { company: string; count: number }[];
  insights: string[];
}

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      router.push('/login');
    } else {
      loadAnalytics();
    }
  }, []);

  const loadAnalytics = async () => {
    try {
      const applications = await apiService.getApplications();
      
      // Calculate analytics
      const total = applications.length;
      const applied = applications.filter(a => a.status === 'Applied').length;
      const interview = applications.filter(a => a.status === 'Interview').length;
      const offer = applications.filter(a => a.status === 'Offer').length;
      const rejected = applications.filter(a => a.status === 'Rejected').length;
      
      const responseRate = total > 0 ? Math.round(((interview + offer) / total) * 100) : 0;
      const successRate = total > 0 ? Math.round((offer / total) * 100) : 0;
      
      // Applications over time (last 30 days)
      const dateMap = new Map<string, number>();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      applications.forEach(app => {
        const date = app.applied_date;
        if (new Date(date) >= thirtyDaysAgo) {
          dateMap.set(date, (dateMap.get(date) || 0) + 1);
        }
      });
      
      const applicationsOverTime = Array.from(dateMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Status breakdown
      const statusBreakdown = [
        { name: 'Applied', value: applied, color: '#3b82f6' },
        { name: 'Interview', value: interview, color: '#f59e0b' },
        { name: 'Offer', value: offer, color: '#10b981' },
        { name: 'Rejected', value: rejected, color: '#ef4444' },
      ].filter(s => s.value > 0);
      
      // Top companies
      const companyMap = new Map<string, number>();
      applications.forEach(app => {
        companyMap.set(app.company, (companyMap.get(app.company) || 0) + 1);
      });
      const topCompanies = Array.from(companyMap.entries())
        .map(([company, count]) => ({ company, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      // Insights
      const insights: string[] = [];
      if (responseRate > 50) {
        insights.push("🎯 Your response rate is excellent! Keep up the good work.");
      } else if (responseRate > 30) {
        insights.push("📈 Your response rate is good. Consider optimizing your resume for better results.");
      } else {
        insights.push("📝 Your response rate needs improvement. Try tailoring your resume for each application.");
      }
      
      if (applicationsOverTime.length > 0) {
        const lastWeek = applicationsOverTime.slice(-7);
        const weeklyAvg = lastWeek.reduce((sum, d) => sum + d.count, 0) / 7;
        if (weeklyAvg > 2) {
          insights.push("🔥 You're applying consistently! This increases your chances significantly.");
        }
      }
      
      if (offer > 0) {
        insights.push("🎉 Congratulations on your offer(s)! Your hard work is paying off.");
      } else if (interview > 0) {
        insights.push("💪 You're getting interviews! Focus on preparation to convert them into offers.");
      }
      
      setData({
        totalApplications: total,
        applied,
        interview,
        offer,
        rejected,
        responseRate,
        successRate,
        averageResponseTime: 0, // Would need additional data
        applicationsOverTime,
        statusBreakdown,
        topCompanies,
        insights,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading analytics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">Failed to load analytics</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Track your job search progress and insights</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Applications</p>
                <p className="text-3xl font-bold text-blue-600">{data.totalApplications}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Response Rate</p>
                <p className="text-3xl font-bold text-green-600">{data.responseRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Interviews</p>
                <p className="text-3xl font-bold text-yellow-600">{data.interview}</p>
              </div>
              <Target className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Offers</p>
                <p className="text-3xl font-bold text-purple-600">{data.offer}</p>
              </div>
              <Award className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Success Rate</p>
                <p className="text-3xl font-bold text-indigo-600">{data.successRate}%</p>
              </div>
              <Clock className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Applications Over Time */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">Applications Over Time</h2>
            {data.applicationsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.applicationsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Applications" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-gray-500">
                No application data in the last 30 days
              </div>
            )}
          </div>

          {/* Status Breakdown */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">Status Breakdown</h2>
            {data.statusBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.statusBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.statusBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-gray-500">
                No application data yet
              </div>
            )}
          </div>
        </div>

        {/* Top Companies */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">Top Companies Applied</h2>
            {data.topCompanies.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topCompanies} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="company" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name="Applications" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-gray-500">
                No applications yet
              </div>
            )}
          </div>

          {/* Insights */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">Insights & Recommendations</h2>
            <div className="space-y-3">
              {data.insights.map((insight, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-700">{insight}</p>
                </div>
              ))}
              {data.insights.length === 0 && (
                <p className="text-gray-500 text-center py-8">
                  Add more applications to see personalized insights
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}