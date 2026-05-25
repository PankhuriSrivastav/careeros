'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

const CodingIntelPage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'leetcode' | 'hackerrank' | 'manual'>('leetcode');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState(null);
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

  // Fetch companies list on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await axios.get('/api/coding-intel/companies', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
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
      const response = await axios.get('/api/coding-intel/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.data.profile) {
        setUserProfile(response.data.profile);
      }
    } catch (error) {
      console.error('Error loading saved profile:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      let endpoint = '/api/coding-intel/parse/leetcode';
      if (activeTab === 'hackerrank') {
        endpoint = '/api/coding-intel/parse/hackerrank';
      }

      const response = await axios.post(endpoint, formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Save profile
      const saveResponse = await axios.post('/api/coding-intel/profile', response.data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setUserProfile(response.data);
      alert(`✅ ${response.data.total_solved} problems detected across ${Object.keys(response.data.topic_counts).length} topics`);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('❌ Error parsing CSV file');
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
    const response = await axios.post('/api/coding-intel/manual', manualTopics, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const saveResponse = await axios.post('/api/coding-intel/profile', response.data, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    setUserProfile(response.data);
    alert('✅ Manual profile saved');
  };

  const handleAnalyze = async () => {
    if (selectedCompanies.length === 0) {
      alert('Please select at least one company');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/coding-intel/analyze', {
        companies: selectedCompanies
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setGapAnalysis(response.data);
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

  const displayedCompanies = companySearch ? filteredCompanies : selectedCompanies.length > 0 ? selectedCompanies : companies.slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">📊 Coding Round Intel</h1>
          <p className="text-slate-600">Upload your LeetCode/HackerRank history or enter manually. We'll tell you exactly what to study for your target companies.</p>
        </div>

        {/* Section 1: Input Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
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

          {/* LeetCode Tab */}
          {activeTab === 'leetcode' && (
            <div>
              <p className="text-slate-600 mb-4">Go to <strong>leetcode.com → Profile → Download CSV</strong></p>
              <label
                onDragEnter={handleDragActive}
                onDragLeave={handleDragInactive}
                onDragOver={handleDragActive}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer transition ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
                <div className="text-center">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-slate-900 font-semibold mb-1">Drop CSV file here</p>
                  <p className="text-slate-600 text-sm">or click to browse</p>
                </div>
              </label>
            </div>
          )}

          {/* HackerRank Tab */}
          {activeTab === 'hackerrank' && (
            <div>
              <p className="text-slate-600 mb-4">Go to <strong>hackerrank.com → Profile → Download submission history</strong></p>
              <label
                onDragEnter={handleDragActive}
                onDragLeave={handleDragInactive}
                onDragOver={handleDragActive}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer transition ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
                <div className="text-center">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-slate-900 font-semibold mb-1">Drop CSV file here</p>
                  <p className="text-slate-600 text-sm">or click to browse</p>
                </div>
              </label>
            </div>
          )}

          {/* Manual Tab */}
          {activeTab === 'manual' && (
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
          )}
        </div>

        {/* Current Profile Summary */}
        {userProfile && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <p className="text-slate-900">
              <strong>Your combined profile:</strong> {userProfile.total_solved} problems across {Object.keys(userProfile.topic_counts).length} topics
              {userProfile.weekly_pace && ` • ~${userProfile.weekly_pace.toFixed(1)} problems/week`}
            </p>
          </div>
        )}

        {/* Section 2: Company Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">🏢 Select Target Companies</h2>
          
          <input
            type="text"
            placeholder="Search companies..."
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

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
            
            {/* Critical Gaps */}
            {gapAnalysis.critical_gaps && gapAnalysis.critical_gaps.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-red-700 mb-4">❌ Critical Gaps</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gapAnalysis.critical_gaps.map((gap) => (
                    <div key={gap.topic} className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-bold text-slate-900 mb-2">{gap.topic}</h4>
                      <p className="text-sm text-slate-700 mb-2">
                        You: <strong>{gap.user_solved}</strong> vs Expected: <strong>{gap.company_expected}</strong>
                      </p>
                      <div className="w-full bg-slate-300 rounded-full h-2 mb-3">
                        <div
                          className="bg-red-600 h-2 rounded-full transition"
                          style={{width: `${Math.min(gap.coverage_percent, 100)}%`}}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-600 mb-3">
                        Needed by: {gap.companies_needing.join(', ')}
                      </p>
                      {gap.weeks_to_close && (
                        <p className="text-sm text-slate-900">
                          ⏱️ Close in ~<strong>{gap.weeks_to_close.toFixed(1)} weeks</strong> at your pace
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Partial Gaps */}
            {gapAnalysis.partial_gaps && gapAnalysis.partial_gaps.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-yellow-700 mb-4">⚠️ Partial Coverage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gapAnalysis.partial_gaps.map((gap) => (
                    <div key={gap.topic} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-bold text-slate-900 mb-2">{gap.topic}</h4>
                      <p className="text-sm text-slate-700 mb-2">
                        You: <strong>{gap.user_solved}</strong> vs Expected: <strong>{gap.company_expected}</strong>
                      </p>
                      <div className="w-full bg-slate-300 rounded-full h-2 mb-3">
                        <div
                          className="bg-yellow-500 h-2 rounded-full transition"
                          style={{width: `${Math.min(gap.coverage_percent, 100)}%`}}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-600">
                        Needed by: {gap.companies_needing.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Covered Topics */}
            {gapAnalysis.covered_topics && gapAnalysis.covered_topics.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-bold text-green-700 mb-3">✅ Covered Topics ({gapAnalysis.covered_topics.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {gapAnalysis.covered_topics.map((gap) => (
                    <span key={gap.topic} className="px-3 py-1 bg-green-200 text-green-900 rounded-full text-sm font-semibold">
                      {gap.topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodingIntelPage;
