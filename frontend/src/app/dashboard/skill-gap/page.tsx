'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import { Briefcase, TrendingUp, AlertCircle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';

interface SkillGap {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  resources: { name: string; url: string }[];
}

interface CompanyRequirement {
  company: string;
  skills: { name: string; priority: 'high' | 'medium' | 'low' }[];
}

// Company skill requirements database
const COMPANY_SKILLS: CompanyRequirement[] = [
  {
    company: 'Google',
    skills: [
      { name: 'Data Structures & Algorithms', priority: 'high' },
      { name: 'System Design', priority: 'high' },
      { name: 'Python', priority: 'high' },
      { name: 'Java', priority: 'medium' },
      { name: 'Distributed Systems', priority: 'high' },
      { name: 'Database Management', priority: 'medium' },
      { name: 'Cloud Computing', priority: 'medium' },
      { name: 'Machine Learning', priority: 'low' },
    ],
  },
  {
    company: 'Amazon',
    skills: [
      { name: 'Data Structures & Algorithms', priority: 'high' },
      { name: 'System Design', priority: 'high' },
      { name: 'Leadership Principles', priority: 'high' },
      { name: 'Java', priority: 'high' },
      { name: 'Distributed Systems', priority: 'high' },
      { name: 'AWS', priority: 'high' },
      { name: 'Database Management', priority: 'medium' },
      { name: 'OOP Concepts', priority: 'medium' },
    ],
  },
  {
    company: 'Microsoft',
    skills: [
      { name: 'Data Structures & Algorithms', priority: 'high' },
      { name: 'System Design', priority: 'high' },
      { name: 'C#/.NET', priority: 'high' },
      { name: 'Azure', priority: 'medium' },
      { name: 'Problem Solving', priority: 'high' },
      { name: 'Database Management', priority: 'medium' },
      { name: 'Operating Systems', priority: 'medium' },
      { name: 'Communication', priority: 'medium' },
    ],
  },
  {
    company: 'Meta',
    skills: [
      { name: 'Data Structures & Algorithms', priority: 'high' },
      { name: 'System Design', priority: 'high' },
      { name: 'React', priority: 'high' },
      { name: 'PHP/Hack', priority: 'medium' },
      { name: 'JavaScript', priority: 'high' },
      { name: 'Distributed Systems', priority: 'high' },
      { name: 'Product Sense', priority: 'medium' },
      { name: 'Leadership', priority: 'low' },
    ],
  },
  {
    company: 'Netflix',
    skills: [
      { name: 'Java', priority: 'high' },
      { name: 'Microservices', priority: 'high' },
      { name: 'AWS', priority: 'high' },
      { name: 'System Design', priority: 'high' },
      { name: 'Data Structures & Algorithms', priority: 'medium' },
      { name: 'Database Management', priority: 'medium' },
      { name: 'CI/CD', priority: 'medium' },
      { name: 'Cloud Computing', priority: 'high' },
    ],
  },
  {
    company: 'Flipkart',
    skills: [
      { name: 'Data Structures & Algorithms', priority: 'high' },
      { name: 'Java', priority: 'high' },
      { name: 'Spring Boot', priority: 'high' },
      { name: 'System Design', priority: 'medium' },
      { name: 'Microservices', priority: 'medium' },
      { name: 'Database Management', priority: 'medium' },
      { name: 'Linux', priority: 'low' },
      { name: 'Docker', priority: 'low' },
    ],
  },
  {
    company: 'Zomato',
    skills: [
      { name: 'Data Structures & Algorithms', priority: 'high' },
      { name: 'Python', priority: 'medium' },
      { name: 'JavaScript', priority: 'medium' },
      { name: 'React', priority: 'medium' },
      { name: 'System Design', priority: 'medium' },
      { name: 'SQL', priority: 'medium' },
      { name: 'Node.js', priority: 'low' },
      { name: 'Problem Solving', priority: 'high' },
    ],
  },
  {
    company: 'Razorpay',
    skills: [
      { name: 'Data Structures & Algorithms', priority: 'high' },
      { name: 'Python', priority: 'high' },
      { name: 'Django', priority: 'medium' },
      { name: 'System Design', priority: 'medium' },
      { name: 'Fintech Domain', priority: 'medium' },
      { name: 'Database Management', priority: 'medium' },
      { name: 'REST APIs', priority: 'high' },
      { name: 'Security', priority: 'medium' },
    ],
  },
  {
    company: 'CRED',
    skills: [
      { name: 'Data Structures & Algorithms', priority: 'high' },
      { name: 'Python', priority: 'high' },
      { name: 'Go', priority: 'medium' },
      { name: 'System Design', priority: 'high' },
      { name: 'Microservices', priority: 'medium' },
      { name: 'AWS', priority: 'medium' },
      { name: 'Database Management', priority: 'medium' },
      { name: 'Fintech Domain', priority: 'medium' },
    ],
  },
];

