'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import { 
  Briefcase, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Upload,
  Loader2,
  Target,
  BookOpen
} from 'lucide-react';

interface CompanySkill {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  frequency: string;
}

interface CompanyData {
  name: string;
  tier: 'tier1' | 'tier2';
  skills: CompanySkill[];
  sampleProblems: { name: string; topic: string; difficulty: string; link: string }[];
  resources: { name: string; url: string }[];
}

// Company database
const COMPANY_DATABASE: CompanyData[] = [
  {
    name: 'Google',
    tier: 'tier1',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '90% of interviews' },
      { skill: 'System Design', priority: 'high', frequency: '75% of interviews' },
      { skill: 'Dynamic Programming', priority: 'high', frequency: '65% of interviews' },
      { skill: 'Python/Java', priority: 'high', frequency: '70% of interviews' },
      { skill: 'Distributed Systems', priority: 'medium', frequency: '40% of interviews' },
      { skill: 'Trees & Graphs', priority: 'medium', frequency: '50% of interviews' },
    ],
    sampleProblems: [
      { name: 'Longest Increasing Subsequence', topic: 'DP', difficulty: 'Medium', link: 'https://leetcode.com/problems/longest-increasing-subsequence' },
      { name: 'Number of Islands', topic: 'Graph', difficulty: 'Medium', link: 'https://leetcode.com/problems/number-of-islands' },
      { name: 'LRU Cache', topic: 'Design', difficulty: 'Medium', link: 'https://leetcode.com/problems/lru-cache' },
    ],
    resources: [
      { name: 'LeetCode Google Tag', url: 'https://leetcode.com/tag/google' },
      { name: 'GFG Google Preparation', url: 'https://www.geeksforgeeks.org/company-preparation/google/' },
    ],
  },
  {
    name: 'Amazon',
    tier: 'tier1',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '95% of interviews' },
      { skill: 'System Design', priority: 'high', frequency: '70% of interviews' },
      { skill: 'Leadership Principles', priority: 'high', frequency: '100% of interviews' },
      { skill: 'Java', priority: 'high', frequency: '60% of interviews' },
      { skill: 'AWS', priority: 'medium', frequency: '40% of interviews' },
      { skill: 'Object Oriented Design', priority: 'medium', frequency: '35% of interviews' },
    ],
    sampleProblems: [
      { name: 'Two Sum', topic: 'Array', difficulty: 'Easy', link: 'https://leetcode.com/problems/two-sum' },
      { name: 'Maximum Subarray', topic: 'DP', difficulty: 'Medium', link: 'https://leetcode.com/problems/maximum-subarray' },
      { name: 'Rotate Image', topic: 'Matrix', difficulty: 'Medium', link: 'https://leetcode.com/problems/rotate-image' },
    ],
    resources: [
      { name: 'LeetCode Amazon Tag', url: 'https://leetcode.com/tag/amazon' },
      { name: 'GFG Amazon Preparation', url: 'https://www.geeksforgeeks.org/company-preparation/amazon/' },
    ],
  },
  {
    name: 'Microsoft',
    tier: 'tier1',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '90% of interviews' },
      { skill: 'System Design', priority: 'high', frequency: '60% of interviews' },
      { skill: 'C#/.NET', priority: 'high', frequency: '50% of interviews' },
      { skill: 'Problem Solving', priority: 'high', frequency: '85% of interviews' },
      { skill: 'Azure', priority: 'medium', frequency: '30% of interviews' },
      { skill: 'Operating Systems', priority: 'medium', frequency: '35% of interviews' },
    ],
    sampleProblems: [
      { name: 'Reverse Linked List', topic: 'Linked List', difficulty: 'Easy', link: 'https://leetcode.com/problems/reverse-linked-list' },
      { name: 'Course Schedule', topic: 'Graph', difficulty: 'Medium', link: 'https://leetcode.com/problems/course-schedule' },
      { name: 'Design Tic-Tac-Toe', topic: 'Design', difficulty: 'Medium', link: 'https://leetcode.com/problems/design-tic-tac-toe' },
    ],
    resources: [
      { name: 'LeetCode Microsoft Tag', url: 'https://leetcode.com/tag/microsoft' },
      { name: 'GFG Microsoft Preparation', url: 'https://www.geeksforgeeks.org/company-preparation/microsoft/' },
    ],
  },
  {
    name: 'Meta',
    tier: 'tier1',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '95% of interviews' },
      { skill: 'System Design', priority: 'high', frequency: '80% of interviews' },
      { skill: 'React', priority: 'high', frequency: '50% of interviews' },
      { skill: 'JavaScript', priority: 'high', frequency: '60% of interviews' },
      { skill: 'Product Sense', priority: 'medium', frequency: '40% of interviews' },
      { skill: 'PHP/Hack', priority: 'low', frequency: '20% of interviews' },
    ],
    sampleProblems: [
      { name: 'Valid Parentheses', topic: 'Stack', difficulty: 'Easy', link: 'https://leetcode.com/problems/valid-parentheses' },
      { name: 'Merge Intervals', topic: 'Array', difficulty: 'Medium', link: 'https://leetcode.com/problems/merge-intervals' },
      { name: 'Lowest Common Ancestor', topic: 'Tree', difficulty: 'Medium', link: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree' },
    ],
    resources: [
      { name: 'LeetCode Meta Tag', url: 'https://leetcode.com/tag/facebook' },
      { name: 'GFG Meta Preparation', url: 'https://www.geeksforgeeks.org/company-preparation/facebook/' },
    ],
  },
  {
    name: 'Flipkart',
    tier: 'tier2',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '85% of interviews' },
      { skill: 'Java', priority: 'high', frequency: '60% of interviews' },
      { skill: 'Spring Boot', priority: 'medium', frequency: '40% of interviews' },
      { skill: 'System Design', priority: 'medium', frequency: '35% of interviews' },
      { skill: 'Microservices', priority: 'medium', frequency: '30% of interviews' },
      { skill: 'REST APIs', priority: 'medium', frequency: '40% of interviews' },
    ],
    sampleProblems: [
      { name: 'Max Sliding Window', topic: 'Queue', difficulty: 'Hard', link: 'https://leetcode.com/problems/sliding-window-maximum' },
      { name: 'Clone Graph', topic: 'Graph', difficulty: 'Medium', link: 'https://leetcode.com/problems/clone-graph' },
    ],
    resources: [
      { name: 'GFG Flipkart Preparation', url: 'https://www.geeksforgeeks.org/company-preparation/flipkart/' },
    ],
  },
  {
    name: 'Zomato',
    tier: 'tier2',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '80% of interviews' },
      { skill: 'Python/JavaScript', priority: 'high', frequency: '70% of interviews' },
      { skill: 'System Design', priority: 'medium', frequency: '30% of interviews' },
      { skill: 'SQL', priority: 'medium', frequency: '40% of interviews' },
      { skill: 'REST APIs', priority: 'medium', frequency: '45% of interviews' },
      { skill: 'Node.js/React', priority: 'low', frequency: '25% of interviews' },
    ],
    sampleProblems: [
      { name: 'Find the Winner', topic: 'Array', difficulty: 'Medium', link: 'https://leetcode.com/problems/find-the-winner' },
    ],
    resources: [
      { name: 'GFG Zomato Preparation', url: 'https://www.geeksforgeeks.org/company-preparation/zomato/' },
    ],
  },
  {
    name: 'Razorpay',
    tier: 'tier2',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '85% of interviews' },
      { skill: 'Python', priority: 'high', frequency: '70% of interviews' },
      { skill: 'System Design', priority: 'medium', frequency: '35% of interviews' },
      { skill: 'Django/Flask', priority: 'medium', frequency: '30% of interviews' },
      { skill: 'Fintech Domain', priority: 'low', frequency: '20% of interviews' },
    ],
    sampleProblems: [
      { name: 'Coin Change', topic: 'DP', difficulty: 'Medium', link: 'https://leetcode.com/problems/coin-change' },
    ],
    resources: [
      { name: 'GFG Razorpay Preparation', url: 'https://www.geeksforgeeks.org/company-preparation/razorpay/' },
    ],
  },
  {
    name: 'CRED',
    tier: 'tier2',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '80% of interviews' },
      { skill: 'Python/Go', priority: 'high', frequency: '60% of interviews' },
      { skill: 'System Design', priority: 'high', frequency: '45% of interviews' },
      { skill: 'Microservices', priority: 'medium', frequency: '30% of interviews' },
      { skill: 'Fintech Domain', priority: 'medium', frequency: '25% of interviews' },
    ],
    sampleProblems: [
      { name: 'Design a Key-Value Store', topic: 'Design', difficulty: 'Hard', link: 'https://leetcode.com/problems/design-a-key-value-store' },
    ],
    resources: [
      { name: 'LeetCode', url: 'https://leetcode.com' },
    ],
  },
  {
    name: 'PhonePe',
    tier: 'tier2',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '85% of interviews' },
      { skill: 'Java', priority: 'high', frequency: '65% of interviews' },
      { skill: 'System Design', priority: 'medium', frequency: '30% of interviews' },
      { skill: 'Fintech Domain', priority: 'low', frequency: '20% of interviews' },
    ],
    sampleProblems: [
      { name: 'Minimum Jumps', topic: 'DP', difficulty: 'Medium', link: 'https://leetcode.com/problems/jump-game-ii' },
    ],
    resources: [
      { name: 'LeetCode', url: 'https://leetcode.com' },
    ],
  },
  {
    name: 'Swiggy',
    tier: 'tier2',
    skills: [
      { skill: 'Data Structures & Algorithms', priority: 'high', frequency: '80% of interviews' },
      { skill: 'System Design', priority: 'high', frequency: '40% of interviews' },
      { skill: 'Python/Java', priority: 'high', frequency: '60% of interviews' },
      { skill: 'Microservices', priority: 'medium', frequency: '30% of interviews' },
    ],
    sampleProblems: [
      { name: 'Design Twitter Feed', topic: 'Design', difficulty: 'Medium', link: 'https://leetcode.com/problems/design-twitter' },
    ],
    resources: [
      { name: 'LeetCode', url: 'https://leetcode.com' },
    ],
  },
];

