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
  initiateCalls: async (phoneNumbers, gymId, customInstructions = null) => {
    const payload = {
      phone_numbers: phoneNumbers,
    };
    
    // Only include custom_instructions if provided
    if (customInstructions && customInstructions.length > 0) {
      payload.custom_instructions = customInstructions;
    }
    
    const response = await api.post(`/api/calls/initiate?gym_id=${gymId}`, payload);
    return response.data;
  },

  // List calls with optional filters
  listCalls: async (params = {}) => {
    // params can include: gym_id, status, sentiment, pain_point, revenue_interest, limit, skip
    const response = await api.get('/api/calls', { params });
    // Handle new paginated format (object with calls and total) or old format (array)
    if (response.data && response.data.calls) {
      return response.data; // Return full object with calls and total
    }
    return response.data; // Return array for backward compatibility
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

  // Search calls (hybrid: phone, status, sentiment, NLP)
  searchCalls: async (params = {}) => {
    // params: { query, search_type, gym_id, limit, skip }
    const response = await api.get('/api/calls/search', { params });
    return response.data;
  },
  
  // Get top churn user segments
  getTopChurnUsers: async (gymId = null, threshold = 0.8, limit = 100) => {
    const params = {};
    if (gymId) params.gym_id = gymId;
    params.threshold = threshold;
    params.limit = limit;
    const response = await api.get('/api/calls/user-segments/churn', { params });
    return response.data;
  },
  
  // Get top revenue user segments
  getTopRevenueUsers: async (gymId = null, threshold = 0.8, limit = 100) => {
    const params = {};
    if (gymId) params.gym_id = gymId;
    params.threshold = threshold;
    params.limit = limit;
    const response = await api.get('/api/calls/user-segments/revenue', { params });
    return response.data;
  },
  
  // Get latest call by phone number
  getLatestCallByPhone: async (phoneNumber, gymId = null) => {
    const params = {};
    if (gymId) params.gym_id = gymId;
    const response = await api.get(`/api/calls/phone/${phoneNumber}/latest`, { params });
    return response.data;
  },
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
