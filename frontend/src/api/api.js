import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Debug: Log the API URL being used
console.log('🔗 API Base URL:', API_BASE_URL);
console.log('🔗 VITE_API_URL env:', import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add ngrok bypass header to all requests via interceptor
api.interceptors.request.use(
  (config) => {
    // Always add ngrok skip browser warning header
    config.headers['ngrok-skip-browser-warning'] = 'true';
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses that might be ngrok warning pages
api.interceptors.response.use(
  (response) => {
    // Check if response is HTML (ngrok warning page)
    if (typeof response.data === 'string' && response.data.includes('ngrok')) {
      console.error('❌ Received ngrok warning page instead of API response');
      throw new Error('Ngrok browser warning page detected. Please check your ngrok configuration.');
    }
    return response;
  },
  (error) => {
    // Check if error response is HTML (ngrok warning page)
    if (error.response && typeof error.response.data === 'string' && error.response.data.includes('ngrok')) {
      console.error('❌ Ngrok warning page in error response');
      error.message = 'Ngrok browser warning page detected. The ngrok-skip-browser-warning header may not be working.';
    }
    return Promise.reject(error);
  }
);

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

  // Get bulk insights for multiple calls
  getBulkInsights: async (callIds) => {
    const response = await api.post('/api/calls/insights/bulk', callIds);
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
  getDashboardSummary: async (startDate, endDate, gymId = null) => {
    const params = { start_date: startDate, end_date: endDate };
    if (gymId) params.gym_id = gymId;
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
  getTopChurnUsers: async (gymId = null, startDate = null, endDate = null, threshold = 0.8, limit = 100) => {
    const params = {};
    if (gymId) params.gym_id = gymId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    params.threshold = threshold;
    params.limit = limit;
    const response = await api.get('/api/calls/user-segments/churn', { params });
    return response.data;
  },
  
  // Get top revenue user segments
  getTopRevenueUsers: async (gymId = null, startDate = null, endDate = null, threshold = 0.8, limit = 100) => {
    const params = {};
    if (gymId) params.gym_id = gymId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    params.threshold = threshold;
    params.limit = limit;
    const response = await api.get('/api/calls/user-segments/revenue', { params });
    return response.data;
  },
  
  // Get pain point user segments
  getPainPointUsers: async (gymId = null, painPoint = null, limit = 100) => {
    const params = {};
    if (gymId) params.gym_id = gymId;
    if (painPoint) params.pain_point = painPoint;
    params.limit = limit;
    const response = await api.get('/api/calls/user-segments/pain-points', { params });
    return response.data;
  },
  
  // Get prompt filtered user segments (AI search)
  getPromptFilteredUsers: async (gymId = null, prompt = '', limit = 100) => {
    const params = {};
    if (gymId) params.gym_id = gymId;
    params.prompt = prompt;
    params.limit = limit;
    const response = await api.get('/api/calls/user-segments/prompt', { params });
    return response.data;
  },
  
  // Get latest call by phone number
  getLatestCallByPhone: async (phoneNumber, gymId = null, startDate = null, endDate = null) => {
    const params = {};
    if (gymId) params.gym_id = gymId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get(`/api/calls/phone/${phoneNumber}/latest`, { params });
    return response.data;
  },

  // Trend data endpoints
  getChurnTrend: async (gymId = null, startDate, endDate, period = 'day') => {
    const params = { start_date: startDate, end_date: endDate, period };
    if (gymId) params.gym_id = gymId;
    const response = await api.get('/api/calls/trends/churn', { params });
    return response.data;
  },

  getRevenueTrend: async (gymId = null, startDate, endDate, period = 'day') => {
    const params = { start_date: startDate, end_date: endDate, period };
    if (gymId) params.gym_id = gymId;
    const response = await api.get('/api/calls/trends/revenue', { params });
    return response.data;
  },

  getSentimentTrend: async (gymId = null, startDate, endDate, period = 'day') => {
    const params = { start_date: startDate, end_date: endDate, period };
    if (gymId) params.gym_id = gymId;
    const response = await api.get('/api/calls/trends/sentiment', { params });
    return response.data;
  },

  // Get pickup rate statistics
  getPickupStats: async (gymId = null) => {
    const params = {};
    if (gymId) params.gym_id = gymId;
    const response = await api.get('/api/calls/stats/pickup', { params });
    return response.data;
  },

  // Get all live calls
  getLiveCalls: async () => {
    const response = await api.get('/api/calls/live');
    return response.data;
  },

  // Get live call audio WebSocket URL (POC - direct Bland.ai call, later will use backend proxy)
  getLiveCallAudio: async (callId, blandApiKey) => {
    // POC: Call Bland AI directly from frontend
    // NOTE: For production, this should be proxied through backend to keep API key secure
    const blandUrl = `https://api.bland.ai/v1/calls/${encodeURIComponent(callId)}/listen`;
    
    try {
      const response = await fetch(blandUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(blandApiKey ? { Authorization: `Bearer ${blandApiKey}` } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bland AI API returned ${response.status}: ${errorText}`);
      }

      const json = await response.json();
      return json;
    } catch (error) {
      console.error('Error getting live call audio:', error);
      throw error;
    }
  },
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
