import { useState, useEffect } from 'react';
import { callsAPI } from '../api/api';

export default function CallsList() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [insights, setInsights] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    loadCalls(currentPage);
  }, [currentPage]);

  const loadCalls = async (page = 1) => {
    try {
      setLoading(true);
      const skip = (page - 1) * itemsPerPage;
      // First, get total count with a larger limit to estimate total (or we could add a count endpoint)
      // For now, we'll load with a reasonable limit and use pagination
      const data = await callsAPI.listCalls({ 
        limit: itemsPerPage, 
        skip: skip 
      });
      setCalls(data);
      
      // Try to get total count - if API returns it, use it, otherwise estimate
      // We'll need to make another call to get total or the API should return it
      // For now, if we get less than limit, we know we're at the end
      if (data.length < itemsPerPage) {
        setTotalCalls(skip + data.length);
      } else {
        // Estimate: if we got full page, there might be more
        // To get exact count, we'd need API to return total_count
        setTotalCalls(skip + data.length + (data.length === itemsPerPage ? 1 : 0));
      }
      
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

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedCall(null); // Clear selection when changing pages
    setInsights(null);
    loadCalls(page); // Load the new page from server
  };

  const handleAnalyze = async (callId) => {
    try {
      await callsAPI.analyzeCall(callId);
      alert('Analysis completed!');
      loadCalls();
      if (selectedCall?.call_id === callId) {
        loadInsights(callId);
      }
    } catch (err) {
      alert('Failed to analyze: ' + err.message);
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
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Calls</h1>
          <p className="text-gray-400">Manage and analyze your calls</p>
        </div>
        <button
          onClick={loadCalls}
          className="px-6 py-3 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors font-medium"
        >
          🔄 Refresh
        </button>
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
                    {call.insights?.anomaly_score !== undefined && call.insights.anomaly_score !== null && call.insights.anomaly_score > 0.7 && (
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs font-medium border border-orange-500/30">
                        ⚠️ Anomaly
                      </span>
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

                  {/* Revenue Interest */}
                  {insights.revenue_interest && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Revenue Interest</p>
                      <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                        <p className="text-primary-400 font-medium text-sm flex items-center gap-2 mb-2">
                          💰 Revenue Interest Detected
                        </p>
                        {insights.revenue_interest_quote && (
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

                  {/* Anomaly Score */}
                  {insights.anomaly_score !== undefined && insights.anomaly_score !== null && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Anomaly Score</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-900/50 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              insights.anomaly_score > 0.7 ? 'bg-orange-500' : 
                              insights.anomaly_score > 0.4 ? 'bg-yellow-500' : 
                              'bg-gray-500'
                            }`}
                            style={{ width: `${insights.anomaly_score * 100}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            insights.anomaly_score > 0.7 ? 'text-orange-400' : 
                            insights.anomaly_score > 0.4 ? 'text-yellow-400' : 
                            'text-gray-400'
                          }`}>
                            {insights.anomaly_score.toFixed(2)}
                          </span>
                          {insights.anomaly_score > 0.7 && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium border border-orange-500/30">
                              Anomaly
                            </span>
                          )}
                        </div>
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
