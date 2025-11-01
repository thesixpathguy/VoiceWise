import { useState, useEffect } from 'react';
import { callsAPI } from '../api/api';

export default function CallsList() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    loadCalls();
  }, []);

  const loadCalls = async () => {
    try {
      setLoading(true);
      const data = await callsAPI.listCalls({ limit: 50 });
      setCalls(data);
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
            calls.map((call) => (
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
                  <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(call.status)}`}>
                    {call.status}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
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
            ))
          )}
        </div>

        {/* Call Details Panel */}
        <div className="lg:sticky lg:top-8 h-fit">
          {selectedCall ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Call Details</h2>
              
              {/* Basic Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary-400 mb-3">Information</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Phone:</span> {selectedCall.phone_number}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Status:</span> {selectedCall.status}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium text-gray-400">Call ID:</span> {selectedCall.call_id}
                  </p>
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
                    <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                      <p className="text-primary-400 font-medium text-sm flex items-center gap-2">
                        💰 Revenue Interest Detected
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