export default function SkillGapAnalyzerPage() {
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customCompany, setCustomCompany] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      router.push('/login');
    } else {
      checkResumeExists();
    }
  }, []);

  const checkResumeExists = async () => {
    try {
      // Check if user has uploaded resume before
      // For now, just check localStorage or a flag
      // In production, fetch from API
      setHasResume(false);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredCompanies = COMPANY_DATABASE.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      default: return '🔵';
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await apiService.analyzeResume(file);
      if (result && result.keywords) {
        setResumeSkills(result.keywords);
        setShowResumeUpload(true);
        setHasResume(true);
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
    } finally {
      setUploading(false);
    }
  };

  const checkSkillMatch = (skill: string): 'has' | 'partial' | 'missing' => {
    if (!resumeSkills.length) return 'missing';
    const skillLower = skill.toLowerCase();
    const hasExact = resumeSkills.some(s => s.toLowerCase() === skillLower);
    if (hasExact) return 'has';
    const hasPartial = resumeSkills.some(s => skillLower.includes(s.toLowerCase()) || s.toLowerCase().includes(skillLower));
    return hasPartial ? 'partial' : 'missing';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Skill Gap Analyzer</h1>
          <p className="text-gray-600">
            Select a company to see what skills you need to prepare
          </p>
        </div>

        {/* Resume Upload Banner */}
        {!hasResume && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-1">Upload Your Resume</h2>
                <p className="text-gray-600 text-sm">
                  Get personalized insights on which skills you already have
                </p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <div className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? 'Uploading...' : 'Upload Resume'}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Company Selection */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Select a Company
            </h2>
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showCustomInput ? 'Browse companies' : '+ Add custom company'}
            </button>
          </div>

          {showCustomInput ? (
            <div>
              <input
                type="text"
                placeholder="Enter company name..."
                value={customCompany}
                onChange={(e) => setCustomCompany(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {customCompany && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    For {customCompany}, we recommend preparing:
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li>• Data Structures & Algorithms</li>
                    <li>• System Design basics</li>
                    <li>• Problem Solving</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    *Custom company data is generalized. For specific questions, check Glassdoor.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {filteredCompanies.map((company) => (
                  <button
                    key={company.name}
                    onClick={() => setSelectedCompany(company)}
                    className={`px-3 py-2 rounded-lg border transition text-sm ${
                      selectedCompany?.name === company.name
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {company.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Company Details */}
        {selectedCompany && !showCustomInput && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <h2 className="text-xl font-bold text-white">{selectedCompany.name}</h2>
              <p className="text-blue-100 text-sm mt-1">
                {selectedCompany.tier === 'tier1' ? '🏆 Top Tier Company' : '📈 Product Based Company'}
              </p>
            </div>

            {/* Skills Section */}
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Skills to Prepare
              </h3>
              <div className="space-y-3">
                {selectedCompany.skills.map((skill, idx) => {
                  const matchStatus = checkSkillMatch(skill.skill);
                  return (
                    <div key={idx} className={`border rounded-lg p-3 ${getPriorityColor(skill.priority)}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{getPriorityIcon(skill.priority)}</span>
                            <span className="font-semibold">{skill.skill}</span>
                            <span className="text-xs opacity-75">{skill.frequency}</span>
                          </div>
                          <p className="text-xs opacity-75">
                            {skill.priority === 'high' ? 'Must know' : skill.priority === 'medium' ? 'Important' : 'Nice to have'}
                          </p>
                        </div>
                        {resumeSkills.length > 0 && (
                          <div className="ml-4">
                            {matchStatus === 'has' && (
                              <span className="text-green-600 flex items-center gap-1 text-sm">
                                <CheckCircle className="w-4 h-4" /> You have this
                              </span>
                            )}
                            {matchStatus === 'partial' && (
                              <span className="text-yellow-600 text-sm">⚠️ Partially matched</span>
                            )}
                            {matchStatus === 'missing' && (
                              <span className="text-gray-500 text-sm">❌ Not detected</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sample Problems */}
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-600" />
                Sample Problems
              </h3>
              <div className="grid gap-3">
                {selectedCompany.sampleProblems.map((problem, idx) => (
                  <a
                    key={idx}
                    href={problem.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div>
                      <span className="font-medium">{problem.name}</span>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">{problem.topic}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          problem.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                          problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {problem.difficulty}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                ))}
              </div>
            </div>

            {/* Resources */}
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-orange-600" />
                Free Resources
              </h3>
              <div className="flex flex-wrap gap-3">
                {selectedCompany.resources.map((resource, idx) => (
                  <a
                    key={idx}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  >
                    {resource.name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>

            {/* Summary */}
            {resumeSkills.length > 0 && (
              <div className="p-6 bg-green-50 border-t">
                <h3 className="font-semibold mb-2">📊 Your Preparation Status</h3>
                <p className="text-sm text-gray-700">
                  Based on your resume, you have {selectedCompany.skills.filter(s => checkSkillMatch(s.skill) === 'has').length} out of {selectedCompany.skills.length} key skills.
                </p>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${(selectedCompany.skills.filter(s => checkSkillMatch(s.skill) === 'has').length / selectedCompany.skills.length) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Keep learning the missing skills to improve your chances!
                </p>
              </div>
            )}
          </div>
        )}

        {/* No selection state */}
        {!selectedCompany && !showCustomInput && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Company Selected</h2>
            <p className="text-gray-500">
              Select a company from the list above to see their skill requirements
            </p>
          </div>
        )}
      </div>
    </div>
  );
}