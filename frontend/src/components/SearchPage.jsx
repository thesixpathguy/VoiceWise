import { useState } from 'react';
import { callsAPI } from '../api/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('nlp');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [insights, setInsights] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResults(null);
      setSelectedCall(null);
      setInsights(null);

      const response = await callsAPI.searchCalls({
        query: query.trim(),
        search_type: searchType,
        limit: 50
      });

      setResults(response);
    } catch (err) {
      setError('Search failed: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async (callId) => {
    try {
      const data = await callsAPI.analyzeCall(callId);
      setInsights(data);
    } catch (err) {
      console.error('Failed to load insights:', err);
    }
  };

  const handleCallClick = (call) => {
    setSelectedCall(call);
    if (call.insights) {
      setInsights(call.insights);
    } else {
      loadInsights(call.call_id);
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

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-500/20 text-green-400';
      case 'negative':
        return 'bg-red-500/20 text-red-400';
      case 'neutral':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Search Calls</h1>
          <p className="text-gray-400">
            Search by phone number, status, sentiment, or use natural language queries
          </p>
        </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="space-y-4">
          {/* Search Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Search Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setSearchType('phone')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchType === 'phone'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                📞 Phone Number
              </button>
              <button
                type="button"
                onClick={() => setSearchType('status')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchType === 'status'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                📊 Status
              </button>
              <button
                type="button"
                onClick={() => setSearchType('sentiment')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchType === 'sentiment'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                😊 Sentiment
              </button>
              <button
                type="button"
                onClick={() => setSearchType('nlp')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchType === 'nlp'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🔍 NLP Search
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {searchType === 'phone' && 'Phone Number'}
              {searchType === 'status' && 'Status (completed, initiated, failed)'}
              {searchType === 'sentiment' && 'Sentiment (positive, neutral, negative)'}
              {searchType === 'nlp' && 'Search Query (e.g., "need trainer", "equipment issues")'}
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  searchType === 'phone' ? '+1234567890' :
                  searchType === 'status' ? 'completed' :
                  searchType === 'sentiment' ? 'positive' :
                  'need trainer'
                }
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Aggregated Insights */}
          {results.aggregated_insights && results.aggregated_insights.total_calls > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                📊 Aggregated Insights ({results.total_results} calls found)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Sentiment Distribution */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Sentiment</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-green-400">Positive</span>
                      <span className="text-white font-medium">
                        {results.aggregated_insights.sentiment_distribution.positive}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Neutral</span>
                      <span className="text-white font-medium">
                        {results.aggregated_insights.sentiment_distribution.neutral}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-red-400">Negative</span>
                      <span className="text-white font-medium">
                        {results.aggregated_insights.sentiment_distribution.negative}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Revenue Interest */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Revenue Interest</h3>
                  <div className="text-3xl font-bold text-primary-400">
                    {results.aggregated_insights.revenue_interest_count}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {((results.aggregated_insights.revenue_interest_count / results.total_results) * 100).toFixed(0)}% of calls
                  </p>
                </div>

                {/* Average Confidence */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Avg Confidence</h3>
                  <div className="text-3xl font-bold text-white">
                    {(results.aggregated_insights.average_confidence * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-gray-500 mt-1">AI analysis confidence</p>
                </div>
              </div>

              {/* Top Topics */}
              {results.aggregated_insights.top_topics && results.aggregated_insights.top_topics.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Top Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {results.aggregated_insights.top_topics.map((topic, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm"
                      >
                        {topic.name} ({topic.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Pain Points */}
              {results.aggregated_insights.top_pain_points && results.aggregated_insights.top_pain_points.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Top Pain Points</h3>
                  <div className="flex flex-wrap gap-2">
                    {results.aggregated_insights.top_pain_points.map((point, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm"
                      >
                        {point.name} ({point.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Individual Call Results */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              📞 Individual Results ({results.total_results})
            </h2>

            {results.calls && results.calls.length > 0 ? (
              <div className="space-y-4">
                {results.calls.map((call) => (
                  <div
                    key={call.call_id}
                    onClick={() => handleCallClick(call)}
                    className={`bg-gray-900/50 border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedCall?.call_id === call.call_id
                        ? 'border-primary-500 bg-gray-900'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{call.phone_number}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(call.status)}`}>
                            {call.status}
                          </span>
                          {call.insights && call.insights.sentiment && (
                            <span className={`px-2 py-0.5 rounded text-xs ${getSentimentColor(call.insights.sentiment)}`}>
                              {call.insights.sentiment}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          {new Date(call.created_at).toLocaleString()} • {call.duration_seconds}s
                        </p>
                      </div>
                      {call.insights && call.insights.revenue_interest && (
                        <span className="text-2xl">💰</span>
                      )}
                    </div>

                    {call.raw_transcript && (
                      <p className="text-sm text-gray-300 line-clamp-2 mt-2">
                        {call.raw_transcript}
                      </p>
                    )}

                    {call.insights && call.insights.topics && call.insights.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {call.insights.topics.slice(0, 3).map((topic, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No calls found</p>
            )}
          </div>

          {/* Selected Call Details */}
          {selectedCall && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Call Details</h2>
                <button
                  onClick={() => setSelectedCall(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Call Info */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Call Information</h3>
                  <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
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
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-white">{selectedCall.duration_seconds}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Date:</span>
                      <span className="text-white">{new Date(selectedCall.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Transcript */}
                {selectedCall.raw_transcript && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Transcript</h3>
                    <div className="bg-gray-900/50 rounded-lg p-4">
                      <p className="text-gray-300 text-sm whitespace-pre-wrap">
                        {selectedCall.raw_transcript}
                      </p>
                    </div>
                  </div>
                )}

                {/* Insights */}
                {insights && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">AI Insights</h3>
                    <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
                      {/* Sentiment */}
                      <div>
                        <span className="text-gray-400 text-sm">Sentiment: </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getSentimentColor(insights.sentiment)}`}>
                          {insights.sentiment}
                        </span>
                      </div>

                      {/* Topics */}
                      {insights.topics && insights.topics.length > 0 && (
                        <div>
                          <span className="text-gray-400 text-sm block mb-1">Topics:</span>
                          <div className="flex flex-wrap gap-1">
                            {insights.topics.map((topic, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded text-xs">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pain Points */}
                      {insights.pain_points && insights.pain_points.length > 0 && (
                        <div>
                          <span className="text-gray-400 text-sm block mb-1">Pain Points:</span>
                          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                            {insights.pain_points.map((point, idx) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Opportunities */}
                      {insights.opportunities && insights.opportunities.length > 0 && (
                        <div>
                          <span className="text-gray-400 text-sm block mb-1">Opportunities:</span>
                          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                            {insights.opportunities.map((opp, idx) => (
                              <li key={idx}>{opp}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Revenue Interest Quote */}
                      {insights.revenue_interest && insights.revenue_interest_quote && (
                        <div>
                          <span className="text-gray-400 text-sm block mb-1">💰 Revenue Interest Quote:</span>
                          <p className="text-primary-400 text-sm italic">"{insights.revenue_interest_quote}"</p>
                        </div>
                      )}

                      {/* Confidence */}
                      <div>
                        <span className="text-gray-400 text-sm">Confidence: </span>
                        <span className="text-white text-sm">{(insights.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

