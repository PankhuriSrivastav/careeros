import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://careeros-backend-asbs.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  status: 'Applied' | 'OA' | 'Interview' | 'Offer' | 'Rejected' | 'Interested';
  applied_date: string;
  salary?: string;
  notes?: string;
  job_description?: string;   // ← this line must be present
}

export const apiService = {
  // Auth
  async register(email: string, password: string, name: string) {
    const response = await api.post('/auth/register', { email, password, name });
    return response.data;
  },

  async login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    return response.data;
  },

  logout() {
    localStorage.removeItem('token');
  },

  getToken() {
    return localStorage.getItem('token');
  },

  isAuthenticated() {
    return !!localStorage.getItem('token');
  },

  // Applications
  async getApplications(): Promise<JobApplication[]> {
    const response = await api.get('/applications/');
    return response.data;
  },

  async createApplication(app: Omit<JobApplication, 'id'>): Promise<JobApplication> {
    const response = await api.post('/applications/', app);
    return response.data;
  },

  async deleteApplication(id: string): Promise<void> {
    await api.delete(`/applications/${id}`);
  },

  // Update application (Edit feature)
  async updateApplication(id: string, app: Omit<JobApplication, 'id'>): Promise<JobApplication> {
    const response = await api.put(`/applications/${id}`, app);
    return response.data;
  },

  // Resume analysis (sends PDF file)
  async analyzeResume(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/resume/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Job description matching
  async matchJob(jobDescription: string): Promise<any> {
    const response = await api.post('/job/match', { job_description: jobDescription });
    return response.data;
  },

  async searchOpportunities(opportunityType: string, page: number = 1) {
    const response = await api.get('/api/opportunities/search', {
      params: { opportunity_type: opportunityType, page },
    });
    return response.data;
  },

  async getSavedOpportunities() {
    const response = await api.get('/api/opportunities/saved');
    return response.data;
  },

  async trackOpportunity(payload: {
    company_name: string;
    role: string;
    source_url: string;
    source_platform?: string | null;
    description?: string;
    trust_score?: number;
    match_percent?: number;
  }) {
    const response = await api.post('/api/opportunities/track', payload);
    return response.data;
  },

  // Resume tailoring
  async getResumeVersions() {
    const response = await api.get('/resume/versions');
    return response.data;
  },

  async tailorResume(resumeVersionId: string, jobDescription: string, companyName: string, applicationId?: string) {
    const response = await api.post('/resume/tailor', {
      resume_version_id: resumeVersionId,
      job_description: jobDescription,
      company_name: companyName,
      application_id: applicationId,
    });
    return response.data;
  },

  async saveTailoredResume(tailoredText: string, companyName: string, originalMatch: number, tailoredMatch: number, applicationId?: string) {
    const response = await api.post('/resume/save-tailored', {
      tailored_text: tailoredText,
      company_name: companyName,
      original_match: originalMatch,
      tailored_match: tailoredMatch,
      application_id: applicationId,
    });
    return response.data;
  },

  // Referral Finder
  async searchProfessionals(company: string, role: string) {
    const response = await api.get('/api/referral/search', {
      params: { company, role },
    });
    return response.data;
  },

  async draftMessage(payload: {
    profile_name: string;
    profile_college?: string;
    profile_yoe?: number;
    company: string;
    role: string;
    user_name: string;
    user_college: string;
    user_project?: string;
  }) {
    const response = await api.post('/api/referral/draft', payload);
    return response.data;
  },

  async trackReferral(payload: {
    application_id?: string;
    company: string;
    role: string;
    profile_url: string;
    profile_name: string;
    profile_college?: string;
    message_drafted: string;
  }) {
    const response = await api.post('/api/referral/track', payload);
    return response.data;
  },

  async updateReferralStatus(outreachId: string, status: string) {
    const response = await api.put(`/api/referral/track/${outreachId}`, { status });
    return response.data;
  },

  async getReferralHistory() {
    const response = await api.get('/api/referral/history');
    return response.data;
  },

  // Coding Round Intel
  async parseLeetCodeCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/coding-intel/parse/leetcode', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async parseHackerRankCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/coding-intel/parse/hackerrank', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async submitManualCodingProfile(topics: Record<string, number>) {
    const response = await api.post('/api/coding-intel/manual', topics);
    return response.data;
  },

  async saveCodingProfile(profileData: any) {
    const response = await api.post('/api/coding-intel/profile', profileData);
    return response.data;
  },

  async getCodingProfile() {
    const response = await api.get('/api/coding-intel/profile');
    return response.data;
  },

  async analyzeCodingGaps(companies: string[], profileId?: number) {
    const response = await api.post('/api/coding-intel/analyze', {
      companies,
      profile_id: profileId,
    });
    return response.data;
  },

  async generateStudyPlan(company: string, weeksUntilInterview: number, hoursPerDay: number, criticalGaps: any[]) {
    const response = await api.post('/api/coding-intel/study-plan', {
      company,
      weeks_until_interview: weeksUntilInterview,
      hours_per_day: hoursPerDay,
      critical_gaps: criticalGaps,
    });
    return response.data;
  },

  async getTopicResources(topic: string) {
    const response = await api.get(`/api/coding-intel/resources/${topic}`);
    return response.data;
  },

  async getCodingIntelCompanies() {
    const response = await api.get('/api/coding-intel/companies');
    return response.data;
  },

  // Interview Intel
  async startInterviewSession(companyName: string, jdText?: string, resumeSnapshot?: any, mode: string = 'full', selectedRounds?: string[]) {
    const response = await api.post('/api/interview/session/start', {
      company_name: companyName,
      jd_text: jdText,
      resume_snapshot: resumeSnapshot,
      mode,
      selected_rounds: selectedRounds,
    });
    return response.data;
  },

  async getInterviewSession(sessionId: string) {
    const response = await api.get(`/api/interview/session/${sessionId}`);
    return response.data;
  },

  async sendInterviewMessage(sessionId: string, content: string) {
    const response = await api.post(`/api/interview/session/${sessionId}/message`, {
      content,
    });
    return response.data;
  },

  async completeInterviewRound(sessionId: string) {
    const response = await api.post(`/api/interview/session/${sessionId}/round/complete`, {});
    return response.data;
  },

  async completeInterviewSession(sessionId: string) {
    const response = await api.post(`/api/interview/session/${sessionId}/complete`, {});
    return response.data;
  },

  async getInterviewSessions() {
    const response = await api.get('/api/interview/sessions');
    return response.data;
  },

  async getInterviewDebrief(sessionId: string) {
    const response = await api.get(`/api/interview/session/${sessionId}/debrief`);
    return response.data;
  },
};

