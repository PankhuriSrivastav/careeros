'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://careeros-backend-asbs.onrender.com';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

interface UserProfile {
  topic_counts: { [key: string]: number };
  total_solved: number;
  weekly_pace?: number;
  difficulty_breakdown?: { [key: string]: { easy: number; medium: number; hard: number } };
  sources?: { [key: string]: number };
}

interface TopicResource {
  must_solve?: Array<{ name: string; difficulty: string; url: string; why?: string }>;
  youtube?: { name: string; url: string };
  article?: { name: string; url: string };
}

interface GapItem {
  topic: string;
  user_solved: number;
  company_expected: number;
  coverage_percent: number;
  priority: number;
  companies_needing: string[];
  weeks_to_close?: number;
  problems_needed?: number;
  frequency?: string;
  difficulty?: string;
  resources?: TopicResource;
  source?: string;
}

interface GapAnalysis {
  critical_gaps: GapItem[];
  partial_gaps: GapItem[];
  covered_topics: GapItem[];
  summary?: { total_critical: number; total_partial: number; total_topics_covered: number; total_topics_analyzed: number };
}

const CodingIntelContent = () => {
  const [activeTab, setActiveTab] = useState<'leetcode' | 'hackerrank' | 'manual'>('leetcode');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [leetcodeUsername, setLeetcodeUsername] = useState('');
  const [leetcodeFetching, setLeetcodeFetching] = useState(false);
  const [manualTopics, setManualTopics] = useState<{[key: string]: number}>({
    'Dynamic Programming': 0,
    'Trees': 0,
    'Graphs': 0,
    'Arrays': 0,
    'Linked Lists': 0,
    'Binary Search': 0,
    'Sorting': 0,
    'Hashmaps': 0,
    'Strings': 0,
    'Recursion': 0,
    'Heaps': 0,
    'Tries': 0,
    'Greedy': 0,
    'Math/Bit Manipulation': 0,
    'Stack/Queue': 0,
  });
  const [companySearch, setCompanySearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [studyWeeks, setStudyWeeks] = useState(8);
  const [studyHours, setStudyHours] = useState(2);
  const [studyPlan, setStudyPlan] = useState('');
  const [studyPlanLoading, setStudyPlanLoading] = useState(false);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/coding-intel/companies`, {
          headers: getAuthHeaders()
        });
        setCompanies(response.data.companies);
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };

    fetchCompanies();
    loadSavedProfile();
  }, []);

  const loadSavedProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/coding-intel/profile`, {
        headers: getAuthHeaders()
      });
      if (response.data.profile) {
        setUserProfile(response.data.profile);
      }
    } catch (error) {
      console.error('Error loading saved profile:', error);
    }
  };

  const handleFetchLeetCode = async () => {
    if (!leetcodeUsername.trim()) {
      alert('Please enter your LeetCode username');
      return;
    }

    setLeetcodeFetching(true);
    try {
      const response = await axios.get(`${API_URL}/api/coding-intel/parse/leetcode`, {
        params: { username: leetcodeUsername.trim() },
        headers: getAuthHeaders()
      });

      // Save profile
      await axios.post(`${API_URL}/api/coding-intel/profile`, response.data, {
        headers: getAuthHeaders()
      });

      await loadSavedProfile();
      setGapAnalysis(null);
      alert(`✅ Fetched ${response.data.total_solved} problems across ${Object.keys(response.data.topic_counts).length} topics`);
      setLeetcodeUsername('');
    } catch (error: any) {
      console.error('Error fetching LeetCode profile:', error);
      const errorMessage = error?.response?.data?.detail || 'Could not fetch profile. Try again or enter manually.';
      alert(`❌ ${errorMessage}`);
      // Auto-switch to manual entry on error
      setActiveTab('manual');
    } finally {
      setLeetcodeFetching(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Only HackerRank uses file upload now
      let endpoint = `${API_URL}/api/coding-intel/parse/hackerrank`;

      const response = await axios.post(endpoint, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });

      // Save profile
      await axios.post(`${API_URL}/api/coding-intel/profile`, response.data, {
        headers: getAuthHeaders()
      });

      await loadSavedProfile();
      setGapAnalysis(null);
      alert(`✅ ${response.data.total_solved} problems detected across ${Object.keys(response.data.topic_counts).length} topics`);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      const errorMessage = error?.response?.data?.detail || 'Error parsing HackerRank file';
      alert(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDragActive = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragInactive = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleManualSubmit = async () => {
    const response = await axios.post(`${API_URL}/api/coding-intel/manual`, manualTopics, {
      headers: getAuthHeaders()
    });

    const saveResponse = await axios.post(`${API_URL}/api/coding-intel/profile`, response.data, {
      headers: getAuthHeaders()
    });

    await loadSavedProfile();
    setGapAnalysis(null);
    alert('✅ Manual profile saved');
  };

  const handleAnalyze = async () => {
    if (selectedCompanies.length === 0) {
      alert('Please select at least one company');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/coding-intel/analyze`, {
        companies: selectedCompanies
      }, {
        headers: getAuthHeaders()
      });

      setGapAnalysis(response.data);
      setStudyPlan('');
    } catch (error) {
      console.error('Error analyzing gaps:', error);
      alert('❌ Error analyzing gaps');
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.toLowerCase().includes(companySearch.toLowerCase())
  );

  const displayedCompanies = companySearch ? filteredCompanies : companies.slice(0, 12);
  const addCustomCompany = () => {
    const company = companySearch.trim();
    if (!company) return;
    if (!companies.some(c => c.toLowerCase() === company.toLowerCase())) {
      setCompanies([...companies, company].sort());
    }
    if (!selectedCompanies.some(c => c.toLowerCase() === company.toLowerCase())) {
      setSelectedCompanies([...selectedCompanies, company]);
    }
    setCompanySearch('');
  };

  const handleGenerateStudyPlan = async () => {
    if (!gapAnalysis || selectedCompanies.length === 0) return;

    setStudyPlanLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/coding-intel/study-plan`, {
        weeks_until_interview: studyWeeks,
        hours_per_day: studyHours,
        company: selectedCompanies[0],
        critical_gaps: gapAnalysis.critical_gaps
      }, {
        headers: getAuthHeaders()
      });

      setStudyPlan(response.data.study_plan);
    } catch (error: any) {
      console.error('Error generating study plan:', error);
      alert(`❌ ${error?.response?.data?.detail || 'Error generating study plan'}`);
    } finally {
      setStudyPlanLoading(false);
    }
  };

  const renderGapCard = (gap: GapItem, tone: 'red' | 'yellow') => {
    const resources = gap.resources || {};
    const problems = resources.must_solve?.slice(0, 3) || [];

    return (
      <div key={gap.topic} className={`${tone === 'red' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-bold text-slate-900">{gap.topic}</h4>
          <span className="text-xs font-semibold text-slate-600">Priority #{gap.priority}</span>
        </div>
        <p className="text-sm text-slate-700 mb-2">
          You: <strong>{gap.user_solved}</strong> / Need: <strong>{gap.company_expected}</strong>
          {gap.problems_needed !== undefined && gap.problems_needed > 0 && ` (${gap.problems_needed} more)`}
        </p>
        <div className="w-full bg-slate-300 rounded-full h-2 mb-3">
          <div
            className={`${tone === 'red' ? 'bg-red-600' : 'bg-yellow-500'} h-2 rounded-full transition`}
            style={{width: `${Math.min(gap.coverage_percent, 100)}%`}}
          ></div>
        </div>
        <p className="text-xs text-slate-600 mb-2">
          Needed by: {gap.companies_needing.join(', ')}
          {gap.source === 'ai_estimated' && ' • AI estimated'}
        </p>
        {(gap.frequency || gap.difficulty) && (
          <p className="text-xs text-slate-600 mb-3">
            {gap.frequency && `Frequency: ${gap.frequency}`}
            {gap.frequency && gap.difficulty && ' • '}
            {gap.difficulty && `Difficulty: ${gap.difficulty}`}
          </p>
        )}
        {problems.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-700 mb-1">Must solve</p>
            <div className="space-y-1">
              {problems.map(problem => (
                <a key={problem.url} href={problem.url} target="_blank" rel="noreferrer" className="block text-sm text-blue-700 hover:underline">
                  {problem.name} ({problem.difficulty})
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-sm">
          {resources.youtube && <a href={resources.youtube.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{resources.youtube.name}</a>}
          {resources.article && <a href={resources.article.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{resources.article.name}</a>}
        </div>
        {gap.weeks_to_close && (
          <p className="text-sm text-slate-900 mt-3">
            ⏱️ Close in ~<strong>{gap.weeks_to_close.toFixed(1)} weeks</strong> at your pace
          </p>
        )}
      </div>
    );
  };

  const topicEntries = userProfile
    ? Object.entries(userProfile.topic_counts).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-6">
      {/* Section 1: Input Panel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Upload Your Practice History</h2>
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('leetcode')}
            className={`px-6 py-3 font-semibold transition ${activeTab === 'leetcode' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
          >
            LeetCode
          </button>
          <button
            onClick={() => setActiveTab('hackerrank')}
            className={`px-6 py-3 font-semibold transition ${activeTab === 'hackerrank' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
          >
            HackerRank
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-6 py-3 font-semibold transition ${activeTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Manual Entry
          </button>
        </div>

        {activeTab === 'leetcode' && (
          <div>
            <p className="text-slate-600 mb-6">Enter your LeetCode username to fetch your solved problems</p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="e.g., your_username"
                value={leetcodeUsername}
                onChange={(e) => setLeetcodeUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleFetchLeetCode()}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={leetcodeFetching}
              />
              <button
                onClick={handleFetchLeetCode}
                disabled={leetcodeFetching}
                className={`px-6 py-2 font-semibold rounded-lg transition ${leetcodeFetching ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                {leetcodeFetching ? 'Fetching...' : 'Fetch Profile'}
              </button>
            </div>
            {leetcodeFetching && (
              <p className="text-blue-600 text-sm mt-3">⏳ Fetching your LeetCode profile...</p>
            )}
          </div>
        )}

        {activeTab === 'hackerrank' && (
          <div>
            <p className="text-slate-600 mb-6">Go to <strong>hackerrank.com → Profile → Download submission history (JSON)</strong></p>
            <label
              onDragEnter={handleDragActive}
              onDragLeave={handleDragInactive}
              onDragOver={handleDragActive}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
            >
              <input
                type="file"
                accept=".json,.csv"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
              <div className="text-center">
                <div className="text-3xl mb-2">📁</div>
                <p className="text-slate-900 font-semibold mb-1">Drop JSON file here</p>
                <p className="text-slate-600 text-sm">or click to browse</p>
              </div>
            </label>
          </div>
        )}

        {activeTab === 'manual' && (
          <div>
            <p className="text-slate-600 mb-6">Enter how many problems you've solved in each topic</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(manualTopics).map(([topic, count]) => (
                <div key={topic}>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">{topic}</label>
                  <input
                    type="number"
                    min="0"
                    value={count}
                    onChange={(e) => setManualTopics({...manualTopics, [topic]: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              ))}
              <button
                onClick={handleManualSubmit}
                className="col-span-2 md:col-span-3 mt-4 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                Submit Manual Entry
              </button>
            </div>
            <style>{`
              input[type="number"]::-webkit-outer-spin-button,
              input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
              }
              input[type="number"] {
                -moz-appearance: textfield;
              }
            `}</style>
          </div>
        )}
      </div>

      {userProfile && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-slate-900">
            <strong>Your profile:</strong> {userProfile.total_solved} problems across {Object.keys(userProfile.topic_counts).length} topics
            {userProfile.weekly_pace && ` • ~${userProfile.weekly_pace.toFixed(1)} problems/week`}
          </p>
          {userProfile.sources && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(userProfile.sources).map(([source, total]) => (
                <span key={source} className="px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-semibold text-slate-700">
                  {source}: {total}
                </span>
              ))}
            </div>
          )}
          {topicEntries.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Topic breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {topicEntries.map(([topic, count]) => (
                  <div key={topic} className="flex items-center justify-between rounded-lg border border-blue-100 bg-white px-3 py-2">
                    <span className="text-sm font-medium text-slate-800">{topic}</span>
                    <span className="text-sm font-bold text-blue-700">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-700">
              No topic breakdown is available yet. Try another source or use Manual Entry to add counts.
            </p>
          )}
        </div>
      )}

      {/* Section 2: Company Selector */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Select Target Companies</h2>
        
        <input
          type="text"
          placeholder="Search companies or add your own..."
          value={companySearch}
          onChange={(e) => setCompanySearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustomCompany()}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {companySearch.trim() && !companies.some(c => c.toLowerCase() === companySearch.trim().toLowerCase()) && (
          <button
            onClick={addCustomCompany}
            className="mb-4 px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition"
          >
            + Add "{companySearch.trim()}"
          </button>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {displayedCompanies.map(company => (
            <button
              key={company}
              onClick={() => {
                if (selectedCompanies.includes(company)) {
                  setSelectedCompanies(selectedCompanies.filter(c => c !== company));
                } else {
                  setSelectedCompanies([...selectedCompanies, company]);
                }
              }}
              className={`px-4 py-2 rounded-full font-semibold transition ${
                selectedCompanies.includes(company)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              {company}
            </button>
          ))}
        </div>

        {selectedCompanies.length > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:bg-slate-400"
          >
            {loading ? 'Analyzing...' : '🔍 Analyze My Gaps'}
          </button>
        )}
      </div>

      {/* Section 3: Gap Analysis Results */}
      {gapAnalysis && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">📈 Gap Analysis Results</h2>
          
          {gapAnalysis.critical_gaps && gapAnalysis.critical_gaps.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-red-700 mb-4">❌ Critical Gaps</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gapAnalysis.critical_gaps.map((gap) => renderGapCard(gap, 'red'))}
              </div>
            </div>
          )}

          {gapAnalysis.partial_gaps && gapAnalysis.partial_gaps.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-yellow-700 mb-4">⚠️ Partial Coverage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gapAnalysis.partial_gaps.map((gap) => renderGapCard(gap, 'yellow'))}
              </div>
            </div>
          )}

          {gapAnalysis.covered_topics && gapAnalysis.covered_topics.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-bold text-green-700 mb-3">✅ Covered Topics ({gapAnalysis.covered_topics.length})</h3>
              <div className="flex flex-wrap gap-2">
                {gapAnalysis.covered_topics.map((gap: any) => (
                  <span key={gap.topic} className="px-3 py-1 bg-green-200 text-green-900 rounded-full text-sm font-semibold">
                    {gap.topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Generate Study Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Weeks until interview</span>
                <input
                  type="number"
                  min="1"
                  value={studyWeeks}
                  onChange={(e) => setStudyWeeks(parseInt(e.target.value) || 1)}
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Hours per day</span>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={studyHours}
                  onChange={(e) => setStudyHours(parseFloat(e.target.value) || 1)}
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <button
                onClick={handleGenerateStudyPlan}
                disabled={studyPlanLoading || gapAnalysis.critical_gaps.length === 0}
                className="self-end px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-slate-400"
              >
                {studyPlanLoading ? 'Generating...' : 'Generate Plan'}
              </button>
            </div>
            {studyPlan && (
              <pre className="mt-5 whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-800 font-sans">
                {studyPlan}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodingIntelContent;
