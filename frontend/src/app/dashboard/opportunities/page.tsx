'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Search,
  Shield,
  TrendingUp,
  Briefcase,
  ExternalLink,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { apiService } from '@/lib/api';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  platform: string | null;
  match_percent: number;
  trust_score: number;
  trust_label: string;
  source?: string;
  registration_deadline?: string | null;
}

interface SavedOpportunity {
  id: string;
  company_name: string;
  role: string;
  description: string;
  source_url: string;
  source_platform: string;
  trust_score: number;
  trust_label: string;
  match_percent: number;
  created_at: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  total_pages: number;
  results_per_page: number;
  keywords_used: string[];
  opportunity_type: string;
  used_fallback?: boolean;
  message?: string | null;
  disclaimer?: string;
  sources?: Record<string, number>;
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Opportunities', group: 'General' },
  { value: 'internship', label: 'Internships (General)', group: 'Internships' },
  { value: 'internship_software', label: 'Software Development', group: 'Internships' },
  { value: 'internship_ai_ml', label: 'AI / Machine Learning', group: 'Internships' },
  { value: 'internship_data', label: 'Data Science / Analytics', group: 'Internships' },
  { value: 'internship_web', label: 'Web Development', group: 'Internships' },
  { value: 'internship_mobile', label: 'Mobile Development', group: 'Internships' },
  { value: 'internship_devops', label: 'DevOps / Cloud', group: 'Internships' },
  { value: 'hackathon', label: 'Hackathons & Competitions', group: 'Other' },
  { value: 'job', label: 'Full-time Jobs', group: 'Jobs' },
  { value: 'job_fresher', label: 'Fresher / Entry-level Jobs', group: 'Jobs' },
];

