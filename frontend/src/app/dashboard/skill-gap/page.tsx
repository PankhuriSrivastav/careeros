'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import { 
  Briefcase, TrendingUp, CheckCircle, AlertCircle, 
  ExternalLink, Upload, Loader2, Target, BookOpen, 
  Clock, Calendar, FileText, X, ChevronDown, Search, Plus
} from 'lucide-react';

// Company list with roles
const COMPANY_LIST = [
  { name: 'Google', roles: ['Software Engineer', 'Data Scientist', 'DevOps Engineer'] },
  { name: 'Amazon', roles: ['Software Engineer', 'Data Engineer', 'Frontend Engineer'] },
  { name: 'Microsoft', roles: ['Software Engineer', 'Cloud Engineer', 'Product Manager'] },
  { name: 'Meta', roles: ['Software Engineer', 'Data Scientist', 'Product Manager'] },
  { name: 'Netflix', roles: ['Software Engineer', 'Data Engineer'] },
  { name: 'Flipkart', roles: ['Software Engineer', 'Backend Engineer'] },
  { name: 'Zomato', roles: ['Software Engineer', 'Data Analyst'] },
  { name: 'Razorpay', roles: ['Software Engineer', 'Backend Engineer'] },
  { name: 'CRED', roles: ['Software Engineer', 'Data Scientist'] },
  { name: 'PhonePe', roles: ['Software Engineer', 'Security Engineer'] },
  { name: 'Swiggy', roles: ['Software Engineer', 'Data Analyst'] },
];

// All unique company names for search
const ALL_COMPANIES = COMPANY_LIST.map(c => c.name);

// All unique roles across companies
const ALL_ROLES = [...new Set(COMPANY_LIST.flatMap(c => c.roles))];

