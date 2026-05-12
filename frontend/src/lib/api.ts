import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://careeros-backend-asbs.onrender.com';

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
};