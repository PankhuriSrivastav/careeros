'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/lib/api';
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  Plus,
  Shield,
  TrendingUp,
  Briefcase,
} from 'lucide-react';

interface Opportunity {
  id: string;
  company_name: string;
  role: string;
  description: string;
  source_url: string;
  source_platform: string;
  trust_score: number;
  match_percent: number;
  created_at: string;
}

export default function OpportunitiesPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opportunities`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data);
      }
    } catch (err) {
      console.error('Failed to load opportunities', err);
    }
  };

  const handleAdd = async () => {
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opportunities/add?url=${encodeURIComponent(url)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (response.ok) {
        setUrl('');
        await loadOpportunities();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to add opportunity');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setAdding(false);
    }
  };

  const handleTrack = async (opp: Opportunity) => {
    try {
      await apiService.createApplication({
        company: opp.company_name,
        role: opp.role,
        status: 'Interested',
        applied_date: new Date().toISOString().split('T')[0],
        notes: opp.source_url,
        job_description: opp.description,
      });
      alert('✅ Added to Application Tracker!');
    } catch (err) {
      console.error('Failed to track', err);
    }
  };

  const getTrustColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getTrustLabel = (score: number) => {
    if (score >= 70) return 'High Trust';
    if (score >= 40) return 'Medium Trust';
    return 'Low Trust';
  };

  return (
    <div className="space-y-6">
      {/* Header with URL input */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Opportunity Finder</h1>
        <p className="text-gray-600 mb-4">
          Paste a job posting URL and we'll extract the details, show how it matches your resume, and flag potential scams.
        </p>

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://linkedin.com/jobs/..."
            className="flex-1 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !url.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {adding ? 'Extracting...' : 'Add Opportunity'}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Opportunities List */}
      {opportunities.length > 0 ? (
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{opp.role}</h3>
                  <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                    <Briefcase className="w-4 h-4" />
                    {opp.company_name}
                    {opp.source_platform && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                        {opp.source_platform}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span>{opp.match_percent}% match</span>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrustColor(
                      opp.trust_score
                    )}`}
                  >
                    <Shield className="w-3 h-3" />
                    {getTrustLabel(opp.trust_score)} ({opp.trust_score})
                  </div>
                </div>
              </div>

              {opp.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-3">{opp.description}</p>
              )}

              <div className="flex gap-2 mt-3">
                <a
                  href={opp.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Posting
                </a>
                <button
                  onClick={() => handleTrack(opp)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
                >
                  <Plus className="w-4 h-4" />
                  Track
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-12 text-center border border-gray-200">
          <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No Opportunities Yet</h2>
          <p className="text-gray-400">Paste a job URL above to get started.</p>
        </div>
      )}
    </div>
  );
}