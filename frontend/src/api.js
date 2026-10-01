import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

const errorMessage = (e) =>
  e.response?.data?.error ||
  (e.request ? "Can't reach the server. Check that the backend is running on port 5000." : e.message);

const call = async (fn) => {
  try {
    const { data } = await fn();
    return data;
  } catch (e) {
    throw new Error(errorMessage(e));
  }
};

export const analyzeResume = (file, jobDescription) => {
  const form = new FormData();
  form.append('resume', file);
  if (jobDescription) form.append('jobDescription', jobDescription);
  return call(() => api.post('/analyze', form));
};

export const getHistory = () => call(() => api.get('/analyses'));
export const getAnalysis = (id) => call(() => api.get(`/analyses/${id}`));
export const deleteAnalysis = (id) => call(() => api.delete(`/analyses/${id}`));
