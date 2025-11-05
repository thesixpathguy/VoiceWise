import { useState } from 'react';
import { callsAPI } from '../api/api';

export default function SearchPage({ setCurrentPage }) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('nlp');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [insights, setInsights] = useState(null);
  const [currentPage, setPage] = useState(1);
  const itemsPerPage = 8;

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
        limit: 30
      });

      // Debug logging
      console.log('🔍 Search response:', response);
      if (response.aggregated_insights) {
        console.log('📊 Aggregated insights:', response.aggregated_insights);
        console.log('💰 Top opportunities:', response.aggregated_insights.top_opportunities);
        console.log('💰 Top opportunities type:', typeof response.aggregated_insights.top_opportunities);
        console.log('💰 Top opportunities is array:', Array.isArray(response.aggregated_insights.top_opportunities));
        console.log('💰 Top opportunities keys:', response.aggregated_insights.top_opportunities ? Object.keys(response.aggregated_insights.top_opportunities) : 'null/undefined');
      }

      setResults(response);
      setPage(1); // Reset to first page on new search
      setSelectedCall(null); // Clear selection on new search
      setInsights(null);
      
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

  // Pagination calculations (client-side pagination for search results)
  const allCalls = results?.calls || [];
  const totalCalls = allCalls.length;
  const totalPages = Math.ceil(totalCalls / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCalls = allCalls.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setPage(page);
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Search Calls</h1>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
        <div className="space-y-4">
          {/* Search Type Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Search Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSearchType('phone')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  searchType === 'phone'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600'
                }`}
              >
                📞 Phone Number
              </button>
              <button
                type="button"
                onClick={() => setSearchType('sentiment')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  searchType === 'sentiment'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600'
                }`}
              >
                😊 Sentiment
              </button>
              <button
                type="button"
                onClick={() => setSearchType('nlp')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  searchType === 'nlp'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600'
                }`}
              >
                🔍 NLP Search
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              {searchType === 'phone' && 'Phone Number'}
              {searchType === 'sentiment' && 'Sentiment (positive, neutral, negative)'}
              {searchType === 'nlp' && 'Search Query (e.g., "need trainer", "equipment issues")'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  searchType === 'phone' ? '+1234567890' :
                  searchType === 'sentiment' ? 'positive' :
                  'need trainer'
                }
                className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Searching...
                  </span>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Aggregated Insights */}
          {results.aggregated_insights && results.aggregated_insights.total_calls > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span>
                Aggregated Insights ({results.total_results} calls)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Sentiment Distribution */}
                <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-3">
                  <h3 className="text-xs font-medium text-gray-400 mb-2">Sentiment</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-green-400 text-xs">Positive</span>
                      <span className="text-white font-semibold text-sm">
                        {results.aggregated_insights.sentiment_distribution.positive}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-red-400 text-xs">Negative</span>
                      <span className="text-white font-semibold text-sm">
                        {results.aggregated_insights.sentiment_distribution.negative}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Revenue Interest */}
                <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-3">
                  <h3 className="text-xs font-medium text-gray-400 mb-2">Revenue Interest</h3>
                  <div className="text-2xl font-bold text-primary-400">
                    {results.aggregated_insights.revenue_interest_count}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {((results.aggregated_insights.revenue_interest_count / results.total_results) * 100).toFixed(0)}% of calls
                  </p>
                </div>

                {/* Churn Interest */}
                <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-3">
                  <h3 className="text-xs font-medium text-gray-400 mb-2">Churn Interest</h3>
                  <div className="text-2xl font-bold text-orange-400">
                    {results.aggregated_insights.churn_interest_count}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {((results.aggregated_insights.churn_interest_count / results.total_results) * 100).toFixed(0)}% of calls
                  </p>
                </div>

                {/* Average Confidence */}
                <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-3">
                  <h3 className="text-xs font-medium text-gray-400 mb-2">Avg Confidence</h3>
                  <div className="text-2xl font-bold text-white">
                    {(results.aggregated_insights.average_confidence * 100).toFixed(0)}%
                  </div>
                  <p className="text-xs text-gray-500 mt-1">AI analysis confidence</p>
                </div>
              </div>

              {/* Top Topics, Pain Points, and Opportunities */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Top Topics */}
                {results.aggregated_insights.top_topics && results.aggregated_insights.top_topics.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                      <span>💬</span>
                      Top Topics
                    </h3>
                    <div className="space-y-1">
                      {results.aggregated_insights.top_topics.slice(0, 5).map((topic, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-gray-700/30 transition-all"
                        >
                          <span className="text-gray-300 text-xs">{topic.name}</span>
                          <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded-full text-xs font-medium">
                            {topic.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Pain Points */}
                {results.aggregated_insights.top_pain_points && results.aggregated_insights.top_pain_points.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                      <span>🎯</span>
                      Top Pain Points
                    </h3>
                    <div className="space-y-1">
                      {results.aggregated_insights.top_pain_points.slice(0, 5).map((point, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-gray-700/30 transition-all"
                        >
                          <span className="text-gray-300 text-xs">{point.name}</span>
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                            {point.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Opportunities */}
                {results.aggregated_insights.top_opportunities && results.aggregated_insights.top_opportunities.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                      <span>💰</span>
                      Top Opportunities
                    </h3>
                    <div className="space-y-1">
                      {results.aggregated_insights.top_opportunities.slice(0, 5).map((opportunity, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-gray-700/30 transition-all"
                        >
                          <span className="text-gray-300 text-xs">{opportunity.name}</span>
                          <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded-full text-xs font-medium">
                            {opportunity.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Individual Call Results - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calls List - Left Side */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📞</span>
                  Results ({results.total_results})
                </h2>
                {/* Call Button - Only for sentiment and nlp searches */}
                {setCurrentPage && (searchType === 'sentiment' || searchType === 'nlp') && results.calls && results.calls.length > 0 && (
                  <button
                    onClick={() => {
                      const phoneNumbers = results.calls.map(call => call.phone_number).join('\n');
                      localStorage.setItem('initiateCalls_phoneNumbers', phoneNumbers);
                      
                      // Store search segment information
                      const searchSegment = {
                        query: query,
                        searchType: searchType,
                        resultCount: results.calls.length,
                        timestamp: new Date().toISOString()
                      };
                      localStorage.setItem('initiateCalls_searchSegment', JSON.stringify(searchSegment));
                      
                      setCurrentPage('initiate');
                    }}
                    className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-lg flex items-center gap-1.5 text-xs font-medium"
                    title={`Add ${results.calls.length} phone numbers to initiate call section`}
                  >
                    <span>📞</span>
                    <span>Add to Initiate Call</span>
                  </button>
                )}
              </div>

              {paginatedCalls.length > 0 ? (
                <>
                  {paginatedCalls.map((call) => (
                    <div
                      key={call.call_id}
                      onClick={() => handleCallClick(call)}
                      className={`bg-gray-800/50 border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedCall?.call_id === call.call_id
                          ? 'border-primary-500 shadow-lg shadow-primary-500/20 bg-gray-800'
                          : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold text-sm">{call.phone_number}</span>
                        <div className="flex items-center gap-1.5">
                          {call.insights && call.insights.anomaly_score !== undefined && call.insights.anomaly_score !== null && call.insights.anomaly_score >= 0.8 && (
                            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium border border-orange-500/30">
                              ⚠️
                            </span>
                          )}
                          {call.insights && call.insights.churn_score !== undefined && call.insights.churn_score !== null && call.insights.churn_score >= 0.8 && (
                            <span className="text-xs" title={`Churn Risk: ${call.insights.churn_score.toFixed(1)}`}>🔴</span>
                          )}
                          {call.insights && call.insights.revenue_interest_score !== undefined && call.insights.revenue_interest_score !== null && call.insights.revenue_interest_score >= 0.8 && (
                            <span className="text-xs" title={`Revenue Interest: ${call.insights.revenue_interest_score.toFixed(1)}`}>💰</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(call.status)}`}>
                            {call.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        {call.duration_seconds ? (
                          <p className="text-gray-400">
                            <span className="font-medium">Duration:</span> {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                          </p>
                        ) : (
                          <p className="text-gray-500 text-xs italic">Duration: N/A</p>
                        )}
                        <p className="text-gray-400">
                          <span className="font-medium">Created:</span> {new Date(call.created_at).toLocaleDateString()} {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {call.insights && call.insights.topics && call.insights.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {call.insights.topics.slice(0, 3).map((topic, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-gray-700/50 text-gray-300 rounded text-xs"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
                      <div className="text-xs text-gray-400">
                        Showing {startIndex + 1}-{Math.min(endIndex, totalCalls)} of {totalCalls}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Prev
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
                                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                    currentPage === page
                                      ? 'bg-primary-500 text-white'
                                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                              return <span key={page} className="text-gray-500 text-xs">...</span>;
                            }
                            return null;
                          })}
                        </div>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                  <span className="text-4xl mb-3 block">📞</span>
                  <p className="text-gray-400 text-sm">No calls found</p>
                </div>
              )}
            </div>

            {/* Call Details Panel - Right Side */}
            <div className="lg:sticky lg:top-4 h-fit">
              {selectedCall ? (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span>📋</span>
                    Call Details
                  </h2>
                  
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                      <span>ℹ️</span>
                      Call Information
                    </h3>
                    <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">Phone:</span>
                        <span className="text-white text-xs font-medium">{selectedCall.phone_number}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">Status:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(selectedCall.status)}`}>
                          {selectedCall.status}
                        </span>
                      </div>
                      {selectedCall.duration_seconds ? (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-xs">Duration:</span>
                          <span className="text-white text-xs font-medium">
                            {Math.floor(selectedCall.duration_seconds / 60)}m {selectedCall.duration_seconds % 60}s
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-xs">Duration:</span>
                          <span className="text-gray-500 text-xs italic">N/A</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">Created:</span>
                        <span className="text-white text-xs">{new Date(selectedCall.created_at).toLocaleDateString()} {new Date(selectedCall.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transcript */}
                  {selectedCall.raw_transcript && (
                    <div>
                      <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                        <span>📝</span>
                        Transcript
                      </h3>
                      <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-3 max-h-64 overflow-y-auto">
                        <p className="text-gray-300 text-xs whitespace-pre-wrap leading-relaxed">
                          {selectedCall.raw_transcript}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Custom Instructions & Answers */}
                  {selectedCall.custom_instructions && selectedCall.custom_instructions.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                        <span>📋</span>
                        Custom Instructions & Results
                      </h3>
                      <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-3 space-y-3">
                      {selectedCall.custom_instructions.map((instruction, index) => {
                        const result = insights?.custom_instruction_answers?.[instruction];
                        // Handle both formats: object with type/answer/followed/summary OR simple string answer
                        const answer = typeof result === 'string' ? result : result?.answer;
                        const followed = result?.followed;
                        const summary = result?.summary;
                        const isQuestion = result?.type === 'question' || (typeof result === 'string' || result?.answer);
                        const isInstruction = result?.type === 'instruction' || (result?.followed !== undefined);
                        
                        return (
                          <div key={index} className="border-b border-gray-700 last:border-b-0 pb-2.5 last:pb-0">
                            <div className="mb-1.5">
                              <span className="text-xs font-medium text-primary-300">📋 {isQuestion ? 'Question' : 'Instruction'}:</span>
                              <p className="text-xs text-gray-300 mt-0.5">{instruction}</p>
                            </div>
                            
                            {/* Show answer if it exists (for questions or simple string format) */}
                            {answer && (
                              <div className="mt-1.5">
                                <span className="text-xs font-medium text-green-300">💬 Member's Answer:</span>
                                <p className="text-xs text-gray-200 mt-0.5">{answer}</p>
                              </div>
                            )}
                            
                            {/* Show followed status and summary for instructions */}
                            {isInstruction && (
                              <div className="mt-1.5 space-y-1">
                                {followed !== undefined && followed !== null && (
                                <div className="flex items-center gap-2">
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
                              <div className="mt-1.5">
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

                  {/* Insights */}
                  {insights && (
                    <div>
                      <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                        <span>🤖</span>
                        AI Insights
                      </h3>
                      
                      <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-3 space-y-3">
                        {/* Sentiment */}
                        <div>
                          <span className="text-xs font-medium text-gray-400 block mb-1">Sentiment</span>
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${
                            insights.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                            insights.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {insights.sentiment}
                          </span>
                        </div>

                        {/* Gym Rating */}
                        {(insights.gym_rating || (selectedCall.insights && selectedCall.insights.gym_rating)) && (
                          <div>
                            <span className="text-xs font-medium text-gray-400 block mb-1">Gym Rating</span>
                            <div className="flex items-center gap-2">
                              <div className={`text-xl font-bold ${
                                (insights.gym_rating || selectedCall.insights?.gym_rating) >= 8 ? 'text-green-400' :
                                (insights.gym_rating || selectedCall.insights?.gym_rating) >= 5 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {insights.gym_rating || selectedCall.insights?.gym_rating}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                    <span
                                      key={star}
                                      className={`text-xs ${
                                        star <= (insights.gym_rating || selectedCall.insights?.gym_rating)
                                          ? (insights.gym_rating || selectedCall.insights?.gym_rating) >= 8 ? 'text-green-400' :
                                            (insights.gym_rating || selectedCall.insights?.gym_rating) >= 5 ? 'text-yellow-400' :
                                            'text-red-400'
                                          : 'text-gray-600'
                                      }`}
                                    >
                                      {star <= (insights.gym_rating || selectedCall.insights?.gym_rating) ? '★' : '☆'}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Topics */}
                        {insights.topics && insights.topics.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-400 block mb-1">Topics</span>
                            <div className="flex flex-wrap gap-1">
                              {insights.topics.map((topic, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded text-xs">
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pain Points */}
                        {insights.pain_points && insights.pain_points.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-400 block mb-1">Pain Points</span>
                            <ul className="list-disc list-inside text-gray-300 text-xs space-y-0.5">
                              {insights.pain_points.map((point, idx) => (
                                <li key={idx}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Opportunities */}
                        {insights.opportunities && insights.opportunities.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-400 block mb-1">Opportunities</span>
                            <ul className="list-disc list-inside text-gray-300 text-xs space-y-0.5">
                              {insights.opportunities.map((opp, idx) => (
                                <li key={idx}>{opp}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Churn Interest */}
                      {insights.churn_score !== undefined && insights.churn_score !== null && insights.churn_score >= 0.8 && (
                        <div className="mt-3">
                          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2">
                            <p className="text-orange-400 text-xs font-semibold mb-1">⚠️ Churn Risk: {insights.churn_score.toFixed(1)}</p>
                            {insights.churn_interest_quote && insights.churn_score >= 0.7 && (
                              <p className="text-orange-300 text-xs italic">"{insights.churn_interest_quote}"</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Revenue Interest */}
                      {insights.revenue_interest_score !== undefined && insights.revenue_interest_score !== null && insights.revenue_interest_score >= 0.8 && (
                        <div className="mt-3">
                          <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-2">
                            <p className="text-primary-400 text-xs font-semibold mb-1">💰 Revenue Interest: {insights.revenue_interest_score.toFixed(1)}</p>
                            {insights.revenue_interest_quote && insights.revenue_interest_score >= 0.7 && (
                              <p className="text-primary-300 text-xs italic">"{insights.revenue_interest_quote}"</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Confidence */}
                      {insights.confidence !== undefined && insights.confidence !== null && (
                        <div className="mt-3">
                          <span className="text-xs font-medium text-gray-400 block mb-1">Confidence</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
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

                      {/* Anomaly Score */}
                      {((insights && insights.anomaly_score !== undefined && insights.anomaly_score !== null && insights.anomaly_score >= 0.8) || 
                        (selectedCall.insights && selectedCall.insights.anomaly_score !== undefined && selectedCall.insights.anomaly_score !== null && selectedCall.insights.anomaly_score >= 0.8)) && (
                        <div className="mt-3">
                          <span className="text-xs font-medium text-gray-400 block mb-1">Anomaly Score</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full transition-all bg-orange-500"
                                style={{ width: `${((insights?.anomaly_score || selectedCall.insights?.anomaly_score) || 0) * 100}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-orange-400">
                                {(insights?.anomaly_score || selectedCall.insights?.anomaly_score || 0).toFixed(2)}
                              </span>
                              <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium border border-orange-500/30">
                                Anomaly
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Extracted At */}
                      {(insights.extracted_at || (selectedCall.insights && selectedCall.insights.extracted_at)) && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <span className="text-xs font-medium text-gray-400 block mb-0.5">Analysis Date</span>
                          <span className="text-white text-xs">
                            {new Date(insights.extracted_at || selectedCall.insights.extracted_at).toLocaleDateString()} {new Date(insights.extracted_at || selectedCall.insights.extracted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                  <span className="text-4xl mb-3 block">📋</span>
                  <p className="text-gray-400 text-sm">Select a call to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

