import { useState, useEffect, useMemo } from 'react';
import { callsAPI } from '../api/api';

export default function CallsList() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [insights, setInsights] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const [generic, setGeneric] = useState({});
  const [pickupStats, setPickupStats] = useState(null);
  const itemsPerPage = 10;

  const defaultDateRange = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formatForAPI = (date) => {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    return {
      startDate: formatForAPI(thirtyDaysAgo),
      endDate: formatForAPI(today)
    };
  }, []);

  const loadPickupStats = async () => {
    try {
      const data = await callsAPI.getPickupStats();
      console.log('Pickup stats data:', data);
      setPickupStats(data);
    } catch (err) {
      console.error('Failed to load pickup stats:', err);
    }
  };

  const loadSummary = async () => {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const formatForAPI = (date) => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      };

      const data = await callsAPI.getDashboardSummary({
        startDate: formatForAPI(thirtyDaysAgo),
        endDate: formatForAPI(today)
      });
      console.log('Dashboard summary data:', data);
      console.log('Generic data:', data.generic);
      setGeneric(data.generic || {});
    } catch (err) {
      console.error('Failed to load summary data:', err);
    }
  };

  const loadCalls = async (page = 1, extraParams = {}) => {
    try {
      setLoading(true);
      // Ensure page is a valid number, default to 1 if invalid
      const pageNum = Number(page) || 1;
      const skip = Math.max(0, (pageNum - 1) * itemsPerPage);
      const params = { 
        limit: itemsPerPage, 
        skip: skip,
        ...extraParams
      };

      if (!params.start_date || !params.end_date) {
        params.start_date = defaultDateRange.startDate;
        params.end_date = defaultDateRange.endDate;
      }

      const response = await callsAPI.listCalls(params);
      
      // Handle both old format (array) and new format (object with calls and total)
      const calls = Array.isArray(response) ? response : (response.calls || []);
      const total = (response.total !== undefined && !Array.isArray(response)) ? response.total : (calls.length < itemsPerPage ? skip + calls.length : skip + calls.length + 1);
      
      // Load insights in bulk for all calls
      if (calls.length > 0) {
        try {
          const callIds = calls.map(call => call.call_id);
          const bulkInsightsResponse = await callsAPI.getBulkInsights(callIds);
          const insightsMap = bulkInsightsResponse.insights || {};
          
          // Merge insights into calls
          const callsWithInsights = calls.map(call => ({
            ...call,
            insights: insightsMap[call.call_id] || null
          }));
          
          setCalls(callsWithInsights);
        } catch (insightsErr) {
          console.error('Failed to load insights:', insightsErr);
          // Still set calls even if insights fail
          setCalls(calls);
        }
      } else {
        setCalls(calls);
      }
      
      setTotalCalls(total);
      
      setError(null);
    } catch (err) {
      setError('Failed to load calls');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async (callId) => {
    try {
      const data = await callsAPI.getCallInsights(callId);
      setInsights(data);
    } catch (err) {
      console.error('Failed to load insights:', err);
      setInsights(null);
    }
  };

  const handleCallClick = (call) => {
    setSelectedCall(call);
    loadInsights(call.call_id);
  };

  // Pagination calculations (server-side pagination)
  const totalPages = Math.ceil(totalCalls / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  const [currentFilters, setCurrentFilters] = useState({});

  const handlePageChange = (page, filters = currentFilters) => {
    setCurrentPage(page);
    setCurrentFilters(filters);
    setSelectedCall(null); // Clear selection when changing pages
    setInsights(null);
    loadCalls(page, filters); // Load the new page from server
  };

  useEffect(() => {
    loadCalls(currentPage, currentFilters);
    loadSummary();
    loadPickupStats();
  }, [currentPage, currentFilters, defaultDateRange]);

  const handleAnalyze = async (callId) => {
    try {
      await callsAPI.analyzeCall(callId);
      alert('Analysis completed!');
      loadCalls(currentPage || 1);
      if (selectedCall?.call_id === callId) {
        loadInsights(callId);
      }
    } catch (err) {
      alert('Failed to analyze: ' + err.message);
    }
  };

  const handleRefresh = () => {
    // Reset to page 1 and reload
    setCurrentPage(1);
    loadCalls(1, currentFilters);
    loadSummary();
    loadPickupStats();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'initiated':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading calls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Metrics Deck */}
      <div className="mb-8">
        <div className="relative flex justify-center mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
          </div>
          <div className="relative flex items-center gap-3 rounded-full border border-gray-700 bg-gray-900 px-5 py-2.5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse"></div>
              <span className="text-base text-gray-400 font-medium">Feedback Metrics</span>
              <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse"></div>
          </div>
          <button
            onClick={handleRefresh}
            title="Refresh metrics and calls"
            aria-label="Refresh metrics and calls"
              className="ml-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/80 border-2 border-primary-400 text-white hover:bg-primary-500 hover:border-primary-300 transition-all shadow-lg shadow-primary-500/30 text-lg font-bold"
            >
              <span className="leading-none">↻</span>
          </button>
          </div>
        </div>

        {/* Stats Grid - Matching Dashboard Style */}
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
          {/* Avg Confidence - Primary */}
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-2 cursor-pointer hover:bg-primary-500/20 transition-all flex flex-col items-center justify-center">
            <span className="text-gray-400 text-sm mb-0.5">Avg Confidence</span>
            <p className="text-xl font-bold text-primary-400">
                {generic.average_confidence !== null && generic.average_confidence !== undefined
                  ? `${(generic.average_confidence * 100).toFixed(0)}%`
                  : 'N/A'}
            </p>
          </div>

          {/* Total Duration - Purple */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-2 cursor-pointer hover:bg-purple-500/20 transition-all flex flex-col items-center justify-center">
            <span className="text-gray-400 text-sm mb-0.5">Total Duration</span>
            <p className="text-xl font-bold text-purple-400">
                {generic.total_duration_seconds !== null && generic.total_duration_seconds !== undefined
                ? `${Math.floor(generic.total_duration_seconds / 60)}m`
                  : 'N/A'}
            </p>
          </div>

          {/* Avg Duration - Green */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 cursor-pointer hover:bg-green-500/20 transition-all flex flex-col items-center justify-center">
            <span className="text-gray-400 text-sm mb-0.5">Avg Duration</span>
            <p className="text-xl font-bold text-green-400">
                {generic.average_duration_seconds !== null && generic.average_duration_seconds !== undefined
                ? `${Math.floor(generic.average_duration_seconds)}s`
                  : 'N/A'}
            </p>
          </div>

          {/* Total Calls - Orange */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2 cursor-pointer hover:bg-orange-500/20 transition-all flex flex-col items-center justify-center">
            <span className="text-gray-400 text-sm mb-0.5">Total Calls</span>
            <p className="text-xl font-bold text-orange-400">{generic.total_calls || 0}</p>
          </div>

          {/* Pickup Rate - Emerald */}
          {pickupStats && typeof pickupStats.pickup_rate === 'number' ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 cursor-pointer hover:bg-emerald-500/20 transition-all flex flex-col items-center justify-center">
              <span className="text-gray-400 text-sm mb-0.5">Pickup Rate</span>
              <p className="text-xl font-bold text-emerald-400">{pickupStats.pickup_rate.toFixed(1)}%</p>
              </div>
          ) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-sm mb-0.5">Pickup Rate</span>
              <p className="text-xl font-bold text-white">N/A</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Calls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls List */}
        <div className="space-y-4">
          {calls.length === 0 ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
              <span className="text-6xl mb-4 block">📞</span>
              <p className="text-gray-400 text-lg">No calls yet</p>
              <p className="text-gray-500 text-sm mt-2">Initiate your first call to get started</p>
            </div>
          ) : (
            <>
              {calls.map((call) => (
              <div
                key={call.call_id}
                onClick={() => handleCallClick(call)}
                className={`bg-gray-800/50 border rounded-xl p-6 cursor-pointer transition-all ${
                  selectedCall?.call_id === call.call_id
                    ? 'border-primary-500 shadow-lg shadow-primary-500/20'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-medium">{call.phone_number}</span>
                  <div className="flex items-center gap-2">
                    {call.insights && call.insights.churn_score !== undefined && call.insights.churn_score !== null && call.insights.churn_score >= 0.8 && (
                      <span className="text-xs" title={`Churn Risk: ${call.insights.churn_score.toFixed(1)}`}>⚠️</span>
                    )}
                    {call.insights && call.insights.revenue_interest_score !== undefined && call.insights.revenue_interest_score !== null && call.insights.revenue_interest_score >= 0.8 && (
                      <span className="text-xs" title={`Revenue Interest: ${call.insights.revenue_interest_score.toFixed(1)}`}>💰</span>
                    )}
                    <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(call.status)}`}>
                      {call.status}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  {call.duration_seconds ? (
                    <p className="text-gray-400">
                      <span className="font-medium">Duration:</span> {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                    </p>
                  ) : (
                    <p className="text-gray-500 text-xs italic">Duration: Not available</p>
                  )}
                  <p className="text-gray-400">
                    <span className="font-medium">Created:</span> {new Date(call.created_at).toLocaleString()}
                  </p>
                </div>

                {call.status === 'completed' && (
                  <div className="mt-4 flex gap-2">
                    {call.raw_transcript && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnalyze(call.call_id);
                        }}
                        className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm transition-colors"
                      >
                        🤖 Analyze
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400">
                  Showing {startIndex + 1}-{Math.min(startIndex + calls.length, totalCalls)} of {totalCalls} calls
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-2 rounded-lg transition-colors ${
                              currentPage === page
                                ? 'bg-primary-500 text-white'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="text-gray-500">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>

        {/* Call Details Panel */}
        <div className="lg:sticky lg:top-8 h-fit">
          {selectedCall ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Call Details</h2>
              
              {/* Basic Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary-400 mb-3">Call Information</h3>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone:</span>
                    <span className="text-white">{selectedCall.phone_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedCall.status)}`}>
                      {selectedCall.status}
                    </span>
                  </div>
                  {selectedCall.duration_seconds ? (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-white">
                        {Math.floor(selectedCall.duration_seconds / 60)}m {selectedCall.duration_seconds % 60}s
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-gray-500 text-xs italic">Not available</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Created:</span>
                    <span className="text-white text-xs">{new Date(selectedCall.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Custom Instructions & Answers */}
              {selectedCall.custom_instructions && selectedCall.custom_instructions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-primary-400 mb-3">Custom Instructions & Results</h3>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-4">
                    {selectedCall.custom_instructions.map((instruction, index) => {
                      const result = insights?.custom_instruction_answers?.[instruction];
                      // Handle both formats: object with type/answer/followed/summary OR simple string answer
                      const answer = typeof result === 'string' ? result : result?.answer;
                      const followed = result?.followed;
                      const summary = result?.summary;
                      const isQuestion = result?.type === 'question' || (typeof result === 'string' || result?.answer);
                      const isInstruction = result?.type === 'instruction' || (result?.followed !== undefined);
                      
                      return (
                        <div key={index} className="border-b border-gray-700 last:border-b-0 pb-4 last:pb-0">
                          <div className="mb-2">
                            <span className="text-sm font-medium text-primary-300">📋 {isQuestion ? 'Question' : 'Instruction'}:</span>
                            <p className="text-sm text-gray-300 mt-1">{instruction}</p>
                          </div>
                          
                          {/* Show answer if it exists (for questions or simple string format) */}
                          {answer && (
                            <div>
                              <span className="text-sm font-medium text-green-300">💬 Member's Answer:</span>
                              <p className="text-sm text-gray-200 mt-1">{answer}</p>
                            </div>
                          )}
                          
                          {/* Show followed status and summary for instructions */}
                          {isInstruction && (
                            <div>
                              {followed !== undefined && followed !== null && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-blue-300">🤖 Agent Followed:</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    followed
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                    {followed ? '✓ Yes' : '✗ No'}
                                </span>
                              </div>
                              )}
                              {summary && (
                              <div>
                                <span className="text-sm font-medium text-purple-300">📝 Summary:</span>
                                  <p className="text-sm text-gray-200 mt-1">{summary}</p>
                              </div>
                              )}
                            </div>
                          )}
                          
                          {!result && (
                            <div>
                              <span className="text-sm font-medium text-gray-400">Status:</span>
                              <p className="text-sm text-gray-500 italic mt-1">Not processed yet</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {selectedCall.raw_transcript && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-primary-400 mb-3">Transcript</h3>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedCall.raw_transcript}
                    </p>
                  </div>
                </div>
              )}

              {/* Insights */}
              {insights && (
                <div>
                  <h3 className="text-lg font-semibold text-primary-400 mb-3">AI Insights</h3>
                  
                  {/* Sentiment */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-2">Sentiment</p>
                    <span className={`inline-block px-4 py-2 rounded-lg font-medium ${
                      insights.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                      insights.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {insights.sentiment.toUpperCase()}
                    </span>
                  </div>

                  {/* Gym Rating */}
                  {insights.gym_rating && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Gym Rating</p>
                      <div className="flex items-center gap-3">
                        <div className={`text-3xl font-bold ${
                          insights.gym_rating >= 8 ? 'text-green-400' :
                          insights.gym_rating >= 5 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {insights.gym_rating}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                              <span
                                key={star}
                                className={`text-xl ${
                                  star <= insights.gym_rating
                                    ? insights.gym_rating >= 8 ? 'text-green-400' :
                                      insights.gym_rating >= 5 ? 'text-yellow-400' :
                                      'text-red-400'
                                    : 'text-gray-600'
                                }`}
                              >
                                {star <= insights.gym_rating ? '★' : '☆'}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">out of 10</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Topics */}
                  {insights.topics && insights.topics.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Topics</p>
                      <div className="flex flex-wrap gap-2">
                        {insights.topics.map((topic, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pain Points */}
                  {insights.pain_points && insights.pain_points.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Pain Points</p>
                      <ul className="space-y-1">
                        {insights.pain_points.map((point, index) => (
                          <li key={index} className="text-gray-300 text-sm">
                            • {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Opportunities */}
                  {insights.opportunities && insights.opportunities.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Opportunities</p>
                      <ul className="space-y-1">
                        {insights.opportunities.map((opp, index) => (
                          <li key={index} className="text-gray-300 text-sm">
                            • {opp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Churn Interest */}
                  {insights.churn_score !== undefined && insights.churn_score !== null && insights.churn_score >= 0.8 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Churn Interest</p>
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                        <p className="text-orange-400 font-medium text-sm flex items-center gap-2 mb-2">
                          ⚠️ Churn Risk Score: {insights.churn_score.toFixed(1)}
                        </p>
                        {insights.churn_interest_quote && insights.churn_score >= 0.7 && (
                          <p className="text-orange-300 text-sm italic mt-2">
                            "{insights.churn_interest_quote}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Revenue Interest */}
                  {insights.revenue_interest_score !== undefined && insights.revenue_interest_score !== null && insights.revenue_interest_score >= 0.8 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Revenue Interest</p>
                      <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                        <p className="text-primary-400 font-medium text-sm flex items-center gap-2 mb-2">
                          💰 Revenue Interest Score: {insights.revenue_interest_score.toFixed(1)}
                        </p>
                        {insights.revenue_interest_quote && insights.revenue_interest_score >= 0.7 && (
                          <p className="text-primary-300 text-sm italic mt-2">
                            "{insights.revenue_interest_quote}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Confidence */}
                  {insights.confidence !== undefined && insights.confidence !== null && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Confidence</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-900/50 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-primary-500 transition-all"
                            style={{ width: `${insights.confidence * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-white text-sm font-medium">
                          {(insights.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}


                  {/* Extracted At */}
                  {insights.extracted_at && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-1">Analysis Date</p>
                      <p className="text-gray-300 text-sm">
                        {new Date(insights.extracted_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!selectedCall.raw_transcript && (
                <p className="text-gray-500 text-center py-8 italic">
                  No transcript available. Transcribe the call to see details.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
              <span className="text-6xl mb-4 block">👈</span>
              <p className="text-gray-400">Select a call to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
