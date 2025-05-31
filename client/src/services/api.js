import axios from 'axios';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Prompts API
export const promptsApi = {
  getAll: (params = {}) => api.get('/prompts', { params }),
  getById: (id) => api.get(`/prompts/${id}`),
  create: (prompt) => api.post('/prompts', prompt),
  update: (id, prompt) => api.put(`/prompts/${id}`, prompt),
  delete: (id) => api.delete(`/prompts/${id}`),
  deleteAll: () => api.delete('/prompts'),
  export: () => api.get('/export'),
  getSuggestions: (content, category) => api.post('/prompts/suggestions', { content, category }),
  import: (data) => api.post('/import', data),
};

// Categories API
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (category) => api.post('/categories', category),
};

// Health check
export const healthCheck = () => api.get('/health');

export default api; 