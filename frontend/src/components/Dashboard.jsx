import { useState, useEffect } from 'react';
import { callsAPI } from '../api/api';
import FilteredCallsModal from './FilteredCallsModal';

export default function Dashboard({ setCurrentPage }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterModal, setFilterModal] = useState({
    isOpen: false,
    type: null,
    value: null,
    label: '',
    callId: null
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await callsAPI.getDashboardSummary();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-4 px-6 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalSentiment = summary.sentiment.positive + summary.sentiment.neutral + summary.sentiment.negative;

  const openFilterModal = (type, value, label, callId = null) => {
    setFilterModal({ isOpen: true, type, value, label, callId });
  };

  const closeFilterModal = () => {
    setFilterModal({ isOpen: false, type: null, value: null, label: '', callId: null });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Member feedback insights and analytics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Calls */}
        <div 
          onClick={() => setCurrentPage('calls')}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 cursor-pointer hover:bg-gray-800 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Calls</span>
            <span className="text-2xl">📞</span>
          </div>
          <p className="text-3xl font-bold text-white">{summary.total_calls}</p>
        </div>

        {/* Positive Sentiment */}
        <div 
          onClick={() => openFilterModal('sentiment', 'positive', `Positive Sentiment Calls (${summary.sentiment.positive})`)}
          className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 cursor-pointer hover:bg-green-500/20 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Positive</span>
            <span className="text-2xl">😊</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{summary.sentiment.positive}</p>
          {totalSentiment > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              {Math.round((summary.sentiment.positive / totalSentiment) * 100)}%
            </p>
          )}
        </div>

        {/* Negative Sentiment */}
        <div 
          onClick={() => openFilterModal('sentiment', 'negative', `Negative Sentiment Calls (${summary.sentiment.negative})`)}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 cursor-pointer hover:bg-red-500/20 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Negative</span>
            <span className="text-2xl">😞</span>
          </div>
          <p className="text-3xl font-bold text-red-400">{summary.sentiment.negative}</p>
          {totalSentiment > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              {Math.round((summary.sentiment.negative / totalSentiment) * 100)}%
            </p>
          )}
        </div>

        {/* Revenue Opportunities */}
        <div 
          onClick={() => openFilterModal('revenue_interest', true, `Revenue Opportunity Calls (${summary.revenue_opportunities})`)}
          className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-6 cursor-pointer hover:bg-primary-500/20 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Opportunities</span>
            <span className="text-2xl">💰</span>
          </div>
          <p className="text-3xl font-bold text-primary-400">{summary.revenue_opportunities}</p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pain Points */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>🎯</span>
            Top Pain Points
          </h2>
          {summary.top_pain_points && summary.top_pain_points.length > 0 ? (
            <div className="space-y-3">
              {summary.top_pain_points.map((point, index) => (
                <div 
                  key={index} 
                  onClick={() => openFilterModal('pain_point', point.name, `Pain Point: ${point.name} (${point.count} calls)`)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-all"
                >
                  <span className="text-gray-300">{point.name}</span>
                  <span className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm font-medium">
                    {point.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No pain points detected yet</p>
          )}
        </div>

        {/* High Interest Quotes */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>💬</span>
            High Interest Quotes
          </h2>
          {summary.high_interest_quotes && summary.high_interest_quotes.length > 0 ? (
            <div className="space-y-4">
              {summary.high_interest_quotes.map((quote, index) => (
                <div 
                  key={index} 
                  onClick={() => openFilterModal('call_id', quote.call_id, `Call: ${quote.phone_number}`, quote.call_id)}
                  className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-800/50 transition-all"
                >
                  <p className="text-gray-300 text-sm mb-2 italic">"{quote.quote}"</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded ${
                      quote.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                      quote.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {quote.sentiment}
                    </span>
                    <span className="text-xs text-gray-500">{quote.phone_number}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No quotes available yet</p>
          )}
        </div>
      </div>

      {/* Filtered Calls Modal */}
      <FilteredCallsModal
        isOpen={filterModal.isOpen}
        onClose={closeFilterModal}
        filterType={filterModal.type}
        filterValue={filterModal.value}
        filterLabel={filterModal.label}
        specificCallId={filterModal.callId}
      />
    </div>
  );
}