// Resource links for each skill
const SKILL_RESOURCES: Record<string, { name: string; url: string }[]> = {
  'Data Structures & Algorithms': [
    { name: 'LeetCode', url: 'https://leetcode.com' },
    { name: 'GeeksforGeeks', url: 'https://geeksforgeeks.org' },
    { name: 'Striver\'s A2Z DSA Sheet', url: 'https://takeuforward.org/strivers-a2z-dsa-course' },
  ],
  'System Design': [
    { name: 'Grokking System Design (Free)', url: 'https://www.youtube.com/c/GauravSen' },
    { name: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
    { name: 'ByteByteGo', url: 'https://blog.bytebytego.com' },
  ],
  'Python': [
    { name: 'Python Official Tutorial', url: 'https://docs.python.org/3/tutorial' },
    { name: 'Real Python', url: 'https://realpython.com' },
  ],
  'Java': [
    { name: 'Java Tutorial (W3Schools)', url: 'https://w3schools.com/java' },
    { name: 'Java Programming Masterclass (Free)', url: 'https://youtube.com/playlist?list=PLL8woMHwr36EDxjNocnR8-HayJHrrbgU-' },
  ],
  'JavaScript': [
    { name: 'JavaScript.info', url: 'https://javascript.info' },
    { name: 'Modern JS Tutorial', url: 'https://github.com/getify/You-Dont-Know-JS' },
  ],
  'React': [
    { name: 'React Official Tutorial', url: 'https://react.dev/learn' },
    { name: 'FreeCodeCamp React Course', url: 'https://youtu.be/bMknfKXIFA8' },
  ],
  'AWS': [
    { name: 'AWS Free Training', url: 'https://aws.amazon.com/training' },
    { name: 'Cloud Practitioner (Free)', url: 'https://www.youtube.com/watch?v=3hLmDS179YE' },
  ],
  'Docker': [
    { name: 'Docker Official Tutorial', url: 'https://docs.docker.com/get-started' },
    { name: 'FreeCodeCamp Docker Course', url: 'https://youtu.be/fqMOX6JJhGo' },
  ],
  'SQL': [
    { name: 'SQL Tutorial (W3Schools)', url: 'https://w3schools.com/sql' },
    { name: 'LeetCode SQL Problems', url: 'https://leetcode.com/problemset/database' },
  ],
  'Spring Boot': [
    { name: 'Spring Boot Tutorial', url: 'https://spring.io/guides' },
    { name: 'Java Brains YouTube', url: 'https://youtube.com/c/JavaBrains' },
  ],
  'Microservices': [
    { name: 'Microservices.io', url: 'https://microservices.io' },
    { name: 'FreeCodeCamp Microservices', url: 'https://youtu.be/CGeI3uDmfS0' },
  ],
  'Operating Systems': [
    { name: 'OS Tutorial (GFG)', url: 'https://geeksforgeeks.org/operating-systems' },
    { name: 'Neso Academy OS', url: 'https://youtube.com/playlist?list=PLBlnK6fEyqRjW3Kv3vN6zP8HrPxmKxYJ4' },
  ],
  'Communication': [
    { name: 'Soft Skills Guide', url: 'https://www.mindtools.com' },
    { name: 'Corporate Communication', url: 'https://alison.com/course/corporate-communication' },
  ],
  'Leadership Principles': [
    { name: 'Amazon Leadership Principles', url: 'https://www.amazon.jobs/content/en/our-workplace/leadership-principles' },
    { name: 'STAR Method Guide', url: 'https://www.themuse.com/advice/star-interview-method' },
  ],
  'Problem Solving': [
    { name: 'LeetCode', url: 'https://leetcode.com' },
    { name: 'GFG Problem Solving', url: 'https://geeksforgeeks.org/problems' },
  ],
  'OOP Concepts': [
    { name: 'OOP Tutorial (GFG)', url: 'https://geeksforgeeks.org/object-oriented-programming-in-java' },
    { name: 'OOP in Python', url: 'https://realpython.com/python3-object-oriented-programming' },
  ],
  'Node.js': [
    { name: 'Node.js Official Guide', url: 'https://nodejs.org/en/docs/guides' },
    { name: 'FreeCodeCamp Node.js', url: 'https://youtu.be/Oe421EPjeBE' },
  ],
  'C#/.NET': [
    { name: 'Microsoft Learning', url: 'https://learn.microsoft.com/en-us/dotnet/csharp' },
    { name: 'FreeCodeCamp C#', url: 'https://youtu.be/GhQdlIFylQ8' },
  ],
  'PHP/Hack': [
    { name: 'PHP Tutorial (W3Schools)', url: 'https://w3schools.com/php' },
    { name: 'HackLang Docs', url: 'https://docs.hhvm.com/hack' },
  ],
  'Go': [
    { name: 'Go Tour', url: 'https://go.dev/tour' },
    { name: 'FreeCodeCamp Go', url: 'https://youtu.be/Sq8MLN9PH28' },
  ],
  'Django': [
    { name: 'Django Official Tutorial', url: 'https://docs.djangoproject.com/en/5.0/intro' },
    { name: 'Django for APIs', url: 'https://learndjango.com/tutorials' },
  ],
  'CI/CD': [
    { name: 'GitHub Actions Guide', url: 'https://docs.github.com/en/actions' },
    { name: 'Jenkins Tutorial', url: 'https://www.jenkins.io/doc/tutorials' },
  ],
  'Cloud Computing': [
    { name: 'AWS Free Training', url: 'https://aws.amazon.com/training' },
    { name: 'Google Cloud Skills Boost', url: 'https://cloud.google.com/training' },
  ],
  'Security': [
    { name: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten' },
    { name: 'Web Security Basics', url: 'https://www.freecodecamp.org/news/web-security' },
  ],
  'Fintech Domain': [
    { name: 'RBI Guidelines', url: 'https://rbi.org.in' },
    { name: 'Fintech Explained', url: 'https://www.investopedia.com/terms/f/fintech.asp' },
  ],
  'Product Sense': [
    { name: 'Product Management Guide', url: 'https://www.productplan.com' },
    { name: 'Cracking Product Interviews', url: 'https://www.productinterview.com' },
  ],
  'Distributed Systems': [
    { name: 'Distributed Systems Guide', url: 'https://www.freecodecamp.org/news/distributed-systems' },
    { name: 'MIT Distributed Systems', url: 'https://www.youtube.com/playlist?list=PLUl4u3cNGP63J0KXxqjzBoSVVudJXhFjQ' },
  ],
  'Database Management': [
    { name: 'SQL Tutorial (W3Schools)', url: 'https://w3schools.com/sql' },
    { name: 'Database Design Guide', url: 'https://www.freecodecamp.org/news/database-design' },
  ],
  'Azure': [
    { name: 'Azure Free Learning', url: 'https://learn.microsoft.com/en-us/training/azure' },
    { name: 'Azure Fundamentals', url: 'https://www.youtube.com/watch?v=Jf09HBb0e9s' },
  ],
  'Linux': [
    { name: 'Linux Journey', url: 'https://linuxjourney.com' },
    { name: 'Linux Tutorial', url: 'https://www.freecodecamp.org/news/linux-commands' },
  ],
};

export default function SkillGapAnalyzerPage() {
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [hasResume, setHasResume] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      router.push('/login');
    } else {
      loadResumeSkills();
    }
  }, []);

  const loadResumeSkills = async () => {
    try {
      const applications = await apiService.getApplications();
      // Try to get resume keywords from stored data
      // For now, we'll use a placeholder or get from user profile
      // In production, you'd fetch from a resume analysis endpoint
      setHasResume(true);
      // Placeholder skills from resume analysis
      setResumeSkills(['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'Git']);
    } catch (error) {
      console.error('Error loading resume skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (company: string) => {
    if (selectedCompanies.includes(company)) {
      setSelectedCompanies(selectedCompanies.filter(c => c !== company));
    } else if (selectedCompanies.length < 5) {
      setSelectedCompanies([...selectedCompanies, company]);
    }
  };

  const analyzeGaps = async () => {
    if (selectedCompanies.length === 0) return;
    
    setAnalyzing(true);
    
    // Get all required skills from selected companies
    const requiredSkillsMap = new Map<string, { priority: 'high' | 'medium' | 'low'; companies: string[] }>();
    
    selectedCompanies.forEach(company => {
      const companyData = COMPANY_SKILLS.find(c => c.company === company);
      if (companyData) {
        companyData.skills.forEach(skill => {
          const existing = requiredSkillsMap.get(skill.name);
          if (existing) {
            existing.companies.push(company);
            if (skill.priority === 'high') existing.priority = 'high';
          } else {
            requiredSkillsMap.set(skill.name, {
              priority: skill.priority,
              companies: [company],
            });
          }
        });
      }
    });
    
    // Find gaps (skills not in resume)
    const resumeSkillsLower = resumeSkills.map(s => s.toLowerCase());
    const gaps: SkillGap[] = [];
    
    requiredSkillsMap.forEach((value, skill) => {
      const skillLower = skill.toLowerCase();
      const hasSkill = resumeSkillsLower.some(rs => 
        rs.includes(skillLower) || skillLower.includes(rs)
      );
      
      if (!hasSkill) {
        const resources = SKILL_RESOURCES[skill] || [
          { name: 'Google Search', url: `https://www.google.com/search?q=Learn+${encodeURIComponent(skill)}+programming` },
        ];
        
        gaps.push({
          skill,
          priority: value.priority,
          resources,
        });
      }
    });
    
    // Sort by priority (high first)
    gaps.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
    
    setSkillGaps(gaps);
    setAnalyzing(false);
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Skill Gap Analyzer</h1>
          <p className="text-gray-600">
            Select your dream companies and see what skills you're missing
          </p>
        </div>

        {!hasResume ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-xl font-semibold mb-2">No Resume Found</h2>
            <p className="text-gray-600 mb-4">
              Please upload your resume in the Resume Analyzer tab first.
            </p>
            <button
              onClick={() => router.push('/dashboard/resume')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Resume Analyzer
            </button>
          </div>
        ) : (
          <>
            {/* Selected Companies */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                Select Dream Companies (up to 5)
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {COMPANY_SKILLS.map((company) => (
                  <button
                    key={company.company}
                    onClick={() => toggleCompany(company.company)}
                    className={`px-4 py-2 rounded-lg border transition ${
                      selectedCompanies.includes(company.company)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {company.company}
                  </button>
                ))}
              </div>
              
              {selectedCompanies.length > 0 && (
                <div className="mt-4 flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Selected: {selectedCompanies.join(', ')}
                  </p>
                  <button
                    onClick={analyzeGaps}
                    disabled={analyzing}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      'Analyze Skill Gaps'
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Your Resume Skills */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Skills Detected from Your Resume
              </h2>
              <div className="flex flex-wrap gap-2">
                {resumeSkills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-3">
                *These skills are extracted from your resume. Add more projects to increase your skill set.
              </p>
            </div>

            {/* Skill Gaps Analysis */}
            {skillGaps.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Skill Gaps Analysis
                </h2>
                <p className="text-gray-600 mb-6">
                  Based on your selected companies, you're missing these skills:
                </p>
                
                <div className="space-y-4">
                  {skillGaps.map((gap, idx) => (
                    <div key={idx} className={`border rounded-lg p-4 ${getPriorityColor(gap.priority)}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{getPriorityIcon(gap.priority)}</span>
                            <h3 className="text-lg font-semibold">{gap.skill}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getPriorityColor(gap.priority)}`}>
                              {gap.priority} priority
                            </span>
                          </div>
                          <p className="text-sm mb-3">
                            {gap.priority === 'high' 
                              ? 'This skill is frequently asked in interviews. Prioritize learning this.'
                              : gap.priority === 'medium'
                              ? 'This skill appears often. Consider adding it to your toolkit.'
                              : 'Nice to have. Learn this after high-priority skills.'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {gap.resources.map((resource, ridx) => (
                              <a
                                key={ridx}
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm hover:shadow transition"
                              >
                                {resource.name}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold mb-2">💡 Next Steps</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    <li>Start with high-priority skills first (marked 🔴)</li>
                    <li>Use the free resources provided above</li>
                    <li>Add projects using these skills to your resume</li>
                    <li>Re-upload your resume after adding new skills</li>
                  </ul>
                </div>
              </div>
            )}

            {skillGaps.length === 0 && selectedCompanies.length > 0 && !analyzing && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h2 className="text-xl font-semibold mb-2">Great Match!</h2>
                <p className="text-gray-600">
                  Your resume skills match well with your selected companies!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}