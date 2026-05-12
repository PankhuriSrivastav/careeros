'use client';

import { useState, useEffect } from 'react';
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
import { Calendar, TrendingUp, Target, Clock, Award, AlertCircle, Loader2 } from 'lucide-react';

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

const renderCustomLabel = (entry: any) => {
  const percent = entry.percent;
  if (percent === undefined) return entry.name;
  return `${entry.name}: ${(percent * 100).toFixed(0)}%`;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const applications = await apiService.getApplications();
      
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
      } else if (total > 0) {
        insights.push("📝 Your response rate needs improvement. Try tailoring your resume for each application.");
      }
      
      if (applicationsOverTime.length > 0) {
        const lastWeek = applicationsOverTime.slice(-7);
        const weeklyAvg = lastWeek.reduce((sum, d) => sum + d.count, 0) / Math.max(1, lastWeek.length);
        if (weeklyAvg > 2) {
          insights.push("🔥 You're applying consistently! This increases your chances significantly.");
        }
      }
      
      if (offer > 0) {
        insights.push("🎉 Congratulations on your offer(s)! Your hard work is paying off.");
      } else if (interview > 0) {
        insights.push("💪 You're getting interviews! Focus on preparation to convert them into offers.");
      } else if (total === 0) {
        insights.push("✨ Add your first application to see insights and track your progress!");
      } else {
        insights.push("🚀 Keep applying! Every application brings you closer to your dream job.");
      }
      
      setData({
        totalApplications: total,
        applied,
        interview,
        offer,
        rejected,
        responseRate,
        successRate,
        averageResponseTime: 0,
        applicationsOverTime,
        statusBreakdown,
        topCompanies,
        insights,
      });
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      if (err?.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError('Failed to load analytics. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-lg text-red-600 font-medium mb-4">{error}</p>
          <button
            onClick={loadAnalytics}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg text-gray-500">No analytics data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Applications</p>
              <p className="text-3xl font-bold text-blue-600">{data.totalApplications}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Response Rate</p>
              <p className="text-3xl font-bold text-green-600">{data.responseRate}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Interviews</p>
              <p className="text-3xl font-bold text-yellow-600">{data.interview}</p>
            </div>
            <Target className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Offers</p>
              <p className="text-3xl font-bold text-purple-600">{data.offer}</p>
            </div>
            <Award className="w-8 h-8 text-purple-400" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Applications Over Time</h2>
          {data.applicationsOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.applicationsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Applications" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-400">
              No application data in the last 30 days
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Status Breakdown</h2>
          {data.statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
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
            <div className="h-72 flex items-center justify-center text-gray-400">
              No application data yet
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Top Companies Applied</h2>
          {data.topCompanies.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topCompanies} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="company" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" name="Applications" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-400">
              No applications yet
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Insights & Recommendations</h2>
          <div className="space-y-3">
            {data.insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-sm">{insight}</p>
              </div>
            ))}
          </div>
          {data.totalApplications === 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                💡 <strong>Get started:</strong> Add your job applications in the Job Tracker tab to see analytics here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}