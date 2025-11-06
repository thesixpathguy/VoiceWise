import { useState, useEffect } from 'react';
import { callsAPI } from '../api/api';

export default function FilteredCallsModal({ isOpen, onClose, filterType, filterValue, filterLabel, specificCallId = null }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [insights, setInsights] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    if (isOpen && filterType && filterValue !== null) {
      // Reset state when filter changes
      setCalls([]);
      setSelectedCall(null);
      setInsights(null);
      setCurrentPage(1); // Reset to first page
      setTotalCalls(0); // Reset total to avoid stale pagination
      
      // If a specific call ID is provided, load just that call
      if (specificCallId) {
        loadSpecificCall(specificCallId);
      } else if (filterType === 'call_id' && filterValue) {
        // Also handle call_id filter type directly
        loadSpecificCall(filterValue);
      } else {
        // Always start from page 1 when filter changes (don't use currentPage state as it hasn't updated yet)
        loadFilteredCalls(1);
      }
    }
  }, [isOpen, filterType, filterValue, specificCallId]);

  const loadSpecificCall = async (callId) => {
    try {
      setLoading(true);
      setError(null);
      
      const call = await callsAPI.getCall(callId);
      if (call) {
        // Load insights for this call
        try {
          const insights = await callsAPI.getCallInsights(callId);
          const callWithInsights = {
            ...call,
            insights: insights || null
          };
          setCalls([callWithInsights]);
          // Auto-select the call
          setSelectedCall(callWithInsights);
          loadInsights(call.call_id);
        } catch (insightsErr) {
          console.error('Failed to load insights:', insightsErr);
          // Still set call even if insights fail
          setCalls([call]);
          setSelectedCall(call);
          loadInsights(call.call_id);
        }
      } else {
        setError(`Call ${callId} not found`);
      }
    } catch (err) {
      setError(`Failed to load call: ${err.message || err}`);
      console.error('Error loading specific call:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredCalls = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const skip = (page - 1) * itemsPerPage;
      // Build filter params based on type
      const params = { 
        limit: itemsPerPage,
        skip: skip
      };
      
      if (filterType === 'sentiment') {
        params.sentiment = filterValue;
      } else if (filterType === 'pain_point') {
        params.pain_point = filterValue;
      } else if (filterType === 'pain_point_churn') {
        // Format: "pain_point_name|threshold"
        const [painPoint, threshold] = filterValue.split('|');
        params.pain_point = painPoint;
        params.churn_min_score = parseFloat(threshold) || 0.8;
        params.order_by = 'churn_score_desc'; // Order by decreasing churn score
      } else if (filterType === 'opportunity') {
        params.opportunity = filterValue;
      } else if (filterType === 'opportunity_revenue') {
        // Format: "opportunity_name|threshold"
        const [opportunity, threshold] = filterValue.split('|');
        params.opportunity = opportunity;
        params.revenue_min_score = parseFloat(threshold) || 0.8;
        params.order_by = 'revenue_score_desc'; // Order by decreasing revenue score
      } else if (filterType === 'revenue_interest') {
        params.revenue_interest = filterValue;
      } else if (filterType === 'churn_min_score') {
        params.churn_min_score = filterValue;
        params.order_by = 'churn_score_desc'; // Order by decreasing churn score
      } else if (filterType === 'revenue_min_score') {
        params.revenue_min_score = filterValue;
        params.order_by = 'revenue_score_desc'; // Order by decreasing revenue score
      } else if (filterType === 'date_range') {
        // Format: "start_date|end_date" (ISO date strings)
        const [startDate, endDate] = filterValue.split('|');
        params.start_date = startDate;
        params.end_date = endDate;
      } else if (filterType === 'call_id') {
        // For specific call IDs, load that call directly
        // This is handled by the specificCallId prop and loadSpecificCall
      }
      
      const response = await callsAPI.listCalls(params);
      // Handle both old format (array) and new format (object with calls and total)
      const calls = Array.isArray(response) ? response : (response.calls || []);
      // Use total from response if available, otherwise use calls length as fallback
      const total = (response.total !== undefined && !Array.isArray(response)) 
        ? response.total 
        : calls.length; // If total not provided, use actual calls length (no estimation)
      
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
    } catch (err) {
      setError('Failed to load filtered calls');
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

  // Pagination calculations (server-side pagination, skip if only 1 call from specificCallId)
  const totalPages = calls.length <= 1 ? 1 : Math.ceil(totalCalls / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedCall(null); // Clear selection when changing pages
    setInsights(null);
    if (!specificCallId) {
      loadFilteredCalls(page); // Load the new page from server
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col m-auto">
        {/* Header */}
        <div className="border-b border-gray-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{filterLabel}</h2>
            <p className="text-gray-400 text-sm mt-1">
              {loading ? 'Loading...' : `${calls.length} call${calls.length !== 1 ? 's' : ''} found`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading calls...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
              <p className="text-red-400">{error}</p>
              <button
                onClick={loadFilteredCalls}
                className="mt-4 px-6 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">📞</span>
              <p className="text-gray-400 text-lg">No calls found with this filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calls List */}
              <div className="space-y-4">
                {calls.map((call) => (
                  <div
                    key={call.call_id}
                    onClick={() => handleCallClick(call)}
                    className={`bg-gray-800/50 border rounded-xl p-4 cursor-pointer transition-all ${
                      selectedCall?.call_id === call.call_id
                        ? 'border-primary-500 shadow-lg shadow-primary-500/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{call.phone_number}</span>
                      <div className="flex items-center gap-2">
                        {call.insights && call.insights.churn_score !== undefined && call.insights.churn_score !== null && call.insights.churn_score >= 0.8 && (
                          <span className="text-xs" title={`Churn Risk: ${call.insights.churn_score.toFixed(1)}`}>⚠️</span>
                        )}
                        {call.insights && call.insights.revenue_interest_score !== undefined && call.insights.revenue_interest_score !== null && call.insights.revenue_interest_score >= 0.8 && (
                          <span className="text-xs" title={`Revenue Interest: ${call.insights.revenue_interest_score.toFixed(1)}`}>💰</span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(call.status)}`}>
                          {call.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-sm">
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
                  </div>
                ))}
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                    <div className="text-xs text-gray-400">
                      Showing {startIndex + 1}-{Math.min(startIndex + calls.length, totalCalls)} of {totalCalls} calls
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                className={`px-2 py-1 rounded-lg text-sm transition-colors ${
                                  currentPage === page
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return <span key={page} className="text-gray-500 text-sm">...</span>;
                          }
                          return null;
                        })}
                      </div>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Call Details Panel */}
              <div className="lg:sticky lg:top-0 h-fit">
                {selectedCall ? (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Call Details</h3>
                    
                    {/* Custom Instructions & Answers */}
                    {selectedCall?.custom_instructions && selectedCall.custom_instructions.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-primary-400 mb-2">Custom Instructions & Results</h4>
                        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 space-y-3">
                          {selectedCall.custom_instructions.map((instruction, index) => {
                            const result = insights?.custom_instruction_answers?.[instruction];
                            // Handle both formats: object with type/answer/followed/summary OR simple string answer
                            const answer = typeof result === 'string' ? result : result?.answer;
                            const followed = result?.followed;
                            const summary = result?.summary;
                            const isQuestion = result?.type === 'question' || (typeof result === 'string' || result?.answer);
                            const isInstruction = result?.type === 'instruction' || (result?.followed !== undefined);
                            
                            return (
                              <div key={index} className="border-b border-gray-700 last:border-b-0 pb-3 last:pb-0">
                                <div className="mb-1.5">
                                  <span className="text-xs font-medium text-primary-300">📋 {isQuestion ? 'Question' : 'Instruction'}:</span>
                                  <p className="text-xs text-gray-300 mt-0.5">{instruction}</p>
                                </div>
                                
                                {/* Show answer if it exists (for questions or simple string format) */}
                                {answer && (
                                  <div>
                                    <span className="text-xs font-medium text-green-300">💬 Member's Answer:</span>
                                    <p className="text-xs text-gray-200 mt-0.5">{answer}</p>
                                  </div>
                                )}
                                
                                {/* Show followed status and summary for instructions */}
                                {isInstruction && (
                                  <div>
                                    {followed !== undefined && followed !== null && (
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-medium text-blue-300">🤖 Agent Followed:</span>
                                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
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
                                      <span className="text-xs font-medium text-purple-300">📝 Summary:</span>
                                        <p className="text-xs text-gray-200 mt-0.5">{summary}</p>
                                    </div>
                                    )}
                                  </div>
                                )}
                                
                                {!result && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-400">Status:</span>
                                    <p className="text-xs text-gray-500 italic mt-0.5">Not processed yet</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Basic Info */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-primary-400 mb-2">Call Information</h4>
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 space-y-2 text-sm">
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

                    {/* Transcript */}
                    {selectedCall.raw_transcript && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-primary-400 mb-2">Transcript</h4>
                        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                          <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">
                            {selectedCall.raw_transcript}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Insights */}
                    {insights && (
                      <div>
                        <h4 className="text-sm font-semibold text-primary-400 mb-2">AI Insights</h4>
                        
                        {/* Sentiment */}
                        <div className="mb-3">
                          <p className="text-xs text-gray-400 mb-1">Sentiment</p>
                          <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
                            insights.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                            insights.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {insights.sentiment.toUpperCase()}
                          </span>
                        </div>

                        {/* Gym Rating */}
                        {insights.gym_rating && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-1">Gym Rating</p>
                            <div className="flex items-center gap-2">
                              <div className={`text-2xl font-bold ${
                                insights.gym_rating >= 8 ? 'text-green-400' :
                                insights.gym_rating >= 5 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {insights.gym_rating}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                    <span
                                      key={star}
                                      className={`text-sm ${
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
                                <p className="text-xs text-gray-500 mt-0.5">out of 10</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Topics */}
                        {insights.topics && insights.topics.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-1">Topics</p>
                            <div className="flex flex-wrap gap-1">
                              {insights.topics.map((topic, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs"
                                >
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pain Points */}
                        {insights.pain_points && insights.pain_points.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-1">Pain Points</p>
                            <ul className="space-y-1">
                              {insights.pain_points.map((point, index) => (
                                <li key={index} className="text-gray-300 text-xs">
                                  • {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Opportunities */}
                        {insights.opportunities && insights.opportunities.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-1">Opportunities</p>
                            <ul className="space-y-1">
                              {insights.opportunities.map((opp, index) => (
                                <li key={index} className="text-gray-300 text-xs">
                                  • {opp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Churn Interest */}
                        {insights.churn_score !== undefined && insights.churn_score !== null && insights.churn_score >= 0.8 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-1">Churn Interest</p>
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2">
                              <p className="text-orange-400 font-medium text-xs flex items-center gap-2 mb-1">
                                ⚠️ Churn Risk Score: {insights.churn_score.toFixed(1)}
                              </p>
                              {insights.churn_interest_quote && insights.churn_score >= 0.7 && (
                                <p className="text-orange-300 text-xs italic mt-1">
                                  "{insights.churn_interest_quote}"
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Revenue Interest */}
                        {insights.revenue_interest_score !== undefined && insights.revenue_interest_score !== null && insights.revenue_interest_score >= 0.8 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-1">Revenue Interest</p>
                            <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-2">
                              <p className="text-primary-400 font-medium text-xs flex items-center gap-2 mb-1">
                                💰 Revenue Interest Score: {insights.revenue_interest_score.toFixed(1)}
                              </p>
                              {insights.revenue_interest_quote && insights.revenue_interest_score >= 0.7 && (
                                <p className="text-primary-300 text-xs italic mt-1">
                                  "{insights.revenue_interest_quote}"
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Confidence */}
                        {insights.confidence !== undefined && insights.confidence !== null && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-1">Confidence</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-900/50 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-primary-500 transition-all"
                                  style={{ width: `${insights.confidence * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-white text-xs font-medium">
                                {(insights.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        )}


                        {/* Extracted At */}
                        {insights.extracted_at && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Analysis Date</p>
                            <p className="text-gray-300 text-xs">
                              {new Date(insights.extracted_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
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
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