// Curated resources for core skills (fallback)
const CORE_SKILL_RESOURCES: Record<string, { name: string; url: string }[]> = {
  'Data Structures & Algorithms': [
    { name: 'LeetCode', url: 'https://leetcode.com' },
    { name: 'GeeksforGeeks', url: 'https://geeksforgeeks.org' },
  ],
  'System Design': [
    { name: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
    { name: 'Grokking System Design', url: 'https://www.youtube.com/c/GauravSen' },
  ],
  'Python': [
    { name: 'Python Official Tutorial', url: 'https://docs.python.org/3/tutorial' },
  ],
  'AWS': [
    { name: 'AWS Free Training', url: 'https://aws.amazon.com/training' },
  ],
  'Docker': [
    { name: 'Docker Official Tutorial', url: 'https://docs.docker.com/get-started' },
  ],
  'SQL': [
    { name: 'SQL Tutorial', url: 'https://w3schools.com/sql' },
  ],
};

interface SelectedCompany {
  name: string;
  role: string;
  jdData?: any;
  isLoading: boolean;
}

interface SkillGap {
  skill: string;
  companies: string[];
  priority: 'high' | 'medium' | 'low';
  resources?: { name: string; url: string }[];
}

export default function SkillGapAnalyzerPage() {
  const [selectedCompanies, setSelectedCompanies] = useState<SelectedCompany[]>([]);
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [companyInput, setCompanyInput] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showJDPaste, setShowJDPaste] = useState<string | null>(null);
  const [jdText, setJdText] = useState('');
  const [pastingJD, setPastingJD] = useState(false);
  const [learningTimeline, setLearningTimeline] = useState<{ weeks: number; completionDate: string } | null>(null);
  const [hoursPerDay, setHoursPerDay] = useState(1);
  const router = useRouter();

  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  // Filtered lists based on input
  const filteredCompanies = ALL_COMPANIES.filter(c =>
    c.toLowerCase().includes(companyInput.toLowerCase())
  );

  const filteredRoles = ALL_ROLES.filter(r =>
    r.toLowerCase().includes(roleInput.toLowerCase())
  );

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      router.push('/login');
    }
    const storedSkills = localStorage.getItem('resumeSkills');
    if (storedSkills) {
      setResumeSkills(JSON.parse(storedSkills));
    }
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setShowRoleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await apiService.analyzeResume(file);
      if (result && result.keywords) {
        setResumeSkills(result.keywords);
        localStorage.setItem('resumeSkills', JSON.stringify(result.keywords));
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
    } finally {
      setUploading(false);
    }
  };

  const addCompany = async (companyName: string, role: string) => {
    if (selectedCompanies.find(c => c.name === companyName && c.role === role)) {
      return; // Already added
    }

    setShowAddCompany(false);
    setCompanyInput('');
    setRoleInput('');
    
    setSelectedCompanies(prev => [...prev, { name: companyName, role, isLoading: true }]);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job-descriptions/${encodeURIComponent(companyName)}/${encodeURIComponent(role)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      
      setSelectedCompanies(prev => prev.map(c => 
        c.name === companyName && c.role === role ? { ...c, jdData: data, isLoading: false } : c
      ));
    } catch (error) {
      console.error('Error fetching JD:', error);
      setSelectedCompanies(prev => prev.map(c => 
        c.name === companyName && c.role === role ? { ...c, isLoading: false } : c
      ));
    }
  };

  const removeCompany = (index: number) => {
    setSelectedCompanies(prev => prev.filter((_, i) => i !== index));
  };

  const pasteRealJD = async (companyName: string, role: string, jdText: string) => {
    setPastingJD(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job-descriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          company_name: companyName,
          role: role,
          job_description: jdText,
          share_consent: true
        })
      });
      
      const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job-descriptions/${encodeURIComponent(companyName)}/${encodeURIComponent(role)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const refreshData = await refreshResponse.json();
      
      setSelectedCompanies(prev => prev.map(c => 
        c.name === companyName && c.role === role ? { ...c, jdData: refreshData, isLoading: false } : c
      ));
      setShowJDPaste(null);
      setJdText('');
    } catch (error) {
      console.error('Error saving JD:', error);
    } finally {
      setPastingJD(false);
    }
  };

  const analyzeGaps = async () => {
    setAnalyzing(true);
    
    const requiredSkillsMap = new Map<string, { priority: 'high' | 'medium' | 'low'; companies: string[] }>();
    
    selectedCompanies.forEach(company => {
      if (company.jdData?.extracted_skills) {
        company.jdData.extracted_skills.forEach((skill: string) => {
          const existing = requiredSkillsMap.get(skill);
          if (existing) {
            existing.companies.push(company.name);
          } else {
            requiredSkillsMap.set(skill, {
              priority: company.jdData.source_type === 'community' ? 'high' : 'medium',
              companies: [company.name]
            });
          }
        });
      }
    });
    
    const resumeSkillsLower = resumeSkills.map(s => s.toLowerCase());
    const gaps: SkillGap[] = [];
    
    requiredSkillsMap.forEach((value, skill) => {
      const skillLower = skill.toLowerCase();
      const hasSkill = resumeSkillsLower.some(rs => 
        rs.includes(skillLower) || skillLower.includes(rs)
      );
      
      if (!hasSkill) {
        let priority: 'high' | 'medium' | 'low' = 'low';
        if (value.companies.length >= 3) priority = 'high';
        else if (value.companies.length >= 2) priority = 'medium';
        
        const resources = CORE_SKILL_RESOURCES[skill] || [
          { name: 'Search Resources', url: `https://www.google.com/search?q=Learn+${encodeURIComponent(skill)}` }
        ];
        
        gaps.push({
          skill,
          companies: value.companies,
          priority,
          resources
        });
      }
    });
    
    gaps.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
    
    setSkillGaps(gaps);
    
    let totalWeeks = 0;
    gaps.forEach(gap => {
      if (gap.priority === 'high') totalWeeks += 3;
      else if (gap.priority === 'medium') totalWeeks += 2;
      else totalWeeks += 1;
    });
    
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + (totalWeeks * 7));
    
    setLearningTimeline({
      weeks: totalWeeks,
      completionDate: completionDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    });
    
    setAnalyzing(false);
  };

  const getAgeBadge = (createdAt: string, ageDays: number) => {
    if (ageDays < 7) {
      return { emoji: '🟢', text: 'Fresh', color: 'text-green-600', bg: 'bg-green-50', message: 'Added recently – likely accurate' };
    } else if (ageDays < 30) {
      return { emoji: '🟡', text: `${ageDays} days ago`, color: 'text-yellow-600', bg: 'bg-yellow-50', message: 'Added within a month' };
    } else if (ageDays < 90) {
      return { emoji: '🟠', text: `${Math.floor(ageDays / 30)} months ago`, color: 'text-orange-600', bg: 'bg-orange-50', message: 'May be stale – verify requirements' };
    } else if (ageDays < 180) {
      return { emoji: '🔴', text: `${Math.floor(ageDays / 30)} months ago`, color: 'text-red-600', bg: 'bg-red-50', message: 'Likely outdated – add new version' };
    } else {
      return { emoji: '⚫', text: 'Archived', color: 'text-gray-500', bg: 'bg-gray-100', message: 'Archived – add new version' };
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return { emoji: '🔴', text: 'High Priority', color: 'text-red-600', bg: 'bg-red-50' };
      case 'medium': return { emoji: '🟡', text: 'Medium Priority', color: 'text-yellow-600', bg: 'bg-yellow-50' };
      default: return { emoji: '🔵', text: 'Low Priority', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Skill Gap Analyzer</h1>
          <p className="text-gray-600">
            Select target companies and roles to see what skills you're missing
          </p>
        </div>

        {/* Resume Upload */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">Your Resume</h2>
              <p className="text-gray-600 text-sm">
                {resumeSkills.length > 0 
                  ? `✅ ${resumeSkills.length} skills detected` 
                  : "Upload to see personalized skill gaps"}
              </p>
              {resumeSkills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {resumeSkills.slice(0, 5).map((skill, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                      {skill}
                    </span>
                  ))}
                  {resumeSkills.length > 5 && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      +{resumeSkills.length - 5} more
                    </span>
                  )}
                </div>
              )}
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
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Uploading...' : resumeSkills.length > 0 ? 'Update Resume' : 'Upload Resume'}
              </div>
            </label>
          </div>
        </div>

        {/* Selected Companies */}
        {selectedCompanies.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Selected Companies ({selectedCompanies.length})
            </h2>
            <div className="space-y-4">
              {selectedCompanies.map((company, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{company.name}</h3>
                      <p className="text-sm text-gray-600">{company.role}</p>
                    </div>
                    <button onClick={() => removeCompany(idx)} className="text-red-500 hover:text-red-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {company.isLoading ? (
                    <div className="flex items-center gap-2 mt-3 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading requirements...</span>
                    </div>
                  ) : company.jdData ? (
                    <div className="mt-3">
                      {/* Source badge */}
                      {company.jdData.source_type === 'community' ? (
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getAgeBadge(company.jdData.created_at, company.jdData.age_days).bg} ${getAgeBadge(company.jdData.created_at, company.jdData.age_days).color} mb-2`}>
                          <span>{getAgeBadge(company.jdData.created_at, company.jdData.age_days).emoji}</span>
                          <span>{getAgeBadge(company.jdData.created_at, company.jdData.age_days).text}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-50 text-orange-600 mb-2">
                          <span>🤖</span>
                          <span>AI-Estimated</span>
                        </div>
                      )}
                      
                      {/* Skills */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {company.jdData.extracted_skills?.slice(0, 8).map((skill: string, sidx: number) => (
                          <span key={sidx} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                            {skill}
                          </span>
                        ))}
                      </div>
                      
                      {/* AI estimate warning banner */}
                      {company.jdData.source_type === 'ai_estimate' && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs text-orange-700">
                                These skills are AI-estimated, not from a real {company.name} JD.
                              </p>
                              <button
                                onClick={() => setShowJDPaste(`${company.name}|${company.role}`)}
                                className="text-xs text-orange-600 hover:underline mt-1"
                              >
                                → Paste real JD for accurate results
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* JD Paste Form with Explanation */}
                      {showJDPaste === `${company.name}|${company.role}` && (
                        <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                          {/* Helpful hint box */}
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-blue-800">What is a Job Description (JD)?</p>
                                <p className="text-xs text-blue-700 mt-1">
                                  A JD includes <strong>job responsibilities</strong> (what you'll do) and <strong>job requirements</strong> (skills, experience, education needed).
                                </p>
                                <p className="text-xs text-blue-700 mt-1">
                                  📋 <strong>Example:</strong> "We are looking for a Software Engineer with 3+ years experience in Python, AWS, and System Design. You will be responsible for building scalable APIs..."
                                </p>
                                <p className="text-xs text-blue-700 mt-1">
                                  💡 <strong>Tip:</strong> Copy the entire job posting from LinkedIn, company careers page, or any job portal and paste it below.
                                </p>
                              </div>
                            </div>
                          </div>

                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Paste the full job description below
                          </label>
                          <textarea
                            value={jdText}
                            onChange={(e) => setJdText(e.target.value)}
                            placeholder="Paste the complete job description here (including responsibilities AND requirements)..."
                            className="w-full p-3 border border-gray-300 rounded-lg text-sm h-36 resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => pasteRealJD(company.name, company.role, jdText)}
                              disabled={pastingJD || !jdText.trim()}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                            >
                              {pastingJD ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Save JD & Get Accurate Skills
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setShowJDPaste(null);
                                setJdText('');
                              }}
                              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                          {jdText.trim().length > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              {jdText.length} characters pasted — the longer and more detailed, the better the results!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-red-500 mt-2">Failed to load requirements</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Company Button */}
        {!showAddCompany ? (
          <button
            onClick={() => setShowAddCompany(true)}
            className="w-full bg-white border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition mb-8"
          >
            + Add Company
          </button>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Add Company</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Company Searchable Input */}
              <div className="relative" ref={companyDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={companyInput}
                    onChange={(e) => {
                      setCompanyInput(e.target.value);
                      setShowCompanyDropdown(true);
                    }}
                    onFocus={() => setShowCompanyDropdown(true)}
                    placeholder="Search or type company name..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                {showCompanyDropdown && companyInput && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCompanies.length > 0 ? (
                      filteredCompanies.map((company) => (
                        <div
                          key={company}
                          onClick={() => {
                            setCompanyInput(company);
                            setShowCompanyDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-sm flex items-center gap-2"
                        >
                          <Briefcase className="w-4 h-4 text-gray-400" />
                          {company}
                        </div>
                      ))
                    ) : (
                      <div
                        onClick={() => {
                          setShowCompanyDropdown(false);
                        }}
                        className="px-4 py-2 hover:bg-green-50 dark:hover:bg-green-900/30 cursor-pointer text-sm flex items-center gap-2 text-green-600"
                      >
                        <Plus className="w-4 h-4" />
                        Add "{companyInput}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Role Searchable Input */}
              <div className="relative" ref={roleDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={roleInput}
                    onChange={(e) => {
                      setRoleInput(e.target.value);
                      setShowRoleDropdown(true);
                    }}
                    onFocus={() => setShowRoleDropdown(true)}
                    placeholder="Search or type role..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                {showRoleDropdown && roleInput && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredRoles.length > 0 ? (
                      filteredRoles.map((role) => (
                        <div
                          key={role}
                          onClick={() => {
                            setRoleInput(role);
                            setShowRoleDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-sm flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4 text-gray-400" />
                          {role}
                        </div>
                      ))
                    ) : (
                      <div
                        onClick={() => {
                          setShowRoleDropdown(false);
                        }}
                        className="px-4 py-2 hover:bg-green-50 dark:hover:bg-green-900/30 cursor-pointer text-sm flex items-center gap-2 text-green-600"
                      >
                        <Plus className="w-4 h-4" />
                        Add "{roleInput}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => companyInput.trim() && roleInput.trim() && addCompany(companyInput.trim(), roleInput.trim())}
                disabled={!companyInput.trim() || !roleInput.trim()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddCompany(false);
                  setCompanyInput('');
                  setRoleInput('');
                }}
                className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Analyze Button */}
        {selectedCompanies.length > 0 && resumeSkills.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600">Study hours/day:</label>
                <input
                  type="number"
                  min="0.5"
                  max="8"
                  step="0.5"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseFloat(e.target.value))}
                  className="w-20 p-2 border border-gray-300 rounded-lg text-center"
                />
                <span className="text-sm text-gray-500">hours</span>
              </div>
              <button
                onClick={analyzeGaps}
                disabled={analyzing}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {analyzing ? 'Analyzing...' : 'Analyze Skill Gaps'}
              </button>
            </div>
          </div>
        )}

        {/* Learning Timeline */}
        {learningTimeline && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-lg p-6 mb-8 border border-purple-200">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Your Learning Timeline
            </h2>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-2xl font-bold text-purple-700">{learningTimeline.weeks} weeks</p>
                <p className="text-sm text-gray-600">at {hoursPerDay} hour/day</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Estimated completion</p>
                <p className="text-lg font-semibold">{learningTimeline.completionDate}</p>
              </div>
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full" style={{ width: '30%' }} />
            </div>
          </div>
        )}

        {/* Skill Gaps Results */}
        {skillGaps.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Skills to Learn
            </h2>
            <p className="text-gray-600 mb-6">
              Based on your selected companies, here's what you need to learn:
            </p>
            
            <div className="space-y-4">
              {skillGaps.map((gap, idx) => {
                const priorityBadge = getPriorityBadge(gap.priority);
                return (
                  <div key={idx} className={`border rounded-lg p-4 ${priorityBadge.bg}`}>
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{priorityBadge.emoji}</span>
                        <h3 className="font-semibold">{gap.skill}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityBadge.bg} ${priorityBadge.color}`}>
                          {priorityBadge.text}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Affects: {gap.companies.join(', ')}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-3">
                      {gap.resources?.map((resource, ridx) => (
                        <a
                          key={ridx}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-xs hover:shadow transition"
                        >
                          {resource.name}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold mb-2">💡 Next Steps</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li>Start with High Priority skills (they affect the most companies)</li>
                <li>For AI-estimated companies, paste real JDs for accurate results</li>
                <li>Use the free resources provided above</li>
                <li>Update your resume after learning new skills and re-analyze</li>
              </ul>
            </div>
          </div>
        )}

        {/* No resume warning */}
        {selectedCompanies.length > 0 && resumeSkills.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-xl font-semibold mb-2">Upload Your Resume First</h2>
            <p className="text-gray-600">
              Upload your resume above to see personalized skill gap analysis.
            </p>
          </div>
        )}

        {/* No companies warning */}
        {selectedCompanies.length === 0 && (
          <div className="bg-gray-50 rounded-xl p-12 text-center border border-gray-200">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Companies Selected</h2>
            <p className="text-gray-500">
              Click "Add Company" to start analyzing skill gaps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}