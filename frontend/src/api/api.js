import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Call API endpoints
export const callsAPI = {
  // Initiate batch calls to gym members
  initiateCalls: async (phoneNumbers, gymId) => {
    const response = await api.post(`/api/calls/initiate?gym_id=${gymId}`, {
      phone_numbers: phoneNumbers,
    });
    return response.data;
  },

  // List calls
  listCalls: async (params = {}) => {
    const response = await api.get('/api/calls', { params });
    return response.data;
  },

  // Get single call
  getCall: async (callId) => {
    const response = await api.get(`/api/calls/${callId}`);
    return response.data;
  },

  // Get call insights
  getCallInsights: async (callId) => {
    const response = await api.get(`/api/calls/${callId}/insights`);
    return response.data;
  },

  // Transcribe call
  transcribeCall: async (callId) => {
    const response = await api.post(`/api/calls/${callId}/transcribe`);
    return response.data;
  },

  // Analyze call
  analyzeCall: async (callId) => {
    const response = await api.post(`/api/calls/${callId}/analyze`);
    return response.data;
  },

  // Delete call
  deleteCall: async (callId) => {
    const response = await api.delete(`/api/calls/${callId}`);
    return response.data;
  },

  // Get dashboard summary
  getDashboardSummary: async (gymId = null) => {
    const params = gymId ? { gym_id: gymId } : {};
    const response = await api.get('/api/calls/dashboard/summary', { params });
    return response.data;
  },
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