// Convenience exports for direct usage
export const getApplications = apiService.getApplications;
export const createApplication = apiService.createApplication;
export const updateApplication = apiService.updateApplication;
export const deleteApplication = apiService.deleteApplication;
export const analyzeResume = apiService.analyzeResume;
export const matchJob = apiService.matchJob;
export const searchOpportunities = apiService.searchOpportunities;
export const getSavedOpportunities = apiService.getSavedOpportunities;
export const trackOpportunity = apiService.trackOpportunity;
export const getResumeVersions = apiService.getResumeVersions;
export const tailorResume = apiService.tailorResume;
export const saveTailoredResume = apiService.saveTailoredResume;
export const searchProfessionals = apiService.searchProfessionals;
export const draftMessage = apiService.draftMessage;
export const trackReferral = apiService.trackReferral;
export const updateReferralStatus = apiService.updateReferralStatus;
export const startInterviewSession = apiService.startInterviewSession;
export const getInterviewSession = apiService.getInterviewSession;
export const sendInterviewMessage = apiService.sendInterviewMessage;
export const completeInterviewRound = apiService.completeInterviewRound;
export const completeInterviewSession = apiService.completeInterviewSession;
export const getInterviewSessions = apiService.getInterviewSessions;
export const getInterviewDebrief = apiService.getInterviewDebrief;
export const getReferralHistory = apiService.getReferralHistory;
export const parseLeetCodeCSV = apiService.parseLeetCodeCSV;
export const parseHackerRankCSV = apiService.parseHackerRankCSV;
export const submitManualCodingProfile = apiService.submitManualCodingProfile;
export const saveCodingProfile = apiService.saveCodingProfile;
export const getCodingProfile = apiService.getCodingProfile;
export const analyzeCodingGaps = apiService.analyzeCodingGaps;
export const generateStudyPlan = apiService.generateStudyPlan;
export const getTopicResources = apiService.getTopicResources;
export const getCodingIntelCompanies = apiService.getCodingIntelCompanies;