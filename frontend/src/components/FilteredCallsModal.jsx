import { useState, useEffect } from 'react';
import { callsAPI } from '../api/api';

export default function FilteredCallsModal({ isOpen, onClose, filterType, filterValue, filterLabel, specificCallId = null }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    if (isOpen && filterType && filterValue !== null) {
      // Reset state when filter changes
      setCalls([]);
      setSelectedCall(null);
      setInsights(null);
      
      // If a specific call ID is provided, load just that call
      if (specificCallId) {
        loadSpecificCall(specificCallId);
      } else {
        loadFilteredCalls();
      }
    }
  }, [isOpen, filterType, filterValue, specificCallId]);

  const loadSpecificCall = async (callId) => {
    try {
      setLoading(true);
      setError(null);
      
      const call = await callsAPI.getCall(callId);
      setCalls([call]);
      // Auto-select the call
      setSelectedCall(call);
      loadInsights(call.call_id);
    } catch (err) {
      setError('Failed to load call');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredCalls = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build filter params based on type
      const params = { limit: 50 };
      
      if (filterType === 'sentiment') {
        params.sentiment = filterValue;
      } else if (filterType === 'pain_point') {
        params.pain_point = filterValue;
      } else if (filterType === 'revenue_interest') {
        params.revenue_interest = filterValue;
      }
      
      const data = await callsAPI.listCalls(params);
      setCalls(data);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(call.status)}`}>
                        {call.status}
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-400">
                        <span className="font-medium">Call ID:</span> {call.call_id.substring(0, 12)}...
                      </p>
                      {call.duration_seconds && (
                        <p className="text-gray-400">
                          <span className="font-medium">Duration:</span> {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                        </p>
                      )}
                      <p className="text-gray-400">
                        <span className="font-medium">Created:</span> {new Date(call.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Call Details Panel */}
              <div className="lg:sticky lg:top-0 h-fit">
                {selectedCall ? (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Call Details</h3>
                    
                    {/* Basic Info */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-primary-400 mb-2">Information</h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-300">
                          <span className="font-medium text-gray-400">Phone:</span> {selectedCall.phone_number}
                        </p>
                        <p className="text-gray-300">
                          <span className="font-medium text-gray-400">Status:</span> {selectedCall.status}
                        </p>
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

                        {/* Revenue Interest */}
                        {insights.revenue_interest && (
                          <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-2">
                            <p className="text-primary-400 font-medium text-xs flex items-center gap-2">
                              💰 Revenue Interest Detected
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