export default function OpportunityFinderPage() {
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [saved, setSaved] = useState<SavedOpportunity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [keywordsUsed, setKeywordsUsed] = useState<string[]>([]);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sourceStats, setSourceStats] = useState<Record<string, number> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    loadSavedOpportunities();
  }, []);

  const loadSavedOpportunities = async () => {
    try {
      const data = await apiService.getSavedOpportunities();
      setSaved(data);
    } catch (err) {
      console.error('Failed to load saved opportunities', err);
    }
  };

  const handleSearch = async (pageNum: number = 1) => {
    setSearching(true);
    setError(null);
    setInfo(null);
    if (pageNum === 1) {
      setHasSearched(true);
      setResults([]);
      setSourceStats(null);
    }

    try {
      const data: SearchResponse = await apiService.searchOpportunities(filter, pageNum);
      setResults(data.results || []);
      setCurrentPage(data.page || 1);
      setTotalPages(data.total_pages || 1);
      setTotalResults(data.total || 0);
      setKeywordsUsed(data.keywords_used || []);
      setSourceStats(data.sources || null);

      if ((data.results || []).length === 0 && pageNum === 1) {
        setError(
          data.message ||
            'No matching listings found. Upload your resume in Resume Analyzer, then try another category.'
        );
      } else {
        if (data.message) {
          setInfo(data.message);
        } else if (data.used_fallback) {
          setInfo('Used broader search — results may be less specific to your filter.');
        }
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(
        detail ||
          'Search failed. Upload your resume in the Resume Analyzer tab first, then search again.'
      );
    } finally {
      setSearching(false);
    }
  };

  const handleTrack = async (result: SearchResult) => {
    setTrackingUrl(result.url);
    try {
      const parts = result.title.includes(' - ')
        ? result.title.split(' - ')
        : result.title.split(' | ');
      const role = parts[0].trim();
      const company = parts.length > 1 ? parts[1].trim() : 'Unknown';

      await apiService.trackOpportunity({
        company_name: company,
        role: role,
        source_url: result.url,
        source_platform: result.platform,
        description: result.snippet,
        trust_score: result.trust_score,
        match_percent: result.match_percent,
      });
      await loadSavedOpportunities();
      setResults((prev) => prev.filter((item) => item.url !== result.url));
    } catch (err) {
      console.error('Track error:', err);
      alert('Failed to track opportunity.');
    } finally {
      setTrackingUrl(null);
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

  const groupedFilters = FILTER_OPTIONS.reduce<Record<string, typeof FILTER_OPTIONS>>((acc, opt) => {
    if (!acc[opt.group]) acc[opt.group] = [];
    acc[opt.group].push(opt);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Opportunity Finder</h1>
        <p className="text-gray-600 mb-4">
          Aggregates real internship and job postings from across the web that match your resume —
          open a listing to apply on the original site. Upload your resume first in{' '}
          <Link href="/dashboard" className="text-blue-600 hover:underline font-medium">
            Resume Analyzer
          </Link>
          .
        </p>

        <div className="flex gap-2 flex-wrap sm:flex-nowrap items-stretch">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {Object.entries(groupedFilters).map(([group, options]) => (
              <optgroup key={group} label={group}>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 font-medium transition whitespace-nowrap"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searching ? 'Searching...' : 'Search Opportunities'}
          </button>
        </div>

        {keywordsUsed.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Resume skills used:</span>
            {keywordsUsed.map((kw) => (
              <span key={kw} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        )}

        {sourceStats && Object.keys(sourceStats).length > 0 && (
          <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-xs font-semibold text-indigo-900 mb-2">Data sources:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sourceStats).map(([source, count]) => (
                count > 0 && (
                  <span
                    key={source}
                    className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full"
                  >
                    {source.replace(/_/g, ' ')}: {count}
                  </span>
                )
              ))}
            </div>
          </div>
        )}

        {info && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            {info}
            {sourceStats && (
              <p className="text-xs mt-1 opacity-75">
                Aggregated from Internshala, RSS feeds, Adzuna, JSearch, and web search.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700">
              <p>{error}</p>
              {error.toLowerCase().includes('resume') && (
                <p className="mt-2 flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  Go to Dashboard → Resume AI → upload PDF → Analyze Resume
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {hasSearched && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Search Results ({results.length} on page {currentPage} of {totalPages} • {totalResults} total)
            </h2>
          </div>
          {results.map((result) => (
            <div
              key={result.url}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{result.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{result.snippet}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {result.platform && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                        {result.platform}
                      </span>
                    )}
                    {result.source && (
                      <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full capitalize">
                        via {result.source.replace('_', ' ')}
                      </span>
                    )}
                    {result.registration_deadline && (
                      <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium">
                        📅 Closes: {result.registration_deadline}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span>{result.match_percent}% match</span>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrustColor(
                      result.trust_score
                    )}`}
                  >
                    <Shield className="w-3 h-3" />
                    {getTrustLabel(result.trust_score)} ({result.trust_score})
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  Apply / View
                </a>
                <button
                  onClick={() => handleTrack(result)}
                  disabled={trackingUrl === result.url}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition disabled:opacity-50"
                >
                  {trackingUrl === result.url ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Briefcase className="w-4 h-4" />
                  )}
                  Track
                </button>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleSearch(currentPage - 1)}
                disabled={currentPage === 1 || searching}
                className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                ← Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  pageNum >= currentPage - 1 && pageNum <= currentPage + 1 ? (
                    <button
                      key={pageNum}
                      onClick={() => handleSearch(pageNum)}
                      disabled={searching}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                        pageNum === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ) : pageNum === currentPage - 2 || pageNum === currentPage + 2 ? (
                    <span key={pageNum} className="px-2 py-2 text-gray-400">
                      ...
                    </span>
                  ) : null
                ))}
              </div>

              <button
                onClick={() => handleSearch(currentPage + 1)}
                disabled={currentPage === totalPages || searching}
                className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>

              <span className="ml-4 text-xs text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )}
        </div>
      )}

      {saved.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Tracked Opportunities ({saved.length})</h2>
          {saved.map((opp) => (
            <div key={opp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{opp.role}</h3>
                  <p className="text-sm text-gray-600">{opp.company_name}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Tracked</span>
              </div>
              {opp.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{opp.description}</p>
              )}
              <a
                href={opp.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                View Original Posting
              </a>
            </div>
          ))}
        </div>
      )}

      {!hasSearched && saved.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-12 text-center border border-gray-200">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Find Your Next Opportunity</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            Upload your resume, pick a category (Software Dev, AI/ML, Web, etc.), then search for
            matched openings you can apply to directly.
          </p>
        </div>
      )}
    </div>
  );
}
