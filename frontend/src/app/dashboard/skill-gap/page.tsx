'use client';

import { useState, useEffect, useRef } from 'react';
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

const ALL_COMPANIES = COMPANY_LIST.map(c => c.name);
const ALL_ROLES = [...new Set(COMPANY_LIST.flatMap(c => c.roles))];

const HIGH_DEMAND_SKILLS = [
  'python', 'java', 'javascript', 'typescript', 'react', 'sql',
  'data structures', 'algorithms', 'system design', 'aws',
  'git', 'docker', 'rest api', 'node.js', 'html', 'css'
];

const MEDIUM_DEMAND_SKILLS = [
  'mongodb', 'postgresql', 'redis', 'kubernetes', 'ci/cd',
  'graphql', 'angular', 'vue', 'django', 'flask', 'spring',
  'testing', 'debugging', 'code review', 'agile'
];

const CORE_SKILL_RESOURCES: Record<string, { name: string; url: string }[]> = {
  'Data Structures & Algorithms': [
    { name: 'LeetCode', url: 'https://leetcode.com' },
    { name: 'GeeksforGeeks', url: 'https://geeksforgeeks.org' },
  ],
  'Data Structures': [
    { name: 'LeetCode', url: 'https://leetcode.com' },
    { name: 'GeeksforGeeks', url: 'https://geeksforgeeks.org' },
  ],
  'Algorithms': [
    { name: 'LeetCode', url: 'https://leetcode.com' },
    { name: 'AlgoExpert', url: 'https://algoexpert.io' },
  ],
  'System Design': [
    { name: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
    { name: 'Grokking System Design', url: 'https://www.youtube.com/c/GauravSen' },
  ],
  'Python': [
    { name: 'Python Official Tutorial', url: 'https://docs.python.org/3/tutorial' },
  ],
  'Java': [
    { name: 'Java Tutorial', url: 'https://www.w3schools.com/java' },
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
  'React': [
    { name: 'React Documentation', url: 'https://react.dev' },
  ],
  'JavaScript': [
    { name: 'JavaScript.info', url: 'https://javascript.info' },
  ],
  'Git': [
    { name: 'Git Tutorial', url: 'https://www.atlassian.com/git/tutorials' },
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
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const filteredCompanies = ALL_COMPANIES.filter(c =>
    c.toLowerCase().includes(companyInput.toLowerCase())
  );

  const filteredRoles = ALL_ROLES.filter(r =>
    r.toLowerCase().includes(roleInput.toLowerCase())
  );

  // Load saved data on mount
  useEffect(() => {
    const storedSkills = localStorage.getItem('resumeSkills');
    if (storedSkills) {
      setResumeSkills(JSON.parse(storedSkills));
    }
    
    const storedCompanies = localStorage.getItem('selectedCompanies');
    if (storedCompanies) {
      const companies = JSON.parse(storedCompanies);
      setTimeout(() => {
        companies.forEach((company: { name: string; role: string }) => {
          addCompany(company.name, company.role);
        });
        setInitialLoadDone(true);
      }, 100);
    } else {
      setInitialLoadDone(true);
    }
  }, []);

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

  // Save companies to localStorage whenever they change
  useEffect(() => {
    if (initialLoadDone && selectedCompanies.length > 0) {
      localStorage.setItem('selectedCompanies', JSON.stringify(
        selectedCompanies.map(c => ({ name: c.name, role: c.role }))
      ));
    }
  }, [selectedCompanies, initialLoadDone]);

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
    if (selectedCompanies.find(c => c.name === companyName && c.role === role)) return;

    setShowAddCompany(false);
    setCompanyInput('');
    setRoleInput('');

    setSelectedCompanies(prev => [...prev, { name: companyName, role, isLoading: true }]);

    try {
      // First try to get JD from job_descriptions table (community JDs)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job-descriptions/${encodeURIComponent(companyName)}/${encodeURIComponent(role)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();

      // If no community JD exists, check if user has an application with JD
      if (!data.exists || data.source_type === 'no_data') {
        const appsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const apps = await appsResponse.json();
        const userApp = apps.find((app: any) =>
          app.company.toLowerCase() === companyName.toLowerCase() &&
          app.role.toLowerCase() === role.toLowerCase() &&
          app.job_description
        );

        if (userApp) {
          // Use JD from user's application
          const jdData = {
            exists: true,
            source_type: 'user_application',
            extracted_skills: [], // Skills would need to be extracted
            job_description: userApp.job_description,
            created_at: userApp.created_at,
            age_days: Math.floor((new Date().getTime() - new Date(userApp.created_at).getTime()) / (1000 * 60 * 60 * 24))
          };
          setSelectedCompanies(prev => prev.map(c =>
            c.name === companyName && c.role === role ? { ...c, jdData: jdData, isLoading: false } : c
          ));
          return;
        }
      }

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
    setSelectedCompanies(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        localStorage.removeItem('selectedCompanies');
      }
      return updated;
    });
  };

  const pasteRealJD = async (companyName: string, role: string, jdText: string) => {
    setPastingJD(true);
    try {
      // Get current company data to check if JD exists
      const currentCompany = selectedCompanies.find(c => c.name === companyName && c.role === role);
      
      // First, check if this JD came from user's application
      const appsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const apps = await appsResponse.json();
      const userApp = apps.find((app: any) =>
        app.company.toLowerCase() === companyName.toLowerCase() &&
        app.role.toLowerCase() === role.toLowerCase()
      );

      if (userApp) {
        // Update the user's application with new JD
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/${userApp.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            company: userApp.company,
            role: userApp.role,
            status: userApp.status,
            applied_date: userApp.applied_date,
            salary: userApp.salary,
            notes: userApp.notes,
            job_description: jdText
          })
        });
      }

      // Update or create job description in job_descriptions table
      if (currentCompany?.jdData?.id && currentCompany.jdData.source_type === 'community') {
        // Update existing JD using PUT
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job-descriptions/${currentCompany.jdData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            job_description: jdText,
            share_consent: true
          })
        });
      } else {
        // Create new JD using POST
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job-descriptions`, {
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
      }

      // Refresh the JD data
      const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job-descriptions/${encodeURIComponent(companyName)}/${encodeURIComponent(role)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const refreshData = await refreshResponse.json();

      setSelectedCompanies(prev => prev.map(c =>
        c.name === companyName && c.role === role ? { ...c, jdData: refreshData, isLoading: false } : c
      ));
      setShowJDPaste(null);
      setJdText('');

      // Auto-reanalyze skill gaps after JD update
      if (resumeSkills.length > 0) {
        await analyzeGaps();
      }
    } catch (error) {
      console.error('Error saving JD:', error);
    } finally {
      setPastingJD(false);
    }
  };

  // ==================== FIXED analyzeGaps ====================
  const analyzeGaps = async () => {
    setAnalyzing(true);

    // Auto-save any unsaved JD before analyzing
    if (showJDPaste && jdText.trim()) {
      const [companyName, role] = showJDPaste.split('|');
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job-descriptions`, {
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
          c.name === companyName && c.role === role ? { ...c, jdData: refreshData } : c
        ));
        setShowJDPaste(null);
        setJdText('');
      } catch (error) {
        console.error('Auto-save JD failed:', error);
      }
    }

    const requiredSkillsMap = new Map<string, { companies: string[]; sourceType: string }>();
    
    selectedCompanies.forEach(company => {
      if (company.jdData?.extracted_skills) {
        company.jdData.extracted_skills.forEach((skill: string) => {
          const existing = requiredSkillsMap.get(skill);
          if (existing) {
            existing.companies.push(company.name);
          } else {
            requiredSkillsMap.set(skill, {
              companies: [company.name],
              sourceType: company.jdData.source_type || 'ai_estimate'
            });
          }
        });
      }
    });
    
    const resumeSkillsLower = resumeSkills.map(s => s.toLowerCase());
    const gaps: SkillGap[] = [];

    // Generic/non-technical words to filter out
    const GENERIC_SKILLS = new Set([
      'work', 'using', 'support', 'knowledge', 'understanding',
      'backend', 'frontend', 'architecture', 'models', 'optimize',
      'integrate', 'integration', 'apis', 'api', 'authentication',
      'use', 'build', 'manage', 'system', 'data', 'computer',
      'game', 'science', 'developer', 'development', 'coding',
      'problem solving', 'communication', 'teamwork', 'leadership',
    ]);

    requiredSkillsMap.forEach((value, skill) => {
      const skillLower = skill.toLowerCase();
      
      // Skip generic skills
      if (GENERIC_SKILLS.has(skillLower)) return;

      const hasSkill = resumeSkillsLower.some(rs => 
        rs.includes(skillLower) || skillLower.includes(rs)
      );
      
      if (!hasSkill) {
        let priority: 'high' | 'medium' | 'low' = 'low';
        
        if (value.sourceType === 'community') {
          priority = 'high';
        } else if (value.companies.length >= 3) {
          priority = 'high';
        } else if (value.companies.length >= 2) {
          priority = 'medium';
        } else if (HIGH_DEMAND_SKILLS.includes(skillLower)) {
          priority = 'medium';
        } else if (MEDIUM_DEMAND_SKILLS.includes(skillLower)) {
          priority = 'medium';
        }
        
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
      if (order[a.priority] !== order[b.priority]) {
        return order[a.priority] - order[b.priority];
      }
      return a.skill.localeCompare(b.skill);
    });
    
    setSkillGaps(gaps);
    
    // Effort-based timeline calculation
    const hoursPerSkill: Record<string, number> = {
      high: 21,    // ~3 weeks at 1h/day
      medium: 14,  // ~2 weeks
      low: 4,      // ~0.5 weeks
    };
    
    let totalHours = 0;
    gaps.forEach(gap => {
      if (gap.priority === 'high') totalHours += hoursPerSkill.high;
      else if (gap.priority === 'medium') totalHours += hoursPerSkill.medium;
      else totalHours += hoursPerSkill.low;
    });
    
    const daysNeeded = Math.ceil(totalHours / Math.max(0.5, hoursPerDay));
    const totalWeeks = Math.ceil(daysNeeded / 7);
    
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + daysNeeded);
    
    setLearningTimeline({
      weeks: totalWeeks,
      completionDate: completionDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    });
    
    setAnalyzing(false);
  };

  const getAgeBadge = (createdAt: string, ageDays: number) => {
    if (ageDays < 7) return { emoji: '🟢', text: 'Fresh', color: 'text-green-600', bg: 'bg-green-50' };
    else if (ageDays < 30) return { emoji: '🟡', text: `${ageDays} days ago`, color: 'text-yellow-600', bg: 'bg-yellow-50' };
    else if (ageDays < 90) return { emoji: '🟠', text: `${Math.floor(ageDays / 30)} months ago`, color: 'text-orange-600', bg: 'bg-orange-50' };
    else if (ageDays < 180) return { emoji: '🔴', text: `${Math.floor(ageDays / 30)} months ago`, color: 'text-red-600', bg: 'bg-red-50' };
    else return { emoji: '⚫', text: 'Archived', color: 'text-gray-500', bg: 'bg-gray-100' };
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return { emoji: '🔴', text: 'High Priority', color: 'text-red-600', bg: 'bg-red-50' };
      case 'medium': return { emoji: '🟡', text: 'Medium Priority', color: 'text-yellow-600', bg: 'bg-yellow-50' };
      default: return { emoji: '🔵', text: 'Low Priority', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
  };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Resume Upload */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                  <span key={idx} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
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
          <label className="cursor-pointer flex-shrink-0">
            <input
              type="file"
              accept=".pdf"
              onChange={handleResumeUpload}
              className="hidden"
              disabled={uploading}
            />
            <div className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : resumeSkills.length > 0 ? 'Update Resume' : 'Upload Resume'}
            </div>
          </label>
        </div>
      </div>

      {/* Selected Companies */}
      {selectedCompanies.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Selected Companies ({selectedCompanies.length})
          </h2>
          <div className="space-y-4">
            {selectedCompanies.map((company, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{company.name}</h3>
                    <p className="text-sm text-gray-500">{company.role}</p>
                  </div>
                  <button 
                    onClick={() => removeCompany(idx)} 
                    className="text-gray-400 hover:text-red-500 transition p-1 rounded-full hover:bg-red-50"
                  >
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
                    {company.jdData.source_type === 'community' ? (
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getAgeBadge(company.jdData.created_at, company.jdData.age_days).bg} ${getAgeBadge(company.jdData.created_at, company.jdData.age_days).color} mb-2`}>
                        <span>{getAgeBadge(company.jdData.created_at, company.jdData.age_days).emoji}</span>
                        <span>{getAgeBadge(company.jdData.created_at, company.jdData.age_days).text}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 mb-2">
                        <span>🤖</span>
                        <span>AI-Estimated</span>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {company.jdData.extracted_skills?.slice(0, 8).map((skill: string, sidx: number) => (
                        <span key={sidx} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex gap-2">
                      {company.jdData.source_type === 'ai_estimate' ? (
                        <div className="flex-1 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs text-orange-700">
                                These skills are AI-estimated, not from a real {company.name} JD.
                              </p>
                              <button
                                onClick={() => setShowJDPaste(`${company.name}|${company.role}`)}
                                className="text-xs text-orange-600 hover:text-orange-800 underline mt-1 font-medium"
                              >
                                → Paste real JD for accurate results
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowJDPaste(`${company.name}|${company.role}`)}
                          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition"
                        >
                          ✏️ Edit JD
                        </button>
                      )}
                    </div>
                    
                    {showJDPaste === `${company.name}|${company.role}` && (
                      <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-blue-800">What is a Job Description (JD)?</p>
                              <p className="text-xs text-blue-700 mt-1">
                                A JD includes <strong>job responsibilities</strong> (what you'll do) and <strong>job requirements</strong> (skills, experience, education needed).
                              </p>
                              <p className="text-xs text-blue-700 mt-1">
                                📋 <strong>Example:</strong> "We are looking for a Software Engineer with 3+ years experience in Python, AWS, and System Design..."
                              </p>
                              <p className="text-xs text-blue-700 mt-1">
                                💡 <strong>Tip:</strong> Copy the entire job posting from LinkedIn, company careers page, or any job portal.
                              </p>
                            </div>
                          </div>
                        </div>

                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {company.jdData?.source_type === 'ai_estimate' ? 'Paste the full job description below' : 'Edit the job description below'}
                        </label>
                        <textarea
                          value={jdText}
                          onChange={(e) => setJdText(e.target.value)}
                          placeholder="Paste the complete job description here (including responsibilities AND requirements)..."
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm h-36 resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => pasteRealJD(company.name, company.role, jdText)}
                            disabled={pastingJD || !jdText.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition"
                          >
                            {pastingJD ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                            ) : (
                              <><CheckCircle className="w-4 h-4" /> Save JD & Get Accurate Skills</>
                            )}
                          </button>
                          <button
                            onClick={() => { setShowJDPaste(null); setJdText(''); }}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 font-medium transition"
                          >
                            Cancel
                          </button>
                        </div>
                        {jdText.trim().length > 0 && (
                          <p className="text-xs text-gray-400 mt-2">
                            {jdText.length} characters pasted — the longer and more detailed, the better!
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
          className="w-full bg-white border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition font-medium"
        >
          + Add Company
        </button>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Add Company</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="relative" ref={companyDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={companyInput}
                  onChange={(e) => { setCompanyInput(e.target.value); setShowCompanyDropdown(true); }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  placeholder="Search or type company name..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              {showCompanyDropdown && companyInput && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCompanies.length > 0 ? (
                    filteredCompanies.map((company) => (
                      <div key={company} onClick={() => { setCompanyInput(company); setShowCompanyDropdown(false); }}
                        className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm flex items-center gap-2 transition">
                        <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{company}</span>
                      </div>
                    ))
                  ) : (
                    <div onClick={() => setShowCompanyDropdown(false)}
                      className="px-4 py-2.5 hover:bg-green-50 cursor-pointer text-sm flex items-center gap-2 text-green-600 font-medium transition">
                      <Plus className="w-4 h-4 flex-shrink-0" />
                      <span>Add "{companyInput}"</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={roleDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={roleInput}
                  onChange={(e) => { setRoleInput(e.target.value); setShowRoleDropdown(true); }}
                  onFocus={() => setShowRoleDropdown(true)}
                  placeholder="Search or type role..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              {showRoleDropdown && roleInput && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredRoles.length > 0 ? (
                    filteredRoles.map((role) => (
                      <div key={role} onClick={() => { setRoleInput(role); setShowRoleDropdown(false); }}
                        className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm flex items-center gap-2 transition">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{role}</span>
                      </div>
                    ))
                  ) : (
                    <div onClick={() => setShowRoleDropdown(false)}
                      className="px-4 py-2.5 hover:bg-green-50 cursor-pointer text-sm flex items-center gap-2 text-green-600 font-medium transition">
                      <Plus className="w-4 h-4 flex-shrink-0" />
                      <span>Add "{roleInput}"</span>
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
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
            <button
              onClick={() => { setShowAddCompany(false); setCompanyInput(''); setRoleInput(''); }}
              className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Analyze Button */}
      {selectedCompanies.length > 0 && resumeSkills.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">Study hours/day:</label>
              <input type="number" min="0.5" max="8" step="0.5" value={hoursPerDay}
                onChange={(e) => setHoursPerDay(parseFloat(e.target.value))}
                className="w-20 p-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              <span className="text-sm text-gray-500">hours</span>
            </div>
            <button onClick={analyzeGaps} disabled={analyzing}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              {analyzing ? 'Analyzing...' : 'Analyze Skill Gaps'}
            </button>
          </div>
        </div>
      )}

      {/* Learning Timeline */}
      {learningTimeline && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-sm border border-purple-200 p-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" /> Your Learning Timeline
          </h2>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-3xl font-bold text-purple-700">{learningTimeline.weeks} weeks</p>
              <p className="text-sm text-gray-600">at {hoursPerDay} hour/day</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Estimated completion</p>
              <p className="text-lg font-semibold text-gray-900">{learningTimeline.completionDate}</p>
            </div>
          </div>
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, learningTimeline.weeks * 10)}%` }} />
          </div>
        </div>
      )}

      {/* Skill Gaps Results */}
      {skillGaps.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" /> Skills to Learn
          </h2>
          <p className="text-gray-600 mb-6 text-sm">Based on your selected companies, here's what you need to learn:</p>
          
          <div className="space-y-3">
            {skillGaps.map((gap, idx) => {
              const priorityBadge = getPriorityBadge(gap.priority);
              return (
                <div key={idx} className={`border rounded-lg p-4 ${priorityBadge.bg} hover:shadow-sm transition`}>
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{priorityBadge.emoji}</span>
                      <h3 className="font-semibold text-gray-900">{gap.skill}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge.bg} ${priorityBadge.color}`}>
                        {priorityBadge.text}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">Required by: {gap.companies.join(', ')}</div>
                  </div>
                  {gap.resources && gap.resources.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {gap.resources.map((resource, ridx) => (
                        <a key={ridx} href={resource.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs hover:shadow-md hover:border-gray-300 transition font-medium">
                          {resource.name} <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">💡 Next Steps</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
              <li>Start with <strong>High Priority</strong> skills — they're most in-demand</li>
              <li>For AI-estimated companies, paste real JDs for accurate results</li>
              <li>Use the free resources provided for each skill</li>
              <li>Update your resume after learning new skills and re-analyze</li>
            </ul>
          </div>
        </div>
      )}

      {/* No resume warning */}
      {selectedCompanies.length > 0 && resumeSkills.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-xl font-semibold mb-2">Upload Your Resume First</h2>
          <p className="text-gray-600">Upload your resume above to see personalized skill gap analysis.</p>
        </div>
      )}

      {/* No companies warning */}
      {selectedCompanies.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-12 text-center border border-gray-200">
          <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No Companies Selected</h2>
          <p className="text-gray-400">Click "Add Company" above to start analyzing skill gaps.</p>
        </div>
      )}
    </div>
  );
}